import type { GroupedAttributes } from "./grouped-attributes";

export type AttributeKey =
  | keyof GroupedAttributes["goalkeeping"]
  | keyof GroupedAttributes["technical"]
  | keyof GroupedAttributes["mental"]
  | keyof GroupedAttributes["physical"];

export type AttributeWeights = Partial<Record<AttributeKey, number>>;

/**
 * 1 = linear weighted average (the FM27 benchmark method), 2 = weights squared so high/low weight
 * ratios matter more. Profiles saved before this option existed default to 2.
 */
export type WeightEmphasis = 1 | 2;

export interface WeightProfile {
  id: string;
  name: string;
  description?: string;
  weights: AttributeWeights;
  emphasis?: WeightEmphasis;
  /** Set on profiles seeded from a benchmark (e.g. the fm-scoring FM27 role weights). */
  builtIn?: "fm27";
}
