import type { AttributeKey } from "@/types/weights";

export const GOALKEEPING_KEYS: AttributeKey[] = [
  "aerialReach",
  "commandOfArea",
  "communication",
  "eccentricity",
  "handling",
  "kicking",
  "oneOnOnes",
  "punching",
  "reflexes",
  "rushingOutTendency",
  "throwing",
];

export const TECHNICAL_KEYS: AttributeKey[] = [
  "corners",
  "crossing",
  "dribbling",
  "finishing",
  "firstTouch",
  "freeKickTaking",
  "penaltyTaking",
  "heading",
  "longShots",
  "longThrows",
  "marking",
  "passing",
  "tackling",
  "technique",
];

export const MENTAL_KEYS: AttributeKey[] = [
  "aggression",
  "anticipation",
  "bravery",
  "composure",
  "concentration",
  "decisions",
  "determination",
  "flair",
  "leadership",
  "offTheBall",
  "positioning",
  "teamWork",
  "vision",
  "workRate",
];

export const PHYSICAL_KEYS: AttributeKey[] = [
  "acceleration",
  "agility",
  "balance",
  "jumpingReach",
  "naturalFitness",
  "pace",
  "stamina",
  "strength",
];

export const ALL_ATTRIBUTE_KEYS: AttributeKey[] = [
  ...TECHNICAL_KEYS,
  ...MENTAL_KEYS,
  ...PHYSICAL_KEYS,
  ...GOALKEEPING_KEYS,
];
