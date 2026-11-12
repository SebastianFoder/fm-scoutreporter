import type { PlayerAttributes } from "@scoutreporter/core/types/player-attributes";
import type { AttributeKey } from "@scoutreporter/core/types/weights";
import { ALL_ATTRIBUTE_KEYS, PHYSICAL_KEYS } from "@scoutreporter/core/attribute-keys";
import { CA_COSTS, type PositionGroup } from "./ca-costs";
import { parsePositionGroups } from "./positions";
import {
  COACHING_GROUPS,
  GK_COACH_KEYS,
  GROUP_PROFILE,
  profileGrowth,
  TRAINING_TEST,
} from "./training";

/**
 * Full-potential projection for FM27, built on the fm-scoring CA cost table.
 *
 * FM's CA is (very nearly) a linear function of the position-weighted attribute sum. With the FM27 cost
 * table, a Hidden Attributes export of 109 goalkeepers gives CA ≈ 0.165·Σ(cost·attribute) − 99 (r = 0.99, RMSE ≈ 2.5 CA).
 * We express that per cost point (A = Σ(cost·attr) / Σ(cost)), so CA ≈ slope·A + intercept, calibrate it
 * on the imported players when there are enough of them, and use it to find the A a player has at PA.
 * The extra CA is then spread over the attributes that can still grow, each at the rate harvestgreen22's
 * FM27 training test measured for it (see `training.ts`), scaled by its room below 20.
 */

/** Training never moves these (harvestgreen22's FM27 test: about 0 a season under every schedule). */
const FIXED_KEYS = new Set<AttributeKey>([
  "determination",
  "aggression",
  "bravery",
  "eccentricity",
  "punching",
]);

const PHYSICAL = new Set<AttributeKey>(PHYSICAL_KEYS);
const GK_COACHED = new Set<AttributeKey>(GK_COACH_KEYS);
const FITNESS_COACHED = new Set<AttributeKey>(
  COACHING_GROUPS.find((g) => g.id === "fitness")!.keys,
);

/** Default model: the fit on the FM27 Hidden Attributes GK sample (0.16469·S − 99.17, Σcost = 107). */
export const DEFAULT_CA_MODEL: CaModel = {
  slope: 0.16469 * 107,
  intercept: -99.17,
  source: "default",
  n: 109,
  rmse: 2.48,
  r: 0.99,
};

const MIN_FIT_SAMPLES = 10;
const MIN_GROUP_R = 0.8;
const MIN_GLOBAL_R = 0.7;

export interface CaModel {
  /** CA per point of cost-weighted average attribute. */
  slope: number;
  intercept: number;
  source: "dataset-position" | "dataset" | "default";
  n: number;
  rmse: number | null;
  r: number | null;
}

export interface CaModelSet {
  global: CaModel;
  byGroup: Partial<Record<PositionGroup, CaModel>>;
}

export interface PotentialProjection {
  ca: number;
  pa: number;
  /** Position groups whose CA costs were blended for this player. */
  groups: PositionGroup[];
  model: CaModel;
  /** Projected attributes at PA (whole numbers, 1–20). */
  attributes: Record<AttributeKey, number>;
  /** CA the model predicts for the current attributes (to sanity-check the fit). */
  predictedCa: number;
  /** True when every growable attribute would hit 20 before CA reached PA. */
  capped: boolean;
}

type CostTable = Partial<Record<AttributeKey, number>>;

function blendedCosts(groups: PositionGroup[]): CostTable {
  const out: CostTable = {};
  for (const g of groups) {
    for (const [k, c] of Object.entries(CA_COSTS[g]) as [AttributeKey, number][]) {
      out[k] = (out[k] ?? 0) + c / groups.length;
    }
  }
  return out;
}

function costAverage(get: (k: AttributeKey) => number, costs: CostTable): number {
  let s = 0;
  let total = 0;
  for (const [k, c] of Object.entries(costs) as [AttributeKey, number][]) {
    s += c * get(k);
    total += c;
  }
  return total === 0 ? 0 : s / total;
}

