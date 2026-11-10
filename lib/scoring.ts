import type { PlayerWithGroups } from "@/data/players-store";
import type { AttributeWeights, AttributeKey, WeightEmphasis } from "@/types/weights";
import { weightedAverage } from "@/lib/fm27/benchmarks";

const BASELINE_AVG_ATTRIBUTE = 13;

/** Profiles saved before the emphasis option keep their squared weighting. */
export const LEGACY_EMPHASIS: WeightEmphasis = 2;

export function getPlayerAttributeValue(
  p: PlayerWithGroups,
  key: AttributeKey,
): number {
  const g = p.grouped;
  if (key in g.goalkeeping) return (g.goalkeeping as Record<string, number>)[key];
  if (key in g.technical) return (g.technical as Record<string, number>)[key];
  if (key in g.mental) return (g.mental as Record<string, number>)[key];
  if (key in g.physical) return (g.physical as Record<string, number>)[key];
  return 0;
}

/** Weighted average attribute on FM's 1–20 scale. */
export function computeWeightedAverage(
  player: PlayerWithGroups,
  weights: AttributeWeights,
  emphasis: WeightEmphasis = LEGACY_EMPHASIS,
): number {
  return weightedAverage((k) => getPlayerAttributeValue(player, k), weights, emphasis);
}

/** Weighted average for an arbitrary attribute set (e.g. projected potential attributes). */
export function computeWeightedAverageOf(
  attributes: Record<AttributeKey, number>,
  weights: AttributeWeights,
  emphasis: WeightEmphasis = LEGACY_EMPHASIS,
): number {
  return weightedAverage((k) => attributes[k] ?? 0, weights, emphasis);
}

/** Weighted average scaled so 13 = 100 (e.g. 10 → 76.9, 16 → 123.1). */
export function scaleScore(weightedAvg: number): number {
  return (weightedAvg / BASELINE_AVG_ATTRIBUTE) * 100;
}

export function computeScore(
  player: PlayerWithGroups,
  weights: AttributeWeights,
  emphasis: WeightEmphasis = LEGACY_EMPHASIS,
): number {
  return scaleScore(computeWeightedAverage(player, weights, emphasis));
}
