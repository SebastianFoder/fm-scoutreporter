import type { AttributeKey, AttributeWeights, WeightProfile } from "@/types/weights";

/**
 * FM27 role weights benchmarked by jamiebolden/fm-scoring (`weights/fm27.toml`), which are tuned toward
 * harvestgreen22's FM27 match-engine attribute test (fm-arena thread 20925).
 * Role score = Σ(attribute × weight) / Σ(weight), on FM's 1–20 scale (linear weighting).
 *
 * The goalkeeper weights are doubled from the source (which uses 0.5 steps) so they stay whole numbers;
 * the ratios, and therefore the scores, are unchanged.
 */
export type Fm27Role = "CB" | "WB/6" | "10" | "9" | "GK";

export interface Fm27RoleDef {
  role: Fm27Role;
  profileId: string;
  name: string;
  description: string;
  weights: AttributeWeights;
}

export const FM27_ROLES: Fm27RoleDef[] = [
  {
    role: "CB",
    profileId: "fm27-cb",
    name: "FM27 · Centre-back",
    description: "fm-scoring FM27 benchmark: CB",
    weights: {
      acceleration: 5,
      anticipation: 3,
      composure: 2,
      decisions: 1,
      firstTouch: 1,
      heading: 3,
      jumpingReach: 5,
      pace: 5,
      passing: 2,
      positioning: 2,
      stamina: 1,
      strength: 3,
      tackling: 1,
      workRate: 1,
    },
  },
  {
    role: "WB/6",
    profileId: "fm27-wb6",
    name: "FM27 · Wing-back / DM (6)",
    description: "fm-scoring FM27 benchmark: WB/6 (full-backs, wing-backs, holding midfielders)",
    weights: {
      acceleration: 5,
      anticipation: 3,
      composure: 1,
      decisions: 1,
      dribbling: 3,
      firstTouch: 1,
      pace: 5,
      passing: 2,
      positioning: 2,
      stamina: 4,
      strength: 1,
      tackling: 1,
      teamWork: 2,
      workRate: 3,
    },
  },
  {
    role: "10",
    profileId: "fm27-10",
    name: "FM27 · Attacker / Winger (10)",
    description: "fm-scoring FM27 benchmark: 10 (attacking midfielders and wingers)",
    weights: {
      acceleration: 5,
      anticipation: 3,
      composure: 2,
      decisions: 1,
      dribbling: 5,
      finishing: 1,
      firstTouch: 1,
      offTheBall: 2,
      pace: 5,
      passing: 2,
      stamina: 2,
      strength: 1,
      teamWork: 1,
      workRate: 2,
    },
  },
  {
    role: "9",
    profileId: "fm27-9",
    name: "FM27 · Striker (9)",
    description: "fm-scoring FM27 benchmark: 9 (strikers)",
    weights: {
      acceleration: 5,
      anticipation: 3,
      composure: 2,
      decisions: 1,
      dribbling: 3,
      finishing: 3,
      firstTouch: 1,
      heading: 1,
      jumpingReach: 5,
      offTheBall: 2,
      pace: 5,
      stamina: 2,
      strength: 1,
      teamWork: 1,
      workRate: 2,
    },
  },
  {
    role: "GK",
    profileId: "fm27-gk",
    name: "FM27 · Goalkeeper",
    description: "fm-scoring FM27 benchmark: GK",
    weights: {
      acceleration: 6,
      anticipation: 2,
      aerialReach: 6,
      agility: 10,
      commandOfArea: 4,
      communication: 2,
      composure: 2,
      concentration: 2,
      decisions: 2,
      handling: 1,
      kicking: 1,
      oneOnOnes: 2,
      passing: 2,
      positioning: 4,
      reflexes: 10,
      throwing: 1,
    },
  },
];

export const OUTFIELD_ROLES = FM27_ROLES.filter((r) => r.role !== "GK");
export const GK_ROLE = FM27_ROLES.find((r) => r.role === "GK")!;

export function fm27BenchmarkProfiles(): WeightProfile[] {
  return FM27_ROLES.map((r) => ({
    id: r.profileId,
    name: r.name,
    description: r.description,
    weights: { ...r.weights },
    emphasis: 1,
    builtIn: "fm27",
  }));
}

/**
 * Expected best-role score by age (fm-scoring `[age_benchmark]`). 100% "vs Age" means the player is on
 * track to be a high-end Championship / low-end Premier League player in their prime once fully developed.
 * Ages outside the table use the nearest end.
 */
export const AGE_BENCHMARK: Record<number, number> = {
  15: 10.3,
  16: 10.9,
  17: 11.5,
  18: 12.2,
  19: 12.6,
  20: 12.9,
  21: 13.2,
  22: 13.4,
  23: 13.7,
  24: 13.8,
};

/** The fully developed (24+) benchmark: what a prime high-end Championship / low-end PL player scores. */
export const PRIME_BENCHMARK = AGE_BENCHMARK[24];

export function ageBenchmark(age: number): number {
  const ages = Object.keys(AGE_BENCHMARK).map(Number);
  const min = Math.min(...ages);
  const max = Math.max(...ages);
  const a = Math.min(max, Math.max(min, Math.round(age || min)));
  return AGE_BENCHMARK[a];
}

/** Linear weighted average on the 1–20 scale; attributes not weighted are ignored. */
export function weightedAverage(
  get: (key: AttributeKey) => number,
  weights: AttributeWeights,
  emphasis = 1,
): number {
  let sum = 0;
  let total = 0;
  for (const key of Object.keys(weights) as AttributeKey[]) {
    const w = weights[key] ?? 0;
    if (w <= 0) continue;
    const wEff = Math.pow(w, emphasis);
    sum += get(key) * wEff;
    total += wEff;
  }
  return total === 0 ? 0 : sum / total;
}

export interface RoleScore {
  role: Fm27Role;
  name: string;
  score: number;
}

/** Score every FM27 role that fits the player (keepers only as GK, outfielders on the four outfield roles). */
export function fm27RoleScores(
  get: (key: AttributeKey) => number,
  isGoalkeeper: boolean,
): RoleScore[] {
  const roles = isGoalkeeper ? [GK_ROLE] : OUTFIELD_ROLES;
  return roles.map((r) => ({
    role: r.role,
    name: r.name,
    score: weightedAverage(get, r.weights),
  }));
}

export function bestFm27Role(
  get: (key: AttributeKey) => number,
  isGoalkeeper: boolean,
): RoleScore {
  const scores = fm27RoleScores(get, isGoalkeeper);
  return scores.reduce((best, s) => (s.score > best.score ? s : best), scores[0]);
}

export function isGoalkeeperPosition(position: string): boolean {
  return /\bGK\b/i.test(position);
}
