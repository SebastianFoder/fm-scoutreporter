import { STAFF_ATTRIBUTES, type StaffAttributeKey } from "./staff-attributes";
import type { StaffMember } from "./staff-parser";

/**
 * Staff role weights from jamiebolden/fm-scoring (`weights/fm27.toml`, `[staff.<role>]`, notes in
 * `weights/fm27_staff.md`): a community FM24 staff rating grid (weights 0–4), relabelled for FM27 and checked
 * against the key attributes FM27 highlights on staff profiles. The general Coach column is split into FM's nine
 * coaching groups (each group's two coaching attributes at 4, plus the coach mentals and Working With
 * Youngsters). Adaptability, Judging Staff Ability and Negotiating have weight 0 in every role.
 *
 * fm-scoring's "Judging Player Ability / Potential" are FM26's Judging Current / Potential Ability (JCA / JPA),
 * and its "People Management" is FM26's Man Management.
 */

export type StaffRoleGroup = "Management" | "Coaching" | "Recruitment and analysis" | "Medical";

export interface StaffRole {
  id: string;
  /** fm-scoring's short label. */
  short: string;
  name: string;
  group: StaffRoleGroup;
  /** One line on what the role is judged on. */
  summary: string;
  /** Relative weights (1–4); the score is the weighted average of the known attributes. */
  weights: Partial<Record<StaffAttributeKey, number>>;
}

const COACH_GROUP_EXTRAS = {
  authority: 2,
  determination: 2,
  motivating: 2,
  manManagement: 1,
  workingWithYoungsters: 1,
} as const;

function coachGroup(
  id: string,
  short: string,
  name: string,
  trains: string,
  a: StaffAttributeKey,
  b: StaffAttributeKey,
): StaffRole {
  return {
    id,
    short,
    name,
    group: "Coaching",
    summary: `Trains ${trains}.`,
    weights: { [a]: 4, [b]: 4, ...COACH_GROUP_EXTRAS },
  };
}

