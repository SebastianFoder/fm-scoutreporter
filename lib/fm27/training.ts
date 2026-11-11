import type { AttributeKey } from "@/types/weights";
import type { PositionGroup } from "./ca-costs";

/**
 * FM27 training evidence collected in jamiebolden/fm-scoring (`docs/`).
 *
 * Attribute growth per session comes from harvestgreen22's FM27 training test (FM-Arena), kept in
 * fm-scoring as `训练excel Training excel.xlsx`: an 18-year-old outfielder with every attribute at 8,
 * PA 150, Professionalism and Ambition 12, coaches at 16 and training facilities at 20, played 100 matches
 * over one season. Values are the average attribute change at the end of that season, over 20 to 30 runs.
 * Every row except `noTraining` used the Quickness individual focus. Goalkeepers were not tested.
 */

export type DevelopmentSessionId =
  | "conditioning"
  | "heavyConditioning"
  | "individualDevelopment"
  | "attackingBallWork"
  | "defensiveBallWork"
  | "possessionBallWork";

type TestRowId =
  | DevelopmentSessionId
  | "noTraining"
  | "rest"
  | "conditioningDefensive"
  | "defensiveX3"
  | "conditioningAttacking"
  | "attackingX3"
  | "lightConditioningConditioningAttackingDefensive";

/** The 36 outfield attributes the test tracked. */
type TestedKey = Exclude<
  AttributeKey,
  | "handling"
  | "reflexes"
  | "aerialReach"
  | "commandOfArea"
  | "communication"
  | "kicking"
  | "oneOnOnes"
  | "throwing"
  | "punching"
  | "eccentricity"
  | "rushingOutTendency"
>;

export interface TrainingTestRow {
  label: string;
  /** CA gained over the season. */
  ca: number;
  /** Attribute change over the season (1–20 scale). */
  growth: Record<TestedKey, number>;
}

