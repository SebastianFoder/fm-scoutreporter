using System.Diagnostics;

namespace ScoutReporter.Reader;

/// <summary>Which half of the database to keep.</summary>
internal enum DatabaseChoice { Men, Women, Both }

/// <summary>Everything one scan found, ready for <see cref="DumpWriter"/>.</summary>
internal sealed class ScanResult
{
    public List<Person> Players = new();
    public List<Person> Staff = new();
    public string Game;
    public string GameVersion;
    public string SupportedVersion;
    public bool VersionOk;
    public DateTime? GameDate;       // from my team's fixture schedule; null = not found
    public int GameYear;
    public string Manager;
    public string MyClub;
    /// <summary>Players and staff in FM's search result at scan time; 0 = no search found.</summary>
    public int SearchPlayers, SearchStaff;
    /// <summary>
    /// Everyone the scan found. A search scan reads only the people it keeps, so Players and Staff
    /// can hold fewer.
    /// </summary>
    public int FoundPlayers, FoundStaff;
    /// <summary>Only FM's search result and your own club were kept (see KeepSearchOnly).</summary>
    public bool SearchOnly;
    /// <summary>Share of the scanned memory that could not be read (0..1).</summary>
    public double UnreadFraction;
    public bool FromSnapshot;
    public long ElapsedMs;
    /// <summary>How long each step of the scan took, in order (see <see cref="StepTimer"/>).</summary>
    public List<(string step, long ms)> Timings = new();
    /// <summary>Class-offset histogram (largest first), for diagnostics and re-pinning.</summary>
    public List<(int offset, long count)> ClassHistogram = new();
    public List<string> Log = new();
    /// <summary>Player object and player block addresses, to UID (for the probe-lists experiment).</summary>
    public Dictionary<ulong, uint> PersonToUid = new();

    /// <summary>
    /// Drop everyone who is neither in FM's search result nor at your own club (playing there, or
    /// owned by it and out on loan). This turns a scan of the whole database into an export of the
    /// search on screen: the club stays so the Squad and Best XI screens keep working.
    /// </summary>
    public void KeepSearchOnly()
    {
        int players = Math.Max(Players.Count, FoundPlayers), staff = Math.Max(Staff.Count, FoundStaff);
        bool Mine(Person p) => MyClub != null && (p.Club == MyClub || p.OwnerClub == MyClub);
        Players = Players.Where(p => p.InSearch || Mine(p)).ToList();
        Staff = Staff.Where(s => s.InSearch || Mine(s)).ToList();
        SearchOnly = true;
        Log.Add($"Kept FM's search result and your club: {Players.Count:N0} of {players:N0} players, {Staff.Count:N0} of {staff:N0} staff.");
    }
}

/// <summary>
/// Finds every player and staff member in fm.exe's memory. Adapted from FMSuperScout's Dumper
/// (MIT): the scan walks FM's private heap in parallel, recognises database objects by their
/// vtable's class offset, reads players and staff, then links players to clubs through the squad
/// lists and reads the in-game date from the human manager's team.
/// </summary>
internal sealed class Scanner
{
    private readonly GameProcess _game;
    private readonly DatabaseChoice _db;
    private readonly Action<string, double> _progress;
    private readonly bool _onlySearch;
    /// <summary>Developer option (--force-retry): retry from a snapshot even when memory read fine.</summary>
    public bool ForceRetry { get; init; }
    private Fields F = Fields.All[0];
    /// <summary>Vtable of FM's person search session (0 = not found), see Fields.SEARCH_*.</summary>
    private ulong _searchVt;

    // Read buffers, one per worker.
    private static readonly byte[][] BufPool = new byte[MemScan.MaxWorkers][];

    /// <param name="onlySearch">
    /// Read only the people a search scan keeps (FM's search result and your club, see
    /// <see cref="ScanResult.KeepSearchOnly"/>). Everyone is still found: the search needs that.
    /// </param>
    public Scanner(GameProcess game, DatabaseChoice db, Action<string, double> progress, bool onlySearch = false)
    {
        _game = game;
        _db = db;
        _onlySearch = onlySearch;
        _progress = progress ?? ((_, _) => { });
    }

    /// <summary>
    /// Scan live first (fast, no extra memory pressure). Only when more than 10% of the regions could
    /// not be read is there one automatic retry from a frozen snapshot (VA clone), so nobody pays the
    /// snapshot's cost unless it is needed.
    /// </summary>
    public ScanResult Run()
    {
        var first = RunOnce(useSnapshot: false, out bool retry);
        if (!retry) return first;
        var second = RunOnce(useSnapshot: true, out _);
        second.Log.InsertRange(0, first.Log);
        second.Timings.Insert(0, ("first try", first.ElapsedMs));
        return second;
    }

