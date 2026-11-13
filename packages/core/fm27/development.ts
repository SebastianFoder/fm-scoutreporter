import type { AttributeKey } from "@scoutreporter/core/types/weights";
import type { PlayerWithGroups } from "@scoutreporter/core/players";
import { FM27_ROLES, isGoalkeeperPosition, type RoleScore } from "./benchmarks";
import { fm27PlayerScores } from "./player-scores";
import { parsePositionGroups } from "./positions";
import { growthRates } from "./potential";
import {
  COACHING_GROUPS,
  DEVELOPMENT_SESSIONS,
  developmentEndAge,
  GROUP_PROFILE,
  TRAINING_TEST,
  type CoachingGroup,
  type DevelopmentSessionId,
} from "./training";
import type { PositionGroup } from "./ca-costs";

/**
 * A per-player development plan: how to get a player to (or as close as possible to) their PA in FM27.
 * Built from the evidence in jamiebolden/fm-scoring: harvestgreen22's training test, the fm-scoring
 * author's own FM27 schedule tests, and an FM27 training-code tester's findings quoted there.
 */

export type AdviceTone = "positive" | "info" | "warning";

export interface AdviceItem {
  id: string;
  title: string;
  detail: string;
  tone: AdviceTone;
}

export interface SessionPick {
  id: DevelopmentSessionId;
  label: string;
  /** Role-score growth relative to the best of the six development sessions (1 = best). */
  relative: number;
  /** Role attributes this session builds more than the average development session does. */
  builds: AttributeKey[];
}

export interface CoachingShare {
  group: CoachingGroup;
  /** Share of the player's remaining role-weighted growth that this coaching group trains. */
  share: number;
}

export interface DevelopmentPlan {
  /** The role the plan develops the player for (best role at PA when known, else best role now). */
  role: RoleScore;
  isGoalkeeper: boolean;
  /** Age after which attributes grow little (24 outfield, 27 goalkeepers). */
  endAge: number;
  seasonsLeft: number;
  caGap: number | null;
  focus: { name: string; reason: string };
  trainingRole: { name: string; reason: string };
  /** Development sessions ranked for this player's role (outfield only; keepers weren't tested). */
  sessions: SessionPick[] | null;
  coaching: CoachingShare[];
  items: AdviceItem[];
}

const LABELS: Partial<Record<AttributeKey, string>> = {
  firstTouch: "First Touch",
  offTheBall: "Off The Ball",
  teamWork: "Teamwork",
  workRate: "Work Rate",
  jumpingReach: "Jumping Reach",
  aerialReach: "Aerial Reach",
  commandOfArea: "Command Of Area",
  oneOnOnes: "One On Ones",
  longShots: "Long Shots",
  longThrows: "Long Throws",
  naturalFitness: "Natural Fitness",
  freeKickTaking: "Free Kick Taking",
  penaltyTaking: "Penalty Taking",
  rushingOutTendency: "Rushing Out (Tendency)",
};

export function attributeLabel(k: AttributeKey): string {
  return LABELS[k] ?? k.charAt(0).toUpperCase() + k.slice(1);
}

/** Pace and Acceleration are at or near the top of every outfield role's weights. */
const QUICKNESS_KEYS: AttributeKey[] = ["pace", "acceleration"];
const QUICKNESS_DONE = 18;

function roleWeights(role: RoleScore["role"]): Partial<Record<AttributeKey, number>> {
  return FM27_ROLES.find((r) => r.role === role)!.weights;
}

function rankSessions(
  get: (k: AttributeKey) => number,
  weights: Partial<Record<AttributeKey, number>>,
  physScale: (k: AttributeKey) => number,
): SessionPick[] {
  const total = Object.values(weights).reduce((a, w) => a + (w ?? 0), 0);
  const roleKeys = Object.keys(weights) as AttributeKey[];
  const growthOf = (id: DevelopmentSessionId, k: AttributeKey) =>
    Math.max(0, (TRAINING_TEST[id].growth as Partial<Record<AttributeKey, number>>)[k] ?? 0) * physScale(k);
  const room = (k: AttributeKey) => Math.min(1, Math.max(0, 20 - get(k)) / 12);
  const mean = (k: AttributeKey) =>
    DEVELOPMENT_SESSIONS.reduce((a, id) => a + growthOf(id, k), 0) / DEVELOPMENT_SESSIONS.length;

  const scored = DEVELOPMENT_SESSIONS.map((id) => {
    const gain = roleKeys.reduce((a, k) => a + ((weights[k] ?? 0) * growthOf(id, k) * room(k)) / total, 0);
    // What this session adds over the average development session, for this player's role. Pace and
    // Acceleration are left out: their growth comes from the Quickness focus every tested session used.
    const builds = roleKeys
      .filter((k) => !QUICKNESS_KEYS.includes(k))
      .map((k) => ({ k, v: (weights[k] ?? 0) * (growthOf(id, k) - mean(k)) * room(k) }))
      .filter((x) => x.v > 0.05)
      .sort((a, b) => b.v - a.v)
      .slice(0, 3)
      .map((x) => x.k);
    return { id, label: TRAINING_TEST[id].label, gain, builds };
  });
  const best = Math.max(...scored.map((s) => s.gain));
  return scored
    .map(({ id, label, gain, builds }) => ({ id, label, builds, relative: best > 0 ? gain / best : 0 }))
    .sort((a, b) => b.relative - a.relative);
}

