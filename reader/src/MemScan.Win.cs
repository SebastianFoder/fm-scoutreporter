using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace ScoutReporter.Reader;

/// <summary>
/// The FM process being read: an external fm.exe, opened with read rights only. Nothing is ever
/// written. Adapted from FMSuperScout (MIT).
/// </summary>
internal sealed class GameProcess : IDisposable
{
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern nint OpenProcess(uint access, bool inherit, int pid);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(nint h);

    private const uint PROCESS_VM_READ = 0x0010;
    private const uint PROCESS_QUERY_INFORMATION = 0x0400;
    private const uint PROCESS_DUP_HANDLE = 0x0040;
    private const uint PROCESS_CREATE_PROCESS = 0x0080;   // needed for the VA clone (PssCaptureSnapshot)

    public nint Handle { get; }
    public Process Process { get; }

    private GameProcess(nint h, Process p) { Handle = h; Process = p; }

    /// <summary>Open fm.exe with read rights only (least privilege).</summary>
    public static GameProcess Open(Process p)
    {
        nint h = OpenProcess(PROCESS_VM_READ | PROCESS_QUERY_INFORMATION, false, p.Id);
        if (h == 0) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), $"cannot open fm.exe (pid {p.Id})");
        return new(h, p);
    }

    /// <summary>
    /// A handle with clone rights for PssCaptureSnapshot, requested only for the snapshot retry.
    /// 0 = not granted. The caller closes it (ReleaseCloneHandle) once the capture is done.
    /// </summary>
    public nint OpenCloneHandle() =>
        OpenProcess(PROCESS_VM_READ | PROCESS_QUERY_INFORMATION | PROCESS_DUP_HANDLE | PROCESS_CREATE_PROCESS, false, Process.Id);
    public void ReleaseCloneHandle(nint h) { if (h != 0) CloseHandle(h); }

    public void Dispose() => CloseHandle(Handle);
}

/// <summary>
/// Windows part: ReadProcessMemory on fm.exe. ReadProcessMemory reads in kernel mode and returns
/// false for a bad address, so it is completely crash-safe: the approach external FM editors use.
/// </summary>
internal sealed partial class MemScan
{
    [StructLayout(LayoutKind.Sequential)]
    private struct MEMORY_BASIC_INFORMATION
    {
        public ulong BaseAddress;
        public ulong AllocationBase;
        public uint AllocationProtect;
        public uint __alignment1;
        public ulong RegionSize;
        public uint State;
        public uint Protect;
        public uint Type;
        public uint __alignment2;
    }

