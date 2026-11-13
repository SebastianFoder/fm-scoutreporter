namespace ScoutReporter.Reader;

/// <summary>
/// Writes a scan in Scout Reporter's format (schema "scoutreporter-scan" version 2, documented in
/// packages/core/scan/README.md and typed in packages/core/scan/schema.ts): a lines file, one JSON
/// object per line. Line 1 holds the schema, version and meta; every further line is one player
/// (`"kind":"player"`) or staff member (`"kind":"staff"`). A full database is over 700 MB, more than
/// one JavaScript string can hold, so the desktop app reads it line by line into SQLite.
/// </summary>
internal static class DumpWriter
{
    public const string Schema = "scoutreporter-scan";
    public const int SchemaVersion = 2;
    public const string FileName = "scan.ndjson";

    /// <summary>
    /// Decide whether a scan may be written. A loaded save always has players, so an empty result
    /// means the scan failed (save not loaded, or offsets moved after an FM patch): never write it. A
    /// scan that could not read more than 10% of memory, even after the snapshot retry, is probably
    /// thinned out: it is refused when there is an earlier scan to keep using (an existing file, or
    /// the app's stored scans, see --previous-exists), but with nothing yet it is better than nothing.
    /// A scan that should keep only FM's search result (--only-search) needs one.
    /// </summary>
    public static (bool write, ScanError? error, string message) Check(ScanResult r, bool existingFile, bool onlySearch = false)
    {
        if (r.Players.Count == 0 && r.Staff.Count == 0)
            return (false, ScanError.NothingFound,
                "The scan found no players. Is your save fully loaded? If it is, the reader may need an update for this FM version.");
        if (r.UnreadFraction > 0.10 && existingFile)
            return (false, ScanError.TooMuchUnread,
                $"The scan could not read {Math.Round(r.UnreadFraction * 100)}% of FM's memory, even after a retry from a frozen snapshot. " +
                "Windows is probably low on memory: close other apps or reboot, then scan again. Your previous scan was kept.");
        if (onlySearch && r.SearchPlayers == 0 && r.SearchStaff == 0)
            return (false, ScanError.NoSearch,
                "Football Manager has no search result to read. In FM, open Player Search (or Staff Search), set your filters, " +
                "leave the search on screen and scan again.");
        return (true, null, null);
    }

    /// <summary>Write atomically: to a .tmp file first, moved over the target only once complete.</summary>
    public static void WriteFile(string path, ScanResult r, string readerVersion, DatabaseChoice db, DateTime scannedAt)
    {
        string tmp = path + ".tmp";
        using (var j = JsonWriter.ToFile(tmp))
        {
            Write(j, r, readerVersion, db, scannedAt);
            j.Close();
        }
        File.Move(tmp, path, true);
    }

    public static void Write(JsonWriter j, ScanResult r, string readerVersion, DatabaseChoice db, DateTime scannedAt)
    {
        // Line 1: schema, version and meta.
        j.BeginObj();
        j.Prop("schema", Schema);
        j.Prop("schemaVersion", SchemaVersion);
        j.Key("meta"); j.BeginObj();
        j.Prop("scannedAt", scannedAt.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ", System.Globalization.CultureInfo.InvariantCulture));
        j.Prop("readerVersion", readerVersion);
        j.Prop("game", r.Game);
        j.Prop("gameVersion", r.GameVersion);
        j.Prop("supportedVersion", r.SupportedVersion);
        j.Prop("versionOk", r.VersionOk);
        if (r.GameDate is DateTime gd) { j.Prop("gameDate", gd.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture)); j.Prop("gameDateSource", "schedule"); }
        else { j.PropNull("gameDate"); j.Prop("gameDateSource", "none"); }
        j.Prop("gameYear", r.GameYear);
        j.Prop("manager", r.Manager);
        j.Prop("myClub", r.MyClub);
        j.Prop("database", db.ToString().ToLowerInvariant());
        j.Prop("currency", "GBP");
        j.Prop("unreadFraction", Math.Round(r.UnreadFraction, 4));
        // People in FM's player/staff search at scan time ("inSearch" on each); 0 = no search found.
        j.Prop("searchPlayers", r.SearchPlayers);
        j.Prop("searchStaff", r.SearchStaff);
        // "search": only FM's search result and your club were kept; "full": the whole database.
        j.Prop("scope", r.SearchOnly ? "search" : "full");
        j.EndObj();
        j.EndObj();
        j.NewLine();

        // Then one person per line.
        foreach (var p in r.Players) { WritePlayer(j, p); j.NewLine(); }
        foreach (var s in r.Staff) { WriteStaff(j, s); j.NewLine(); }
    }

