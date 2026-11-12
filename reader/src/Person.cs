namespace ScoutReporter.Reader;

/// <summary>One player or staff member as read from memory, before it is written out.</summary>
internal sealed class Person
{
    public uint Uid;
    public bool IsPlayer;
    public string Name;
    public int BirthYear, BirthDoy, Age;
    public string Nationality;
    public uint NationId;
    public int Gender;               // 1 = female

    /// <summary>Where the person plays now (squad walk), falling back to the contract's club.</summary>
    public string Club;
    /// <summary>The club holding the contract; differs from Club for loans.</summary>
    public string OwnerClub;
    public string Division;
    public int TeamType = -1;        // 0 = first team, ~3 = reserves, 10+ = youth
    public int ClubRep;

    public int Ca, Pa;
    public long Wage = -1;           // GBP per week, -1 = unknown
    public string ContractExpires;   // yyyy-MM-dd
    public int CurRep, WorldRep;

    // Personality (raw 1..20, 0 = unknown).
    public int Ambition, Loyalty, Professionalism, Adaptability, Pressure, Sportsmanship, Temperament, Controversy;

    // Players
    public readonly Dictionary<string, int> Attributes = new();
    public readonly Dictionary<string, int> Hidden = new();
    public readonly Dictionary<string, int> Positions = new();
    public int FootLeft, FootRight;
    public int Height;
    public long Value = -1, AskingPrice = -1;
    public bool Listed, LoanListed, NotForSale, SetForRelease;

    // Staff
    public string Job;
    public int JobId;
    public List<int> PreferredJobs = new();
    public byte[] JobPreferences;
    public readonly Dictionary<string, int> StaffAttributes = new();

    /// <summary>Memory address of the person part (used to walk contracts and squads).</summary>
    public ulong PersonAddr;
}
