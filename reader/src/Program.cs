using System.Diagnostics;

namespace ScoutReporter.Reader;

/// <summary>
/// ScoutReporter.Reader: reads the database of a running Football Manager 27 (or 26) from fm.exe's
/// memory, read-only, and writes it as a lines file (scan.ndjson, one JSON object per line) for the
/// Scout Reporter desktop app.
///
///   ScoutReporter.Reader.exe scan --out &lt;dir&gt; [--db men|women|both] [--only-search] [--previous-exists]
///
/// --only-search: keep only the people in FM's Player Search or Staff Search result, plus your own
/// club, instead of the whole database. Fails (no-search) when FM has no search result.
/// --previous-exists: the app already has a scan to fall back on, so a thinned-out scan (too much
/// memory unreadable) is refused rather than stored.
///
/// Developer commands (plain text, see reader/REPIN.md): probe-lists, probe-find, probe-chain,
/// probe-peek.
///   ScoutReporter.Reader.exe version
///
/// It reports on stdout as JSON lines, one object per line:
///   {"type":"progress","phase":"scanning","progress":0.42}
///   {"type":"log","message":"..."}
///   {"type":"done","file":"...","players":51234,"staff":12000,"versionOk":true,"game":"FM27","gameVersion":"27.0.1.0"}
///   {"type":"error","code":"not-running","message":"..."}
/// Exit codes: 0 done, 2 FM not running, 3 another scan is running, 4 no access (FM runs as
/// administrator), 5 save not loaded, 6 nothing found, 7 too much unreadable, 8 no search result
/// (with --only-search), 64 usage, 1 other.
///
/// It only ever asks Windows for read access to fm.exe; nothing is written to the game.
/// </summary>
internal static class Program
{
    private static readonly object OutLock = new();

    private static int Main(string[] args)
    {
        string mode = args.Length > 0 ? args[0].ToLowerInvariant() : "";
        try
        {
            return mode switch
            {
                "scan" => Scan(args),
                "probe-lists" => ProbeLists(args),
                "probe-find" => ProbeFind(args),
                "probe-chain" => ProbeChain(args),
                "probe-peek" => ProbePeek(args),
                "version" => PrintVersion(),
                _ => Usage(),
            };
        }
        catch (ScanException e)
        {
            Error(e.Code, e.Message);
            return (int)e.Code;
        }
        catch (Exception e)
        {
            Emit(w => { w.Prop("type", "error"); w.Prop("code", "failed"); w.Prop("message", "The scan failed: " + e.Message); });
            return 1;
        }
    }

    private static string ReaderVersion => typeof(Program).Assembly.GetName().Version?.ToString(3) ?? "0.0.0";

    private static int Usage()
    {
        Console.Error.WriteLine("Usage: ScoutReporter.Reader scan --out <dir> [--db men|women|both] [--only-search] [--previous-exists] | version");
        return 64;
    }

    private static int PrintVersion()
    {
        var supported = string.Join(", ", Fields.All.Select(f => $"{f.Game} {f.SupportedVersion}.x"));
        Emit(w => { w.Prop("type", "version"); w.Prop("version", ReaderVersion); w.Prop("supported", supported); });
        return 0;
    }

    private static string Arg(string[] args, string name)
    {
        int i = Array.IndexOf(args, name);
        return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
    }

