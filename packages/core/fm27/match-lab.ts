import type { AttributeKey, AttributeWeights } from "@scoutreporter/core/types/weights";

/**
 * The source numbers behind the FM27 role weights, and the rule that turns them into whole-number weights.
 * `benchmarks.ts` holds the resulting weights as literals; `fm27.test.ts` recomputes them from this file, so a
 * change to either side has to be made on purpose.
 *
 * Source: FM Match Lab, Study 13b, "what is an attribute worth in each position? Random configurations"
 * (caiograco289/Fm-Match-Lab, docs/studies/13b-value-by-position-random.md, Gegenpress run, 50,000 matches,
 * committed 14 November 2026). Every attribute of every starter moves by ±5 at random in each match, and one
 * regression estimates each attribute in each position. Values are per season (38 games) for +1 level in ONE
 * player of the position. `*` in the study (|t| > 2 in both random halves, same sign) is `confirmed` here.
 *
 * The study publishes the cells below. Every other outfield attribute (Passing, Technique, Tackling, Marking,
 * Positioning, Crossing, Decisions, Composure, First Touch, Off the Ball, Flair, Work Rate, ...) is "within ±0.04 in
 * every position and mostly within ±0.02" (typical 95% margin ±0.03), so the rule would drop them anyway.
 */

export type MatchLabPosition = "ST" | "AM" | "DM" | "FB" | "CB";
export const MATCH_LAB_POSITIONS: MatchLabPosition[] = ["ST", "AM", "DM", "FB", "CB"];

/** One study cell: the value per season per level, and whether the study marks it confirmed (*). */
type Cell = readonly [value: number, confirmed: boolean];
type PositionRow = Record<MatchLabPosition, Cell>;

/** 13b "Expected points by position": xPts per season, +1 level in one player. */
export const XPTS_BY_POSITION: Partial<Record<AttributeKey, PositionRow>> = {
  //                ST            AM            DM            FB            CB
  acceleration:  { ST: [0.2, true], AM: [0.15, true], DM: [0.15, true], FB: [0.17, true], CB: [0.2, true] },
  pace:          { ST: [0.21, true], AM: [0.17, true], DM: [0.12, true], FB: [0.17, true], CB: [0.13, true] },
  jumpingReach:  { ST: [0.19, true], AM: [0.1, true], DM: [0.06, false], FB: [0.08, true], CB: [0.32, true] },
  stamina:       { ST: [0.07, true], AM: [0.1, true], DM: [0.09, true], FB: [0.1, true], CB: [0.08, true] },
  anticipation:  { ST: [0.1, true], AM: [0.07, true], DM: [0.07, true], FB: [0.07, true], CB: [0.1, true] },
  balance:       { ST: [0.09, true], AM: [0.03, false], DM: [0.04, false], FB: [0.06, true], CB: [0.1, true] },
  dribbling:     { ST: [0.05, true], AM: [0.07, true], DM: [0.02, false], FB: [0.08, true], CB: [0.03, false] },
  concentration: { ST: [0.06, true], AM: [0.03, false], DM: [0.02, false], FB: [0.07, true], CB: [0.05, true] },
  vision:        { ST: [0.02, false], AM: [0.01, false], DM: [0.05, true], FB: [0.0, false], CB: [0.03, false] },
  strength:      { ST: [0.03, false], AM: [0.02, false], DM: [0.04, false], FB: [0.02, false], CB: [0.04, false] },
};

/**
 * 13b "Goal difference": goals for minus against per season, +1 level in one player. Only used for the two
 * attributes the study confirms on goal difference but not on expected points. Finishing acts at the shot, which the
 * engine's xG model doesn't read. For Strength the study's "conversion" reading has been withdrawn (FM-Arena post
 * #64, 25 November 2026: the engine reads it in body contests, with Balance, and for kick power), but the
 * goal-difference values themselves stand; see the `benchmarks.ts` header for why they are kept.
 */