    private static void WriteCommon(JsonWriter j, Person p)
    {
        j.Prop("uid", p.Uid);
        j.Prop("name", p.Name ?? "?");
        j.Prop("birthDate", p.BirthYear > 0 ? new DateTime(p.BirthYear, 1, 1).AddDays(p.BirthDoy - 1).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture) : null);
        j.PropPositive("age", p.Age);
        j.Prop("nationality", p.Nationality);
        if (p.NationId != 0) j.Prop("nationId", p.NationId);
        if (p.Gender == 1) j.Prop("female", true);
        if (p.InSearch) j.Prop("inSearch", true);
        j.Prop("club", p.Club);
        j.Prop("division", p.Division);
        if (p.ClubRep > 0) j.Prop("clubReputation", p.ClubRep);   // the club's reputation (~0..10000)
        j.Prop("ca", p.Ca);
        j.Prop("pa", p.Pa);
        j.PropPositive("wage", p.Wage);
        j.Prop("contractExpires", p.ContractExpires);
        j.Key("personality"); j.BeginObj();
        WriteRaw20(j, "ambition", p.Ambition);
        WriteRaw20(j, "loyalty", p.Loyalty);
        WriteRaw20(j, "professionalism", p.Professionalism);
        WriteRaw20(j, "adaptability", p.Adaptability);
        WriteRaw20(j, "pressure", p.Pressure);
        WriteRaw20(j, "sportsmanship", p.Sportsmanship);
        WriteRaw20(j, "temperament", p.Temperament);
        WriteRaw20(j, "controversy", p.Controversy);
        j.EndObj();
        j.Key("reputation"); j.BeginObj();
        j.Prop("current", p.CurRep);
        j.Prop("world", p.WorldRep);
        j.EndObj();
    }

    private static void WriteRaw20(JsonWriter j, string key, int v) { if (v > 0) j.Prop(key, v); else j.PropNull(key); }

    private static void WriteMap(JsonWriter j, string key, Dictionary<string, int> map)
    {
        j.Key(key); j.BeginObj();
        foreach (var kv in map) j.Prop(kv.Key, kv.Value);
        j.EndObj();
    }

    private static void WritePlayer(JsonWriter j, Person p)
    {
        j.BeginObj();
        j.Prop("kind", "player");
        WriteCommon(j, p);
        // Owner only when it differs from where the player plays now (a loan).
        if (p.OwnerClub != null && p.OwnerClub != p.Club) j.Prop("ownerClub", p.OwnerClub);
        if (p.TeamType >= 0) j.Prop("teamType", p.TeamType);
        WriteMap(j, "positions", p.Positions);
        j.Key("foot"); j.BeginObj(); j.Prop("left", p.FootLeft); j.Prop("right", p.FootRight); j.EndObj();
        j.PropPositive("height", p.Height);
        j.PropPositive("value", p.Value);
        j.PropPositive("askingPrice", p.AskingPrice);
        j.Key("transferStatus"); j.BeginObj();
        j.Prop("listed", p.Listed);
        j.Prop("loanListed", p.LoanListed);
        j.Prop("notForSale", p.NotForSale);
        j.Prop("setForRelease", p.SetForRelease);
        j.EndObj();
        WriteMap(j, "attributes", p.Attributes);
        WriteMap(j, "hidden", p.Hidden);
        j.EndObj();
    }

    private static void WriteStaff(JsonWriter j, Person s)
    {
        j.BeginObj();
        j.Prop("kind", "staff");
        WriteCommon(j, s);
        j.Prop("job", s.Job);
        if (s.JobId > 0) j.Prop("jobId", s.JobId);
        j.Key("preferredJobs"); j.BeginArr(); foreach (var g in s.PreferredJobs) j.Val(g); j.EndArr();
        if (s.JobPreferences != null) { j.Key("jobPreferences"); j.BeginArr(); foreach (var v in s.JobPreferences) j.Val(v); j.EndArr(); }
        else j.PropNull("jobPreferences");
        WriteMap(j, "attributes", s.StaffAttributes);
        j.EndObj();
    }
}