    private static int Scan(string[] args)
    {
        string outDir = Arg(args, "--out");
        if (string.IsNullOrWhiteSpace(outDir)) return Usage();
        var db = (Arg(args, "--db") ?? "men").ToLowerInvariant() switch
        {
            "women" => DatabaseChoice.Women,
            "both" => DatabaseChoice.Both,
            _ => DatabaseChoice.Men,
        };
        Directory.CreateDirectory(outDir);
        string target = Path.Combine(outDir, DumpWriter.FileName);

        // One scan at a time.
        using var gate = new Mutex(false, @"Local\ScoutReporter-reader-scan");
        bool owned;
        try { owned = gate.WaitOne(0); }
        catch (AbandonedMutexException) { owned = true; }   // the previous holder crashed: take over
        if (!owned) throw new ScanException(ScanError.Busy, "A scan is already running.");
        try
        {
            using var fm = FindFm(out bool denied);
            if (fm == null)
            {
                // An fm.exe we may not open is almost always FM running as administrator.
                if (denied) throw new ScanException(ScanError.NoAccess, NoAccessMessage);
                throw new ScanException(ScanError.NotRunning, "Football Manager is not running. Start it, load your save and try again.");
            }
            GameProcess game;
            try { game = GameProcess.Open(fm); }
            catch (System.ComponentModel.Win32Exception e) when (e.NativeErrorCode == 5)
            {
                throw new ScanException(ScanError.NoAccess, NoAccessMessage);
            }
            using var _ = game;
            Log($"Scout Reporter reader {ReaderVersion}: fm.exe pid {fm.Id}");

            var result = new Scanner(game, db, Progress).Run();
            foreach (var line in result.Log) Log(line);
            try { WriteDiagnostics(Path.Combine(outDir, "diagnostics.txt"), result, ReaderVersion); }
            catch (Exception e) { Log("Could not write diagnostics.txt: " + e.Message); }   // best effort, but say so
            bool previous = File.Exists(target) || args.Contains("--previous-exists");
            bool onlySearch = args.Contains("--only-search");
            var (write, error, message) = DumpWriter.Check(result, previous, onlySearch);
            if (!write) throw new ScanException(error!.Value, message);
            if (onlySearch)
            {
                int before = result.Log.Count;
                result.KeepSearchOnly();
                foreach (var line in result.Log.Skip(before)) Log(line);
            }

            Progress("writing", 0.95);
            DumpWriter.WriteFile(target, result, ReaderVersion, db, DateTime.UtcNow);
            if (!result.VersionOk) Log(RepinHint(result));
            Emit(w =>
            {
                w.Prop("type", "done");
                w.Prop("file", target);
                w.Prop("players", result.Players.Count);
                w.Prop("staff", result.Staff.Count);
                w.Prop("versionOk", result.VersionOk);
                w.Prop("game", result.Game);
                w.Prop("gameVersion", result.GameVersion);
                w.Prop("elapsedMs", result.ElapsedMs);
            });
            return 0;
        }
        finally { gate.ReleaseMutex(); }
    }

    /// <summary>
    /// Experiment: list arrays in FM's memory that hold players (see Probe). Prints plain text, not
    /// JSON lines. `probe-lists [--min 1000]`.
    /// </summary>
    private static int ProbeLists(string[] args)
    {
        int min = int.TryParse(Arg(args, "--min"), out int m) ? m : 1000;
        using var fm = FindFm(out bool denied) ?? throw new ScanException(denied ? ScanError.NoAccess : ScanError.NotRunning, "Football Manager is not running.");
        using var game = GameProcess.Open(fm);
        var result = new Scanner(game, DatabaseChoice.Both, (_, _) => { }).Run();
        var byUid = result.Players.GroupBy(p => p.Uid).ToDictionary(g => g.Key, g => g.First());
        Console.WriteLine($"{result.Players.Count:N0} players, {result.PersonToUid.Count:N0} player addresses. Lists with at least {min:N0} players:");
        var first = Probe.Lists(game, result, min);
        // FM's full player list (the longest pointer list), to look for lists of positions in it.
        var full = first.FirstOrDefault(r => r.Kind == "pointer" && r.Stride == 8);
        uint[] indexToUid = null;
        var mem = new MemScan(game);
        if (full != null)
        {
            indexToUid = new uint[full.Length];
            for (int i = 0; i < full.Length; i++) indexToUid[i] = result.PersonToUid.GetValueOrDefault(mem.Ptr(full.Address + (ulong)(i * 8)));
        }
        var runs = Probe.Lists(game, result, min, indexToUid);
        foreach (var r in runs.Take(int.TryParse(Arg(args, "--top"), out int top) ? top : 40))
        {
            var ages = Probe.Entries(mem, r, indexToUid, result.PersonToUid).Select(u => byUid.TryGetValue(u, out var p) ? p.Age : -1).Where(a => a > 0).ToList();
            string ageRange = ages.Count > 0 ? $"ages {ages.Min()}-{ages.Max()}" : "ages ?";
            string sample = string.Join(", ", r.Sample.Select(u => byUid.TryGetValue(u, out var p) ? p.Name : u.ToString()));
            Console.WriteLine($"  {r.Length,8:N0}  {r.Kind,-7} every {r.Stride,2} bytes  at 0x{r.Address:X}  {ageRange,-11} {sample}");
        }
        Console.WriteLine($"{runs.Count:N0} lists found.");
        mem.ReleaseSnapshot();
        return 0;
    }

