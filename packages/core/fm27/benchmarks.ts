import type { AttributeKey, AttributeWeights, WeightProfile } from "@scoutreporter/core/types/weights";

/**
 * FM27 role weights from FM Match Lab Study 13b (caiograco289/Fm-Match-Lab, "what is an attribute worth in each
 * position?", 50,000 matches with every starter's attributes moved ±5 at random, one regression per position).
 * Role score = Σ(attribute × weight) / Σ(weight), on FM's 1–20 scale (linear weighting).
 *
 * Rule (recomputed from the study's numbers in `match-lab.ts` by `fm27.test.ts`):
 * 1. value = expected points per season for +1 level in one player of the position; Strength and Finishing, which
 *    13b confirms on goal difference but not on expected points, use goal difference × 0.6 points per goal (see
 *    "Strength and Finishing" below); the keeper uses points (his shot-stopping changes goals, not xG);
 * 2. keep cells the study confirms (|t| > 2 in both random halves; for the keeper, |t| > 2) worth at least 0.04;
 * 3. scale each position so its top attribute = 10, round half up.
 * Study positions map to roles: CB → CB, FB → WB, DM → DM, AM → 10, ST → 9, GK → GK.
 *
 * Source values per season per level (13b; † = goal difference × 0.6; the keeper in points):
 *          Acc   Pace  JumpR Stam  Antic Bal   Drib  Conc  Vision Str†  Fin†
 *   ST     .20   .21   .19   .07   .10   .09   .05   .06   .02    .10   .13
 *   AM     .15   .17   .10   .10   .07  (.03)  .07  (.03) (.01)   .08  (.04)
 *   DM     .15   .12  (.06)  .09   .07  (.04) (.02) (.02)  .05    .09  (.02)
 *   FB     .17   .17   .08   .10   .07   .06   .08   .07  (.00)  (.05) (.00)
 *   CB     .20   .13   .32   .08   .10   .10  (.03)  .05  (.03)   .10  (.02)
 *   GK     Agility .58, Reflexes .50, Aerial Reach .16, Acceleration .16, Determination .12 (t 2.8);
 *          Handling, Concentration, Positioning, One on Ones under t 2.
 * Brackets: dropped (not confirmed or under 0.04). Every other outfield attribute (Passing, Technique, Tackling,
 * Marking, Positioning, Decisions, Composure, First Touch, Off the Ball, Work Rate, ...) is within ±0.04 in every
 * position in the study, so no role weights it.
 *
 * Strength and Finishing. Finishing acts at the shot, and the engine's xG model reads no attributes (distance, angle
 * and blockers only), so its value shows in goals, not xG; a paired retest by the study's author used it as a control
 * and found the effect again. Strength is confirmed on goal difference (both random halves) for ST, AM, DM and CB,
 * and the Catenaccio run repeats it for the forwards, but its expected points are confirmed nowhere. The study first
 * put this down to conversion. The author has since withdrawn a larger, separate claim ("+0.5 goals a game above xG
 * from 1 to 20"): the retest of +5 Strength gave +0.07 goals above xG, not significant, and he reads Strength in the
 * engine only in body contests (with Balance) and for kick power (FM-Arena, "FM27 match engine: what we know so
 * far", page 4, post #64, 25 November 2026). That retest doesn't contradict 13b: read per game for the whole team,
 * 13b's own forward cells predict about +0.07 for +5, and for one player less. Goal difference also counts goals
 * against, where body contests in defence act. So Strength keeps its goal-difference value because 13b measures it,
 * not because of a known conversion mechanism; revisit it if a study re-measures Strength's goal difference.
 *
 * Caveats from the studies: the weights come from the Gegenpress run (two strikers). 13b's Catenaccio run (a deep
 * 5-2-2-1, 34,340 matches) has the same leaders (correlation 0.85), but its centre-backs gain less from Pace,
 * Acceleration and Jumping Reach and its central attacking midfielders more from Pace. harvestgreen22's cross-tactic
 * test (FM-Arena, 25 November 2026, 1.05 million matches over four tactics) ranks attributes nearly the same in
 * every tactic except Pace, Stamina and Agility, which depend on the shape, so one weight set serves every formation.
 * Match Lab Study 30 found that 27.1 barely changed results (points -0.12 a game, within noise), so the 27.0.1
 * studies stand; passing and shooting attributes, Finishing among them, "may shift a little". Averages over
 * ±5 around levels of 6-18; Study 12 shows Work Rate is a floor (costly below 9, worth nothing above) and Jumping
 * Reach pays little below 9 and most from 12 to 18, which a linear weight can't express. Study 14b found the same
 * values in every English league tier. Purity's FM-Arena test on a 3-4-2-1 (200,000 matches) correlates 0.80 with
 * 13b. Up to v1.23 the app used jamiebolden/fm-scoring's weights instead (`fm-scoring-weights.ts`).
 */
