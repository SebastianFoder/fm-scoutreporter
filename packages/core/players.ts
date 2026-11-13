import type { PlayerAttributes } from "@scoutreporter/core/types/player-attributes";
import type { GroupedAttributes } from "@scoutreporter/core/types/grouped-attributes";
import type { PotentialProjection } from "@scoutreporter/core/fm27/potential";

/** One imported player: the parsed export row, its attributes grouped for display, and (with CA/PA) its projection. */
export interface PlayerWithGroups {
  raw: PlayerAttributes;
  grouped: GroupedAttributes;
  /** Projected attributes at PA; only for Hidden Attributes view exports (CA + PA columns). */
  potential?: PotentialProjection | null;
}