export function developmentPlan(player: PlayerWithGroups): DevelopmentPlan {
  const { raw, potential } = player;
  const scores = fm27PlayerScores(player);
  const isGoalkeeper = isGoalkeeperPosition(raw.position);
  const role = scores.bestPotential ?? scores.best;
  const weights = roleWeights(role.role);
  const get = (k: AttributeKey) => raw[k];
  const endAge = developmentEndAge(isGoalkeeper);
  const seasonsLeft = Math.max(0, endAge - raw.age);
  const caGap =
    raw.currentAbility !== null && raw.potentialAbility !== null
      ? Math.max(0, raw.potentialAbility - raw.currentAbility)
      : null;

  let groups: PositionGroup[] = parsePositionGroups(raw.position);
  if (groups.length === 0) groups = isGoalkeeper ? ["GK"] : ["CM"];
  const rates = growthRates(groups, raw.age);
  const youngRates = growthRates(groups, 18);
  const physScale = (k: AttributeKey) =>
    (youngRates.get(k) ?? 0) > 0 ? (rates.get(k) ?? 0) / (youngRates.get(k) ?? 1) : 1;

  // What is left to gain, weighted by the role: the projection when it moves anything, else the room
  // below 20 times the growth rate (where training would send the player's growth).
  const roleEntries = Object.entries(weights) as [AttributeKey, number][];
  const byRate = (k: AttributeKey) => (rates.get(k) ?? 0) * Math.max(0, 20 - raw[k]);
  const byProjection = (k: AttributeKey) => (potential ? Math.max(0, potential.attributes[k] - raw[k]) : 0);
  const projected = roleEntries.some(([k]) => byProjection(k) > 0);
  const remaining = projected ? byProjection : byRate;
  const weighted = roleEntries.map(([k, w]) => ({ k, v: w * remaining(k) }));
  const weightedTotal = weighted.reduce((a, x) => a + x.v, 0);

  // Coaching: which coaches train the growth that matters for this role.
  const groupsInScope = COACHING_GROUPS.filter((g) =>
    isGoalkeeper ? g.id === "goalkeeping" || g.id === "fitness" : g.id !== "goalkeeping",
  );
  const coaching: CoachingShare[] =
    weightedTotal > 0
      ? groupsInScope
          .map((group) => ({
            group,
            share: weighted.filter((x) => group.keys.includes(x.k)).reduce((a, x) => a + x.v, 0) / weightedTotal,
          }))
          .filter((c) => c.share >= 0.05)
          .sort((a, b) => b.share - a.share)
      : [];

  // Individual focus.
  let focus: DevelopmentPlan["focus"];
  if (isGoalkeeper) {
    focus = {
      name: "Reflexes / Anticipation / Positioning / Agility",
      reason:
        "Agility and Reflexes carry the most weight for keepers. An FM27 training-code tester found this combined focus the best for keepers prioritising them.",
    };
  } else if (QUICKNESS_KEYS.some((k) => raw[k] < QUICKNESS_DONE)) {
    focus = {
      name: "Quickness",
      reason: `Pace and Acceleration weigh the most in every outfield role. In harvestgreen22's test the focus took them from about +1.6 to +2.7 a season. Current Pace ${raw.pace}, Acceleration ${raw.acceleration}.`,
    };
  } else {
    const next = weighted
      .filter((x) => !QUICKNESS_KEYS.includes(x.k) && (rates.get(x.k) ?? 0) > 0)
      .sort((a, b) => b.v - a.v)[0];
    focus = next
      ? {
          name: attributeLabel(next.k),
          reason: `Pace and Acceleration are already ${raw.pace} and ${raw.acceleration}, so Quickness has little left to add. ${attributeLabel(next.k)} is where the ${role.role} score has the most to gain.`,
        }
      : { name: "Quickness", reason: "Pace and Acceleration weigh the most in every outfield role." };
  }

  // Training role.
  const defensive = groups.some((g) => g !== "GK" && GROUP_PROFILE[g] === "defensive");
  const trainingRole: DevelopmentPlan["trainingRole"] = isGoalkeeper
    ? {
        name: "Leave both training roles unassigned",
        reason: "An FM27 training-code tester got the most growth for keepers with no role and the combined focus above.",
      }
    : {
        name: `${defensive ? "Defensive Midfielder" : "Attacking Midfielder"} out of possession, nothing in possession`,
        reason: `An FM27 training-code tester got the strongest CA growth for young outfielders from an out-of-possession role alone, with Quickness: Defensive Midfielder for defenders, wing-backs and DMs, Attacking Midfielder for everyone else. Anticipation grew most. This comes from one tester's controlled runs.`,
      };

  const sessions = isGoalkeeper ? null : rankSessions(get, weights, physScale);

  // Notes, most important first.
  const items: AdviceItem[] = [];

  if (scores.bestPotential && scores.bestPotential.role !== scores.best.role) {
    items.push({
      id: "role",
      tone: "info",
      title: `Develop as a ${scores.bestPotential.role}`,
      detail: `Best role today is ${scores.best.role} (${scores.best.score.toFixed(1)}), but the attributes at PA fit a ${scores.bestPotential.role} better (${scores.bestPotential.score.toFixed(1)}).`,
    });
  }

  if (caGap !== null) {
    if (caGap <= 5) {
      items.push({
        id: "gap",
        tone: "info",
        title: "Close to the ceiling",
        detail: `Only ${caGap} CA between CA ${raw.currentAbility} and PA ${raw.potentialAbility}. Training now mostly decides where the CA goes, not how much there is, so point it at the attributes the role needs.`,
      });
    } else if (seasonsLeft <= 1 && caGap >= 15) {
      items.push({
        id: "gap",
        tone: "warning",
        title: "Unlikely to reach PA",
        detail: `${caGap} CA still to come at age ${raw.age}, and attributes grow little after ${endAge}. Value the player closer to current ability.`,
      });
    } else {
      items.push({
        id: "gap",
        tone: "positive",
        title: `${caGap} CA left to grow into`,
        detail: `CA ${raw.currentAbility} toward PA ${raw.potentialAbility}, with about ${seasonsLeft} season${seasonsLeft === 1 ? "" : "s"} of real development left (growth slows sharply after ${endAge}${isGoalkeeper ? " for keepers" : ""}).`,
      });
    }
  }

  if (raw.age <= 18) {
    items.push({
      id: "minutes",
      tone: "info",
      title: "Peak development years",
      detail:
        "16 to 18 is when attributes grow fastest. Minutes and the quality of the opponents both feed CA growth, so senior or loan minutes beat youth football once the player can hold a place. For the U18s, fm-scoring's author uses the minimal schedule (no tactical sessions).",
    });
  } else if (raw.age < endAge) {
    items.push({
      id: "minutes",
      tone: "info",
      title: "Needs senior minutes",
      detail:
        "Minutes played and the quality of the opponents drive how much CA a player gains. If there's no starting place for them at your club, loan them to the strongest club that will start them.",
    });
  } else {
    items.push({
      id: "minutes",
      tone: "info",
      title: "Past the development window",
      detail: `Attributes grow little after ${endAge}. Training from here mostly reshapes what is already there.`,
    });
  }

  if (raw.professionalism !== null) {
    const prof = raw.professionalism;
    if (prof >= 15) {
      items.push({
        id: "prof",
        tone: "positive",
        title: `Professionalism ${prof}`,
        detail: "fm-scoring's notes point to Professionalism as the hidden attribute that matters most for growth. This level helps a player get the most out of their PA.",
      });
    } else {
      items.push({
        id: "prof",
        tone: prof < 10 ? "warning" : "info",
        title: `${prof < 10 ? "Low" : "Average"} Professionalism (${prof})`,
        detail:
          "fm-scoring's notes point to Professionalism as the hidden attribute that matters most for growth. Mentoring is how FM changes personality: put the player in a mentoring group with senior players high in Professionalism (fm-scoring includes a mentors player search filter).",
      });
    }
  } else if (raw.determination < 10) {
    items.push({
      id: "det",
      tone: "warning",
      title: `Determination ${raw.determination}`,
      detail:
        "Training never moves Determination. Mentoring is the way to change personality. Export with the Hidden Attributes view to see Professionalism.",
    });
  }

  items.push({
    id: "schedule",
    tone: "info",
    title: "Put the development sessions on one day",
    detail:
      "Only Possession, Attacking and Defensive Ball Work, Conditioning, Heavy Conditioning and Individual Development grow attributes. Every other session grew CA no more than resting, and repeating a session adds little. One tester packed the development sessions into one day to keep full Rest days, which have no training-injury checks. That cut training-injury risk from 13.8% to 4.0% with almost the same growth.",
  });

  return { role, isGoalkeeper, endAge, seasonsLeft, caGap, focus, trainingRole, sessions, coaching, items };
}