export const GOAL_DIFF_BY_POSITION: Partial<Record<AttributeKey, PositionRow>> = {
  strength:  { ST: [0.16, true], AM: [0.14, true], DM: [0.15, true], FB: [0.09, false], CB: [0.17, true] },
  finishing: { ST: [0.21, true], AM: [0.06, false], DM: [0.04, false], FB: [0.0, false], CB: [0.04, false] },
};

/** 13b: "points follow the same pattern (about 0.6 points per goal)". */
export const POINTS_PER_GOAL = 0.6;

/**
 * 13b "The goalkeeper": points per season, +1 level of the keeper's attribute, with t. The keeper's shot-stopping
 * changes goals, not chances, so points (not xPts) is the measure. "The rest are within ±0.1 goals and |t| < 2."
 */
export const GK_POINTS: Partial<Record<AttributeKey, readonly [points: number, t: number]>> = {
  agility: [0.58, 13.5],
  reflexes: [0.5, 11.6],
  aerialReach: [0.16, 2.5],
  acceleration: [0.16, 3.7],
  determination: [0.12, 2.8],
  handling: [0.05, 1.2],
  concentration: [0.07, 1.0],
  positioning: [0.05, 1.0],
  oneOnOnes: [0.06, 1.0],
};

/** Drop cells below this (the study's own "above ±0.04" line; its typical 95% margin is ±0.03). */
export const MIN_VALUE = 0.04;
/** The top attribute of each position gets this weight. */
export const TOP_WEIGHT = 10;
/** Goalkeeper cells need at least this |t| (the study's t columns; only a single t is published for the keeper). */
export const GK_MIN_T = 2;

/**
 * The value each attribute has for an outfield position, before the cut-offs: xPts per season, except Strength and
 * Finishing, which use goal difference × 0.6 points per goal: 13b confirms both on goal difference, where expected
 * points don't show them.
 */
export function matchLabValues(pos: MatchLabPosition): { key: AttributeKey; value: number; confirmed: boolean }[] {
  const out: { key: AttributeKey; value: number; confirmed: boolean }[] = [];
  for (const [key, row] of Object.entries(XPTS_BY_POSITION) as [AttributeKey, PositionRow][]) {
    if (GOAL_DIFF_BY_POSITION[key]) continue;
    out.push({ key, value: row[pos][0], confirmed: row[pos][1] });
  }
  for (const [key, row] of Object.entries(GOAL_DIFF_BY_POSITION) as [AttributeKey, PositionRow][]) {
    out.push({ key, value: row[pos][0] * POINTS_PER_GOAL, confirmed: row[pos][1] });
  }
  return out;
}

/** Scale so the top value is TOP_WEIGHT, round half up, drop zeros. */
function toWeights(values: { key: AttributeKey; value: number }[]): AttributeWeights {
  const top = Math.max(...values.map((v) => v.value));
  const weights: AttributeWeights = {};
  for (const { key, value } of values) {
    // The small epsilon keeps a cell such as 0.08 / 0.32 × 10 = 2.5 rounding up despite floating point.
    const w = Math.round((value / top) * TOP_WEIGHT + 1e-9);
    if (w > 0) weights[key] = w;
  }
  return weights;
}

/**
 * The rule, for an outfield position:
 * 1. value = 13b xPts per season per level (Strength and Finishing: goal difference × 0.6 points per goal);
 * 2. keep a cell only if the study marks it confirmed (*) and value ≥ 0.04;
 * 3. scale so the position's top value = 10, round half up, drop zeros.
 */
export function deriveOutfieldWeights(pos: MatchLabPosition): AttributeWeights {
  return toWeights(matchLabValues(pos).filter((v) => v.confirmed && v.value >= MIN_VALUE - 1e-9));
}

/** The goalkeeper: points per season per level, kept when |t| > 2 and value ≥ 0.04, top = 10, round half up. */
export function deriveGoalkeeperWeights(): AttributeWeights {
  const values = (Object.entries(GK_POINTS) as [AttributeKey, readonly [number, number]][])
    .filter(([, [points, t]]) => Math.abs(t) > GK_MIN_T && points >= MIN_VALUE - 1e-9)
    .map(([key, [value]]) => ({ key, value }));
  return toWeights(values);
}
