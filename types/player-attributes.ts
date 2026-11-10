export interface PlayerAttributes {
  player: string;

  crossing: number;
  handling: number;
  concentration: number;
  aggression: number;
  leadership: number;
  positioning: number;
  teamWork: number;
  acceleration: number;
  penaltyTaking: number;

  expires: string; // e.g. "31/12/2030"
  wage: string | null; // e.g. "€1.9K p/w" or null for "N/A"

  rightFoot: string; // e.g. "Very Strong"
  leftFoot: string; // e.g. "Reasonable"
  age: number;
  euNational: boolean; // "True" / "False" in CSV

  // Only in Hidden Attributes view exports; null when the column is missing or hidden.
  professionalism: number | null;
  currentAbility: number | null; // "CA"
  potentialAbility: number | null; // "PA"

  position: string; // e.g. "AM (R), ST (C)"
  uniqueId: string; // keep as string to avoid precision issues

  technique: number;
  tackling: number;
  heading: number;
  marking: number;
  longThrows: number;
  pace: number;
  corners: number;
  stamina: number;
  strength: number;
  reflexes: number;
  naturalFitness: number;
  balance: number;
  jumpingReach: number;
  agility: number;
  workRate: number;
  decisions: number;
  determination: number;
  rushingOutTendency: number; // "Rushing Out (Tendency)"
  anticipation: number;
  composure: number;
  bravery: number;
  throwing: number;
  punching: number;
  oneOnOnes: number; // "One On Ones"
  kicking: number;
  eccentricity: number;
  dribbling: number;
  freeKickTaking: number;
  finishing: number;
  firstTouch: number;
  flair: number;
  longShots: number;
  offTheBall: number;
  passing: number;
  vision: number;
  commandOfArea: number;
  transferValueRange: string | null; // e.g. "€140K - €1.4M" or null for "€0"

  communication: number;
  aerialReach: number;
}
