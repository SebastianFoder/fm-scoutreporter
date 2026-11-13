using System.Text.Json;
using Xunit;

namespace ScoutReporter.Reader.Tests;

public class DecodeTests
{
    [Theory]
    [InlineData(0, 0)]
    [InlineData(5, 1)]
    [InlineData(62, 12)]   // 12.4 rounds down
    [InlineData(63, 13)]   // 12.6 rounds up
    [InlineData(100, 20)]
    [InlineData(255, 20)]  // out of range clamps
    public void Attributes_are_stored_times_five(int raw, int expected) =>
        Assert.Equal(expected, Decode.Attribute((byte)raw));

    [Fact]
    public void Raw_personality_values_outside_1_to_20_are_unknown()
    {
        Assert.Equal(0, Decode.Raw20(0));
        Assert.Equal(15, Decode.Raw20(15));
        Assert.Equal(0, Decode.Raw20(21));
    }

    [Fact]
    public void FM_dates_decode_to_year_and_day_of_year()
    {
        uint raw = (2027u << 16) | 182u;
        Assert.Equal((2027, 182), Decode.FmDate(raw));
        Assert.Equal("2027-07-01", Decode.FmDateIso(raw));
        Assert.Equal((0, 0), Decode.FmDate(0xFFFFFFFF));
        Assert.Null(Decode.FmDateIso((1999u << 16) | 10u, minYear: 2000));
        // Day 366 in a non-leap year is not a date.
        Assert.Null(Decode.FmDateIso((2027u << 16) | 366u));
        Assert.Equal("2028-12-31", Decode.FmDateIso((2028u << 16) | 366u));
    }

    [Fact]
    public void Age_counts_birthdays()
    {
        var today = new DateTime(2027, 7, 1); // day 182
        Assert.Equal(20, Decode.AgeAt(2007, 182, today));
        Assert.Equal(19, Decode.AgeAt(2007, 183, today));
        Assert.Equal(0, Decode.AgeAt(0, 0, today));
    }

    [Fact]
    public void Money_sentinels_mean_unknown()
    {
        Assert.Equal(-1, Decode.Money(0xFFFFFFFF));
        Assert.Equal(2_500_000, Decode.Money(2_500_000));
        Assert.Equal(-1, Decode.MoneyValue(300_000_000));
    }

    [Theory]
    [InlineData("Feyenoord", true)]
    [InlineData("Lech Poznań", true)]
    [InlineData("Fenerbahçe", true)]
    [InlineData("Д", false)]
    [InlineData("Динамо Москва", false)]
    [InlineData("x", false)]
    [InlineData(null, false)]
    public void Only_plausible_names_pass(string name, bool expected) =>
        Assert.Equal(expected, Decode.PlausibleName(name));

    [Fact]
    public void Job_preferences_pick_the_top_groups()
    {
        var table = new byte[15];
        table[2] = 18; table[5] = 18; table[0] = 9;
        var (preferred, scores) = Decode.JobPreferences(table);
        Assert.Equal(new[] { 2, 5 }, preferred);
        Assert.Same(table, scores);

        var weak = new byte[15]; weak[3] = 8;
        Assert.Empty(Decode.JobPreferences(weak).preferred);
        Assert.NotNull(Decode.JobPreferences(weak).scores);

        var corrupt = new byte[15]; corrupt[1] = 200;
        Assert.Null(Decode.JobPreferences(corrupt).scores);
        Assert.Null(Decode.JobPreferences(new byte[3]).scores);
    }

    [Fact]
    public void Job_ids_have_English_names()
    {
        Assert.Equal("Head of Youth Development", Decode.JobName(64));
        Assert.Equal("Performance Analyst", Decode.JobName(60));
        Assert.Null(Decode.JobName(999));
    }
}

public class FieldsTests
{
    [Fact]
    public void Versions_resolve_to_their_layout()
    {
        var (fm27, ok27) = Fields.Resolve(27, 0);
        Assert.Equal("FM27", fm27.Game);
        Assert.True(ok27);
        Assert.Equal(0x440u, fm27.HUMAN_MANAGER_OFFSET);

        var (patched, okPatched) = Fields.Resolve(27, 1);
        Assert.Equal("FM27", patched.Game);
        Assert.False(okPatched);

        var (fm26, ok26) = Fields.Resolve(26, 3);
        Assert.Equal("FM26", fm26.Game);
        Assert.True(ok26);
        Assert.Equal(0x450u, fm26.HUMAN_MANAGER_OFFSET);
    }