    /// <summary>
    /// Experiment: where FM's memory refers to the given players (e.g. the first rows of the player
    /// search on screen), and evenly spaced places where they appear in order (a table of rows).
    /// `probe-find --uids 1,2,3,4`.
    /// </summary>
    private static int ProbeFind(string[] args)
    {
        var targets = (Arg(args, "--uids") ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries).Select(uint.Parse).ToArray();
        if (targets.Length < 3) return Usage();
        using var fm = FindFm(out bool denied) ?? throw new ScanException(denied ? ScanError.NoAccess : ScanError.NotRunning, "Football Manager is not running.");
        using var game = GameProcess.Open(fm);
        var result = new Scanner(game, DatabaseChoice.Both, (_, _) => { }).Run();
        var byUid = result.Players.GroupBy(p => p.Uid).ToDictionary(g => g.Key, g => g.First());
        var mem = new MemScan(game);
        // FM's full player list (position to UID), as in probe-lists.
        var full = Probe.Lists(game, result, 300_000).FirstOrDefault(r => r.Kind == "pointer" && r.Stride == 8);
        uint[] indexToUid = null;
        if (full != null)
        {
            indexToUid = new uint[full.Length];
            for (int i = 0; i < full.Length; i++) indexToUid[i] = result.PersonToUid.GetValueOrDefault(mem.Ptr(full.Address + (ulong)(i * 8)));
        }
        var hits = Probe.Find(game, result, targets, indexToUid);
        foreach (var t in targets)
        {
            var h = hits[t];
            Console.WriteLine($"{t} ({(byUid.TryGetValue(t, out var p) ? p.Name : "?")}): {h.Count} hits ({string.Join(", ", h.GroupBy(x => x.Kind).Select(g => $"{g.Count()} {g.Key}"))})");
        }
        // Rows 1, 2, 3 (and 4) at an even spacing, same kind of reference.
        var a = hits[targets[0]];
        var bSet = hits[targets[1]].Select(x => (x.Address, x.Kind)).ToHashSet();
        var cSet = hits[targets[2]].Select(x => (x.Address, x.Kind)).ToHashSet();
        int found = 0;
        foreach (var x in a)
            foreach (var y in hits[targets[1]].Where(y => y.Kind == x.Kind && y.Address > x.Address && y.Address - x.Address <= 4096))
            {
                ulong stride = y.Address - x.Address;
                if (!cSet.Contains((y.Address + stride, x.Kind))) continue;
                // Walk the table while the entries are players.
                int len = 0;
                var ages = new List<int>();
                for (ulong at = x.Address; len < 2_000_000; at += stride, len++)
                {
                    uint u = x.Kind switch
                    {
                        "uid" => mem.U32(at),
                        "pointer" => result.PersonToUid.GetValueOrDefault(mem.Ptr(at)),
                        _ => mem.I32(at) is int ix && indexToUid != null && ix > 0 && ix < indexToUid.Length ? indexToUid[ix] : 0,
                    };
                    if (u == 0 || !byUid.TryGetValue(u, out var pp)) break;
                    ages.Add(pp.Age);
                }
                Console.WriteLine($"TABLE {x.Kind} at 0x{x.Address:X}, every {stride} bytes: {len:N0} players, ages {(ages.Count > 0 ? $"{ages.Min()}-{ages.Max()}" : "?")}");
                if (++found >= 30) break;
            }
        if (found == 0) Console.WriteLine("No evenly spaced rows found.");
        mem.ReleaseSnapshot();
        return 0;
    }