function fit(points: { x: number; y: number }[], source: CaModel["source"]): CaModel | null {
  const n = points.length;
  if (n < 2) return null;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
    syy += (p.y - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  const slope = sxy / sxx;
  if (!(slope > 0)) return null;
  const intercept = my - slope * mx;
  const r = sxy / Math.sqrt(sxx * syy);
  const rmse = Math.sqrt(
    points.reduce((a, p) => a + (p.y - (slope * p.x + intercept)) ** 2, 0) / n,
  );
  return { slope, intercept, source, n, rmse, r };
}

function attrGetter(p: PlayerAttributes) {
  return (k: AttributeKey) => p[k];
}

function hasAbility(p: PlayerAttributes): p is PlayerAttributes & {
  currentAbility: number;
  potentialAbility: number;
} {
  return (
    typeof p.currentAbility === "number" &&
    typeof p.potentialAbility === "number" &&
    p.currentAbility > 0 &&
    p.potentialAbility > 0
  );
}

/** Calibrate CA ≈ slope·A + intercept on the imported players, falling back to the default fit. */
export function calibrateCaModel(players: PlayerAttributes[]): CaModelSet {
  const all: { x: number; y: number }[] = [];
  const byGroupPts: Partial<Record<PositionGroup, { x: number; y: number }[]>> = {};

  for (const p of players) {
    if (!hasAbility(p)) continue;
    const groups = parsePositionGroups(p.position);
    if (groups.length === 0) continue;
    const x = costAverage(attrGetter(p), blendedCosts(groups));
    const pt = { x, y: p.currentAbility };
    all.push(pt);
    (byGroupPts[groups[0]] ??= []).push(pt);
  }

  const globalFit = all.length >= MIN_FIT_SAMPLES ? fit(all, "dataset") : null;
  const global =
    globalFit && (globalFit.r ?? 0) >= MIN_GLOBAL_R ? globalFit : DEFAULT_CA_MODEL;

  const byGroup: CaModelSet["byGroup"] = {};
  for (const [g, pts] of Object.entries(byGroupPts) as [PositionGroup, { x: number; y: number }[]][]) {
    if (pts.length < MIN_FIT_SAMPLES) continue;
    const m = fit(pts, "dataset-position");
    if (m && (m.r ?? 0) >= MIN_GROUP_R) byGroup[g] = m;
  }

  return { global, byGroup };
}

/**
 * Physical attributes develop mostly in the late teens and slow down through the early 20s.
 * Goalkeepers develop about three years longer than outfielders.
 */
function physicalRate(age: number, isGoalkeeper: boolean): number {
  const a = isGoalkeeper ? age - 3 : age;
  if (a <= 21) return 1;
  if (a <= 24) return 0.75;
  return 0.4;
}

/** The test's attributes all started at 8, so a season's growth used 1/12 of the room below 20. */
const TEST_HEADROOM = 12;

/**
 * How fast each attribute grows relative to its room below 20, as a share of that room per season for
 * the test's 18-year-old. Outfielders use the measured growth of the schedule that suits their position
 * (defensive or attacking ball work, blended for multi-position players). Goalkeepers were not tested,
 * so their GK-coached attributes grow like the outfield coach-trained ones, their physicals like the
 * outfield fitness work without the Quickness focus, and everything else like untrained outfielders.
 */
export function growthRates(
  groups: PositionGroup[],
  age: number,
): Map<AttributeKey, number> {
  const isGoalkeeper = groups.includes("GK");
  const physRate = physicalRate(age, isGoalkeeper);
  const tested = TRAINING_TEST.noTraining.growth as Partial<Record<AttributeKey, number>>;
  const rates = new Map<AttributeKey, number>();

  let seasonGrowth: (k: AttributeKey) => number;
  if (isGoalkeeper) {
    const balanced = profileGrowth("balanced") as Partial<Record<AttributeKey, number>>;
    const coachTrained = COACHING_GROUPS.filter(
      (g) => g.id === "possessionTechnical" || g.id === "possessionTactical",
    ).flatMap((g) => g.keys);
    const gkCoachGrowth =
      coachTrained.reduce((a, k) => a + (balanced[k] ?? 0), 0) / coachTrained.length;
    seasonGrowth = (k) => {
      if (GK_COACHED.has(k)) return gkCoachGrowth;
      if (k === "pace" || k === "acceleration") return tested[k] ?? 0;
      if (FITNESS_COACHED.has(k)) return balanced[k] ?? 0;
      return tested[k] ?? 0;
    };
  } else {
    const profiles = groups
      .filter((g): g is Exclude<PositionGroup, "GK"> => g !== "GK")
      .map((g) => profileGrowth(GROUP_PROFILE[g]) as Partial<Record<AttributeKey, number>>);
    seasonGrowth = (k) => profiles.reduce((a, p) => a + (p[k] ?? 0), 0) / profiles.length;
  }

  for (const k of ALL_ATTRIBUTE_KEYS) {
    let rate = FIXED_KEYS.has(k) ? 0 : Math.max(0, seasonGrowth(k)) / TEST_HEADROOM;
    if (PHYSICAL.has(k)) rate *= physRate;
    rates.set(k, rate);
  }
  return rates;
}

export function projectPotential(
  player: PlayerAttributes,
  models: CaModelSet,
): PotentialProjection | null {
  if (!hasAbility(player)) return null;
  const groups = parsePositionGroups(player.position);
  if (groups.length === 0) return null;

  const model = models.byGroup[groups[0]] ?? models.global;
  const costs = blendedCosts(groups);
  const get = attrGetter(player);
  const ca = player.currentAbility;
  const pa = Math.max(player.potentialAbility, ca);
  const currentA = costAverage(get, costs);
  const targetA = currentA + (pa - ca) / model.slope;

  const rates = growthRates(groups, player.age);

  const grown = (t: number) => (k: AttributeKey) => {
    const v = get(k);
    return Math.min(20, v + t * (rates.get(k) ?? 0) * Math.max(0, 20 - v));
  };

  // Solve A(t) = targetA by bisection. A(t) is non-decreasing in t (t is roughly "seasons of the test's
  // development"), and tMax is where every attribute that can grow reaches 20.
  const minRate = Math.min(...[...rates.values()].filter((r) => r > 0));
  const tMax = Number.isFinite(minRate) ? 1 / minRate : 0;
  let t = 0;
  let capped = false;
  if (pa > ca) {
    if (costAverage(grown(tMax), costs) <= targetA) {
      t = tMax;
      capped = true;
    } else {
      let lo = 0;
      let hi = tMax;
      for (let i = 0; i < 50; i += 1) {
        const mid = (lo + hi) / 2;
        if (costAverage(grown(mid), costs) < targetA) lo = mid;
        else hi = mid;
      }
      t = (lo + hi) / 2;
    }
  }

  const g = grown(t);
  const attributes = Object.fromEntries(
    ALL_ATTRIBUTE_KEYS.map((k) => [k, Math.max(get(k), Math.round(g(k)))]),
  ) as Record<AttributeKey, number>;

  return {
    ca,
    pa,
    groups,
    model,
    attributes,
    predictedCa: model.slope * currentA + model.intercept,
    capped,
  };
}

export interface DatasetPotentials {
  models: CaModelSet;
  byId: Map<string, PotentialProjection>;
  /** True when at least one player had CA and PA (i.e. a Hidden Attributes export). */
  available: boolean;
}

export function computeDatasetPotentials(players: PlayerAttributes[]): DatasetPotentials {
  const models = calibrateCaModel(players);
  const byId = new Map<string, PotentialProjection>();
  for (const p of players) {
    const proj = projectPotential(p, models);
    if (proj) byId.set(p.uniqueId, proj);
  }
  return { models, byId, available: byId.size > 0 };
}
