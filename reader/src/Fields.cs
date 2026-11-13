namespace ScoutReporter.Reader;

/// <summary>
/// FM's memory layout per game version. Adapted from FMSuperScout (MIT, see LICENSE-FMSuperScout):
/// FM26 comes from decompiled Cheat Engine tables (tdg6661, pinned on FM 26.3.x, game_plugin.dll
/// 26.3.0/26.3.2); FM27 is derived from it and was re-verified field by field upstream against a
/// running FM 27.0. All offsets are relative to an object base; see the comment on each group.
///
/// A new FM version or a big patch is a new layout with only the fields that moved
/// (<c>FM26.With(f => ...)</c>) plus a line in <see cref="ForVersion"/>. How: reader/REPIN.md.
/// </summary>
internal sealed class Fields
{
    // The game this layout is for, and the game_plugin.dll version (major.minor) its offsets were
    // pinned on. If the minor differs, the scan still runs but flags versionOk = false.
    public string Game { get; private set; } = "FM26";
    public int SupportedMajor { get; private set; } = 26;
    public int SupportedMinor { get; private set; } = 3;
    public string SupportedVersion => $"{SupportedMajor}.{SupportedMinor}";

    // --- Object header (every database object) ---
    public uint OBJ_DUNI { get; private set; } = 0x0C;         // uint32 unique ID (UID)

    // --- Class offsets (meta+4: distance from the person part to the object start, per class) ---
    public uint PLAYER_OFFSET { get; private set; } = 0x288;   // pure player
    public uint PLAYER_STAFF_OFFSET { get; private set; } = 0x380; // player who is also staff
    public uint STAFF_OFFSET { get; private set; } = 0x100;    // pure staff (non-player)
    public uint HUMAN_MANAGER_OFFSET { get; private set; } = 0x450;

    // --- Player block (plao); base = person - class offset ---
    public uint PLAO_CA { get; private set; } = 0x264;         // u16, 1..200
    public uint PLAO_PA { get; private set; } = 0x266;         // u16
    public uint PLAO_CUR_REP { get; private set; } = 0x260;    // u16
    public uint PLAO_WORLD_REP { get; private set; } = 0x262;  // u16
    public uint PLAO_HEIGHT { get; private set; } = 0x22E;     // u16 (cm)
    public uint PLAO_POSITIONS { get; private set; } = 0x150;  // 15 bytes, position rating 0..20
    public uint PLAO_ATTRS { get; private set; } = 0x15F;      // 55 bytes, stored x5
    public uint PLAO_VALUE { get; private set; } = 0x234;      // u32 GBP: FM's transfer value
    public uint PLAO_ASKING_PRICE { get; private set; } = 0x238; // u32 GBP: asking price (usually unset)

    // --- Person block (pero); base = person ---
    // Gender: byte at person+0x19, bit 0x10 set = female (upstream pin, 15-07-2026).
    public uint PERO_GENDER { get; private set; } = 0x19;
    public uint GENDER_FEMALE_BIT { get; private set; } = 0x10;
    public uint PERO_FIRST_NAME { get; private set; } = 0x50;  // nested string
    public uint PERO_SECOND_NAME { get; private set; } = 0x58;
    public uint PERO_COMMON_NAME { get; private set; } = 0x60;
    public uint PERO_NATION { get; private set; } = 0x68;      // ptr to nation
    public uint PERO_DOB { get; private set; } = 0x88;         // u32 FM date
    public uint PERO_FULL_CONTRACT { get; private set; } = 0xA8; // ptr to contract
    // ptr to 15 bytes (1..20): preference per job group; the highest is FM's "Preferred job".
    // Pinned upstream on FM27 (04-11-2026); not verified on FM26.
    public uint PERO_JOB_PREFS { get; private set; } = 0xD0;

    // Hidden personality, raw bytes 1..20:
    public uint PERO_ADAPTABILITY { get; private set; } = 0x70;
    public uint PERO_AMBITION { get; private set; } = 0x71;
    public uint PERO_LOYALTY { get; private set; } = 0x72;
    public uint PERO_PRESSURE { get; private set; } = 0x73;
    public uint PERO_PROFESSIONALISM { get; private set; } = 0x74;
    public uint PERO_SPORTSMANSHIP { get; private set; } = 0x75;
    public uint PERO_TEMPERAMENT { get; private set; } = 0x76;
    public uint PERO_CONTROVERSY { get; private set; } = 0x77;

    // --- Contract object (via [person + PERO_FULL_CONTRACT]) ---
    public uint CON_TEAM { get; private set; } = 0x10;         // ptr to team
    public uint CON_WEEKLY_WAGE { get; private set; } = 0x20;  // u32 GBP per week
    public uint CON_JOB { get; private set; } = 0x26;          // byte: job (personJobTypes)
    public uint CON_EXPIRY { get; private set; } = 0x48;       // u32 FM date
    public uint CON_STATUS_FLAGS { get; private set; } = 0x57; // byte bitfield, transfer status
    //   bit0 = listed, bit1 = loan listed (unverified), bit3 = listed by request,
    //   bit4 = not for sale, bit5 = set for release

