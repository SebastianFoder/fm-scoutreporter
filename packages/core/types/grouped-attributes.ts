export interface GroupedAttributes {
  goalkeeping: {
    handling: number;
    reflexes: number;
    rushingOutTendency: number;
    commandOfArea: number;
    communication: number;
    aerialReach: number;
    oneOnOnes: number;
    throwing: number;
    punching: number;
    kicking: number;
    eccentricity: number;
  };
  technical: {
    crossing: number;
    technique: number;
    tackling: number;
    heading: number;
    marking: number;
    longThrows: number;
    corners: number;
    dribbling: number;
    freeKickTaking: number;
    penaltyTaking: number;
    finishing: number;
    firstTouch: number;
    longShots: number;
    passing: number;
  };
  mental: {
    concentration: number;
    aggression: number;
    leadership: number;
    positioning: number;
    teamWork: number;
    workRate: number;
    decisions: number;
    determination: number;
    anticipation: number;
    composure: number;
    bravery: number;
    flair: number;
    offTheBall: number;
    vision: number;
  };
  physical: {
    acceleration: number;
    pace: number;
    stamina: number;
    strength: number;
    naturalFitness: number;
    balance: number;
    jumpingReach: number;
    agility: number;
  };
  misc: {
    player: string;
    age: number;
    euNational: boolean;
    position: string;
    uniqueId: string;
    expires: string;
    wage: string | null;
    rightFoot: string;
    leftFoot: string;
    transferValueRange: string | null;
  };
}
