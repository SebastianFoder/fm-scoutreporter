using System.Collections.Concurrent;

namespace ScoutReporter.Reader;

/// <summary>
/// Experiment (`probe-lists`): find lists of players in fm.exe's memory, such as the result of the
/// player search screen, by looking for long runs of values that are all player object addresses
/// (pointers, every 8, 16 or 24 bytes) or all player UIDs (every 4 or 8 bytes). Read-only, like the
/// scan. Used to find out whether FM keeps the filtered search result (and so its "player's
/// interest" verdict) somewhere we can read.
/// </summary>
internal static class Probe
{
    public sealed record Run(ulong Address, string Kind, int Stride, int Length, uint[] Sample);

    /// <summary>
    /// `indexToUid`: FM's full player list (position to UID), to also find lists of positions in
    /// it. Null on the first pass.
    /// </summary>
    public static List<Run> Lists(GameProcess game, ScanResult scan, int minLength, uint[] indexToUid = null)
    {
        var addrToUid = scan.PersonToUid;
        var uids = new HashSet<uint>(scan.Players.Select(p => p.Uid));
        var runs = new ConcurrentBag<Run>();
        var mem = new MemScan(game);
        var regions = mem.ScanRegions.Where(r => r.size >= 0x40).ToList();
        int chunk = MemScan.ChunkBytes;

        Parallel.ForEach(regions, new ParallelOptions { MaxDegreeOfParallelism = Math.Clamp(Environment.ProcessorCount - 1, 1, 6) },
            () => GC.AllocateUninitializedArray<byte>(chunk),
            (region, _, buf) =>
            {
                var (start, size) = region;
                for (ulong done = 0; done < size;)
                {
                    int want = (int)Math.Min((ulong)chunk, size - done);
                    ulong chunkBase = start + done;
                    done += (ulong)want;
                    if (!mem.ReadBlock(chunkBase, buf, want)) continue;

                    // Pointers to player objects, every 8/16/24 bytes.
                    int slots = want / 8;
                    var ptrUid = new uint[slots];
                    for (int j = 0; j < slots; j++)
                    {
                        ulong v = BitConverter.ToUInt64(buf, j * 8);
                        if (v != 0 && addrToUid.TryGetValue(v, out uint uid)) ptrUid[j] = uid;
                    }
                    foreach (int k in new[] { 1, 2, 3, 4, 5, 6, 7, 8 }) Collect(ptrUid, k, 8 * k, "pointer", chunkBase, minLength, runs);

                    // UIDs, every 4/8 bytes.
                    int words = want / 4;
                    var uidAt = new uint[words];
                    for (int j = 0; j < words; j++)
                    {
                        uint v = BitConverter.ToUInt32(buf, j * 4);
                        if (v > 0 && uids.Contains(v)) uidAt[j] = v;
                    }
                    foreach (int k in Enumerable.Range(1, 16)) Collect(uidAt, k, 4 * k, "uid", chunkBase, minLength, runs);

                    // Positions in FM's full player list (int32), every 4/8 bytes.
                    if (indexToUid != null)
                    {
                        var idxAt = new uint[words];
                        for (int j = 0; j < words; j++)
                        {
                            int v = BitConverter.ToInt32(buf, j * 4);
                            if (v > 0 && v < indexToUid.Length) idxAt[j] = indexToUid[v];
                        }
                        foreach (int k in new[] { 1, 2 }) Collect(idxAt, k, 4 * k, "index", chunkBase, minLength, runs, distinctOnly: true);
                    }
                }
                return buf;
            },
            _ => { });
        mem.ReleaseSnapshot();
        return runs.OrderByDescending(r => r.Length).ToList();
    }