    [Fact]
    public void Unknown_versions_use_the_newest_layout_and_are_flagged()
    {
        var (layout, ok) = Fields.Resolve(28, 0);
        Assert.Equal("FM27", layout.Game);
        Assert.False(ok);
    }

    [Fact]
    public void Attribute_offsets_are_unique_and_inside_the_block()
    {
        var all = Fields.PlayerAttrs.Concat(Fields.PlayerHiddenAttrs).ToList();
        Assert.Equal(all.Count, all.Select(a => a.off).Distinct().Count());
        Assert.Equal(all.Count, all.Select(a => a.key).Distinct().Count());
        Assert.All(all, a => Assert.InRange(a.off, 0, 54));
        Assert.Equal(Fields.StaffAttrs.Length, Fields.StaffAttrs.Select(a => a.key).Distinct().Count());
    }
}

public class DumpWriterTests
{
    internal static ScanResult Sample()
    {
        var player = new Person
        {
            Uid = 2002083882, IsPlayer = true, Name = "Alex \"AW\" Williamson", BirthYear = 2007, BirthDoy = 32, Age = 20,
            Nationality = "United States", Club = "Loan FC", OwnerClub = "Parent FC", Division = "MLS", TeamType = 0,
            Ca = 112, Pa = 150, Wage = 1900, ContractExpires = "2030-06-30", Value = 950_000, AskingPrice = -1,
            Professionalism = 15, Ambition = 12, FootLeft = 8, FootRight = 20, Height = 184, Listed = true,
        };
        player.Attributes["pace"] = 15;
        player.Attributes["teamWork"] = 11;
        player.Hidden["consistency"] = 13;
        player.Positions["GK"] = 20;

        var coach = new Person { Uid = 7, Name = "Coach", Ca = 100, Pa = 120, Job = "Coach", JobId = 2, Wage = -1 };
        coach.PreferredJobs.Add(2);
        coach.StaffAttributes["attacking"] = 14;
        coach.StaffAttributes["workingWithYoungsters"] = 16;

        return new ScanResult
        {
            Players = { player }, Staff = { coach }, Game = "FM27", GameVersion = "27.0.1.0", SupportedVersion = "27.0",
            VersionOk = true, GameDate = new DateTime(2027, 8, 14), GameYear = 2027, Manager = "Me", MyClub = "Parent FC",
        };
    }

    /// <summary>The lines of the written scan, each parsed on its own.</summary>
    private static JsonElement[] WriteSample(ScanResult r)
    {
        var sw = new StringWriter();
        using (var j = new JsonWriter(sw))
        {
            DumpWriter.Write(j, r, "0.1.0", DatabaseChoice.Men, new DateTime(2026, 11, 12, 18, 0, 0, DateTimeKind.Utc));
            j.Close();
        }
        string text = sw.ToString();
        Assert.EndsWith("\n", text);
        return text.TrimEnd('\n').Split('\n').Select(line => JsonDocument.Parse(line).RootElement).ToArray();
    }

    private static JsonElement Kind(JsonElement[] lines, string kind) =>
        lines.First(l => l.TryGetProperty("kind", out var k) && k.GetString() == kind);

    [Fact]
    public void Writes_one_line_per_person_after_the_meta_line()
    {
        var r = Sample();
        r.Players.Add(new Person { Uid = 3, Name = "Line\nBreak", Ca = 50, Pa = 60 });
        var lines = WriteSample(r);
        Assert.Equal(1 + r.Players.Count + r.Staff.Count, lines.Length);
        Assert.False(lines[0].TryGetProperty("kind", out _));
        Assert.Equal(new[] { "player", "player", "staff" }, lines.Skip(1).Select(l => l.GetProperty("kind").GetString()));
        Assert.Equal("Line\nBreak", lines[2].GetProperty("name").GetString());
    }

