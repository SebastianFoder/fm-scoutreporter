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
    /// <summary>
    /// The vtables of a class in a module image, by its MSVC RTTI name (".?AVNAME@@"): the name is
    /// in the class's type descriptor, a complete object locator refers to that descriptor, and the
    /// slot just before a vtable points at the locator. Only the primary vtable (offset 0) counts.
    /// `image` is the module as mapped in memory, so an index into it is an RVA.
    /// </summary>
    internal static List<ulong> VtablesOfType(byte[] image, ulong imageBase, string decoratedName)
    {
        var result = new List<ulong>();
        if (image == null) return result;
        byte[] name = System.Text.Encoding.ASCII.GetBytes(decoratedName + "\0");
        for (int at = image.AsSpan().IndexOf(name); at >= 0;)
        {
            int descriptor = at - 16;   // the name follows two pointers
            if (descriptor >= 0)
                for (int i = 0; i + 24 <= image.Length; i += 4)
                {
                    // Locator: signature 1, offset, cdOffset, type descriptor RVA, class RVA, own RVA.
                    if (BitConverter.ToUInt32(image, i + 12) != (uint)descriptor) continue;
                    if (BitConverter.ToUInt32(image, i) != 1 || BitConverter.ToUInt32(image, i + 20) != (uint)i) continue;
                    if (BitConverter.ToUInt32(image, i + 4) != 0) continue;
                    ulong locator = imageBase + (ulong)i;
                    for (int j = 0; j + 16 <= image.Length; j += 8)
                        if (BitConverter.ToUInt64(image, j) == locator) result.Add(imageBase + (ulong)j + 8);
                }
            int next = image.AsSpan(at + 1).IndexOf(name);
            at = next < 0 ? -1 : at + 1 + next;
        }
        return result;
    }

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

    public unsafe ulong Ptr(ulong a) { ulong v; return ReadSmall(a, &v, 8) ? v : 0UL; }
    public unsafe uint U32(ulong a) { uint v; return ReadSmall(a, &v, 4) ? v : 0U; }
    public unsafe int I32(ulong a) { int v; return ReadSmall(a, &v, 4) ? v : 0; }
    public unsafe ushort U16(ulong a) { ushort v; return ReadSmall(a, &v, 2) ? v : (ushort)0; }
    public unsafe byte U8(ulong a) { byte v; return ReadSmall(a, &v, 1) ? v : (byte)0; }

    // ---------- page cache ----------
    //
    // Every ReadProcessMemory call costs about a microsecond, whatever its size, and reading a person
    // takes a couple of hundred small reads that mostly fall in the same few pages (the person, its
    // player block, its contract, club and nation). So small reads fetch the whole 4 KB page once
    // and serve the rest from it. Windows grants or refuses access per page, so a read inside a page
    // succeeds exactly when reading the page does: the results are the same as reading directly.
    // Each thread has its own cache (no locks); it is dropped when the reads switch process.

    internal const int PageSize = 4096;
    private const int CachePages = 256;   // per thread: 1 MB, direct-mapped by page number

    private sealed class PageCache
    {
        public readonly ulong[] Tags = new ulong[CachePages];   // page number + 1; 0 = empty
        public readonly byte[] Data = GC.AllocateUninitializedArray<byte>(CachePages * PageSize, pinned: true);
        public int Epoch;
    }

    private readonly ThreadLocal<PageCache> _pages = new(() => new PageCache());
    private int _cacheEpoch;

    /// <summary>Forget every cached page (the reads now come from another process handle).</summary>
    private void DropPageCache() => Interlocked.Increment(ref _cacheEpoch);

    /// <summary>
    /// Set on a thread whose small reads are scattered one-offs (the scan pass checking a possible
    /// club): fetching a whole page for each would cost more than it saves.
    /// </summary>
    [ThreadStatic] internal static bool BypassPageCache;

    /// <summary>A small read through the page cache; one that spans two pages is read directly.</summary>
    private unsafe bool ReadSmall(ulong addr, void* dst, int len)
    {
        if (addr == 0) return false;
        int off = (int)(addr & (PageSize - 1));
        if (off + len > PageSize || BypassPageCache) return ReadRaw(addr, dst, len);
        ulong page = addr / PageSize;
        var c = _pages.Value;
        int epoch = Volatile.Read(ref _cacheEpoch);
        if (c.Epoch != epoch)
        {
            Array.Clear(c.Tags);
            c.Epoch = epoch;
        }
        int slot = (int)(page % CachePages);
        fixed (byte* data = c.Data)
        {
            byte* at = data + slot * PageSize;
            if (c.Tags[slot] != page + 1)
            {
                if (!ReadRaw(page * PageSize, at, PageSize))
                {
                    // Not readable as a whole page: read the bytes themselves, as before the cache.
                    c.Tags[slot] = 0;
                    return ReadRaw(addr, dst, len);
                }
                c.Tags[slot] = page + 1;
            }
            Buffer.MemoryCopy(at + off, dst, len, len);
            return true;
        }
    }

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
        if (!ReadSmall(addr, buf, maxLen))
        {
            // Fallback: read less (the string can sit right before the end of a region).
            maxLen = 32;
            if (!ReadSmall(addr, buf, maxLen)) return null;
        }
        int n = 0;
        while (n < maxLen && buf[n] != 0) n++;
        var s = n == 0 ? "" : System.Text.Encoding.UTF8.GetString(buf, n).Trim();
        return s.Length == 0 ? null : s;
    }
}
