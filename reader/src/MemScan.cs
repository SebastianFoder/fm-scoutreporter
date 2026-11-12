namespace ScoutReporter.Reader;

/// <summary>What a database object found by the scan is.</summary>
internal enum ObjKind : byte { None, Player, Staff, HumanManager }

/// <summary>
/// A recognised object class and where its field blocks are, counted from the address <c>p</c>
/// where the scan found the vtable. On Windows p is the person part (MSVC offset trick, see
/// MemScan.Win.cs).
/// </summary>
internal sealed class ObjClass
{
    public ObjKind Kind;
    public long BlockOff;    // player or staff block (PLAO_* / NPLO_*) = p + BlockOff
    public int Hist;         // key in the class histogram (diagnostics)
}

/// <summary>
/// Read-only memory access to the FM process. Adapted from FMSuperScout (MIT). The platform part
/// (MemScan.Win.cs) provides the regions, the module map, <c>ReadRaw</c> and class recognition; the
/// typed reads and FM's string layouts are here.
///
/// Every read goes through the operating system (ReadProcessMemory) and returns 0/false for an
/// invalid address. Nothing is ever written to the game.
/// </summary>
internal sealed partial class MemScan
{
    // Regions to scan for database objects (FM's heap).
    public readonly List<(ulong start, ulong size)> ScanRegions = new();

    public ulong GaBase { get; private set; }   // GameAssembly (Unity/C# layer)
    public ulong GaEnd { get; private set; }
    public ulong GpBase { get; private set; }   // game_plugin (native C++ database: person objects live here)
    public ulong GpEnd { get; private set; }
    public string GpPath { get; private set; }  // file path of game_plugin (version detection)

    // Fast lower/upper bound spanning exactly the two modules where database objects have their
    // vtable. Most 8-byte words in the heap are small numbers far below this, so the scan's hot
    // loop rejects them with one comparison before the exact InGp/InGa check.
    private ulong _loMod, _hiMod;

    private void SetModuleBounds()
    {
        ulong lo = ulong.MaxValue, hi = 0;
        if (GpBase != 0) { lo = System.Math.Min(lo, GpBase); hi = System.Math.Max(hi, GpEnd); }
        if (GaBase != 0) { lo = System.Math.Min(lo, GaBase); hi = System.Math.Max(hi, GaEnd); }
        _loMod = lo == ulong.MaxValue ? 0 : lo;
        _hiMod = hi;
    }

    public bool InGa(ulong addr) => addr >= GaBase && addr < GaEnd;
    public bool InGp(ulong addr) => GpBase != 0 && addr >= GpBase && addr < GpEnd;
    public ulong ModLo => _loMod;
    public ulong ModHi => _hiMod;

    /// <summary>Read a whole block. False for an invalid address (never crashes).</summary>
    public unsafe bool ReadBlock(ulong addr, byte[] buf, int len)
    {
        fixed (byte* b = buf) return ReadRaw(addr, b, len);
    }

    public unsafe ulong Ptr(ulong a) { ulong v; return ReadRaw(a, &v, 8) ? v : 0UL; }
    public unsafe uint U32(ulong a) { uint v; return ReadRaw(a, &v, 4) ? v : 0U; }
    public unsafe int I32(ulong a) { int v; return ReadRaw(a, &v, 4) ? v : 0; }
    public unsafe ushort U16(ulong a) { ushort v; return ReadRaw(a, &v, 2) ? v : (ushort)0; }
    public unsafe byte U8(ulong a) { byte v; return ReadRaw(a, &v, 1) ? v : (byte)0; }

    /// <summary>Nested FM string: [addr] -> outer, [outer] -> inner, UTF-8 string at inner+4.</summary>
    public string NestedString(ulong addr, int maxLen = 128)
    {
        ulong outer = Ptr(addr);
        if (outer == 0) return null;
        ulong inner = Ptr(outer);
        if (inner == 0) return null;
        return CStr(inner + 4, maxLen);
    }

    /// <summary>Indirect FM string: [addr] -> ptr, UTF-8 string at ptr+4.</summary>
    public string IndirectString(ulong addr, int maxLen = 128)
    {
        ulong p = Ptr(addr);
        if (p == 0) return null;
        return CStr(p + 4, maxLen);
    }

    public unsafe string CStr(ulong addr, int maxLen)
    {
        maxLen = System.Math.Clamp(maxLen, 32, 256);
        byte* buf = stackalloc byte[maxLen];
        if (!ReadRaw(addr, buf, maxLen))
        {
            // Fallback: read less (the string can sit right before the end of a region).
            maxLen = 32;
            if (!ReadRaw(addr, buf, maxLen)) return null;
        }
        int n = 0;
        while (n < maxLen && buf[n] != 0) n++;
        var s = n == 0 ? "" : System.Text.Encoding.UTF8.GetString(buf, n).Trim();
        return s.Length == 0 ? null : s;
    }
}