export const TRAINING_TEST: Record<TestRowId, TrainingTestRow> = {
  noTraining: {
    label: "No training, no focus",
    ca: 10.7,
    growth: { passing: -0.52, crossing: -0.24, marking: -0.66, penaltyTaking: 1.16, technique: -0.6, corners: -0.52, longThrows: 1.38, dribbling: -0.44, tackling: -1.48, freeKickTaking: -0.64, finishing: -0.42, firstTouch: -0.36, heading: -0.38, longShots: 2.04, flair: -0.74, positioning: -0.74, workRate: 0.82, concentration: -0.62, decisions: 0.56, leadership: 1.54, aggression: 0, vision: 0.46, teamWork: 0.54, offTheBall: 0.54, determination: 0.06, bravery: 0.14, anticipation: 0.54, composure: 0.58, acceleration: 1.54, jumpingReach: 1.48, agility: 1.38, stamina: 1.78, balance: 1.62, strength: 1.86, pace: 1.64, naturalFitness: 0.58 },
  },
  rest: {
    label: "Rest",
    ca: 11.3,
    growth: { passing: -0.6, crossing: -0.2, marking: -0.67, penaltyTaking: 1.17, technique: -0.83, corners: -0.63, longThrows: 1.03, dribbling: -0.57, tackling: -1.67, freeKickTaking: -0.77, finishing: -0.47, firstTouch: -0.5, heading: -0.67, longShots: 1.93, flair: -0.73, positioning: -0.67, workRate: 0.57, concentration: -0.77, decisions: 0.2, leadership: 1.43, aggression: 0, vision: 0.17, teamWork: 0.63, offTheBall: 0.5, determination: 0.1, bravery: -0.1, anticipation: 0.57, composure: 0.07, acceleration: 2.67, jumpingReach: 1, agility: 1.07, stamina: 1.1, balance: 1.2, strength: 1.13, pace: 2.7, naturalFitness: 0.2 },
  },
  conditioning: {
    label: "Conditioning",
    ca: 24.8,
    growth: { passing: 0.47, crossing: 0.63, marking: 0.17, penaltyTaking: 1.17, technique: 0.5, corners: 0.1, longThrows: 1.63, dribbling: 0.67, tackling: -0.47, freeKickTaking: 0.17, finishing: 0.43, firstTouch: 0.5, heading: 0.3, longShots: 1.67, flair: 0.4, positioning: 0.03, workRate: 1.23, concentration: -0.03, decisions: 1.47, leadership: 1.17, aggression: 0, vision: 1.3, teamWork: 0.53, offTheBall: 1.4, determination: 0, bravery: 0.23, anticipation: 1.33, composure: 1.33, acceleration: 2.67, jumpingReach: 1.1, agility: 2.1, stamina: 2.07, balance: 2.03, strength: 2.43, pace: 2.7, naturalFitness: 1.47 },
  },
  heavyConditioning: {
    label: "Heavy Conditioning",
    ca: 24.6,
    growth: { passing: 0.33, crossing: 0.5, marking: 0, penaltyTaking: 1.3, technique: 0.3, corners: 0.13, longThrows: 0.9, dribbling: 0.53, tackling: -0.57, freeKickTaking: 0.03, finishing: 0.57, firstTouch: 0.53, heading: 0.4, longShots: 1.73, flair: 0.4, positioning: 0.03, workRate: 0.9, concentration: 0, decisions: 1.43, leadership: 1.53, aggression: 0, vision: 1.2, teamWork: 0.53, offTheBall: 1.5, determination: 0.03, bravery: 0.1, anticipation: 1.17, composure: 1.4, acceleration: 2.77, jumpingReach: 1.3, agility: 2.23, stamina: 2, balance: 1.97, strength: 2.2, pace: 2.77, naturalFitness: 1.33 },
  },
  individualDevelopment: {
    label: "Individual Development",
    ca: 22.3,
    growth: { passing: 0.53, crossing: 0.87, marking: 0.4, penaltyTaking: 1.4, technique: 0.57, corners: 0.3, longThrows: 1.4, dribbling: 0.7, tackling: 0.13, freeKickTaking: 0.4, finishing: 0.6, firstTouch: 0.53, heading: 0.4, longShots: 1.57, flair: 0.47, positioning: 0.47, workRate: 0.3, concentration: 0.33, decisions: 1.6, leadership: 1.4, aggression: 0, vision: 1.47, teamWork: 0.4, offTheBall: 1.3, determination: 0.13, bravery: 0.17, anticipation: 1.4, composure: 1.4, acceleration: 2.77, jumpingReach: 0.77, agility: 0.83, stamina: 1.13, balance: 0.97, strength: 1.13, pace: 2.67, naturalFitness: 0.37 },
  },
  attackingBallWork: {
    label: "Attacking Ball Work",
    ca: 25.1,
    growth: { passing: 0.87, crossing: 1.77, marking: 0.23, penaltyTaking: 1.2, technique: 0.7, corners: 0.27, longThrows: 1.63, dribbling: 0.9, tackling: -0.33, freeKickTaking: 0.27, finishing: 1.2, firstTouch: 0.8, heading: 0.63, longShots: 1.7, flair: 0.93, positioning: 0.2, workRate: 0.43, concentration: 0.3, decisions: 2.33, leadership: 1.4, aggression: 0, vision: 2.13, teamWork: 0.87, offTheBall: 2.27, determination: 0.03, bravery: -0.03, anticipation: 2.1, composure: 2.17, acceleration: 2.7, jumpingReach: 0.63, agility: 0.7, stamina: 0.9, balance: 1, strength: 0.8, pace: 2.63, naturalFitness: 0.27 },
  },
  defensiveBallWork: {
    label: "Defensive Ball Work",
    ca: 24.8,
    growth: { passing: 0.8, crossing: 0.77, marking: 1.33, penaltyTaking: 1.1, technique: 0.87, corners: 0.3, longThrows: 1.5, dribbling: 0.73, tackling: 0.7, freeKickTaking: 0.27, finishing: 0.53, firstTouch: 0.8, heading: 0.6, longShots: 1.77, flair: 0.6, positioning: 1.1, workRate: 0.43, concentration: 1.23, decisions: 1.73, leadership: 1.57, aggression: 0, vision: 1.6, teamWork: 0.53, offTheBall: 1.57, determination: 0.07, bravery: 0.03, anticipation: 1.83, composure: 1.5, acceleration: 2.63, jumpingReach: 1.13, agility: 0.73, stamina: 1.03, balance: 1.13, strength: 1.3, pace: 2.67, naturalFitness: 0.47 },
  },
  possessionBallWork: {
    label: "Possession Ball Work",
    ca: 26.7,
    growth: { passing: 1.47, crossing: 1.43, marking: 0.3, penaltyTaking: 1.33, technique: 1.3, corners: 0.23, longThrows: 1.57, dribbling: 1.53, tackling: -0.17, freeKickTaking: 0.4, finishing: 0.9, firstTouch: 1.5, heading: 1.1, longShots: 1.7, flair: 1.13, positioning: 0.3, workRate: 0.5, concentration: 0.23, decisions: 2.23, leadership: 1.4, aggression: 0, vision: 1.9, teamWork: 0.93, offTheBall: 1.67, determination: 0, bravery: 0.1, anticipation: 2.13, composure: 1.63, acceleration: 2.73, jumpingReach: 0.53, agility: 0.8, stamina: 1.07, balance: 1.17, strength: 1.27, pace: 2.87, naturalFitness: 0.6 },
  },
  conditioningDefensive: {
    label: "Conditioning + Defensive Ball Work",
    ca: 30.2,
    growth: { passing: 0.75, crossing: 0.85, marking: 1.05, penaltyTaking: 1.35, technique: 0.7, corners: 0.35, longThrows: 1.55, dribbling: 0.9, tackling: 0.55, freeKickTaking: 0.3, finishing: 0.75, firstTouch: 1.05, heading: 0.6, longShots: 1.8, flair: 0.8, positioning: 0.9, workRate: 1.1, concentration: 1, decisions: 2.5, leadership: 1.5, aggression: 0, vision: 1.8, teamWork: 0.9, offTheBall: 1.65, determination: 0, bravery: 0.2, anticipation: 2.45, composure: 1.9, acceleration: 2.45, jumpingReach: 1.15, agility: 2.2, stamina: 2.15, balance: 2.05, strength: 2.1, pace: 2.8, naturalFitness: 1.25 },
  },
  defensiveX3: {
    label: "Defensive Ball Work x3",
    ca: 29.9,
    growth: { passing: 1.3, crossing: 1.25, marking: 1.05, penaltyTaking: 1.4, technique: 1.3, corners: 0.45, longThrows: 1.25, dribbling: 1.35, tackling: 0.75, freeKickTaking: 0.4, finishing: 0.85, firstTouch: 1, heading: 1.25, longShots: 1.5, flair: 1.05, positioning: 1.2, workRate: 0.55, concentration: 1.1, decisions: 2.4, leadership: 1.5, aggression: 0, vision: 2.15, teamWork: 0.95, offTheBall: 1.9, determination: 0.05, bravery: 0.15, anticipation: 2.1, composure: 1.85, acceleration: 2.5, jumpingReach: 1.25, agility: 1.35, stamina: 1.55, balance: 1.9, strength: 1.6, pace: 2.45, naturalFitness: 0.6 },
  },
  conditioningAttacking: {
    label: "Conditioning + Attacking Ball Work",
    ca: 31.1,
    growth: { passing: 1.15, crossing: 1.9, marking: 0.5, penaltyTaking: 1, technique: 0.85, corners: 0.35, longThrows: 1.35, dribbling: 1.1, tackling: 0.15, freeKickTaking: 0.5, finishing: 1.2, firstTouch: 1, heading: 0.6, longShots: 1.65, flair: 1.2, positioning: 0.6, workRate: 1.1, concentration: 0.35, decisions: 2.3, leadership: 1.45, aggression: 0, vision: 2.15, teamWork: 0.9, offTheBall: 1.85, determination: 0.1, bravery: 0.15, anticipation: 2.1, composure: 2.1, acceleration: 2.9, jumpingReach: 1.3, agility: 2.05, stamina: 2.15, balance: 2.05, strength: 2.25, pace: 3.05, naturalFitness: 1.25 },
  },
  attackingX3: {
    label: "Attacking Ball Work x3",
    ca: 32.0,
    growth: { passing: 1.35, crossing: 2.1, marking: 0.75, penaltyTaking: 1.4, technique: 1.05, corners: 0.35, longThrows: 1.6, dribbling: 1.35, tackling: 0.4, freeKickTaking: 0.4, finishing: 1.75, firstTouch: 1.05, heading: 1.05, longShots: 1.45, flair: 1.2, positioning: 0.85, workRate: 0.8, concentration: 0.75, decisions: 2.6, leadership: 1.4, aggression: 0, vision: 2.65, teamWork: 1.05, offTheBall: 2.4, determination: 0, bravery: 0, anticipation: 2.85, composure: 2, acceleration: 2.65, jumpingReach: 1.1, agility: 1.5, stamina: 1.8, balance: 1.8, strength: 1.8, pace: 2.9, naturalFitness: 0.7 },
  },
  lightConditioningConditioningAttackingDefensive: {
    label: "Light Conditioning + Conditioning + Attacking Ball Work + Defensive Ball Work",
    ca: 33.2,
    growth: { passing: 0.95, crossing: 1.75, marking: 1.05, penaltyTaking: 1.45, technique: 1.35, corners: 0.4, longThrows: 1.4, dribbling: 1.3, tackling: 0.25, freeKickTaking: 0.5, finishing: 1.35, firstTouch: 1.5, heading: 0.8, longShots: 1.7, flair: 1.15, positioning: 0.95, workRate: 1.15, concentration: 1.05, decisions: 2.45, leadership: 1.45, aggression: 0, vision: 2.2, teamWork: 1, offTheBall: 2.15, determination: 0, bravery: -0.15, anticipation: 2.75, composure: 2.25, acceleration: 2.75, jumpingReach: 1.4, agility: 2.2, stamina: 1.85, balance: 1.8, strength: 2.3, pace: 2.85, naturalFitness: 1.15 },
  },
};