    [Fact]
    public void Writes_the_schema_and_meta()
    {
        var root = WriteSample(Sample())[0];
        Assert.Equal("scoutreporter-scan", root.GetProperty("schema").GetString());
        Assert.Equal(2, root.GetProperty("schemaVersion").GetInt32());
        var meta = root.GetProperty("meta");
        Assert.Equal("2026-11-12T18:00:00Z", meta.GetProperty("scannedAt").GetString());
        Assert.Equal("27.0.1.0", meta.GetProperty("gameVersion").GetString());
        Assert.True(meta.GetProperty("versionOk").GetBoolean());
        Assert.Equal("2027-08-14", meta.GetProperty("gameDate").GetString());
        Assert.Equal("Parent FC", meta.GetProperty("myClub").GetString());
        Assert.Equal("men", meta.GetProperty("database").GetString());
        Assert.Equal(0, meta.GetProperty("searchPlayers").GetInt32());
        Assert.Equal("full", meta.GetProperty("scope").GetString());
    }

    [Fact]
    public void A_search_only_scan_keeps_the_search_and_your_club()
    {
        var r = Sample();   // one player on loan from your club (Parent FC), one coach elsewhere
        Person Player(uint uid, string club, bool inSearch = false) =>
            new() { Uid = uid, IsPlayer = true, Name = "P" + uid, Club = club, InSearch = inSearch };
        r.Players.Add(Player(1, "Parent FC"));
        r.Players.Add(Player(2, "Other FC", inSearch: true));
        r.Players.Add(Player(3, "Other FC"));
        r.Players.Add(Player(4, null));
        r.Staff.Add(new Person { Uid = 5, Name = "S5", Club = "Parent FC" });
        r.SearchPlayers = 1;
        Assert.True(DumpWriter.Check(r, existingFile: false, onlySearch: true).write);

        r.KeepSearchOnly();
        Assert.Equal(new uint[] { 2002083882, 1, 2 }, r.Players.Select(p => p.Uid).ToArray());
        Assert.Equal(new uint[] { 5 }, r.Staff.Select(s => s.Uid).ToArray());
        Assert.Equal("search", WriteSample(r)[0].GetProperty("meta").GetProperty("scope").GetString());
    }

    [Fact]
    public void A_search_only_scan_needs_a_search_result()
    {
        var r = Sample();
        Assert.Equal((false, ScanError.NoSearch), Pick(DumpWriter.Check(r, existingFile: false, onlySearch: true)));
        Assert.True(DumpWriter.Check(r, existingFile: false).write);
        r.SearchStaff = 1;
        Assert.True(DumpWriter.Check(r, existingFile: false, onlySearch: true).write);
    }

    [Fact]
    public void Marks_people_in_fms_search_result()
    {
        var r = Sample();
        r.Players[0].InSearch = true;
        r.Players[0].ClubRep = 6826;
        r.SearchPlayers = 1;
        var lines = WriteSample(r);
        Assert.Equal(1, lines[0].GetProperty("meta").GetProperty("searchPlayers").GetInt32());
        Assert.Equal(0, lines[0].GetProperty("meta").GetProperty("searchStaff").GetInt32());
        Assert.True(Kind(lines, "player").GetProperty("inSearch").GetBoolean());
        Assert.Equal(6826, Kind(lines, "player").GetProperty("clubReputation").GetInt32());
        Assert.False(Kind(lines, "staff").TryGetProperty("inSearch", out _));
    }

    [Fact]
    public void Writes_players_in_our_keys()
    {
        var p = Kind(WriteSample(Sample()), "player");
        Assert.Equal(2002083882u, p.GetProperty("uid").GetUInt32());
        Assert.Equal("Alex \"AW\" Williamson", p.GetProperty("name").GetString());
        Assert.Equal("2007-02-01", p.GetProperty("birthDate").GetString());
        Assert.Equal("Parent FC", p.GetProperty("ownerClub").GetString());
        Assert.Equal(15, p.GetProperty("attributes").GetProperty("pace").GetInt32());
        Assert.Equal(11, p.GetProperty("attributes").GetProperty("teamWork").GetInt32());
        Assert.Equal(13, p.GetProperty("hidden").GetProperty("consistency").GetInt32());
        Assert.Equal(20, p.GetProperty("positions").GetProperty("GK").GetInt32());
        Assert.Equal(15, p.GetProperty("personality").GetProperty("professionalism").GetInt32());
        Assert.Equal(JsonValueKind.Null, p.GetProperty("personality").GetProperty("loyalty").ValueKind);
        Assert.Equal(950_000, p.GetProperty("value").GetInt64());
        Assert.Equal(JsonValueKind.Null, p.GetProperty("askingPrice").ValueKind);
        Assert.True(p.GetProperty("transferStatus").GetProperty("listed").GetBoolean());
    }