export type Fm27Role = "CB" | "WB" | "DM" | "10" | "9" | "GK";

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
    description: "FM Match Lab FM27 benchmark (Study 13b): centre-backs",
    weights: {
      jumpingReach: 10,
      acceleration: 6,
      pace: 4,
      anticipation: 3,
      balance: 3,
      stamina: 3,
      strength: 3,
      concentration: 2,
    },
  },
  {
    role: "WB",
    profileId: "fm27-wb",
    name: "FM27 · Full-back / Wing-back",
    description: "FM Match Lab FM27 benchmark (Study 13b): full-backs and wing-backs",
    weights: {
      acceleration: 10,
      pace: 10,
      stamina: 6,
      dribbling: 5,
      jumpingReach: 5,
      anticipation: 4,
      balance: 4,
      concentration: 4,
    },
  },
  {
    role: "DM",
    profileId: "fm27-dm",
    name: "FM27 · Defensive / Central midfielder",
    description: "FM Match Lab FM27 benchmark (Study 13b): defensive midfielders, also used for central midfielders",
    weights: {
      acceleration: 10,
      pace: 8,
      stamina: 6,
      strength: 6,
      anticipation: 5,
      vision: 3,
    },
  },
  {
    role: "10",
    profileId: "fm27-10",
    name: "FM27 · Attacker / Winger (10)",
    description: "FM Match Lab FM27 benchmark (Study 13b): attacking midfielders and wingers",
    weights: {
      pace: 10,
      acceleration: 9,
      jumpingReach: 6,
      stamina: 6,
      strength: 5,
      anticipation: 4,
      dribbling: 4,
    },
  },
  {
    role: "9",
    profileId: "fm27-9",
    name: "FM27 · Striker (9)",
    description: "FM Match Lab FM27 benchmark (Study 13b): strikers",
    weights: {
      acceleration: 10,
      pace: 10,
      jumpingReach: 9,
      finishing: 6,
      anticipation: 5,
      strength: 5,
      balance: 4,
      concentration: 3,
      stamina: 3,
      dribbling: 2,
    },
  },
  {
    role: "GK",
    profileId: "fm27-gk",
    name: "FM27 · Goalkeeper",
    description: "FM Match Lab FM27 benchmark (Study 13b): goalkeepers",
    weights: {
      agility: 10,
      reflexes: 9,
      acceleration: 3,
      aerialReach: 3,
      determination: 2,
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
 * Ages outside the table use the nearest end. There is one table for every role. fm-scoring calibrated it on its
 * own role weights; the Match Lab weights put fewer attributes in each role, and on this repo's fixtures a
 * player's best role scores about 0.5 higher for outfielders and 0.9 for keepers, so vs Age reads a few percent
 * high until the table is recalibrated.
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

/** Score every FM27 role that fits the player (keepers only as GK, outfielders on the five outfield roles). */
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