/** The six sessions that grow attributes. Every other session tested grew CA no more than resting. */
export const DEVELOPMENT_SESSIONS: DevelopmentSessionId[] = [
  "possessionBallWork",
  "attackingBallWork",
  "defensiveBallWork",
  "conditioning",
  "heavyConditioning",
  "individualDevelopment",
];

/** Which training emphasis a position group gets in the growth model (and which OOP training role is advised). */
export type GrowthProfileId = "defensive" | "balanced" | "attacking";

export const GROUP_PROFILE: Record<Exclude<PositionGroup, "GK">, GrowthProfileId> = {
  CB: "defensive",
  FB: "defensive",
  WB: "defensive",
  DM: "defensive",
  CM: "balanced",
  WM: "attacking",
  AMW: "attacking",
  AMC: "attacking",
  ST: "attacking",
};

const PROFILE_ROWS: Record<GrowthProfileId, TestRowId[]> = {
  defensive: ["conditioningDefensive", "defensiveX3"],
  balanced: ["lightConditioningConditioningAttackingDefensive"],
  attacking: ["conditioningAttacking", "attackingX3"],
};

/** Mean season growth of the schedules that represent each profile. */
export function profileGrowth(id: GrowthProfileId): Record<TestedKey, number> {
  const rows = PROFILE_ROWS[id].map((r) => TRAINING_TEST[r].growth);
  const out = {} as Record<TestedKey, number>;
  for (const k of Object.keys(rows[0]) as TestedKey[]) {
    out[k] = rows.reduce((a, g) => a + g[k], 0) / rows.length;
  }
  return out;
}