    /// <summary>
    /// Experiment: find a list whose slots lead, through one or more objects, to the given players
    /// in order (the rows of the player search on screen). `probe-chain --uids a,b,c,... [--depth 3]
    /// [--window 768] [--dump file]`.
    /// </summary>
    private static int ProbeChain(string[] args)
    {
        var targets = (Arg(args, "--uids") ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries).Select(uint.Parse).ToArray();
        if (targets.Length < 4) return Usage();
        int depth = int.TryParse(Arg(args, "--depth"), out int d) ? d : 3;
        int window = int.TryParse(Arg(args, "--window"), out int w) ? w : 768;
        using var fm = FindFm(out bool denied) ?? throw new ScanException(denied ? ScanError.NoAccess : ScanError.NotRunning, "Football Manager is not running.");
        using var game = GameProcess.Open(fm);
        var result = new Scanner(game, DatabaseChoice.Both, (_, _) => { }).Run();
        var byUid = result.Players.GroupBy(p => p.Uid).ToDictionary(g => g.Key, g => g.First());
        var mem = new MemScan(game);
        var full = Probe.Lists(game, result, 300_000).FirstOrDefault(r => r.Kind == "pointer" && r.Stride == 8);
        uint[] indexToUid = null;
        if (full != null)
        {
            indexToUid = new uint[full.Length];
            for (int i = 0; i < full.Length; i++) indexToUid[i] = result.PersonToUid.GetValueOrDefault(mem.Ptr(full.Address + (ulong)(i * 8)));
        }
        // Chains are built from the first four rows, then checked against the rest.
        var seed = targets.Take(4).ToArray();
        var hits = Probe.Find(game, result, seed, indexToUid);
        var level = new List<Probe.Node>();
        for (int t = 0; t < seed.Length; t++)
            foreach (var h in hits[seed[t]]) level.Add(new Probe.Node(h.Address, t, h.Kind, Array.Empty<int>()));
        int tables = 0;
        for (int lv = 0; lv <= depth; lv++)
        {
            Console.WriteLine($"level {lv}: {level.Count:N0} places ({string.Join(", ", Enumerable.Range(0, seed.Length).Select(t => level.Count(n => n.Target == t)))} per row)");
            var at = level.GroupBy(n => (n.Address, n.Target)).ToDictionary(g => g.Key, g => g.ToList());
            foreach (var n0 in level.Where(n => n.Target == 0))
                for (int stride = -256; stride <= 256; stride += 8)
                {
                    if (stride == 0) continue;
                    bool Has(int t) => at.TryGetValue((n0.Address + (ulong)(long)(stride * t), t), out var list) && list.Any(x => x.Kind == n0.Kind && x.Offsets.SequenceEqual(n0.Offsets));
                    if (!Has(1) || !Has(2) || !Has(3)) continue;
                    // The remaining rows from the screenshot must follow.
                    int matched = 0;
                    for (int t = 0; t < targets.Length; t++)
                        if (Probe.Resolve(mem, n0.Address + (ulong)(long)(stride * t), n0.Kind, n0.Offsets, indexToUid, result.PersonToUid) == targets[t]) matched++;
                    // Walk forward while slots lead to players.
                    var uids = new List<uint>();
                    for (ulong slot = n0.Address; uids.Count < 2_000_000; slot += (ulong)(long)stride)
                    {
                        uint u = Probe.Resolve(mem, slot, n0.Kind, n0.Offsets, indexToUid, result.PersonToUid);
                        if (u == 0 || !byUid.ContainsKey(u)) break;
                        uids.Add(u);
                    }
                    var ages = uids.Select(u => byUid[u].Age).Where(a => a > 0).ToList();
                    Console.WriteLine($"LIST at 0x{n0.Address:X}, slots {stride} bytes apart, {n0.Kind} via offsets [{string.Join(",", n0.Offsets.Select(o => "0x" + o.ToString("X")))}]: " +
                                      $"{matched}/{targets.Length} screenshot rows in order, {uids.Count:N0} players, {uids.Distinct().Count():N0} distinct, ages {(ages.Count > 0 ? $"{ages.Min()}-{ages.Max()}" : "?")}");
                    string dump = Arg(args, "--dump");
                    if (dump != null && matched == targets.Length && uids.Count >= 100)
                    {
                        File.WriteAllLines($"{dump}.{tables}.txt", uids.Select(u => u.ToString()));
                        Console.WriteLine($"  written to {dump}.{tables}.txt");
                    }
                    tables++;
                }
            if (lv == depth) break;
            level = Probe.Referrers(game, level, window);
        }
        if (tables == 0) Console.WriteLine("No list found that leads to the rows in order.");
        mem.ReleaseSnapshot();
        return 0;
    }