export const STAFF_ROLES: StaffRole[] = [
  {
    id: "manager",
    short: "Mgr",
    name: "Manager",
    group: "Management",
    summary: "Judging ability, motivating, people management and tactical knowledge, then the coaching attributes.",
    weights: {
      judgingCurrentAbility: 4,
      motivating: 4,
      manManagement: 4,
      tacticalKnowledge: 4,
      attacking: 3,
      defending: 3,
      determination: 3,
      judgingPotentialAbility: 3,
      possession: 3,
      tacticalCoaching: 3,
      technical: 3,
      workingWithYoungsters: 1,
    },
  },
  {
    id: "assistant-manager",
    short: "AM",
    name: "Assistant manager",
    group: "Management",
    summary: "Judging ability, motivating and people management for reports, team talks and match advice.",
    weights: {
      judgingCurrentAbility: 4,
      motivating: 4,
      manManagement: 4,
      determination: 3,
      judgingPotentialAbility: 3,
      tacticalKnowledge: 3,
      attacking: 2,
      defending: 2,
      possession: 2,
      tacticalCoaching: 2,
      technical: 2,
      workingWithYoungsters: 1,
    },
  },
  {
    id: "director-of-football",
    short: "DoF",
    name: "Director of football",
    group: "Management",
    summary: "Judging ability and potential. Business (also used) is hidden, so it is not scored.",
    weights: {
      judgingCurrentAbility: 4,
      judgingPotentialAbility: 4,
      manManagement: 1,
      determination: 1,
      motivating: 1,
      tacticalKnowledge: 1,
    },
  },
  {
    id: "head-of-youth",
    short: "HoYD",
    name: "Head of youth development",
    group: "Management",
    summary:
      "Judging ability and potential and working with youngsters. Their hidden Professionalism shifts the intake's: check it by hand.",
    weights: {
      judgingCurrentAbility: 4,
      judgingPotentialAbility: 4,
      workingWithYoungsters: 4,
      attacking: 1,
      defending: 1,
      determination: 1,
      motivating: 1,
      manManagement: 1,
      possession: 1,
      tacticalCoaching: 1,
      technical: 1,
      fitness: 1,
      tacticalKnowledge: 1,
    },
  },
  coachGroup(
    "coach-attacking-tactical",
    "AttTct",
    "Coach: attacking tactical",
    "Composure, Flair and Off The Ball",
    "attacking",
    "tacticalCoaching",
  ),
  coachGroup(
    "coach-attacking-technical",
    "AttTec",
    "Coach: attacking technical",
    "Crossing, Finishing and Long Shots",
    "attacking",
    "technical",
  ),
  coachGroup(
    "coach-defending-tactical",
    "DefTct",
    "Coach: defending tactical",
    "Aggression, Concentration and Positioning",
    "defending",
    "tacticalCoaching",
  ),
  coachGroup(
    "coach-defending-technical",
    "DefTec",
    "Coach: defending technical",
    "Marking and Tackling",
    "defending",
    "technical",
  ),
  coachGroup(
    "coach-possession-tactical",
    "PosTct",
    "Coach: possession tactical",
    "Anticipation, Decisions, Teamwork and Vision",
    "possession",
    "tacticalCoaching",
  ),
  coachGroup(
    "coach-possession-technical",
    "PosTec",
    "Coach: possession technical",
    "Dribbling, First Touch, Heading, Passing and Technique",
    "possession",
    "technical",
  ),
  {
    id: "coach-goalkeeping",
    short: "GKC",
    name: "Coach: goalkeeping",
    group: "Coaching",
    summary: "Trains every goalkeeping attribute, including the outfield-named ones keepers use.",
    weights: {
      goalkeeping: 4,
      motivating: 3,
      authority: 2,
      determination: 2,
      manManagement: 2,
      possession: 2,
      workingWithYoungsters: 1,
    },
  },
  {
    id: "coach-fitness",
    short: "FitC",
    name: "Coach: fitness",
    group: "Coaching",
    summary: "Trains the physicals and Work Rate, the biggest share of every position's weight.",
    weights: {
      fitness: 4,
      motivating: 3,
      authority: 2,
      determination: 2,
      manManagement: 2,
      workingWithYoungsters: 1,
    },
  },
  {
    id: "coach-set-pieces",
    short: "SetC",
    name: "Coach: set pieces",
    group: "Coaching",
    summary: "Trains Corners, Free Kick Taking, Long Throws and Penalty Taking.",
    weights: {
      setPieces: 4,
      authority: 2,
      determination: 2,
      motivating: 2,
      tacticalCoaching: 2,
      manManagement: 1,
      technical: 1,
      workingWithYoungsters: 1,
    },
  },
  {
    id: "scout",
    short: "Scout",
    name: "Scout",
    group: "Recruitment and analysis",
    summary: "Judging current and potential ability, then tactical knowledge.",
    weights: { judgingCurrentAbility: 4, judgingPotentialAbility: 4, tacticalKnowledge: 2, determination: 2 },
  },
  {
    id: "performance-analyst",
    short: "PA",
    name: "Performance analyst",
    group: "Recruitment and analysis",
    summary: "Analysing data, then judging ability and tactical knowledge.",
    weights: { analysingData: 4, judgingCurrentAbility: 3, tacticalKnowledge: 2, determination: 1 },
  },
  {
    id: "physio",
    short: "Physio",
    name: "Physio",
    group: "Medical",
    summary: "Physiotherapy, backed by sports science and the mentals.",
    weights: { physiotherapy: 4, determination: 2, motivating: 2, manManagement: 2, sportsScience: 2 },
  },
  {
    id: "sports-scientist",
    short: "SpSci",
    name: "Sports scientist",
    group: "Medical",
    summary: "Sports science, backed by fitness, physiotherapy and the mentals.",
    weights: {
      sportsScience: 4,
      determination: 2,
      fitness: 2,
      motivating: 2,
      manManagement: 2,
      physiotherapy: 2,
    },
  },
];

export const STAFF_ROLE_BY_ID: Record<string, StaffRole> = Object.fromEntries(STAFF_ROLES.map((r) => [r.id, r]));

export const STAFF_ROLE_GROUPS: StaffRoleGroup[] = ["Management", "Coaching", "Recruitment and analysis", "Medical"];

const OUTFIELD_COACH_GROUPS = [
  "coach-attacking-tactical",
  "coach-attacking-technical",
  "coach-defending-tactical",
  "coach-defending-technical",
  "coach-possession-tactical",
  "coach-possession-technical",
];