/** Attributes the GK coach trains (FM27 Set Coach Assignments hover, fm-scoring `weights/fm27_staff.md`). */
export const GK_COACH_KEYS: AttributeKey[] = [
  "aerialReach",
  "anticipation",
  "commandOfArea",
  "communication",
  "composure",
  "concentration",
  "decisions",
  "firstTouch",
  "handling",
  "kicking",
  "oneOnOnes",
  "passing",
  "positioning",
  "reflexes",
  "rushingOutTendency",
  "technique",
  "throwing",
  "vision",
];

export type CoachingGroupId =
  | "fitness"
  | "possessionTechnical"
  | "possessionTactical"
  | "attackingTactical"
  | "defendingTactical"
  | "attackingTechnical"
  | "defendingTechnical"
  | "setPieces"
  | "goalkeeping";

export interface CoachingGroup {
  id: CoachingGroupId;
  label: string;
  /** Coach attributes that decide how well this group is coached. */
  coachAttributes: string;
  keys: AttributeKey[];
}

/** FM27 coaching groups and the player attributes each trains (fm-scoring `weights/fm27_staff.md`). */
export const COACHING_GROUPS: CoachingGroup[] = [
  {
    id: "fitness",
    label: "Fitness",
    coachAttributes: "Fitness",
    keys: ["acceleration", "agility", "balance", "jumpingReach", "naturalFitness", "pace", "stamina", "strength", "workRate"],
  },
  {
    id: "possessionTechnical",
    label: "Possession technical",
    coachAttributes: "Possession and Technical",
    keys: ["dribbling", "firstTouch", "heading", "passing", "technique"],
  },
  {
    id: "possessionTactical",
    label: "Possession tactical",
    coachAttributes: "Possession and Tactical",
    keys: ["anticipation", "decisions", "teamWork", "vision"],
  },
  {
    id: "attackingTactical",
    label: "Attacking tactical",
    coachAttributes: "Attacking and Tactical",
    keys: ["composure", "flair", "offTheBall"],
  },
  {
    id: "defendingTactical",
    label: "Defending tactical",
    coachAttributes: "Defending and Tactical",
    keys: ["aggression", "concentration", "positioning"],
  },
  {
    id: "attackingTechnical",
    label: "Attacking technical",
    coachAttributes: "Attacking and Technical",
    keys: ["crossing", "finishing", "longShots"],
  },
  {
    id: "defendingTechnical",
    label: "Defending technical",
    coachAttributes: "Defending and Technical",
    keys: ["marking", "tackling"],
  },
  {
    id: "setPieces",
    label: "Set pieces",
    coachAttributes: "Set Pieces",
    keys: ["corners", "freeKickTaking", "longThrows", "penaltyTaking"],
  },
  {
    id: "goalkeeping",
    label: "Goalkeeping",
    coachAttributes: "Goalkeeping",
    keys: GK_COACH_KEYS,
  },
];

/** Age past which attributes grow little. Goalkeepers develop about three years longer (fm-scoring training notes). */
export function developmentEndAge(isGoalkeeper: boolean): number {
  return isGoalkeeper ? 27 : 24;
}