    /// <summary>Runs of non-zero entries every `step` slots (each slot `slotBytes / step` bytes apart).</summary>
    private static void Collect(uint[] at, int step, int strideBytes, string kind, ulong chunkBase, int minLength, ConcurrentBag<Run> runs, bool distinctOnly = false)
    {
        int slotBytes = strideBytes / step;
        for (int phase = 0; phase < step; phase++)
        {
            int runStart = -1, len = 0;
            for (int j = phase; j <= at.Length; j += step)
            {
                bool hit = j < at.Length && at[j] != 0;
                if (hit)
                {
                    if (len == 0) runStart = j;
                    len++;
                    continue;
                }
                if (len >= minLength)
                {
                    var sample = new uint[Math.Min(5, len)];
                    for (int s = 0; s < sample.Length; s++) sample[s] = at[runStart + s * step];
                    // A stride-1 run also shows up as stride 2 and 3 at half/third the length: keep
                    // only the finest stride for a run.
                    // Small numbers are everywhere: a list of positions must name different players.
                    bool distinct = !distinctOnly || DistinctShare(at, runStart, len, step) > 0.95;
                    if (distinct && (step == 1 || !IsDenser(at, runStart, len, step)))
                        runs.Add(new Run(chunkBase + (ulong)(runStart * slotBytes), kind, strideBytes, len, sample));
                }
                len = 0;
            }
        }
    }

    private static double DistinctShare(uint[] at, int runStart, int len, int step)
    {
        var seen = new HashSet<uint>();
        int n = Math.Min(len, 5000);
        for (int s = 0; s < n; s++) seen.Add(at[runStart + s * step]);
        return (double)seen.Count / n;
    }

    /// <summary>The players of a run (all entries).</summary>
    public static IEnumerable<uint> Entries(MemScan mem, Run r, uint[] indexToUid, Dictionary<ulong, uint> addrToUid)
    {
        for (int i = 0; i < r.Length; i++)
        {
            ulong a = r.Address + (ulong)(i * r.Stride);
            yield return r.Kind switch
            {
                "pointer" => addrToUid.GetValueOrDefault(mem.Ptr(a)),
                "uid" => mem.U32(a),
                _ => mem.I32(a) is int ix && ix >= 0 && ix < indexToUid.Length ? indexToUid[ix] : 0,
            };
        }
    }

    public sealed record Hit(ulong Address, string Kind);

    /// <summary>
    /// Every place in memory that refers to one of `targets`: its UID (4 bytes), a pointer to its
    /// object or player block, or its position in FM's full player list (4 bytes).
    /// </summary>
    public static Dictionary<uint, List<Hit>> Find(GameProcess game, ScanResult scan, uint[] targets, uint[] indexToUid)
    {
        var want = new HashSet<uint>(targets);
        var ptrs = scan.PersonToUid.Where(kv => want.Contains(kv.Value)).ToDictionary(kv => kv.Key, kv => kv.Value);
        var idx = new Dictionary<int, uint>();
        if (indexToUid != null) for (int i = 1; i < indexToUid.Length; i++) if (want.Contains(indexToUid[i])) idx[i] = indexToUid[i];
        var hits = new ConcurrentDictionary<uint, ConcurrentBag<Hit>>();
        foreach (var t in targets) hits[t] = new();
        var mem = new MemScan(game);
        int chunk = MemScan.ChunkBytes;
        Parallel.ForEach(mem.ScanRegions.Where(r => r.size >= 0x40).ToList(), new ParallelOptions { MaxDegreeOfParallelism = 6 },
            () => GC.AllocateUninitializedArray<byte>(chunk),
            (region, _, buf) =>
            {
                var (start, size) = region;
                for (ulong done = 0; done < size;)
                {
                    int n = (int)Math.Min((ulong)chunk, size - done);
                    ulong chunkBase = start + done;
                    done += (ulong)n;
                    if (!mem.ReadBlock(chunkBase, buf, n)) continue;
                    for (int i = 0; i + 4 <= n; i += 4)
                    {
                        uint v = BitConverter.ToUInt32(buf, i);
                        if (want.Contains(v)) hits[v].Add(new Hit(chunkBase + (ulong)i, "uid"));
                        if (idx.TryGetValue((int)v, out uint u) && v > 1000) hits[u].Add(new Hit(chunkBase + (ulong)i, "index"));
                        if ((i & 7) == 0 && i + 8 <= n && ptrs.TryGetValue(BitConverter.ToUInt64(buf, i), out uint pu)) hits[pu].Add(new Hit(chunkBase + (ulong)i, "pointer"));
                    }
                }
                return buf;
            },
            _ => { });
        mem.ReleaseSnapshot();
        return hits.ToDictionary(kv => kv.Key, kv => kv.Value.OrderBy(h => h.Address).ToList());
    }