    // --- Nation ---
    public uint NATION_SHORT_NAME { get; private set; } = 0x20; // indirect string
    public uint NATION_NAME { get; private set; } = 0x30;

    // --- Team and competition ---
    public uint TEAM_TYPE { get; private set; } = 0x28;        // byte: 0 = first team, ~3 = reserves, 10+ = youth
    public uint TEAM_CLUB { get; private set; } = 0x30;        // ptr to club
    public uint TEAM_PLAYERS_BEGIN { get; private set; } = 0x38;
    public uint TEAM_PLAYERS_END { get; private set; } = 0x40;
    public uint TEAM_COMP { get; private set; } = 0x50;        // ptr to competition
    public uint TEAM_COMP_ALT { get; private set; } = 0x60;    // same (both pointed at the league upstream)
    public uint TEAM_MANAGER { get; private set; } = 0x80;     // ptr to the team manager's person
    public uint TEAM_SCHEDULE { get; private set; } = 0xA0;    // ptr to the fixture schedule
    public uint TEAM_REP { get; private set; } = 0xA8;         // u16 reputation (~0..10000)
    public uint COMP_NAME { get; private set; } = 0x40;        // indirect string, full name
    public uint COMP_SHORT_NAME { get; private set; } = 0x48;  // indirect string, short name
    // [team+0xA0]+0x94 = the team's next match date: "today" on match days, otherwise a few days ahead.
    public uint SCHED_NEXT_MATCH { get; private set; } = 0x94;
    public uint SCHED_NEXT_MATCH_ALT { get; private set; } = 0x18;

    // --- Club: team vector [club+0x18, club+0x20) ---
    public uint CLUB_TEAMS_BEGIN { get; private set; } = 0x18;
    public uint CLUB_TEAMS_END { get; private set; } = 0x20;
    public uint CLUB_NAME { get; private set; } = 0xC0;        // indirect string
    public uint CLUB_SHORT_NAME { get; private set; } = 0xC8;  // indirect string

    // --- Staff block (nplo); base = person - class offset ---
    public uint NPLO_CA { get; private set; } = 0xDA;          // u16
    public uint NPLO_PA { get; private set; } = 0xDC;          // u16
    public uint NPLO_CUR_REP { get; private set; } = 0xD6;     // u16
    public uint NPLO_WORLD_REP { get; private set; } = 0xD8;   // u16
    public uint NPLO_ATTRS { get; private set; } = 0x10;       // staff attributes base

    // FM's person search (the Player Search and Staff Search screens). The game keeps the whole
    // result of the search on screen, after its filters (also "Player's interest"), in an object of
    // this class: a vector of pointers to entries, each starting with a pointer to the person. The
    // class is found by its RTTI name, so a patch that moves the vtable does not break it. Found on
    // FM 27.0.1 (13-11-2026) with `probe-chain` (see reader/REPIN.md); not verified on FM26.
    public const string SEARCH_SESSION_TYPE = ".?AVPERSON_SEARCH_EDIT_SESSION@@";
    public uint SEARCH_LIST { get; private set; } = 0x10;          // vector begin (end at +8)
    public uint SEARCH_ENTRY_PERSON { get; private set; } = 0x00;  // ptr to the person

    /// <summary>FM26, pinned on 26.3.x.</summary>
    public static readonly Fields FM26 = new();

    /// <summary>
    /// FM27 (Unity 6000.3, game_plugin.dll 27.0). The database layout is almost unchanged from FM26;
    /// verified upstream on 02-11-2026 against a running FM 27.0 save.
    /// </summary>
    public static readonly Fields FM27 = FM26.With(f =>
    {
        f.Game = "FM27"; f.SupportedMajor = 27; f.SupportedMinor = 0;
        f.HUMAN_MANAGER_OFFSET = 0x440;   // FM26: 0x450 (peak pair 0x440/0x468 in the histogram)
    });

    private Fields With(Action<Fields> change)
    {
        var copy = (Fields)MemberwiseClone();
        change(copy);
        return copy;
    }

    /// <summary>Layout for a game_plugin.dll major version; null for an unknown FM version.</summary>
    public static Fields ForVersion(int major) => major switch
    {
        26 => FM26,
        27 => FM27,
        _ => null,
    };

    /// <summary>All known layouts, newest first (fallback without version info).</summary>
    public static readonly Fields[] All = { FM27, FM26 };

    /// <summary>
    /// Pick the layout for a game version and say whether its offsets were pinned on that version.
    /// Unknown major (FM28...): the newest layout as a best guess, flagged as not ok.
    /// </summary>
    public static (Fields layout, bool versionOk) Resolve(int major, int minor)
    {
        var layout = ForVersion(major);
        if (layout == null) return (All[0], false);
        return (layout, minor == layout.SupportedMinor);
    }