    [Fact]
    public void Writes_staff_with_numeric_attributes()
    {
        var s = Kind(WriteSample(Sample()), "staff");
        Assert.Equal("Coach", s.GetProperty("job").GetString());
        Assert.Equal(2, s.GetProperty("preferredJobs")[0].GetInt32());
        Assert.Equal(14, s.GetProperty("attributes").GetProperty("attacking").GetInt32());
        Assert.Equal(JsonValueKind.Null, s.GetProperty("wage").ValueKind);
        Assert.Equal(JsonValueKind.Null, s.GetProperty("jobPreferences").ValueKind);
    }

    [Fact]
    public void Never_writes_an_empty_scan()
    {
        var empty = new ScanResult();
        Assert.Equal((false, ScanError.NothingFound), Pick(DumpWriter.Check(empty, existingFile: false)));
        Assert.Equal((false, ScanError.NothingFound), Pick(DumpWriter.Check(empty, existingFile: true)));
    }

    [Fact]
    public void A_thinned_out_scan_only_replaces_nothing()
    {
        var r = Sample();
        r.UnreadFraction = 0.2;
        Assert.Equal((false, ScanError.TooMuchUnread), Pick(DumpWriter.Check(r, existingFile: true)));
        Assert.True(DumpWriter.Check(r, existingFile: false).write);
        r.UnreadFraction = 0.05;
        Assert.True(DumpWriter.Check(r, existingFile: true).write);
    }

    private static (bool, ScanError?) Pick((bool write, ScanError? error, string message) c) => (c.write, c.error);

    [Fact]
    public void Writes_atomically_through_a_temp_file()
    {
        string dir = Path.Combine(Path.GetTempPath(), "sr-reader-test-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        try
        {
            string path = Path.Combine(dir, DumpWriter.FileName);
            DumpWriter.WriteFile(path, Sample(), "0.1.0", DatabaseChoice.Both, DateTime.UtcNow);
            Assert.True(File.Exists(path));
            Assert.False(File.Exists(path + ".tmp"));
            using var doc = JsonDocument.Parse(File.ReadLines(path).First());
            Assert.Equal("both", doc.RootElement.GetProperty("meta").GetProperty("database").GetString());
        }
        finally { Directory.Delete(dir, true); }
    }
}

public class RttiTests
{
    /// <summary>A module image with one class: its name, a locator for it and a vtable.</summary>
    private static (byte[] image, ulong imageBase) Image(string name, uint locatorOffset = 0)
    {
        const ulong imageBase = 0x7FFE00000000;
        var image = new byte[0x400];
        // Type descriptor at 0x100: two pointers, then the name.
        System.Text.Encoding.ASCII.GetBytes(name + "\0").CopyTo(image, 0x110);
        // Complete object locator at 0x200.
        BitConverter.GetBytes(1u).CopyTo(image, 0x200);
        BitConverter.GetBytes(locatorOffset).CopyTo(image, 0x204);
        BitConverter.GetBytes(0x100u).CopyTo(image, 0x20C);
        BitConverter.GetBytes(0x200u).CopyTo(image, 0x214);
        // The slot before the vtable (at 0x308) points at the locator.
        BitConverter.GetBytes(imageBase + 0x200).CopyTo(image, 0x300);
        return (image, imageBase);
    }

    [Fact]
    public void Finds_a_class_vtable_by_its_rtti_name()
    {
        var (image, imageBase) = Image(Fields.SEARCH_SESSION_TYPE);
        Assert.Equal(new[] { imageBase + 0x308 }, MemScan.VtablesOfType(image, imageBase, Fields.SEARCH_SESSION_TYPE));
    }

