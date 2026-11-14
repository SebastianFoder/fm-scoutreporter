import type { AttributeWeights } from "@scoutreporter/core/types/weights";

/**
 * The FM27 role weights this app used up to v1.23: jamiebolden/fm-scoring `weights/fm27.toml`, tuned toward
 * harvestgreen22's FM27 match-engine attribute test (fm-arena thread 20925); the goalkeeper's doubled from the
 * source's 0.5 steps. They are no longer a benchmark. They are kept so saved profiles that still hold them
 * unedited can be moved to the Match Lab weights (see `migrateWeightConfig`).
 */
export const FM_SCORING_FM27_WEIGHTS: Record<"fm27-cb" | "fm27-wb6" | "fm27-10" | "fm27-9" | "fm27-gk", AttributeWeights> = {
  "fm27-cb": {
    acceleration: 5, anticipation: 3, composure: 2, decisions: 1, firstTouch: 1, heading: 3, jumpingReach: 5,
    pace: 5, passing: 2, positioning: 2, stamina: 1, strength: 3, tackling: 1, workRate: 1,
  },
  "fm27-wb6": {
    acceleration: 5, anticipation: 3, composure: 1, decisions: 1, dribbling: 3, firstTouch: 1, pace: 5,
    passing: 2, positioning: 2, stamina: 4, strength: 1, tackling: 1, teamWork: 2, workRate: 3,
  },
  "fm27-10": {
    acceleration: 5, anticipation: 3, composure: 2, decisions: 1, dribbling: 5, finishing: 1, firstTouch: 1,
    offTheBall: 2, pace: 5, passing: 2, stamina: 2, strength: 1, teamWork: 1, workRate: 2,
  },
  "fm27-9": {
    acceleration: 5, anticipation: 3, composure: 2, decisions: 1, dribbling: 3, finishing: 3, firstTouch: 1,
    heading: 1, jumpingReach: 5, offTheBall: 2, pace: 5, stamina: 2, strength: 1, teamWork: 1, workRate: 2,
  },
  "fm27-gk": {
    acceleration: 6, anticipation: 2, aerialReach: 6, agility: 10, commandOfArea: 4, communication: 2,
    composure: 2, concentration: 2, decisions: 2, handling: 1, kicking: 1, oneOnOnes: 2, passing: 2,
    positioning: 4, reflexes: 10, throwing: 1,
  },
};
