using System.Diagnostics;

namespace ScoutReporter.Reader;

/// <summary>
/// ScoutReporter.Reader: reads the database of a running Football Manager 27 (or 26) from fm.exe's
/// memory, read-only, and writes it as one JSON file for the Scout Reporter desktop app.
///
///   ScoutReporter.Reader.exe scan --out &lt;dir&gt; [--db men|women|both]
///   ScoutReporter.Reader.exe version
///
/// It reports on stdout as JSON lines, one object per line:
///   {"type":"progress","phase":"scanning","progress":0.42}
///   {"type":"log","message":"..."}
///   {"type":"done","file":"...","players":51234,"staff":12000,"versionOk":true,"game":"FM27","gameVersion":"27.0.1.0"}
///   {"type":"error","code":"not-running","message":"..."}
/// Exit codes: 0 done, 2 FM not running, 3 another scan is running, 4 no access (FM runs as
/// administrator), 5 save not loaded, 6 nothing found, 7 too much unreadable, 64 usage, 1 other.
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
        Console.Error.WriteLine("Usage: ScoutReporter.Reader scan --out <dir> [--db men|women|both] | version");
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
            WriteDiagnostics(Path.Combine(outDir, "diagnostics.txt"), result);
            var (write, error, message) = DumpWriter.Check(result, File.Exists(target));
            if (!write) throw new ScanException(error!.Value, message);

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
    private static void WriteDiagnostics(string path, ScanResult r)
    {
        try
        {
            using var w = new StreamWriter(path, false);
            w.WriteLine($"Scout Reporter reader {ReaderVersion} diagnostics, {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
            w.WriteLine($"Game: {r.Game} (game_plugin {r.GameVersion ?? "?"}, offsets pinned on {r.SupportedVersion}.x, {(r.VersionOk ? "ok" : "DIFFERENT VERSION")})");
            w.WriteLine($"Players: {r.Players.Count:N0}  Staff: {r.Staff.Count:N0}  Unreadable: {r.UnreadFraction:P1}  Snapshot: {r.FromSnapshot}  Time: {r.ElapsedMs} ms");
            w.WriteLine($"Manager: {r.Manager ?? "?"}  Club: {r.MyClub ?? "?"}  In-game date: {r.GameDate?.ToString("yyyy-MM-dd") ?? "not found"} (year {r.GameYear})");
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
        catch { /* diagnostics are best effort */ }
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
            ScanError.Busy => "busy",
            _ => "failed",
        });
        w.Prop("message", message);
    });
}