    /// <summary>
    /// Experiment: print 8-byte values at an address, and every place in memory that holds that
    /// address (with what surrounds it). `probe-peek --addr 0x1A198CCC040 [--count 8] [--refs]`.
    /// </summary>
    private static int ProbePeek(string[] args)
    {
        ulong addr = Convert.ToUInt64(Arg(args, "--addr"), 16);
        int count = int.TryParse(Arg(args, "--count"), out int c) ? c : 8;
        using var fm = FindFm(out bool denied) ?? throw new ScanException(denied ? ScanError.NoAccess : ScanError.NotRunning, "Football Manager is not running.");
        using var game = GameProcess.Open(fm);
        var mem = new MemScan(game);
        Console.WriteLine($"game_plugin 0x{mem.GpBase:X}-0x{mem.GpEnd:X}, GameAssembly 0x{mem.GaBase:X}-0x{mem.GaEnd:X}");
        for (int i = 0; i < count; i++) Console.WriteLine($"  0x{addr + (ulong)(i * 8):X}: 0x{mem.Ptr(addr + (ulong)(i * 8)):X}");
        if (args.Contains("--rtti"))
        {
            // addr is a vtable: [vtable - 8] is MSVC's complete object locator, which names the class.
            ulong meta = mem.Ptr(addr - 8);
            ulong td = mem.GpBase + mem.U32(meta + 12);
            Console.WriteLine($"locator 0x{meta:X}: signature {mem.U32(meta)}, offset {mem.I32(meta + 4)}, type descriptor 0x{td:X}, name \"{mem.CStr(td + 16, 200)}\"");
        }
        if (!args.Contains("--refs")) return 0;
        var found = new System.Collections.Concurrent.ConcurrentBag<ulong>();
        int chunk = MemScan.ChunkBytes;
        Parallel.ForEach(mem.ScanRegions.Where(r => r.size >= 0x40).ToList(), new ParallelOptions { MaxDegreeOfParallelism = 6 },
            () => GC.AllocateUninitializedArray<byte>(chunk),
            (region, _, buf) =>
            {
                var (start, size) = region;
                for (ulong done = 0; done < size;)
                {
                    int n = (int)Math.Min((ulong)chunk, size - done);
                    ulong chunkBase = start + done;
                    done += (ulong)n;
                    if (!mem.ReadBlock(chunkBase, buf, n)) continue;
                    for (int i = 0; i + 8 <= n; i += 8)
                        if (BitConverter.ToUInt64(buf, i) == addr) found.Add(chunkBase + (ulong)i);
                }
                return buf;
            },
            _ => { });
        foreach (ulong at in found.OrderBy(x => x))
        {
            Console.WriteLine($"ref at 0x{at:X}:");
            for (int i = -4; i <= 6; i++)
            {
                ulong v = mem.Ptr(at + (ulong)(long)(i * 8));
                string note = v >= addr && v - addr < 64_000_000 && v != addr ? $"  (= addr + {(v - addr) / 8:N0} slots)" : mem.InGp(v) ? "  (game_plugin)" : mem.InGa(v) ? "  (GameAssembly)" : "";
                Console.WriteLine($"   {(i == 0 ? ">" : " ")} {i * 8,4}: 0x{v:X}{note}");
            }
        }
        mem.ReleaseSnapshot();
        return 0;
    }

    private const string NoAccessMessage =
        "Football Manager is running as administrator, so the reader may not read it. " +
        "Start Football Manager normally (not as administrator), or run Scout Reporter as administrator too.";

    /// <summary>
    /// The real Football Manager process: fm.exe with an fm_Data folder next to it (other programs are
    /// called "fm" too). With several, the most recently started.
    /// </summary>
    private static Process FindFm(out bool denied)
    {
        Process best = null;
        denied = false;
        foreach (var p in Process.GetProcessesByName("fm"))
        {
            try
            {
                string exe = p.MainModule?.FileName;
                bool real = exe != null && Directory.Exists(Path.Combine(Path.GetDirectoryName(exe)!, "fm_Data"));
                if (real && (best == null || p.StartTime > best.StartTime)) { best?.Dispose(); best = p; continue; }
            }
            catch (System.ComponentModel.Win32Exception) { denied = true; }   // elevated, or another account
            catch { }
            p.Dispose();
        }
        if (best != null) denied = false;
        return best;
    }

    /// <summary>What to look at when the game version differs from the pinned offsets (see reader/REPIN.md).</summary>
    private static string RepinHint(ScanResult r)
    {
        var top = string.Join(", ", r.ClassHistogram.Take(8).Select(h => $"0x{h.offset:X}={h.count:N0}"));
        return $"Game version {r.GameVersion ?? "?"} differs from the pinned {r.SupportedVersion}.x: check the data. " +
               $"Largest class-offset peaks: {top}. See reader/REPIN.md.";
    }