    private ScanResult RunOnce(bool useSnapshot, out bool retryWithSnapshot)
    {
        retryWithSnapshot = false;
        var sw = Stopwatch.StartNew();
        var result = new ScanResult();
        var steps = new StepTimer(result.Timings);
        void Log(string s) => result.Log.Add(s);

        var (availPhys, availCommit, memLoad) = MemScan.MemoryStatus();
        const ulong MB = 1024 * 1024;
        if (availPhys != 0) Log($"Memory: {availPhys / MB:N0} MB physical free, {availCommit / MB:N0} MB commit free, load {memLoad}%");

        // At most MaxWorkers: each worker holds a 32 MB buffer, and beyond ~8 ReadProcessMemory is the
        // bottleneck, not the CPU. With little free memory, fewer workers: slower, but it does not fail.
        int maxDop = Math.Clamp(Environment.ProcessorCount - 1, 1, MemScan.MaxWorkers);
        if (availPhys != 0 && availPhys < 2048 * MB && maxDop > 2)
        {
            maxDop = 2;
            Log($"Little memory free ({availPhys / MB:N0} MB): scanning with 2 workers.");
        }
        for (int t = 0; t < maxDop; t++)
            BufPool[t] ??= GC.AllocateUninitializedArray<byte>(MemScan.ChunkBytes, pinned: true);

        var mem = new MemScan(_game, useSnapshot);
        steps.Lap("open");
        try
        {
            result.FromSnapshot = mem.Snapshotted;
            if (useSnapshot)
                Log(mem.Snapshotted ? "Retry reads from a frozen memory snapshot (VA clone)." : $"Snapshot unavailable ({mem.SnapshotError ?? "unknown"}): retry reads live memory.");
            if (mem.ImageNote != null) Log(mem.ImageNote);
            Log("Opening: " + mem.OpenTimings);
            if (mem.GaBase == 0) throw new ScanException(ScanError.NotLoaded, "GameAssembly.dll not found. Is Football Manager fully loaded?");
            DetectGameVersion(mem, result);
            // game_plugin.dll (the native database) loads while FM starts up. A scan before that is
            // guaranteed to be empty, so stop instead of producing an empty file.
            if (mem.GpBase == 0) throw new ScanException(ScanError.NotLoaded, "Football Manager is still starting up (the game database is not loaded yet). Load your save, then try again.");

            var searchVts = mem.GamePluginVtables(Fields.SEARCH_SESSION_TYPE);
            _searchVt = searchVts.Count > 0 ? searchVts[0] : 0;
            if (searchVts.Count != 1) Log($"FM's search class was found {searchVts.Count} times (expected once): {(searchVts.Count == 0 ? "search results are not read" : "using the first")}.");
            steps.Lap("version");

            Scan(mem, maxDop, result, sw, steps, out double unread);
            result.UnreadFraction = unread;
            if (!useSnapshot && (unread > 0.10 || ForceRetry))
            {
                Log(ForceRetry ? "--force-retry: retrying from a snapshot."
                               : $"{Math.Round(unread * 100)}% of the memory regions could not be read live: retrying from a snapshot.");
                retryWithSnapshot = true;
            }
            result.ElapsedMs = sw.ElapsedMilliseconds;
            return result;
        }
        finally { mem.ReleaseSnapshot(); }
    }

    private void DetectGameVersion(MemScan mem, ScanResult result)
    {
        F = Fields.All[0];
        result.VersionOk = false;
        try
        {
            var (version, major, minor) = mem.GameVersionInfo();
            result.GameVersion = version;
            if (!string.IsNullOrEmpty(version))
            {
                (F, result.VersionOk) = Fields.Resolve(major, minor);
                result.Log.Add($"game_plugin.dll {version}: layout {F.Game}, pinned on {F.SupportedVersion}.x ({(result.VersionOk ? "ok" : "DIFFERENT VERSION")})");
            }
        }
        catch (Exception e) { result.Log.Add("Version detection failed: " + e.Message); }
        result.Game = F.Game;
        result.SupportedVersion = F.SupportedVersion;
    }

    /// <summary>
    /// One person the scan pass found: where the object is, and the values the pass checked from
    /// the copied memory. Reading the person (name, attributes, contract...) happens afterwards.
    /// </summary>
    internal struct Found
    {
        public ulong Obj;      // the person object
        public ulong Block;    // its player or staff block
        public uint Uid;
        public ushort Ca, Pa;
        public bool Female;
        public ulong Contract; // the person's contract (0 = none)
        public uint Dob;       // raw FM birth date
    }

    /// <summary>
    /// What the pass found in one piece of memory, in the order it met it. Workers take pieces from a
    /// shared queue, so which worker reads which piece varies; the pieces are merged in a fixed order
    /// instead (see Scan), so the result does not depend on it. Lists are made when first needed.
    /// </summary>
    private sealed class PieceFinds
    {
        public List<Found> Players, Staff;
        public List<(ulong obj, ulong person)> Managers;
        public List<(ulong addr, uint uid)> StaffAddrs;
        public List<ulong> Clubs, SearchSessions;
    }

    /// <summary>Per worker: the class histogram and where its time went (Stopwatch ticks), for the log.</summary>
    private sealed class WorkerStats
    {
        public readonly Dictionary<int, long> Hist = new();
        public long CopyTicks, CheckTicks, Objects, ClubChecks;
    }

