namespace ScoutReporter.Reader;

/// <summary>
/// Writes a scan in Scout Reporter's format (schema "scoutreporter-scan" version 1, documented in
/// packages/core/scan/README.md and typed in packages/core/scan/schema.ts).
/// </summary>
internal static class DumpWriter
{
    public const string Schema = "scoutreporter-scan";
    public const int SchemaVersion = 1;
    public const string FileName = "scan.json";

    /// <summary>
    /// Decide whether a scan may be written over <paramref name="existingFile"/>. A loaded save
    /// always has players, so an empty result means the scan failed (save not loaded, or offsets moved
    /// after an FM patch): never write it. A scan that could not read more than 10% of memory, even
    /// after the snapshot retry, is probably thinned out: it may not replace an existing file, but with
    /// no file yet something is better than nothing.
    /// </summary>
    public static (bool write, ScanError? error, string message) Check(ScanResult r, bool existingFile)
    {
        if (r.Players.Count == 0 && r.Staff.Count == 0)
            return (false, ScanError.NothingFound,
                "The scan found no players. Is your save fully loaded? If it is, the reader may need an update for this FM version.");
        if (r.UnreadFraction > 0.10 && existingFile)
            return (false, ScanError.TooMuchUnread,
                $"The scan could not read {Math.Round(r.UnreadFraction * 100)}% of FM's memory, even after a retry from a frozen snapshot. " +
                "Windows is probably low on memory: close other apps or reboot, then scan again. Your previous scan was kept.");
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
        j.EndObj();

        j.Key("players"); j.BeginArr();
        foreach (var p in r.Players) WritePlayer(j, p);
        j.EndArr();
        j.Key("staff"); j.BeginArr();
        foreach (var s in r.Staff) WriteStaff(j, s);
        j.EndArr();
        j.EndObj();
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
        j.Prop("club", p.Club);
        j.Prop("division", p.Division);
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