    [DllImport("kernel32.dll")]
    private static extern ulong VirtualQueryEx(nint hProcess, ulong lpAddress, out MEMORY_BASIC_INFORMATION lpBuffer, ulong dwLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(nint hObject);

    [DllImport("kernel32.dll")]
    private static extern nint GetCurrentProcess();

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern unsafe bool ReadProcessMemory(nint hProcess, ulong lpBaseAddress,
        void* lpBuffer, nuint nSize, out nuint lpNumberOfBytesRead);

    [StructLayout(LayoutKind.Sequential)]
    private struct MEMORYSTATUSEX
    {
        public uint dwLength;
        public uint dwMemoryLoad;
        public ulong ullTotalPhys, ullAvailPhys, ullTotalPageFile, ullAvailPageFile,
                     ullTotalVirtual, ullAvailVirtual, ullAvailExtendedVirtual;
    }
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GlobalMemoryStatusEx(ref MEMORYSTATUSEX lpBuffer);

    /// <summary>Free physical memory, free commit (RAM + page file) and load (%). Drives the worker count.</summary>
    public static (ulong availPhys, ulong availCommit, uint loadPct) MemoryStatus()
    {
        try
        {
            var ms = new MEMORYSTATUSEX { dwLength = (uint)Marshal.SizeOf<MEMORYSTATUSEX>() };
            if (GlobalMemoryStatusEx(ref ms)) return (ms.ullAvailPhys, ms.ullAvailPageFile, ms.dwMemoryLoad);
        }
        catch { }
        return (0, 0, 0);
    }

    // Process Snapshotting API (Windows 8.1+): a copy-on-write clone of fm.exe's address space.
    [DllImport("kernel32.dll")]
    private static extern uint PssCaptureSnapshot(nint processHandle, uint captureFlags, uint threadContextFlags, out nint snapshotHandle);
    [DllImport("kernel32.dll")]
    private static extern uint PssQuerySnapshot(nint snapshotHandle, uint informationClass, out nint buffer, uint bufferLength);
    [DllImport("kernel32.dll")]
    private static extern uint PssFreeSnapshot(nint processHandle, nint snapshotHandle);
    private const uint PSS_CAPTURE_VA_CLONE = 0x00000001;
    private const uint PSS_QUERY_VA_CLONE_INFORMATION = 1;

    private const uint MEM_COMMIT = 0x1000;
    private const uint MEM_PRIVATE = 0x20000;
    private const uint PAGE_READWRITE = 0x04;
    private const uint PAGE_WRITECOPY = 0x08;
    private const uint PAGE_GUARD = 0x100;
    private const uint PAGE_NOACCESS = 0x01;

    // Read source: the live process by default (fast, no extra memory pressure). On request a VA
    // clone: a frozen copy-on-write snapshot of the whole address space, so pages FM frees or
    // rewrites during the scan stay readable. The clone costs commit memory and slows FM down (every
    // write becomes a page copy), so it is a retry when live reading fails, not the default.
    private readonly GameProcess _game;
    private nint _proc;
    private nint _snap, _vaClone;
    public bool Snapshotted { get; private set; }

    // Cached module images for vtable/meta lookups without a syscall per candidate.
    private byte[] _gp;   // game_plugin.dll
    private byte[] _ga;   // GameAssembly.dll

    /// <summary>Set when the image cache was skipped on purpose (little free memory), for the log.</summary>
    public string ImageNote { get; private set; }

    /// <summary>Why the snapshot failed (null = it worked or was not asked for).</summary>
    public string SnapshotError { get; private set; }

    /// <summary>Upper bound for parallel read threads.</summary>
    public const int MaxWorkers = 8;
    /// <summary>Read block per worker: ReadProcessMemory is expensive per call, so big blocks.</summary>
    public const int ChunkBytes = 32 * 1024 * 1024;

    public MemScan(GameProcess game, bool useSnapshot = false)
    {
        _game = game;
        _proc = game.Handle;
        if (useSnapshot) TrySnapshot();   // points _proc at the clone; regions and reads then come from it
        BuildRegions();
        FindModules();      // module addresses are the same in the clone
        _gp = CacheImage(GpBase, GpEnd, "game_plugin.dll");
        _ga = CacheImage(GaBase, GaEnd, "GameAssembly.dll");
    }

    private void TrySnapshot()
    {
        try
        {
            nint cloneRights = _game.OpenCloneHandle();
            if (cloneRights == 0)
            {
                SnapshotError = $"no clone rights on fm.exe (Win32 {Marshal.GetLastWin32Error()})";
                return;
            }
            uint rc;
            try { rc = PssCaptureSnapshot(cloneRights, PSS_CAPTURE_VA_CLONE, 0, out _snap); }
            finally { _game.ReleaseCloneHandle(cloneRights); }   // the clone lives on without this handle
            if (rc != 0)
            {
                // 8 = not enough memory, 1455 = commitment limit, 5 = access denied.
                SnapshotError = $"PssCaptureSnapshot failed (Win32 {rc}: {new System.ComponentModel.Win32Exception((int)rc).Message})";
                _snap = 0;
                return;
            }
            if (PssQuerySnapshot(_snap, PSS_QUERY_VA_CLONE_INFORMATION, out nint clone, (uint)IntPtr.Size) is uint qrc && (qrc != 0 || clone == 0))
            {
                SnapshotError = $"PssQuerySnapshot failed (Win32 {qrc})";
                PssFreeSnapshot(GetCurrentProcess(), _snap); _snap = 0;
                return;
            }
            _vaClone = clone;
            _proc = clone;
            DropPageCache();
            Snapshotted = true;
        }
        catch (Exception e)
        {
            SnapshotError = "exception: " + e.Message;   // fall back to reading live
        }
    }

    /// <summary>
    /// Release the clone as soon as the scan is done: while it lives, every page FM changes costs a
    /// copy. Reads fall back to the live process afterwards.
    /// </summary>
    // PssFreeSnapshot's first argument is the process that holds the snapshot handle: us, not fm.exe.
    public void ReleaseSnapshot()
    {
        if (!Snapshotted) return;
        Snapshotted = false;
        _proc = _game.Handle;
        DropPageCache();
        try { CloseHandle(_vaClone); } catch { }
        try { PssFreeSnapshot(GetCurrentProcess(), _snap); } catch { }
        _vaClone = 0; _snap = 0;
    }

    private byte[] CacheImage(ulong start, ulong end, string name)
    {
        if (start == 0 || end <= start) return null;
        ulong len64 = end - start;
        if (len64 > int.MaxValue) return null;
        int len = (int)len64;
        // Little free physical memory? Skip the cache: lookups fall back to single reads, slower
        // but the scan still works and the allocation does not add to the memory pressure.
        var (availPhys, _, _) = MemoryStatus();
        if (availPhys != 0 && (ulong)len * 2 > availPhys)
        {
            ImageNote = $"image cache for {name} ({len / (1024 * 1024)} MB) skipped: only {availPhys / (1024 * 1024)} MB free, using single reads (slower)";
            return null;
        }
        byte[] image;
        try { image = new byte[len]; }
        catch (OutOfMemoryException)
        {
            ImageNote = $"image cache for {name} ({len / (1024 * 1024)} MB) not allocated (out of memory), using single reads (slower)";
            return null;
        }
        const int chunk = 8 * 1024 * 1024;
        var tmp = new byte[chunk];
        int done = 0;
        while (done < len)
        {
            int want = System.Math.Min(chunk, len - done);
            if (ReadBlock(start + (ulong)done, tmp, want)) Array.Copy(tmp, 0, image, done, want);
            done += want;
        }
        return image;
    }

    /// <summary>Vtables of a game_plugin class by RTTI name; empty without the image cache.</summary>
    public List<ulong> GamePluginVtables(string decoratedName) => VtablesOfType(_gp, GpBase, decoratedName);

    // Fast image reads (out of range: single read). Bounds are checked as (addr - base) so a corrupt
    // pointer near ulong.MaxValue cannot wrap around into a negative index (upstream issue #16).
    private ulong ImgPtr(ulong addr)
    {
        if (_gp != null && addr >= GpBase && addr - GpBase + 8 <= (ulong)_gp.Length) return BitConverter.ToUInt64(_gp, (int)(addr - GpBase));
        if (_ga != null && addr >= GaBase && addr - GaBase + 8 <= (ulong)_ga.Length) return BitConverter.ToUInt64(_ga, (int)(addr - GaBase));
        return Ptr(addr);
    }
    private int ImgI32(ulong addr)
    {
        if (_gp != null && addr >= GpBase && addr - GpBase + 4 <= (ulong)_gp.Length) return BitConverter.ToInt32(_gp, (int)(addr - GpBase));
        if (_ga != null && addr >= GaBase && addr - GaBase + 4 <= (ulong)_ga.Length) return BitConverter.ToInt32(_ga, (int)(addr - GaBase));
        return I32(addr);
    }

    private static bool IsScannable(in MEMORY_BASIC_INFORMATION m)
    {
        if (m.State != MEM_COMMIT) return false;
        if ((m.Protect & PAGE_GUARD) != 0 || (m.Protect & PAGE_NOACCESS) != 0) return false;
        // Person objects live in the private read/write heap. Limiting the scan to it skips image,
        // mapped and code regions, which are slow or unsafe to read.
        if (m.Type != MEM_PRIVATE) return false;
        return (m.Protect & (PAGE_READWRITE | PAGE_WRITECOPY)) != 0;
    }

    private void BuildRegions()
    {
        ulong addr = 0x10000;
        ulong max = 0x7FFFFFFFFFFF;
        int guard = 0;
        while (addr < max && guard++ < 2_000_000)
        {
            if (VirtualQueryEx(_proc, addr, out var mbi, (ulong)Marshal.SizeOf<MEMORY_BASIC_INFORMATION>()) == 0)
                break;
            if (mbi.RegionSize == 0) break;
            if (IsScannable(mbi) && mbi.RegionSize <= 512UL * 1024 * 1024)
                ScanRegions.Add((mbi.BaseAddress, mbi.RegionSize));
            addr = mbi.BaseAddress + mbi.RegionSize;
        }
    }

    private void FindModules()
    {
        _game.Process.Refresh();   // game_plugin loads late, so refresh the module list
        foreach (ProcessModule m in _game.Process.Modules)
        {
            ulong b = (ulong)m.BaseAddress.ToInt64();
            ulong e = b + (ulong)m.ModuleMemorySize;
            if (string.Equals(m.ModuleName, "GameAssembly.dll", StringComparison.OrdinalIgnoreCase))
            { GaBase = b; GaEnd = e; }
            else if (string.Equals(m.ModuleName, "game_plugin.dll", StringComparison.OrdinalIgnoreCase))
            { GpBase = b; GpEnd = e; GpPath = m.FileName; }
        }
        SetModuleBounds();
    }

    private unsafe bool ReadRaw(ulong addr, void* dst, int len)
    {
        if (addr == 0) return false;
        return ReadProcessMemory(_proc, addr, dst, (nuint)len, out var read) && (int)read == len;
    }

    /// <summary>
    /// The MSVC meta-offset trick: meta = [vtable - 8]; the int32 at meta + 4 is the distance from
    /// this (person) part to the object start, fixed per class. Read from the cached module images,
    /// so no syscall.
    /// </summary>
    public int DynamicOffsetFromVtable(ulong vtable)
    {
        ulong meta = ImgPtr(vtable - 8);
        if (meta == 0) return 0;
        return ImgI32(meta + 4);
    }

    // One ObjClass per class offset; the scan threads share the cache.
    private readonly ConcurrentDictionary<int, ObjClass> _classes = new();

    /// <summary>
    /// The class of the object with this vtable. null = not a database object. Kind None with a Hist
    /// = another database object (possibly a club, recognised by shape).
    /// </summary>
    public ObjClass Classify(ulong vt, Fields f)
    {
        int off = DynamicOffsetFromVtable(vt);
        if (off == 0) return null;
        if (_classes.TryGetValue(off, out var c)) return c;
        var kind = off == f.PLAYER_OFFSET || off == f.PLAYER_STAFF_OFFSET ? ObjKind.Player
                 : off == f.STAFF_OFFSET ? ObjKind.Staff
                 : off == f.HUMAN_MANAGER_OFFSET ? ObjKind.HumanManager
                 : ObjKind.None;
        return _classes.GetOrAdd(off, new ObjClass
        {
            Kind = kind,
            BlockOff = -off,
            Hist = off is > 0 and < 0x2000 ? off : 0,
        });
    }

    /// <summary>Version of game_plugin.dll (for example 27.0.x).</summary>
    public (string version, int major, int minor) GameVersionInfo()
    {
        if (string.IsNullOrEmpty(GpPath)) return (null, 0, 0);
        var fvi = FileVersionInfo.GetVersionInfo(GpPath);
        return (fvi.FileVersion, fvi.FileMajorPart, fvi.FileMinorPart);
    }
}