    /// <summary>
    /// The scan works in two steps. The pass copies FM's heap in big blocks and only notes the people
    /// in it (UID, address, CA/PA, contract, birth date), taken from the copied memory: almost no
    /// extra reads. Reading each person's fields comes after, in <see cref="ReadPeople"/>, and only
    /// for the people the scan keeps.
    /// </summary>
    private void Scan(MemScan mem, int maxDop, ScanResult result, Stopwatch sw, StepTimer steps, out double unreadFraction)
    {
        ulong totalBytes = 0;
        foreach (var r in mem.ScanRegions) totalBytes += r.size;
        long doneBytes = 0, unreadBytes = 0, lastProgressMs = 0, regionErrors = 0;
        string firstRegionError = null;
        ulong modLo = mem.ModLo, modHi = mem.ModHi;
        object progressLock = new();
        var regions = mem.ScanRegions.Where(r => r.size >= 0x40).ToList();
        int chunk = MemScan.ChunkBytes;

        // The regions cut into pieces of at most one block. Consecutive pieces of a region overlap by
        // 16 bytes, so an object starting right at a border is not missed (seeing it twice is
        // harmless: UIDs de-duplicate).
        var pieces = new List<(int region, ulong start, ulong size)>();
        for (int ri = 0; ri < regions.Count; ri++)
        {
            var (start, size) = regions[ri];
            for (ulong off = 0; ; off += (ulong)chunk - 16)
            {
                ulong len = Math.Min((ulong)chunk, size - off);
                pieces.Add((ri, start + off, len));
                if (off + len >= size) break;
            }
        }
        var finds = new PieceFinds[pieces.Count];
        var stats = new WorkerStats[maxDop];
        int nextPiece = -1;

        var tasks = new Task[maxDop];
        for (int t = 0; t < maxDop; t++)
        {
            int worker = t;
            var W = stats[worker] = new WorkerStats();
            tasks[worker] = Task.Run(() =>
            {
                MemScan.BypassPageCache = true;   // the pass reads from its own copied blocks
                var buf = BufPool[worker];
                for (int pi = Interlocked.Increment(ref nextPiece); pi < pieces.Count; pi = Interlocked.Increment(ref nextPiece))
                {
                    var (_, start, size) = pieces[pi];
                    var P = finds[pi] = new PieceFinds();
                    ulong scanned = 0;
                    try
                    {
                        while (scanned < size)
                        {
                            int want = (int)Math.Min((ulong)chunk, size - scanned);
                            ulong chunkBase = start + scanned;
                            long t0 = Stopwatch.GetTimestamp();
                            bool copied = mem.ReadBlock(chunkBase, buf, want);
                            W.CopyTicks += Stopwatch.GetTimestamp() - t0;
                            if (!copied)
                            {
                                // One unreadable page must not cost 32 MB: try a 1 MB window. If that
                                // fails too, count it as unread (that count decides about the retry).
                                int fine = (int)Math.Min(1UL << 20, size - scanned);
                                if (want <= fine || !mem.ReadBlock(chunkBase, buf, fine))
                                {
                                    scanned += (ulong)fine;
                                    Interlocked.Add(ref doneBytes, fine);
                                    Interlocked.Add(ref unreadBytes, fine);
                                    continue;
                                }
                                want = fine;
                            }
                            long t1 = Stopwatch.GetTimestamp();
                            ScanChunk(mem, buf, want, chunkBase, modLo, modHi, P, W);
                            W.CheckTicks += Stopwatch.GetTimestamp() - t1;
                            int step = (ulong)want < size - scanned ? want - 16 : want;
                            scanned += (ulong)step;
                            long done = Interlocked.Add(ref doneBytes, step);
                            long now = sw.ElapsedMilliseconds;
                            if (now - Interlocked.Read(ref lastProgressMs) >= 500 && totalBytes > 0 && Monitor.TryEnter(progressLock))
                            {
                                try { lastProgressMs = now; _progress("memory", FindShare * done / totalBytes); }
                                finally { Monitor.Exit(progressLock); }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        // One piece with unexpected content must never sink the whole scan.
                        long rest = (long)(size - scanned);
                        Interlocked.Add(ref doneBytes, rest);
                        Interlocked.Add(ref unreadBytes, rest);
                        Interlocked.Increment(ref regionErrors);
                        Interlocked.CompareExchange(ref firstRegionError, ex.Message, null);
                    }
                }
                MemScan.BypassPageCache = false;   // pool threads are reused: reading people wants the cache
            });
        }
        Task.WaitAll(tasks);
        if (regionErrors > 0) result.Log.Add($"{regionErrors} piece(s) of memory skipped after an internal error (first: {firstRegionError}); the rest of the scan went on.");
        steps.Lap("find");
        double perWorkerMs(long ticks) => ticks * 1000.0 / Stopwatch.Frequency / maxDop;
        result.Log.Add($"Find pass ({maxDop} workers, average per worker): copying {perWorkerMs(stats.Sum(w => w.CopyTicks)):N0} ms, " +
                       $"checking {perWorkerMs(stats.Sum(w => w.CheckTicks)):N0} ms; {stats.Sum(w => w.Objects):N0} database objects, " +
                       $"{stats.Sum(w => w.ClubChecks):N0} club checks.");

        // Merge in a fixed order: as if region r had been read by "lane" r % maxDop, lanes one after
        // the other. Within a lane the first object for a UID counts and later copies are dropped;
        // across lanes the first lane's object wins, but every lane's address still maps to the UID
        // (squad lists may point at either). This keeps which object is read for a UID stable.
        var order = Enumerable.Range(0, pieces.Count).OrderBy(i => pieces[i].region % maxDop).ThenBy(i => i).ToList();
        var lanePlayers = Enumerable.Range(0, maxDop).Select(_ => new HashSet<uint>()).ToArray();
        var laneStaff = Enumerable.Range(0, maxDop).Select(_ => new HashSet<uint>()).ToArray();
        var foundPlayers = new List<Found>();
        var foundStaff = new List<Found>();
        var playerUids = new HashSet<uint>();
        var staffUids = new HashSet<uint>();
        var hist = new Dictionary<int, long>();
        var managers = new List<(ulong obj, ulong person)>();
        var personToUid = new Dictionary<ulong, uint>(1 << 17);
        var clubObjs = new List<ulong>();
        var staffToUid = new Dictionary<ulong, uint>(1 << 17);
        var searchSessions = new HashSet<ulong>();
        foreach (int pi in order)
        {
            var P = finds[pi];
            if (P == null) continue;
            int lane = pieces[pi].region % maxDop;
            if (P.StaffAddrs != null) foreach (var (addr, uid) in P.StaffAddrs) staffToUid[addr] = uid;
            if (P.SearchSessions != null) searchSessions.UnionWith(P.SearchSessions);
            if (P.Players != null)
                foreach (var f in P.Players)
                {
                    if (!lanePlayers[lane].Add(f.Uid)) continue;
                    if (playerUids.Add(f.Uid)) foundPlayers.Add(f);
                    personToUid[f.Obj] = f.Uid;
                    personToUid[f.Block] = f.Uid;
                }
            if (P.Staff != null)
                foreach (var f in P.Staff)
                    if (laneStaff[lane].Add(f.Uid) && staffUids.Add(f.Uid)) foundStaff.Add(f);
            if (P.Managers != null) managers.AddRange(P.Managers);
            if (P.Clubs != null) clubObjs.AddRange(P.Clubs);
        }
        foreach (var W in stats)
            foreach (var kv in W.Hist) hist[kv.Key] = hist.GetValueOrDefault(kv.Key) + kv.Value;
        result.PersonToUid = personToUid;
        unreadFraction = totalBytes > 0 ? (double)Interlocked.Read(ref unreadBytes) / totalBytes : 0;
        if (unreadFraction > 0) result.Log.Add($"Unreadable during the scan: {unreadFraction:P1} of {totalBytes / (1024 * 1024):N0} MB.");
        result.ClassHistogram = hist.OrderByDescending(kv => kv.Value).Select(kv => (kv.Key, kv.Value)).ToList();

        // Every person also has a staff facet, so a player can be picked up as staff too. Real staff
        // (coaches, scouts, physios) have no player facet and stay; the others are not read as staff.
        int staffRaw = foundStaff.Count;
        foundStaff.RemoveAll(f => playerUids.Contains(f.Uid));
        staffUids.ExceptWith(playerUids);
        result.FoundPlayers = foundPlayers.Count;
        result.FoundStaff = foundStaff.Count;
        steps.Lap("merge");

        // Each player's contract club (the owner), from the contract pointer the pass took along.
        // The squad walk needs it for every player (loans), so it is read for all of them.
        var clubNames = new ClubNames(this, mem);
        var ownerClub = ContractClubs(mem, foundPlayers, maxDop);
        var owners = new Dictionary<uint, string>(foundPlayers.Count);
        var contractClubs = new HashSet<ulong>();
        for (int i = 0; i < foundPlayers.Count; i++)
        {
            owners[foundPlayers[i].Uid] = clubNames.Name(ownerClub[i]);
            if (ownerClub[i] != 0) contractClubs.Add(ownerClub[i]);
        }
        steps.Lap("contracts");
        _progress("clubs", 0.40);

        var squadClub = WalkSquads(mem, owners, personToUid, clubObjs, contractClubs, managers, result, maxDop);
        steps.Lap("squads");

        // The human manager's team (person -> contract -> team): source of the in-game date.
        ulong myTeam = 0;
        foreach (var mg in managers)
        {
            ulong con = mem.Ptr(mg.person + F.PERO_FULL_CONTRACT);
            ulong team = con == 0 ? 0 : mem.Ptr(con + F.CON_TEAM);
            if (team == 0) continue;
            myTeam = team;
            if (result.MyClub == null) result.MyClub = ClubNameOf(mem, mem.Ptr(team + F.TEAM_CLUB));
            if (result.Manager == null) result.Manager = ReadName(mem, mg.person);
            break;
        }

        // The current season year from the data: every youth intake adds a big cohort of 16-year-olds,
        // so the latest birth year with a large cohort, plus 16, is about the in-game year.
        var byYear = new Dictionary<int, int>();
        foreach (var f in foundPlayers)
        {
            int year = Decode.FmDate(f.Dob).year;
            if (year is >= 1990 and <= 2100) byYear[year] = byYear.GetValueOrDefault(year) + 1;
        }
        int youngest = byYear.Where(kv => kv.Value >= 30).Select(kv => kv.Key).DefaultIfEmpty(0).Max();
        result.GameYear = youngest > 0 ? youngest + 16 : DateTime.Now.Year;
        FindGameDate(mem, myTeam, result);
        var today = result.GameDate ?? new DateTime(result.GameYear, DateTime.Now.Month, Math.Min(DateTime.Now.Day, 28));
        result.Log.Add($"Found {foundPlayers.Count:N0} players and {foundStaff.Count:N0} staff ({staffRaw - foundStaff.Count:N0} staff entries were players).");
        steps.Lap("date");

        var (searchPlayers, searchStaff) = ReadSearchResults(mem, searchSessions, personToUid, staffToUid, playerUids, staffUids, result);
        steps.Lap("search");

        // Who to read: everyone, or for a search scan only the people it keeps (KeepSearchOnly): the
        // search result and your club. A player is at your club when he plays there (squad walk) or
        // it owns him; a staff member when his contract is with it.
        var readPlayers = foundPlayers;
        var readStaff = foundStaff;
        if (_onlySearch)
        {
            string mine = result.MyClub;
            bool Mine(string club, string owner) => mine != null && (club == mine || owner == mine);
            readPlayers = foundPlayers.Where(f =>
            {
                string owner = owners[f.Uid];
                string club = squadClub.TryGetValue(f.Uid, out var sq) ? sq.club : owner;
                return searchPlayers.Contains(f.Uid) || Mine(club, owner);
            }).ToList();
            var staffClub = ContractClubs(mem, foundStaff, maxDop);
            readStaff = foundStaff.Where((f, i) => searchStaff.Contains(f.Uid) || Mine(clubNames.Name(staffClub[i]), null)).ToList();
            result.Log.Add($"Search scan: reading {readPlayers.Count:N0} players and {readStaff.Count:N0} staff.");
            steps.Lap("pick");
        }

        var players = ReadPeople(readPlayers, maxDop, 0.45, 0.80, result,
            f => ReadPlayer(mem, f.Obj, f.Block, f.Uid, f.Ca, f.Pa, f.Female));
        var staff = ReadPeople(readStaff, maxDop, 0.80, 0.85, result,
            f => ReadStaff(mem, f.Obj, f.Block, f.Uid, f.Ca, f.Pa));
        foreach (var p in players.Values)
        {
            if (squadClub.TryGetValue(p.Uid, out var sc))
            { p.Club = sc.club; if (sc.rep > 0) p.ClubRep = sc.rep; if (sc.div != null) p.Division = sc.div; p.TeamType = sc.tt; }
            p.InSearch = searchPlayers.Contains(p.Uid);
        }
        foreach (var s in staff.Values) s.InSearch = searchStaff.Contains(s.Uid);
        foreach (var p in players.Values.Concat(staff.Values)) p.Age = Decode.AgeAt(p.BirthYear, p.BirthDoy, today);
        result.SearchPlayers = searchPlayers.Count;
        result.SearchStaff = searchStaff.Count;

        result.Players = players.Values.ToList();
        result.Staff = staff.Values.ToList();
        steps.Lap("read people");
    }

    /// <summary>
    /// The club on each found person's contract (contract -> team -> club), 0 when there is none, in
    /// the order of `found`. Teams repeat a lot, so each team's club is read once.
    /// </summary>
    private ulong[] ContractClubs(MemScan mem, List<Found> found, int maxDop)
    {
        var clubs = new ulong[found.Count];
        var teamClub = new System.Collections.Concurrent.ConcurrentDictionary<ulong, ulong>();
        Parallel.For(0, found.Count, new ParallelOptions { MaxDegreeOfParallelism = maxDop }, i =>
        {
            ulong con = found[i].Contract;
            ulong team = con == 0 ? 0 : mem.Ptr(con + F.CON_TEAM);
            if (team == 0) return;
            clubs[i] = teamClub.GetOrAdd(team, t => mem.Ptr(t + F.TEAM_CLUB));
        });
        return clubs;
    }

    /// <summary>Club names by club object, each read once (ClubNameOf, null for no club).</summary>
    private sealed class ClubNames
    {
        private readonly Scanner _s;
        private readonly MemScan _mem;
        private readonly System.Collections.Concurrent.ConcurrentDictionary<ulong, string> _names = new();
        public ClubNames(Scanner s, MemScan mem) { _s = s; _mem = mem; }
        public string Name(ulong club) => club == 0 ? null : _names.GetOrAdd(club, c => _s.ClubNameOf(_mem, c));
    }

    /// <summary>Progress share of the scan pass; reading the people found takes it up to 0.85.</summary>
    private const double FindShare = 0.30;

    /// <summary>
    /// Read every found person (in parallel: each field is a ReadProcessMemory call, so this is where
    /// most of a full scan's time goes). The result keeps the order of `found`. A person whose read
    /// throws is left out and counted, so one odd object never sinks the scan.
    /// </summary>
    private Dictionary<uint, Person> ReadPeople(List<Found> found, int maxDop, double from, double to, ScanResult result, Func<Found, Person> read)
    {
        var people = new Person[found.Count];
        long done = 0, errors = 0, lastProgressMs = 0;
        string firstError = null;
        var clock = Stopwatch.StartNew();
        object progressLock = new();
        Parallel.For(0, found.Count, new ParallelOptions { MaxDegreeOfParallelism = maxDop }, i =>
        {
            try { people[i] = read(found[i]); }
            catch (Exception ex)
            {
                Interlocked.Increment(ref errors);
                Interlocked.CompareExchange(ref firstError, ex.Message, null);
            }
            long n = Interlocked.Increment(ref done);
            long now = clock.ElapsedMilliseconds;
            if (now - Interlocked.Read(ref lastProgressMs) >= 500 && Monitor.TryEnter(progressLock))
            {
                try { lastProgressMs = now; _progress("people", from + (to - from) * n / found.Count); }
                finally { Monitor.Exit(progressLock); }
            }
        });
        if (errors > 0) result.Log.Add($"{errors:N0} people skipped after an internal error (first: {firstError}).");
        var byUid = new Dictionary<uint, Person>(found.Count);
        foreach (var p in people)
            if (p != null) byUid.TryAdd(p.Uid, p);
        return byUid;
    }

    // Values the scan pass reads from the copied block when they lie inside it (`at` is the index in
    // `buf`, `addr` the same place in FM's memory), and from FM's memory otherwise.
    internal static byte BufU8(byte[] buf, int len, long at, MemScan mem, ulong addr) =>
        at >= 0 && at + 1 <= len ? buf[at] : mem.U8(addr);

    internal static ushort BufU16(byte[] buf, int len, long at, MemScan mem, ulong addr) =>
        at >= 0 && at + 2 <= len ? BitConverter.ToUInt16(buf, (int)at) : mem.U16(addr);

    internal static uint BufU32(byte[] buf, int len, long at, MemScan mem, ulong addr) =>
        at >= 0 && at + 4 <= len ? BitConverter.ToUInt32(buf, (int)at) : mem.U32(addr);

    internal static ulong BufPtr(byte[] buf, int len, long at, MemScan mem, ulong addr) =>
        at >= 0 && at + 8 <= len ? BitConverter.ToUInt64(buf, (int)at) : mem.Ptr(addr);

    /// <summary>
    /// The people in FM's search result (the Player Search or Staff Search screen, after its filters
    /// such as "Player's interest"), as UIDs. Each session object holds a vector of entry pointers;
    /// an entry starts with a pointer to the person. With several lists of a kind, the longest wins.
    /// A list where fewer than 90% of the entries are people we know is something else: ignored.
    /// </summary>
    private (HashSet<uint> players, HashSet<uint> staff) ReadSearchResults(MemScan mem, HashSet<ulong> sessions,
        Dictionary<ulong, uint> personToUid, Dictionary<ulong, uint> staffToUid, HashSet<uint> players, HashSet<uint> staff, ScanResult result)
    {
        List<uint> bestPlayers = null, bestStaff = null;
        foreach (ulong session in sessions)
        {
            ulong begin = mem.Ptr(session + F.SEARCH_LIST), end = mem.Ptr(session + F.SEARCH_LIST + 8);
            if (begin == 0 || end <= begin || (end - begin) % 8 != 0 || end - begin > 8UL * 2_000_000) continue;
            int n = (int)((end - begin) / 8);
            var slots = new byte[n * 8];
            if (!mem.ReadBlock(begin, slots, slots.Length)) continue;
            var foundPlayers = new List<uint>();
            var foundStaff = new List<uint>();
            for (int i = 0; i < n; i++)
            {
                ulong entry = BitConverter.ToUInt64(slots, i * 8);
                if (entry < 0x10000) continue;
                ulong person = mem.Ptr(entry + F.SEARCH_ENTRY_PERSON);
                if (!personToUid.TryGetValue(person, out uint uid) && !staffToUid.TryGetValue(person, out uid)) continue;
                if (players.Contains(uid)) foundPlayers.Add(uid);
                else if (staff.Contains(uid)) foundStaff.Add(uid);
            }
            if (foundPlayers.Count + foundStaff.Count < n * 0.9)
            {
                result.Log.Add($"A search list of {n:N0} entries was ignored: only {foundPlayers.Count + foundStaff.Count:N0} are known people.");
                continue;
            }
            if (foundPlayers.Count >= foundStaff.Count) { if (foundPlayers.Count > (bestPlayers?.Count ?? 0)) bestPlayers = foundPlayers; }
            else if (foundStaff.Count > (bestStaff?.Count ?? 0)) bestStaff = foundStaff;
        }
        var inPlayers = new HashSet<uint>(bestPlayers ?? new());
        var inStaff = new HashSet<uint>(bestStaff ?? new());
        if (inPlayers.Count > 0 || inStaff.Count > 0)
            result.Log.Add($"FM search result: {inPlayers.Count:N0} players, {inStaff.Count:N0} staff.");
        return (inPlayers, inStaff);
    }

    private void ScanChunk(MemScan mem, byte[] buf, int want, ulong chunkBase, ulong modLo, ulong modHi, PieceFinds L, WorkerStats W)
    {
        for (int i = 0; i + 0x10 <= want; i += 8)
        {
            ulong vt = BitConverter.ToUInt64(buf, i);
            if (vt < modLo || vt >= modHi) continue;            // fast rejection
            if (!mem.InGp(vt) && !mem.InGa(vt)) continue;       // only database/managed vtables
            if (vt == _searchVt) { (L.SearchSessions ??= new()).Add(chunkBase + (ulong)i); continue; }

            ulong p = chunkBase + (ulong)i;
            var cls = mem.Classify(vt, F);                      // cached: no syscall per candidate
            if (cls == null) continue;
            W.Objects++;
            long uidAt = i + F.OBJ_DUNI;
            uint uid = uidAt + 4 <= want ? BitConverter.ToUInt32(buf, (int)uidAt) : mem.U32(p + F.OBJ_DUNI);
            if (uid == 0 || uid == 0xFFFFFFFF) continue;
            if (cls.Hist != 0) W.Hist[cls.Hist] = W.Hist.GetValueOrDefault(cls.Hist) + 1;
            if (cls.Kind == ObjKind.None)
            {
                W.ClubChecks++;
                if (IsClub(mem, buf, want, i, p)) (L.Clubs ??= new()).Add(p);
                continue;
            }

            // The player or staff block, as an address and as an index into the copied block.
            ulong block = p + (ulong)cls.BlockOff;
            long blockAt = i + cls.BlockOff;
            if (cls.Kind == ObjKind.Player)
            {
                ushort ca = BufU16(buf, want, blockAt + F.PLAO_CA, mem, block + F.PLAO_CA);
                ushort pa = BufU16(buf, want, blockAt + F.PLAO_PA, mem, block + F.PLAO_PA);
                if (ca < 1 || ca > 200 || pa < 1 || pa > 200) continue;
                bool female = (BufU8(buf, want, i + F.PERO_GENDER, mem, p + F.PERO_GENDER) & F.GENDER_FEMALE_BIT) != 0;
                if (female ? _db == DatabaseChoice.Men : _db == DatabaseChoice.Women) continue;
                (L.Players ??= new()).Add(new Found
                {
                    Obj = p, Block = block, Uid = uid, Ca = ca, Pa = pa, Female = female,
                    Contract = BufPtr(buf, want, i + F.PERO_FULL_CONTRACT, mem, p + F.PERO_FULL_CONTRACT),
                    Dob = BufU32(buf, want, i + F.PERO_DOB, mem, p + F.PERO_DOB),
                });
            }
            else
            {
                ushort ca = BufU16(buf, want, blockAt + F.NPLO_CA, mem, block + F.NPLO_CA);
                ushort pa = BufU16(buf, want, blockAt + F.NPLO_PA, mem, block + F.NPLO_PA);
                if (ca < 1 || ca > 200 || pa < 1 || pa > 200) continue;
                if (cls.Kind == ObjKind.HumanManager) (L.Managers ??= new()).Add((p, p));
                (L.Staff ??= new()).Add(new Found
                {
                    Obj = p, Block = block, Uid = uid, Ca = ca, Pa = pa,
                    Contract = BufPtr(buf, want, i + F.PERO_FULL_CONTRACT, mem, p + F.PERO_FULL_CONTRACT),
                });
                (L.StaffAddrs ??= new()).Add((p, uid));
                L.StaffAddrs.Add((block, uid));
            }
        }
    }

    // ---------- players ----------

    private Person ReadPlayer(MemScan m, ulong person, ulong pl, uint uid, ushort ca, ushort pa, bool female)
    {
        var e = new Person { Uid = uid, Ca = ca, Pa = pa, IsPlayer = true, PersonAddr = person, Gender = female ? 1 : 0 };
        ReadCommon(m, person, e);
        e.Height = m.U16(pl + F.PLAO_HEIGHT);
        if (e.Height is < 140 or > 220) e.Height = 0;

        foreach (var (key, off) in Fields.PlayerAttrs) e.Attributes[key] = Decode.Attribute(m.U8(pl + F.PLAO_ATTRS + (ulong)off));
        foreach (var (key, off) in Fields.PlayerHiddenAttrs) e.Hidden[key] = Decode.Attribute(m.U8(pl + F.PLAO_ATTRS + (ulong)off));
        e.FootLeft = Decode.Attribute(m.U8(pl + F.PLAO_ATTRS + Fields.FOOT_LEFT));
        e.FootRight = Decode.Attribute(m.U8(pl + F.PLAO_ATTRS + Fields.FOOT_RIGHT));
        foreach (var (key, off) in Fields.Positions)
        {
            int v = m.U8(pl + F.PLAO_POSITIONS + (ulong)off);
            if (v is >= 1 and <= 20) e.Positions[key] = v;
        }

        // 0x234 is FM's transfer value (verified upstream against in-game amounts); 0x238 the asking price.
        e.Value = Decode.MoneyValue(m.U32(pl + F.PLAO_VALUE));
        e.AskingPrice = Decode.Money(m.U32(pl + F.PLAO_ASKING_PRICE));
        ulong con = m.Ptr(person + F.PERO_FULL_CONTRACT);
        if (con != 0)
        {
            byte flags = m.U8(con + F.CON_STATUS_FLAGS);
            e.Listed = (flags & (1 << 0)) != 0 || (flags & (1 << 3)) != 0;
            e.LoanListed = (flags & (1 << 1)) != 0;   // not verified in game yet
            e.NotForSale = (flags & (1 << 4)) != 0;
            e.SetForRelease = (flags & (1 << 5)) != 0;
        }
        e.CurRep = m.U16(pl + F.PLAO_CUR_REP);
        e.WorldRep = m.U16(pl + F.PLAO_WORLD_REP);
        // The contract's club is the owner. For loaned players it differs from where they play now;
        // the squad walk overwrites Club with the current club.
        e.OwnerClub = e.Club;
        return e;
    }

    // ---------- staff ----------

    private Person ReadStaff(MemScan m, ulong person, ulong st, uint uid, ushort ca, ushort pa)
    {
        var e = new Person { Uid = uid, Ca = ca, Pa = pa, IsPlayer = false, PersonAddr = person };
        e.Gender = (m.U8(person + F.PERO_GENDER) & F.GENDER_FEMALE_BIT) != 0 ? 1 : 0;
        ReadCommon(m, person, e);
        foreach (var (key, off) in Fields.StaffAttrs)
        {
            byte raw = m.U8(st + F.NPLO_ATTRS + (ulong)off);
            e.StaffAttributes[key] = Fields.StaffAttrsRaw.Contains(key) ? Decode.Raw20(raw) : Decode.Attribute(raw);
        }
        // FM27 shows staff Adaptability under Mental; it is the personality value (raw 1-20).
        if (e.Adaptability > 0) e.StaffAttributes["adaptability"] = e.Adaptability;

        ulong con = m.Ptr(person + F.PERO_FULL_CONTRACT);
        if (con != 0)
        {
            e.JobId = m.U8(con + F.CON_JOB);
            e.Job = Decode.JobName(e.JobId);
        }
        e.CurRep = Rep(m.U16(st + F.NPLO_CUR_REP));
        e.WorldRep = Rep(m.U16(st + F.NPLO_WORLD_REP));
        ulong prefs = m.Ptr(person + F.PERO_JOB_PREFS);
        if (prefs != 0)
        {
            var table = new byte[Fields.JobPrefGroups];
            if (m.ReadBlock(prefs, table, table.Length)) (e.PreferredJobs, e.JobPreferences) = Decode.JobPreferences(table);
        }
        return e;
    }

    private static int Rep(int v) => v is >= 1 and <= 10000 ? v : 0;

    /// <summary>Name, birth date, nationality, contract (wage, expiry, club) and personality.</summary>
    private void ReadCommon(MemScan m, ulong person, Person e)
    {
        e.Name = ReadName(m, person);
        (e.BirthYear, e.BirthDoy) = Decode.FmDate(m.U32(person + F.PERO_DOB));
        ulong nat = m.Ptr(person + F.PERO_NATION);
        if (nat != 0)
        {
            e.Nationality = m.IndirectString(nat + F.NATION_SHORT_NAME) ?? m.IndirectString(nat + F.NATION_NAME);
            uint id = m.U32(nat + F.OBJ_DUNI);
            e.NationId = id == 0xFFFFFFFF ? 0 : id;
        }
        ulong con = m.Ptr(person + F.PERO_FULL_CONTRACT);
        if (con != 0)
        {
            e.Wage = Decode.Money(m.U32(con + F.CON_WEEKLY_WAGE));
            e.ContractExpires = Decode.FmDateIso(m.U32(con + F.CON_EXPIRY), minYear: 2000);
        }
        var (club, rep, div) = ResolveClub(m, person);
        e.Club = club; e.ClubRep = rep; e.Division = div;
        e.Ambition = Decode.Raw20(m.U8(person + F.PERO_AMBITION));
        e.Loyalty = Decode.Raw20(m.U8(person + F.PERO_LOYALTY));
        e.Professionalism = Decode.Raw20(m.U8(person + F.PERO_PROFESSIONALISM));
        e.Adaptability = Decode.Raw20(m.U8(person + F.PERO_ADAPTABILITY));
        e.Pressure = Decode.Raw20(m.U8(person + F.PERO_PRESSURE));
        e.Sportsmanship = Decode.Raw20(m.U8(person + F.PERO_SPORTSMANSHIP));
        e.Temperament = Decode.Raw20(m.U8(person + F.PERO_TEMPERAMENT));
        e.Controversy = Decode.Raw20(m.U8(person + F.PERO_CONTROVERSY));
    }

    private string ReadName(MemScan m, ulong person)
    {
        string common = m.NestedString(person + F.PERO_COMMON_NAME);
        if (!string.IsNullOrEmpty(common)) return common;
        string first = m.NestedString(person + F.PERO_FIRST_NAME);
        string second = m.NestedString(person + F.PERO_SECOND_NAME);
        string name = string.Join(" ", new[] { first, second }.Where(s => !string.IsNullOrEmpty(s)));
        return name.Length == 0 ? null : name;
    }

    // ---------- clubs ----------

    /// <summary>Club through the contract chain: contract [person+0xA8] -> team [+0x10] -> club [+0x30].</summary>
    private (string name, int rep, string div) ResolveClub(MemScan m, ulong person)
    {
        ulong con = m.Ptr(person + F.PERO_FULL_CONTRACT);
        if (con == 0) return (null, 0, null);
        ulong team = m.Ptr(con + F.CON_TEAM);
        if (team == 0) return (null, 0, null);
        int rep = m.U16(team + F.TEAM_REP);
        if (rep is < 0 or > 12000) rep = 0;
        ulong club = m.Ptr(team + F.TEAM_CLUB);
        return (club == 0 ? null : ClubNameOf(m, club), rep, CompNameOf(m, team));
    }

    /// <summary>
    /// A team's competition: the full name first (the short name drops the country for unlicensed
    /// leagues), the short name as a fallback.
    /// </summary>
    private string CompNameOf(MemScan m, ulong team)
    {
        foreach (uint off in new[] { F.TEAM_COMP, F.TEAM_COMP_ALT })
        {
            ulong comp = m.Ptr(team + off);
            if (comp == 0) continue;
            string s = m.IndirectString(comp + F.COMP_NAME);
            if (!Decode.PlausibleName(s)) s = m.IndirectString(comp + F.COMP_SHORT_NAME);
            if (Decode.PlausibleName(s)) return s;
        }
        return null;
    }

    /// <summary>
    /// A club object: a team vector of 1..64 teams and a readable name. The vector comes from the
    /// copied block (`at` is the object's index in `buf`) when it lies inside it.
    /// </summary>
    private bool IsClub(MemScan m, byte[] buf, int len, long at, ulong p)
    {
        ulong tb = BufPtr(buf, len, at + F.CLUB_TEAMS_BEGIN, m, p + F.CLUB_TEAMS_BEGIN);
        ulong te = BufPtr(buf, len, at + F.CLUB_TEAMS_END, m, p + F.CLUB_TEAMS_END);
        return tb != 0 && te > tb && (te - tb) % 8 == 0 && (te - tb) / 8 is >= 1 and <= 64 && ClubNameOf(m, p) != null;
    }

    internal string ClubNameOf(MemScan m, ulong club)
    {
        if (club == 0) return null;
        string name = m.IndirectString(club + F.CLUB_NAME) ?? m.IndirectString(club + F.CLUB_SHORT_NAME);
        return Decode.PlausibleName(name) ? name : null;
    }

    /// <summary>
    /// Link players to the club whose squad they are in: clubs found by shape during the scan, then
    /// the clubs on players' contracts. Squad entries are not always person pointers, so an entry is
    /// also probed for a pointer field that points at a known person (upstream, 15-07-2026).
    /// The clubs are read in parallel; what each one holds is then applied in club order, so ties
    /// between squads are settled as they always were.
    /// </summary>
    private Dictionary<uint, (string club, int tt, int rep, string div)> WalkSquads(
        MemScan mem, Dictionary<uint, string> owners, Dictionary<ulong, uint> personToUid,
        List<ulong> shapeClubs, HashSet<ulong> contractClubs, List<(ulong obj, ulong person)> managers, ScanResult result, int maxDop)
    {
        var squad = new Dictionary<uint, (string club, int tt, int rep, string div)>();
        var managerAddrs = new HashSet<ulong>(managers.SelectMany(x => new[] { x.obj, x.person }));

        var clubs = shapeClubs.Concat(contractClubs).Distinct().ToList();
        var perClub = new List<SquadEvent>[clubs.Count];
        Parallel.For(0, clubs.Count, new ParallelOptions { MaxDegreeOfParallelism = maxDop }, ci =>
            perClub[ci] = ReadClubSquads(mem, clubs[ci], personToUid, managerAddrs));
        foreach (var events in perClub)
        {
            if (events == null) continue;
            foreach (var e in events)
            {
                if (e.Manager) { if (result.MyClub == null || e.Tt == 0) result.MyClub = e.Club; }
                else PickSquad(squad, owners, e.Uid, e.Club, e.Tt, e.Rep, e.Div);
            }
        }
        result.Log.Add($"Squad walk: {squad.Count:N0} players linked to clubs.");
        return squad;
    }

    /// <summary>One thing a club's teams hold: a squad entry, or the human manager managing a team.</summary>
    private readonly record struct SquadEvent(bool Manager, uint Uid, string Club, int Tt, int Rep, string Div);

    /// <summary>A club's squad entries and human-manager teams, in team order (null: not a club).</summary>
    private List<SquadEvent> ReadClubSquads(MemScan mem, ulong club, Dictionary<ulong, uint> personToUid, HashSet<ulong> managerAddrs)
    {
        var events = new List<SquadEvent>();
        string cname = ClubNameOf(mem, club);
        if (cname == null) return null;
        ulong tb = mem.Ptr(club + F.CLUB_TEAMS_BEGIN), te = mem.Ptr(club + F.CLUB_TEAMS_END);
        if (tb == 0 || te <= tb || (te - tb) % 8 != 0 || (te - tb) / 8 > 64) return null;
        for (ulong ti = 0; ti < (te - tb) / 8; ti++)
        {
            ulong team = mem.Ptr(tb + ti * 8);
            if (team == 0) continue;
            int tt = mem.U8(team + F.TEAM_TYPE);
            int trep = mem.U16(team + F.TEAM_REP);
            if (trep is < 0 or > 12000) trep = 0;
            ulong mgr = mem.Ptr(team + F.TEAM_MANAGER);
            if (mgr != 0 && managerAddrs.Contains(mgr)) events.Add(new SquadEvent(true, 0, cname, tt, 0, null));
            string div = CompNameOf(mem, team);
            ulong pb = mem.Ptr(team + F.TEAM_PLAYERS_BEGIN), pe = mem.Ptr(team + F.TEAM_PLAYERS_END);
            if (pb == 0 || pe <= pb || (pe - pb) % 8 != 0 || (pe - pb) / 8 > 200) continue;
            for (ulong pi = 0; pi < (pe - pb) / 8; pi++)
            {
                ulong entry = mem.Ptr(pb + pi * 8);
                if (entry == 0) continue;
                if (!personToUid.TryGetValue(entry, out uint uid))
                {
                    bool hit = false;
                    for (ulong off = 0; off <= 0x80 && !hit; off += 8)
                    {
                        ulong q = mem.Ptr(entry + off);
                        hit = q != 0 && personToUid.TryGetValue(q, out uid);
                    }
                    if (!hit) continue;
                }
                events.Add(new SquadEvent(false, uid, cname, tt, trep, div));
            }
        }
        return events;
    }

    /// <summary>
    /// Which squad wins for a player. Within one club: the highest team (lowest team type). Across two
    /// clubs the player is on loan, and the club that is not the contract owner is where he plays.
    /// </summary>
    private static void PickSquad(Dictionary<uint, (string club, int tt, int rep, string div)> squad,
                                  Dictionary<uint, string> owners, uint uid, string cname, int tt, int trep, string div)
    {
        string owner = owners.GetValueOrDefault(uid);
        if (!squad.TryGetValue(uid, out var cur)) { squad[uid] = (cname, tt, trep, div); return; }
        bool take;
        if (cur.club == cname) take = tt < cur.tt;
        else
        {
            bool curIsOwner = owner != null && cur.club == owner;
            bool newIsOwner = owner != null && cname == owner;
            take = curIsOwner == newIsOwner ? tt < cur.tt : curIsOwner;
        }
        if (take) squad[uid] = (cname, tt, trep, div);
    }

    /// <summary>
    /// The in-game date from my team's fixture schedule ([team+0xA0]+0x94): the next match date, so
    /// exactly "today" on match days and up to about two weeks ahead between matches. Upstream found no
    /// readable world clock, so this is the best available.
    /// </summary>
    private void FindGameDate(MemScan mem, ulong myTeam, ScanResult result)
    {
        result.GameDate = null;
        try
        {
            if (myTeam == 0) return;
            ulong sched = mem.Ptr(myTeam + F.TEAM_SCHEDULE);
            if (sched == 0) return;
            foreach (uint off in new[] { F.SCHED_NEXT_MATCH, F.SCHED_NEXT_MATCH_ALT })
            {
                var (y, d) = Decode.FmDate(mem.U32(sched + off));
                if (y < result.GameYear - 1 || y > result.GameYear + 1) continue;
                result.GameDate = new DateTime(y, 1, 1).AddDays(d - 1);
                result.GameYear = y;
                return;
            }
        }
        catch (Exception e) { result.Log.Add("Reading the in-game date failed: " + e.Message); }
    }
}

/// <summary>Times the steps of a scan: each Lap records the time since the previous one.</summary>
internal sealed class StepTimer
{
    private readonly Stopwatch _clock = Stopwatch.StartNew();
    private readonly List<(string step, long ms)> _into;
    private long _last;

    public StepTimer(List<(string step, long ms)> into) => _into = into;

    public void Lap(string step)
    {
        long now = _clock.ElapsedMilliseconds;
        _into.Add((step, now - _last));
        _last = now;
    }

    /// <summary>"open 120 ms, find 830 ms, ..." for logs.</summary>
    public static string Format(IEnumerable<(string step, long ms)> timings) =>
        string.Join(", ", timings.Select(t => string.Create(System.Globalization.CultureInfo.InvariantCulture, $"{t.step} {t.ms:N0} ms")));
}

internal enum ScanError { NotRunning = 2, NoAccess = 4, NotLoaded = 5, NothingFound = 6, TooMuchUnread = 7, NoSearch = 8, Busy = 3 }

internal sealed class ScanException : Exception
{
    public ScanError Code { get; }
    public ScanException(ScanError code, string message) : base(message) { Code = code; }
}