/**
 * FM "Preferred Job" (lowercase) → the fm-scoring roles that cover it. A generic Coach is scored on their best
 * outfield coaching group. Recruitment Analyst has no fm-scoring weights; the Performance Analyst's
 * (Analysing Data plus judging ability) are the nearest.
 */
const JOB_ROLES: Record<string, string[]> = {
  manager: ["manager"],
  "head coach": ["manager"],
  "assistant manager": ["assistant-manager"],
  "assistant coach": ["assistant-manager"],
  "director of football": ["director-of-football"],
  "technical director": ["director-of-football"],
  "sporting director": ["director-of-football"],
  "head of youth development": ["head-of-youth"],
  coach: OUTFIELD_COACH_GROUPS,
  "first team coach": OUTFIELD_COACH_GROUPS,
  "youth coach": OUTFIELD_COACH_GROUPS,
  "goalkeeping coach": ["coach-goalkeeping"],
  "fitness coach": ["coach-fitness"],
  "set piece coach": ["coach-set-pieces"],
  scout: ["scout"],
  "chief scout": ["scout"],
  "performance analyst": ["performance-analyst"],
  "recruitment analyst": ["performance-analyst"],
  physio: ["physio"],
  "head physio": ["physio"],
  physiotherapist: ["physio"],
  "sports scientist": ["sports-scientist"],
  "head of sports science": ["sports-scientist"],
};

/** fm-scoring roles that cover an FM preferred job; empty when the research has no weights for it. */
export function rolesForJob(job: string): StaffRole[] {
  return (JOB_ROLES[job.trim().toLowerCase()] ?? []).map((id) => STAFF_ROLE_BY_ID[id]);
}

/** Attributes the roles weight, in display order, with the highest weight any of them gives. */
export function weightedAttributes(roles: StaffRole[]): Map<StaffAttributeKey, number> {
  const out = new Map<StaffAttributeKey, number>();
  for (const a of STAFF_ATTRIBUTES) {
    const w = Math.max(0, ...roles.map((r) => r.weights[a.key] ?? 0));
    if (w > 0) out.set(a.key, w);
  }
  return out;
}

export interface StaffRoleScore {
  role: StaffRole;
  /** Weighted average on the 1–20 scale. */
  score: number;
  /** Share of the role's weight the export had values for (0–1). */
  coverage: number;
}

/** Score on one role, or null when none of its attributes are known. */
export function scoreStaffRole(s: StaffMember, role: StaffRole): StaffRoleScore | null {
  let sum = 0;
  let known = 0;
  let total = 0;
  for (const [key, w] of Object.entries(role.weights) as [StaffAttributeKey, number][]) {
    total += w;
    const r = s.attributes[key];
    if (!r) continue;
    sum += r.value * w;
    known += w;
  }
  if (known === 0) return null;
  return { role, score: sum / known, coverage: known / total };
}

export interface StaffScores {
  /** Every role with known attributes, best first. */
  all: StaffRoleScore[];
  best: StaffRoleScore | null;
  /** Best score among the roles covering their FM preferred job. */
  preferred: StaffRoleScore | null;
  byRole: Map<string, StaffRoleScore>;
}

/** Roles need at least this share of their weight known to count as a "best role" or a backroom pick. */
export const MIN_COVERAGE = 0.75;

function pickBest(scores: StaffRoleScore[]): StaffRoleScore | null {
  return scores.find((r) => r.coverage >= MIN_COVERAGE) ?? scores[0] ?? null;
}

export function scoreStaff(s: StaffMember): StaffScores {
  const all: StaffRoleScore[] = [];
  const byRole = new Map<string, StaffRoleScore>();
  for (const role of STAFF_ROLES) {
    const r = scoreStaffRole(s, role);
    if (!r) continue;
    all.push(r);
    byRole.set(role.id, r);
  }
  all.sort((a, b) => b.score - a.score);
  const jobRoles = new Set(rolesForJob(s.preferredJob).map((r) => r.id));
  return {
    all,
    best: pickBest(all),
    preferred: pickBest(all.filter((r) => jobRoles.has(r.role.id))),
    byRole,
  };
}
