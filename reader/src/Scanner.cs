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
    /// <summary>Share of the scanned memory that could not be read (0..1).</summary>
    public double UnreadFraction;
    public bool FromSnapshot;
    public long ElapsedMs;
    /// <summary>Class-offset histogram (largest first), for diagnostics and re-pinning.</summary>
    public List<(int offset, long count)> ClassHistogram = new();
    public List<string> Log = new();
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
    private Fields F = Fields.All[0];

    // Read buffers, one per worker.
    private static readonly byte[][] BufPool = new byte[MemScan.MaxWorkers][];

    public Scanner(GameProcess game, DatabaseChoice db, Action<string, double> progress)
    {
        _game = game;
        _db = db;
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
        return second;
    }

    private ScanResult RunOnce(bool useSnapshot, out bool retryWithSnapshot)
    {
        retryWithSnapshot = false;
        var sw = Stopwatch.StartNew();
        var result = new ScanResult();
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
        try
        {
            result.FromSnapshot = mem.Snapshotted;
            if (useSnapshot)
                Log(mem.Snapshotted ? "Retry reads from a frozen memory snapshot (VA clone)." : $"Snapshot unavailable ({mem.SnapshotError ?? "unknown"}): retry reads live memory.");
            if (mem.ImageNote != null) Log(mem.ImageNote);
            if (mem.GaBase == 0) throw new ScanException(ScanError.NotLoaded, "GameAssembly.dll not found. Is Football Manager fully loaded?");
            DetectGameVersion(mem, result);
            // game_plugin.dll (the native database) loads while FM starts up. A scan before that is
            // guaranteed to be empty, so stop instead of producing an empty file.
            if (mem.GpBase == 0) throw new ScanException(ScanError.NotLoaded, "Football Manager is still starting up (the game database is not loaded yet). Load your save, then try again.");

            Scan(mem, maxDop, result, sw, out double unread);
            result.UnreadFraction = unread;
            if (!useSnapshot && unread > 0.10)
            {
                Log($"{Math.Round(unread * 100)}% of the memory regions could not be read live: retrying from a snapshot.");
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

    // Per-thread collections for the parallel scan: each worker fills its own without locks.
    private sealed class ScanLocal
    {
        public readonly Dictionary<uint, Person> Players = new();
        public readonly Dictionary<uint, Person> Staff = new();
        public readonly Dictionary<int, long> Hist = new();
        public readonly List<(ulong obj, ulong person)> Managers = new();
        public readonly Dictionary<ulong, uint> PersonToUid = new();
        public readonly List<ulong> Clubs = new();
    }

    private void Scan(MemScan mem, int maxDop, ScanResult result, Stopwatch sw, out double unreadFraction)
    {
        ulong totalBytes = 0;
        foreach (var r in mem.ScanRegions) totalBytes += r.size;
        long doneBytes = 0, unreadBytes = 0, lastProgressMs = 0, regionErrors = 0;
        string firstRegionError = null;
        ulong modLo = mem.ModLo, modHi = mem.ModHi;
        object progressLock = new();
        var regions = mem.ScanRegions.Where(r => r.size >= 0x40).ToList();
        int chunk = MemScan.ChunkBytes;

        // N workers, each a round-robin share of the regions (sizes vary a lot, interleaving balances).
        var locals = new ScanLocal[maxDop];
        var tasks = new Task[maxDop];
        for (int t = 0; t < maxDop; t++)
        {
            int worker = t;
            var L = locals[worker] = new ScanLocal();
            tasks[worker] = Task.Run(() =>
            {
                var buf = BufPool[worker];
                for (int ri = worker; ri < regions.Count; ri += maxDop)
                {
                    var (start, size) = regions[ri];
                    ulong scanned = 0;
                    try
                    {
                        while (scanned < size)
                        {
                            int want = (int)Math.Min((ulong)chunk, size - scanned);
                            ulong chunkBase = start + scanned;
                            if (!mem.ReadBlock(chunkBase, buf, want))
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
                            ScanChunk(mem, buf, want, chunkBase, modLo, modHi, L);
                            // Windows overlap by 16 bytes, so an object starting right at a chunk
                            // border is not missed. Seeing it twice is harmless (UIDs de-duplicate).
                            int step = (ulong)want < size - scanned ? want - 16 : want;
                            scanned += (ulong)step;
                            long done = Interlocked.Add(ref doneBytes, step);
                            long now = sw.ElapsedMilliseconds;
                            if (now - Interlocked.Read(ref lastProgressMs) >= 500 && totalBytes > 0 && Monitor.TryEnter(progressLock))
                            {
                                try { lastProgressMs = now; _progress("scanning", 0.85 * done / totalBytes); }
                                finally { Monitor.Exit(progressLock); }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        // One region with unexpected content must never sink the whole scan.
                        long rest = (long)(size - scanned);
                        Interlocked.Add(ref doneBytes, rest);
                        Interlocked.Add(ref unreadBytes, rest);
                        Interlocked.Increment(ref regionErrors);
                        Interlocked.CompareExchange(ref firstRegionError, ex.Message, null);
                    }
                }
            });
        }
        Task.WaitAll(tasks);
        if (regionErrors > 0) result.Log.Add($"{regionErrors} region(s) skipped after an internal error (first: {firstRegionError}); the rest of the scan went on.");

        var players = new Dictionary<uint, Person>();
        var staff = new Dictionary<uint, Person>();
        var hist = new Dictionary<int, long>();
        var managers = new List<(ulong obj, ulong person)>();
        var personToUid = new Dictionary<ulong, uint>(1 << 17);
        var clubObjs = new List<ulong>();
        foreach (var L in locals)
        {
            foreach (var kv in L.Players) players.TryAdd(kv.Key, kv.Value);
            foreach (var kv in L.Staff) staff.TryAdd(kv.Key, kv.Value);
            foreach (var kv in L.PersonToUid) personToUid[kv.Key] = kv.Value;
            foreach (var kv in L.Hist) hist[kv.Key] = hist.GetValueOrDefault(kv.Key) + kv.Value;
            managers.AddRange(L.Managers);
            clubObjs.AddRange(L.Clubs);
        }
        unreadFraction = totalBytes > 0 ? (double)Interlocked.Read(ref unreadBytes) / totalBytes : 0;
        if (unreadFraction > 0) result.Log.Add($"Unreadable during the scan: {unreadFraction:P1} of {totalBytes / (1024 * 1024):N0} MB.");
        result.ClassHistogram = hist.OrderByDescending(kv => kv.Value).Select(kv => (kv.Key, kv.Value)).ToList();
        _progress("linking", 0.87);

        var squadClub = WalkSquads(mem, players, personToUid, clubObjs, managers, result);
        foreach (var p in players.Values)
            if (squadClub.TryGetValue(p.Uid, out var sc))
            { p.Club = sc.club; if (sc.rep > 0) p.ClubRep = sc.rep; if (sc.div != null) p.Division = sc.div; p.TeamType = sc.tt; }

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
        foreach (var pl in players.Values)
            if (pl.BirthYear is >= 1990 and <= 2100) byYear[pl.BirthYear] = byYear.GetValueOrDefault(pl.BirthYear) + 1;
        int youngest = byYear.Where(kv => kv.Value >= 30).Select(kv => kv.Key).DefaultIfEmpty(0).Max();
        result.GameYear = youngest > 0 ? youngest + 16 : DateTime.Now.Year;
        FindGameDate(mem, myTeam, result);
        var today = result.GameDate ?? new DateTime(result.GameYear, DateTime.Now.Month, Math.Min(DateTime.Now.Day, 28));
        foreach (var p in players.Values.Concat(staff.Values)) p.Age = Decode.AgeAt(p.BirthYear, p.BirthDoy, today);

        // Every person also has a staff facet, so almost every player was also picked up as staff.
        // Real staff (coaches, scouts, physios) have no player facet and stay.
        int staffRaw = staff.Count;
        foreach (var uid in staff.Keys.Where(players.ContainsKey).ToList()) staff.Remove(uid);
        result.Log.Add($"Found {players.Count:N0} players and {staff.Count:N0} staff ({staffRaw - staff.Count:N0} staff entries were players).");

        result.Players = players.Values.ToList();
        result.Staff = staff.Values.ToList();
    }

    private void ScanChunk(MemScan mem, byte[] buf, int want, ulong chunkBase, ulong modLo, ulong modHi, ScanLocal L)
    {
        for (int i = 0; i + 0x10 <= want; i += 8)
        {
            ulong vt = BitConverter.ToUInt64(buf, i);
            if (vt < modLo || vt >= modHi) continue;            // fast rejection
            if (!mem.InGp(vt) && !mem.InGa(vt)) continue;       // only database/managed vtables

            ulong p = chunkBase + (ulong)i;
            var cls = mem.Classify(vt, F);                      // cached: no syscall per candidate
            if (cls == null) continue;
            long uidAt = i + F.OBJ_DUNI;
            uint uid = uidAt + 4 <= want ? BitConverter.ToUInt32(buf, (int)uidAt) : mem.U32(p + F.OBJ_DUNI);
            if (uid == 0 || uid == 0xFFFFFFFF) continue;
            if (cls.Hist != 0) L.Hist[cls.Hist] = L.Hist.GetValueOrDefault(cls.Hist) + 1;
            if (cls.Kind == ObjKind.None)
            {
                if (IsClub(mem, p)) L.Clubs.Add(p);
                continue;
            }

            ulong block = p + (ulong)cls.BlockOff;               // player or staff block
            ulong person = p;
            if (cls.Kind == ObjKind.Player)
            {
                ushort ca = mem.U16(block + F.PLAO_CA), pa = mem.U16(block + F.PLAO_PA);
                if (ca < 1 || ca > 200 || pa < 1 || pa > 200) continue;
                bool female = (mem.U8(p + F.PERO_GENDER) & F.GENDER_FEMALE_BIT) != 0;
                if (female ? _db == DatabaseChoice.Men : _db == DatabaseChoice.Women) continue;
                if (L.Players.ContainsKey(uid)) continue;
                L.Players[uid] = ReadPlayer(mem, person, block, uid, ca, pa, female);
                L.PersonToUid[p] = uid;
                L.PersonToUid[block] = uid;
            }
            else
            {
                ushort ca = mem.U16(block + F.NPLO_CA), pa = mem.U16(block + F.NPLO_PA);
                if (ca < 1 || ca > 200 || pa < 1 || pa > 200) continue;
                if (cls.Kind == ObjKind.HumanManager) L.Managers.Add((p, person));
                if (!L.Staff.ContainsKey(uid)) L.Staff[uid] = ReadStaff(mem, person, block, uid, ca, pa);
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

    /// <summary>A club object: a team vector of 1..64 teams and a readable name.</summary>
    private bool IsClub(MemScan m, ulong p)
    {
        ulong tb = m.Ptr(p + F.CLUB_TEAMS_BEGIN), te = m.Ptr(p + F.CLUB_TEAMS_END);
        return tb != 0 && te > tb && (te - tb) % 8 == 0 && (te - tb) / 8 is >= 1 and <= 64 && ClubNameOf(m, p) != null;
    }

    private string ClubNameOf(MemScan m, ulong club)
    {
        if (club == 0) return null;
        string name = m.IndirectString(club + F.CLUB_NAME) ?? m.IndirectString(club + F.CLUB_SHORT_NAME);
        return Decode.PlausibleName(name) ? name : null;
    }

    /// <summary>
    /// Link players to the club whose squad they are in: clubs found by shape during the scan, then
    /// the clubs on players' contracts. Squad entries are not always person pointers, so an entry is
    /// also probed for a pointer field that points at a known person (upstream, 15-07-2026).
    /// </summary>
    private Dictionary<uint, (string club, int tt, int rep, string div)> WalkSquads(
        MemScan mem, Dictionary<uint, Person> players, Dictionary<ulong, uint> personToUid,
        List<ulong> shapeClubs, List<(ulong obj, ulong person)> managers, ScanResult result)
    {
        var squad = new Dictionary<uint, (string club, int tt, int rep, string div)>();
        var managerAddrs = new HashSet<ulong>(managers.SelectMany(x => new[] { x.obj, x.person }));
        var contractClubs = new HashSet<ulong>();
        foreach (var p in players.Values)
        {
            ulong con = mem.Ptr(p.PersonAddr + F.PERO_FULL_CONTRACT);
            ulong team = con == 0 ? 0 : mem.Ptr(con + F.CON_TEAM);
            ulong club = team == 0 ? 0 : mem.Ptr(team + F.TEAM_CLUB);
            if (club != 0) contractClubs.Add(club);
        }

        foreach (ulong club in shapeClubs.Concat(contractClubs).Distinct())
        {
            string cname = ClubNameOf(mem, club);
            if (cname == null) continue;
            ulong tb = mem.Ptr(club + F.CLUB_TEAMS_BEGIN), te = mem.Ptr(club + F.CLUB_TEAMS_END);
            if (tb == 0 || te <= tb || (te - tb) % 8 != 0 || (te - tb) / 8 > 64) continue;
            for (ulong ti = 0; ti < (te - tb) / 8; ti++)
            {
                ulong team = mem.Ptr(tb + ti * 8);
                if (team == 0) continue;
                int tt = mem.U8(team + F.TEAM_TYPE);
                int trep = mem.U16(team + F.TEAM_REP);
                if (trep is < 0 or > 12000) trep = 0;
                ulong mgr = mem.Ptr(team + F.TEAM_MANAGER);
                if (mgr != 0 && managerAddrs.Contains(mgr) && (result.MyClub == null || tt == 0)) result.MyClub = cname;
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
                    PickSquad(squad, players, uid, cname, tt, trep, div);
                }
            }
        }
        result.Log.Add($"Squad walk: {squad.Count:N0} players linked to clubs.");
        return squad;
    }

    /// <summary>
    /// Which squad wins for a player. Within one club: the highest team (lowest team type). Across two
    /// clubs the player is on loan, and the club that is not the contract owner is where he plays.
    /// </summary>
    private static void PickSquad(Dictionary<uint, (string club, int tt, int rep, string div)> squad,
                                  Dictionary<uint, Person> players, uint uid, string cname, int tt, int trep, string div)
    {
        players.TryGetValue(uid, out var pe);
        string owner = pe?.OwnerClub;
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

internal enum ScanError { NotRunning = 2, NoAccess = 4, NotLoaded = 5, NothingFound = 6, TooMuchUnread = 7, Busy = 3 }

internal sealed class ScanException : Exception
{
    public ScanError Code { get; }
    public ScanException(ScanError code, string message) : base(message) { Code = code; }
}
