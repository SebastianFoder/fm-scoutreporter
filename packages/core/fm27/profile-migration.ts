import type { AttributeKey, WeightProfile } from "@scoutreporter/core/types/weights";
import { fm27BenchmarkProfiles } from "./benchmarks";
import { FM_SCORING_FM27_WEIGHTS } from "./fm-scoring-weights";

/**
 * Saved weight profiles (localStorage `weightProfiles`, also used by the desktop app's window).
 * `seeded` records which benchmark seeding the config has had:
 * - 1: the five fm-scoring FM27 role profiles were added (v1.x);
 * - 2: the roles moved to the FM Match Lab weights and "WB/6" (`fm27-wb6`) split into `fm27-wb` and `fm27-dm`.
 */
export type StoredWeightConfig = {
  activeId: string;
  profiles: WeightProfile[];
  seeded?: number;
};

export const WEIGHT_SEED_VERSION = 2;

/** Benchmark profile ids each seed version introduced (deleted ones stay deleted after their seed). */
const SEEDED_IDS: Record<number, string[]> = {
  1: ["fm27-cb", "fm27-wb6", "fm27-10", "fm27-9", "fm27-gk"],
  2: ["fm27-wb", "fm27-dm"],
};

const OLD_WB6_ID = "fm27-wb6";
const OLD_WB6_NAME = "FM27 · Wing-back / DM (6)";

/** Same weights, treating a missing key as 0 (saved profiles carry every key, the benchmarks only the used ones). */
function sameWeights(a: WeightProfile["weights"], b: WeightProfile["weights"]): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)] as AttributeKey[]);
  for (const k of keys) if ((a[k] ?? 0) !== (b[k] ?? 0)) return false;
  return true;
}

/**
 * Bring a saved config up to the current benchmarks. Idempotent: a config at WEIGHT_SEED_VERSION is returned as is.
 * - Benchmark profiles the user never edited (weights still exactly fm-scoring's) get the Match Lab weights, name and
 *   description; their emphasis stays as the user set it.
 * - Edited ones keep the user's weights. The four roles that still exist keep their id, so "Reset to benchmark"
 *   now resets to Match Lab; an edited WB/6 becomes an ordinary custom profile (there is no WB/6 benchmark left).
 * - An unedited WB/6 is replaced by the new Full-back / Wing-back and Defensive / Central midfielder profiles, at its
 *   place in the list; an active WB/6 becomes the Full-back / Wing-back profile.
 * - Benchmark profiles a seed version adds are added once; ones the user deleted later stay deleted.
 */
export function migrateWeightConfig(config: StoredWeightConfig): StoredWeightConfig {
  const seeded = config.seeded ?? 0;
  if (seeded >= WEIGHT_SEED_VERSION) return config;

  const benchmarks = fm27BenchmarkProfiles();
  const benchmark = new Map(benchmarks.map((p) => [p.id, p]));
  const old = FM_SCORING_FM27_WEIGHTS as Record<string, WeightProfile["weights"]>;

  let activeId = config.activeId;
  let wb6Index = -1;
  const profiles: WeightProfile[] = [];
  for (const p of config.profiles) {
    const oldWeights = seeded < 2 ? old[p.id] : undefined;
    if (!oldWeights) {
      profiles.push(p);
      continue;
    }
    const unedited = sameWeights(p.weights, oldWeights);
    if (p.id === OLD_WB6_ID) {
      wb6Index = profiles.length;
      if (unedited) {
        if (activeId === OLD_WB6_ID) activeId = "fm27-wb";
      } else {
        profiles.push({
          ...p,
          name: p.name === OLD_WB6_NAME ? "Wing-back / DM (6), edited" : p.name,
          description: "Your edit of fm-scoring's former FM27 WB/6 benchmark",
          builtIn: undefined,
        });
      }
      continue;
    }
    const next = benchmark.get(p.id)!;
    profiles.push(unedited ? { ...next, emphasis: p.emphasis ?? next.emphasis } : p);
  }

  const have = new Set(profiles.map((p) => p.id));
  const due = new Set(
    Object.entries(SEEDED_IDS).flatMap(([version, ids]) => (seeded < Number(version) ? ids : [])),
  );
  const added = benchmarks.filter((b) => due.has(b.id) && !have.has(b.id));
  // New role profiles take WB/6's place in the list; anything else goes at the end.
  const at = wb6Index >= 0 ? wb6Index : profiles.length;
  profiles.splice(at, 0, ...added);

  if (!profiles.some((p) => p.id === activeId)) activeId = profiles[0]?.id ?? activeId;
  return { activeId, profiles, seeded: WEIGHT_SEED_VERSION };
}