    /// <summary>A place that leads to a target player: follow a pointer and add an offset, per step.</summary>
    public sealed record Node(ulong Address, int Target, string Kind, int[] Offsets);

    /// <summary>
    /// One level up: every 8-byte value in memory that points at most `window` bytes before a node
    /// (the start of an object that holds the node).
    /// </summary>
    public static List<Node> Referrers(GameProcess game, List<Node> nodes, int window, int perNodeCap = 64)
    {
        var sorted = nodes.OrderBy(n => n.Address).ToArray();
        var addrs = sorted.Select(n => n.Address).ToArray();
        if (addrs.Length == 0) return new();
        ulong lo = addrs[0] - (ulong)window, hi = addrs[^1];
        var found = new ConcurrentBag<Node>();
        var counts = new int[sorted.Length];
        var mem = new MemScan(game);
        int chunk = MemScan.ChunkBytes;
        Parallel.ForEach(mem.ScanRegions.Where(r => r.size >= 0x40).ToList(), new ParallelOptions { MaxDegreeOfParallelism = 6 },
            () => GC.AllocateUninitializedArray<byte>(chunk),
            (region, _, buf) =>
            {
                var (start, size) = region;
                for (ulong done = 0; done < size;)
                {
                    int n = (int)Math.Min((ulong)chunk, size - done);
                    ulong chunkBase = start + done;
                    done += (ulong)n;
                    if (!mem.ReadBlock(chunkBase, buf, n)) continue;
                    for (int i = 0; i + 8 <= n; i += 8)
                    {
                        ulong v = BitConverter.ToUInt64(buf, i);
                        if (v < lo || v > hi) continue;
                        int ix = Array.BinarySearch(addrs, v);
                        if (ix < 0) ix = ~ix;
                        for (; ix < addrs.Length && addrs[ix] - v < (ulong)window; ix++)
                        {
                            if (Interlocked.Increment(ref counts[ix]) > perNodeCap) continue;
                            var node = sorted[ix];
                            var offsets = new int[node.Offsets.Length + 1];
                            offsets[0] = (int)(addrs[ix] - v);
                            node.Offsets.CopyTo(offsets, 1);
                            found.Add(new Node(chunkBase + (ulong)i, node.Target, node.Kind, offsets));
                        }
                    }
                }
                return buf;
            },
            _ => { });
        mem.ReleaseSnapshot();
        return found.ToList();
    }

    /// <summary>The player a list slot leads to, following the node's offsets.</summary>
    public static uint Resolve(MemScan mem, ulong slot, string kind, int[] offsets, uint[] indexToUid, Dictionary<ulong, uint> addrToUid)
    {
        ulong a = slot;
        foreach (int off in offsets)
        {
            ulong ptr = mem.Ptr(a);
            if (ptr < 0x10000) return 0;
            a = ptr + (ulong)off;
        }
        return kind switch
        {
            "uid" => mem.U32(a),
            "pointer" => addrToUid.GetValueOrDefault(mem.Ptr(a)),
            _ => mem.I32(a) is int ix && indexToUid != null && ix > 0 && ix < indexToUid.Length ? indexToUid[ix] : 0,
        };
    }

    /// <summary>True when the entries between the run's entries are hits too (a finer stride covers it).</summary>
    private static bool IsDenser(uint[] at, int runStart, int len, int step)
    {
        int between = 0, checkedCount = Math.Min(len - 1, 50);
        for (int s = 0; s < checkedCount; s++) if (at[runStart + s * step + 1] != 0) between++;
        return checkedCount > 0 && between * 2 > checkedCount;
    }
}
