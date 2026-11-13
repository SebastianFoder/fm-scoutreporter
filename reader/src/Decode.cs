namespace ScoutReporter.Reader;

/// <summary>
/// Pure decoding of FM's raw values: no memory access, so these are unit-tested without the game.
/// Rules adapted from FMSuperScout (MIT).
/// </summary>
internal static class Decode
{
    /// <summary>Attributes are stored x5 (0..100); FM shows them rounded to 1..20.</summary>
    public static int Attribute(byte raw)
    {
        int v = (int)Math.Floor(raw / 5.0 + 0.5);
        return Math.Clamp(v, 0, 20);
    }

    /// <summary>Personality and a few staff values are stored as raw 1..20; anything else is unknown (0).</summary>
    public static int Raw20(int raw) => raw is >= 1 and <= 20 ? raw : 0;

    /// <summary>FM date: u32, year = raw >> 16, day of year = raw &amp; 0x1ff. (0, 0) when implausible.</summary>
    public static (int year, int doy) FmDate(uint raw)
    {
        int year = (int)(raw >> 16);
        int doy = (int)(raw & 0x1ff);
        if (year is < 1900 or > 2100 || doy is < 1 or > 366) return (0, 0);
        return (year, doy);
    }

    /// <summary>ISO date (yyyy-MM-dd) of an FM date, or null for a missing or sentinel date.</summary>
    public static string FmDateIso(uint raw, int minYear = 1900)
    {
        var (year, doy) = FmDate(raw);
        if (year == 0 || year < minYear) return null;
        // Day 366 in a non-leap year would roll over into the next year.
        if (doy > (DateTime.IsLeapYear(year) ? 366 : 365)) return null;
        return new DateTime(year, 1, 1).AddDays(doy - 1).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);
    }

    /// <summary>Age on <paramref name="now"/> of someone born on day <paramref name="doy"/> of <paramref name="year"/>; 0 when unknown.</summary>
    public static int AgeAt(int year, int doy, DateTime now)
    {
        if (year == 0) return 0;
        int age = now.Year - year - (doy <= now.DayOfYear ? 0 : 1);
        return age is >= 0 and <= 80 ? age : 0;
    }

    /// <summary>FM's "not set" sentinel 0xFFFFFFFF means unknown (-1).</summary>
    public static long Money(uint v) => v == 0xFFFFFFFF ? -1 : v;

    /// <summary>The value field also uses 300,000,000 as "not set".</summary>
    public static long MoneyValue(uint v) => v == 0xFFFFFFFF || v == 300_000_000u ? -1 : v;

    /// <summary>
    /// Only real club, competition and nation names: mostly Latin letters, no stray bytes. Accepts the
    /// whole Latin Unicode range (Extended-A/B and Additional), so Polish and Turkish names pass.
    /// </summary>
    public static bool PlausibleName(string s)
    {
        if (string.IsNullOrEmpty(s) || s.Length is < 2 or > 48) return false;
        int latin = 0, weird = 0;
        foreach (char c in s)
        {
            if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')) latin++;
            else if (c > 0x7F && !(char.IsLetter(c) && (c <= 0x24F || (c >= 0x1E00 && c <= 0x1EFF)))) weird++;
        }
        return latin >= 2 && weird == 0;
    }

    /// <summary>
    /// The job preference table: 15 scores (1..20), one per job group. Returns the groups with the
    /// top score (FM's "Preferred job"; empty when there is no clear preference, below 10, or more
    /// than three tie) and all scores (null when the table is missing or unreadable).
    /// </summary>
    public static (List<int> preferred, byte[] scores) JobPreferences(byte[] table)
    {
        var preferred = new List<int>();
        if (table == null || table.Length != Fields.JobPrefGroups) return (preferred, null);
        int max = 0;
        foreach (byte v in table) { if (v > 20) return (preferred, null); if (v > max) max = v; }
        if (max == 0) return (preferred, null);
        if (max < 10) return (preferred, table);
        for (int i = 0; i < table.Length; i++) if (table[i] == max) preferred.Add(i);
        if (preferred.Count > 3) preferred.Clear();
        return (preferred, table);
    }

    // The job byte on the contract (personJobTypes), named in English.
    private static readonly Dictionary<int, string> Jobs = new()
    {
        [1] = "Player", [2] = "Coach", [3] = "Player/Coach", [4] = "Chairman",
        [6] = "Director", [8] = "Managing Director", [10] = "Director of Football",
        [12] = "Physio", [14] = "Scout", [16] = "Manager", [17] = "Player/Manager",
        [20] = "Assistant Manager", [21] = "Player/Assistant Manager", [22] = "Media Analyst",
        [24] = "General Manager", [26] = "Fitness Coach", [27] = "Player/Fitness Coach",
        [34] = "Goalkeeping Coach", [35] = "Player/Goalkeeping Coach", [36] = "Head of Data Analysis",
        [38] = "Club Doctor", [40] = "Head of Sports Science", [42] = "Data Analyst",
        [44] = "Chief Scout", [45] = "Player/Chief Scout", [46] = "Doctor", [48] = "Sports Scientist",
        [49] = "Player/Youth Coach", [50] = "Head Physio", [52] = "Under-19 Manager",
        [54] = "First-Team Coach", [64] = "Head of Youth Development", [65] = "Player/Head of Youth Development",
        [66] = "Owner", [70] = "President", [86] = "Loan Manager", [88] = "Technical Director",
        [144] = "Caretaker Manager",
        // Analyst roles (FM26 and FM27), pinned upstream on 02-11-2026 from attribute profiles.
        [58] = "Recruitment Analyst", [60] = "Performance Analyst", [62] = "Head of Performance Analysis",
    };

    public static string JobName(int id) => Jobs.TryGetValue(id, out var s) ? s : null;
}