    // Player attributes: our key (matches the app's PlayerAttributes) -> offset from PLAO_ATTRS. Stored x5.
    public static readonly (string key, int off)[] PlayerAttrs =
    {
        ("crossing", 0x00), ("dribbling", 0x01), ("finishing", 0x02), ("heading", 0x03),
        ("longShots", 0x04), ("marking", 0x05), ("offTheBall", 0x06), ("passing", 0x07),
        ("penaltyTaking", 0x08), ("tackling", 0x09), ("vision", 0x0A), ("handling", 0x0B),
        ("aerialReach", 0x0C), ("commandOfArea", 0x0D), ("communication", 0x0E), ("kicking", 0x0F),
        ("throwing", 0x10), ("anticipation", 0x11), ("decisions", 0x12), ("oneOnOnes", 0x13),
        ("positioning", 0x14), ("reflexes", 0x15), ("firstTouch", 0x16), ("technique", 0x17),
        ("flair", 0x1A), ("corners", 0x1B), ("teamWork", 0x1C), ("workRate", 0x1D),
        ("longThrows", 0x1E), ("eccentricity", 0x1F), ("rushingOutTendency", 0x20), ("punching", 0x21),
        ("acceleration", 0x22), ("freeKickTaking", 0x23), ("strength", 0x24), ("stamina", 0x25),
        ("pace", 0x26), ("jumpingReach", 0x27), ("leadership", 0x28), ("balance", 0x2A),
        ("bravery", 0x2B), ("aggression", 0x2D), ("agility", 0x2E), ("naturalFitness", 0x32),
        ("determination", 0x33), ("composure", 0x34), ("concentration", 0x35),
    };

    // Hidden player attributes (also x5).
    public static readonly (string key, int off)[] PlayerHiddenAttrs =
    {
        ("dirtiness", 0x29), ("consistency", 0x2C), ("importantMatches", 0x2F),
        ("injuryProneness", 0x30), ("versatility", 0x31),
    };

    public const int FOOT_LEFT = 0x18;
    public const int FOOT_RIGHT = 0x19;

    // Position rating (byte 0..20) from PLAO_POSITIONS.
    public static readonly (string key, int off)[] Positions =
    {
        ("GK", 0x00), ("SW", 0x01), ("DL", 0x02), ("DC", 0x03), ("DR", 0x04), ("DM", 0x05),
        ("ML", 0x06), ("MC", 0x07), ("MR", 0x08), ("AML", 0x09), ("AMC", 0x0A), ("AMR", 0x0B),
        ("ST", 0x0C), ("WBL", 0x0D), ("WBR", 0x0E),
    };

    // Staff attributes: our key (the app's StaffAttributeKey) -> offset from NPLO_ATTRS. Stored x5,
    // except the keys in StaffAttrsRaw. Verified upstream on 02-11-2026 against FM27's staff profile
    // and per job over 24k staff: working with youngsters is raw 1-20 (heads of youth development
    // average 16 against ~12), goalkeeping at 0x1B (goalkeeping coaches 10.7 against ~2.5), authority
    // at 0x2A. The byte at 0x29 is an unidentified mental value (~11 for everyone) and is left out.
    public static readonly (string key, int off)[] StaffAttrs =
    {
        ("attacking", 0x22), ("defending", 0x23), ("fitness", 0x24), ("possession", 0x25),
        ("technical", 0x26), ("tacticalCoaching", 0x27), ("setPieces", 0x33),
        ("determination", 0x0D), ("manManagement", 0x1E), ("motivating", 0x1F),
        ("judgingCurrentAbility", 0x1C), ("judgingPotentialAbility", 0x1D), ("judgingStaffAbility", 0x32),
        ("negotiating", 0x31), ("tacticalKnowledge", 0x21), ("physiotherapy", 0x20),
        ("sportsScience", 0x2F), ("analysingData", 0x2C), ("workingWithYoungsters", 0x0C),
        ("authority", 0x2A), ("goalkeeping", 0x1B),
    };
    public static readonly HashSet<string> StaffAttrsRaw = new() { "workingWithYoungsters" };

    // Job groups of the preference table (PERO_JOB_PREFS), derived upstream from 26k FM27 staff
    // (highest group against the contract's job byte): 0 manager, 1 assistant manager, 2 coach,
    // 3 physio, 4 scout, 5 goalkeeping coach, 6 fitness coach, 7 unidentified (job 22), 8 board
    // (chairman/director/owner), 9 director of football, 10 head of youth development, 11 loan
    // manager, 12 analyst (recruitment and performance: FM stores no subtype), 13 sports scientist,
    // 14 technical director. The app names them.
    public const int JobPrefGroups = 15;
}