    [Fact]
    public void Ignores_other_classes_secondary_vtables_and_a_missing_image()
    {
        var (image, imageBase) = Image(".?AVPERSON_SEARCH_EDIT_SESSION_HELPER@@");
        Assert.Empty(MemScan.VtablesOfType(image, imageBase, Fields.SEARCH_SESSION_TYPE));
        var (secondary, secondaryBase) = Image(Fields.SEARCH_SESSION_TYPE, locatorOffset: 16);
        Assert.Empty(MemScan.VtablesOfType(secondary, secondaryBase, Fields.SEARCH_SESSION_TYPE));
        Assert.Empty(MemScan.VtablesOfType(null, 0, Fields.SEARCH_SESSION_TYPE));
    }
}

public class DiagnosticsTests
{
    [Fact]
    public void Writes_the_diagnostics_report()
    {
        string dir = Path.Combine(Path.GetTempPath(), "sr-reader-test-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        try
        {
            string path = Path.Combine(dir, "diagnostics.txt");
            Program.WriteDiagnostics(path, DumpWriterTests.Sample(), "0.1.0");
            string text = File.ReadAllText(path);
            Assert.Contains("Players: 1", text);
            Assert.Contains("Alex \"AW\" Williamson", text);
            Assert.Contains("Sample staff:", text);
        }
        finally { Directory.Delete(dir, true); }
    }
}

public class JsonWriterTests
{
    [Fact]
    public void Escapes_strings_and_writes_invariant_numbers()
    {
        var sw = new StringWriter();
        using (var j = new JsonWriter(sw))
        {
            j.BeginObj();
            j.Prop("s", "a\"b\\c\n\u0001");
            j.Prop("d", 0.5);
            j.Prop("nan", double.NaN);
            j.PropPositive("unknown", -1);
            j.Key("arr"); j.BeginArr(); j.Val(1); j.Val(2); j.EndArr();
            j.EndObj();
            j.Close();
        }
        var root = JsonDocument.Parse(sw.ToString()).RootElement;
        Assert.Equal("a\"b\\c\n\u0001", root.GetProperty("s").GetString());
        Assert.Equal(0.5, root.GetProperty("d").GetDouble());
        Assert.Equal(JsonValueKind.Null, root.GetProperty("nan").ValueKind);
        Assert.Equal(JsonValueKind.Null, root.GetProperty("unknown").ValueKind);
        Assert.Equal(2, root.GetProperty("arr").GetArrayLength());
    }
}

public class ScanPassTests
{
    [Fact]
    public void Values_inside_the_copied_block_come_from_it()
    {
        var buf = new byte[32];
        BitConverter.GetBytes((ushort)147).CopyTo(buf, 10);
        BitConverter.GetBytes(0x1234_5678_9ABCUL).CopyTo(buf, 16);
        buf[31] = 0x10;
        // No MemScan: a value read from the block never touches FM's memory.
        Assert.Equal(147, Scanner.BufU16(buf, buf.Length, 10, null, 0));
        Assert.Equal(0x1234_5678_9ABCUL, Scanner.BufPtr(buf, buf.Length, 16, null, 0));
        Assert.Equal(0x10, Scanner.BufU8(buf, buf.Length, 31, null, 0));
        // Only the copied length counts, not the buffer's size.
        Assert.Equal(147, Scanner.BufU16(buf, 12, 10, null, 0));
    }

    [Fact]
    public void Values_past_the_copied_block_are_read_from_memory()
    {
        var buf = new byte[32];
        // Each of these needs FM's memory; with no MemScan that is a NullReferenceException.
        Assert.Throws<NullReferenceException>(() => Scanner.BufU16(buf, 11, 10, null, 0));
        Assert.Throws<NullReferenceException>(() => Scanner.BufPtr(buf, buf.Length, 28, null, 0));
        Assert.Throws<NullReferenceException>(() => Scanner.BufU8(buf, buf.Length, -1, null, 0));
    }

    [Fact]
    public void Step_timings_are_listed_in_order()
    {
        var timings = new List<(string step, long ms)>();
        var steps = new StepTimer(timings);
        steps.Lap("find");
        steps.Lap("read people");
        Assert.Equal(new[] { "find", "read people" }, timings.Select(t => t.step));
        Assert.All(timings, t => Assert.True(t.ms >= 0));
        Assert.Equal("find 1,250 ms, write 30 ms", StepTimer.Format(new[] { ("find", 1250L), ("write", 30L) }));
    }
}