    /// <summary>
    /// Plain-text report next to the scan, written for every scan (also a failed one, when it is
    /// needed most): the log, the class-offset peaks and a sample of players and staff. With
    /// reader/REPIN.md this is most of the work of re-pinning after an FM patch.
    /// </summary>
    internal static void WriteDiagnostics(string path, ScanResult r, string readerVersion)
    {
        {
            using var w = new StreamWriter(path, false);
            w.WriteLine($"Scout Reporter reader {readerVersion} diagnostics, {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
            w.WriteLine($"Game: {r.Game} (game_plugin {r.GameVersion ?? "?"}, offsets pinned on {r.SupportedVersion}.x, {(r.VersionOk ? "ok" : "DIFFERENT VERSION")})");
            w.WriteLine($"Players: {r.Players.Count:N0}  Staff: {r.Staff.Count:N0}  Unreadable: {r.UnreadFraction:P1}  Snapshot: {r.FromSnapshot}  Time: {r.ElapsedMs} ms");
            w.WriteLine($"Manager: {r.Manager ?? "?"}  Club: {r.MyClub ?? "?"}  In-game date: {r.GameDate?.ToString("yyyy-MM-dd") ?? "not found"} (year {r.GameYear})");
            w.WriteLine($"FM search result: {r.SearchPlayers:N0} players, {r.SearchStaff:N0} staff");
            w.WriteLine();
            w.WriteLine("Log:");
            foreach (var line in r.Log) w.WriteLine("  " + line);
            w.WriteLine();
            var f = Fields.Resolve(int.TryParse(r.SupportedVersion?.Split('.')[0], out int major) ? major : 27, 0).layout;
            w.WriteLine($"Pinned class offsets: player=0x{f.PLAYER_OFFSET:X} player+staff=0x{f.PLAYER_STAFF_OFFSET:X} staff=0x{f.STAFF_OFFSET:X} manager=0x{f.HUMAN_MANAGER_OFFSET:X}");
            w.WriteLine("Class offsets (meta+4) with a plausible UID, top 15:");
            foreach (var (offset, count) in r.ClassHistogram.Take(15)) w.WriteLine($"  0x{offset:X} ({offset,5}) : {count:N0}");
            w.WriteLine();
            w.WriteLine("Sample players:");
            foreach (var p in r.Players.Take(12))
                w.WriteLine($"  {p.Name} age={p.Age} CA={p.Ca} PA={p.Pa} pos={string.Join("/", p.Positions.Where(x => x.Value >= 15).Select(x => x.Key))} club={p.Club} value={p.Value} expires={p.ContractExpires}");
            w.WriteLine();
            w.WriteLine("Sample staff:");
            foreach (var s in r.Staff.Take(8))
                w.WriteLine($"  {s.Name} age={s.Age} CA={s.Ca} PA={s.Pa} job={s.Job} club={s.Club}");
        }
    }

    // ---------- output ----------

    private static void Emit(Action<JsonWriter> body)
    {
        var sw = new StringWriter();
        using (var j = new JsonWriter(sw))
        {
            j.BeginObj();
            body(j);
            j.EndObj();
            j.Close();
        }
        lock (OutLock)
        {
            Console.Out.WriteLine(sw.ToString());
            Console.Out.Flush();
        }
    }

    private static void Log(string message) => Emit(w => { w.Prop("type", "log"); w.Prop("message", message); });

    private static void Progress(string phase, double progress) =>
        Emit(w => { w.Prop("type", "progress"); w.Prop("phase", phase); w.Prop("progress", Math.Round(progress, 3)); });

    private static void Error(ScanError code, string message) => Emit(w =>
    {
        w.Prop("type", "error");
        w.Prop("code", code switch
        {
            ScanError.NotRunning => "not-running",
            ScanError.NoAccess => "no-access",
            ScanError.NotLoaded => "not-loaded",
            ScanError.NothingFound => "nothing-found",
            ScanError.TooMuchUnread => "too-much-unread",
            ScanError.NoSearch => "no-search",
            ScanError.Busy => "busy",
            _ => "failed",
        });
        w.Prop("message", message);
    });
}
