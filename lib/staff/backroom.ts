import { solveBestXi, type XiSlot } from "@/lib/best-xi/solver";
import { isFreeAgent, type StaffMember } from "./staff-parser";
import {
  MIN_COVERAGE,
  STAFF_ROLES,
  STAFF_ROLE_BY_ID,
  rolesForJob,
  scoreStaffRole,
  type StaffRole,
} from "./staff-roles";

/** How many of each role to hire, by role id. */
export type BackroomCounts = Record<string, number>;

export interface BackroomPreset {
  id: string;
  name: string;
  counts: BackroomCounts;
}

const COACH_GROUPS = STAFF_ROLES.filter((r) => r.group === "Coaching").map((r) => r.id);
const one = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, 1]));

/** The manager is left out of every preset: that's you. */
export const BACKROOM_PRESETS: BackroomPreset[] = [
  {
    id: "full",
    name: "Full backroom",
    counts: {
      "assistant-manager": 1,
      "director-of-football": 1,
      "head-of-youth": 1,
      ...one(COACH_GROUPS),
      scout: 3,
      "performance-analyst": 1,
      physio: 2,
      "sports-scientist": 1,
    },
  },
  {
    id: "coaching",
    name: "Coaching staff",
    counts: { "assistant-manager": 1, ...one(COACH_GROUPS) },
  },
  {
    id: "recruitment",
    name: "Recruitment team",
    counts: { "director-of-football": 1, scout: 4, "performance-analyst": 1 },
  },
  {
    id: "medical",
    name: "Medical team",
    counts: { physio: 2, "sports-scientist": 1 },
  },
];

export const MAX_PER_ROLE = 10;

/** Counts limited to known roles and 0–MAX_PER_ROLE, without zero entries. */
export function cleanCounts(raw: unknown): BackroomCounts {
  const out: BackroomCounts = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, n] of Object.entries(raw as Record<string, unknown>)) {
    if (!STAFF_ROLE_BY_ID[id] || typeof n !== "number" || !Number.isFinite(n)) continue;
    const v = Math.min(MAX_PER_ROLE, Math.max(0, Math.round(n)));
    if (v > 0) out[id] = v;
  }
  return out;
}

/** The preset these counts match exactly, or null for a custom set-up. */
export function matchingPreset(counts: BackroomCounts): BackroomPreset | null {
  const key = (c: BackroomCounts) =>
    Object.entries(cleanCounts(c))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, n]) => `${id}:${n}`)
      .join(",");
  const k = key(counts);
  return BACKROOM_PRESETS.find((p) => key(p.counts) === k) ?? null;
}

/** A staff member pinned to a role (signed, or being negotiated with): kept while the rest is re-picked. */
export interface BackroomLock {
  role: string;
  id: string;
}

/**
 * Locks limited to known roles that are still wanted, one role per person, and no more per role than
 * the count asks for (earliest locks win).
 */
export function cleanLocks(raw: unknown, counts: BackroomCounts): BackroomLock[] {
  if (!Array.isArray(raw)) return [];
  const wanted = cleanCounts(counts);
  const used = new Set<string>();
  const perRole: Record<string, number> = {};
  const out: BackroomLock[] = [];
  for (const l of raw) {
    if (!l || typeof l !== "object") continue;
    const { role, id } = l as Record<string, unknown>;
    if (typeof role !== "string" || typeof id !== "string" || used.has(id)) continue;
    if ((perRole[role] ?? 0) >= (wanted[role] ?? 0)) continue;
    used.add(id);
    perRole[role] = (perRole[role] ?? 0) + 1;
    out.push({ role, id });
  }
  return out;
}

export interface BackroomOptions {
  freeAgentsOnly?: boolean;
  /** Only consider staff whose FM preferred job is this role (FM staff can turn down other jobs). */
  preferredJobOnly?: boolean;
  /** Unique ids left out of the pick. */
  excluded?: Iterable<string>;
  /**
   * Staff fixed to a role whatever the filters say; the solver only fills the slots left over. Locks on
   * roles not wanted, past a role's count, or on staff not in the import are ignored.
   */
  locked?: BackroomLock[];
}

export interface BackroomPick {
  role: StaffRole;
  member: StaffMember;
  score: number;
  coverage: number;
  locked: boolean;
}

export type BackroomResult =
  | { kind: "empty" }
  | { kind: "ok"; picks: BackroomPick[]; totalScore: number }
  | {
      kind: "short";
      /**
       * Roles that can't all be filled, with how many are wanted (not counting locked staff) and how many
       * staff qualify at all.
       */
      roles: { role: StaffRole; wanted: number; eligible: number }[];
    };

/** Staff who may fill a role, with their score on it. */
export function backroomCandidates(staff: StaffMember[], role: StaffRole, opts: BackroomOptions = {}) {
  const excluded = new Set(opts.excluded ?? []);
  const out: { member: StaffMember; score: number; coverage: number }[] = [];
  for (const member of staff) {
    if (excluded.has(member.uniqueId)) continue;
    if (opts.freeAgentsOnly && !isFreeAgent(member)) continue;
    if (opts.preferredJobOnly && !rolesForJob(member.preferredJob).some((r) => r.id === role.id)) continue;
    const s = scoreStaffRole(member, role);
    if (!s || s.coverage < MIN_COVERAGE) continue;
    out.push({ member, score: s.score, coverage: s.coverage });
  }
  return out;
}

/**
 * The backroom with the highest total role score: every wanted role filled, nobody hired twice. Solved
 * exactly as an assignment problem (the Best XI solver with no budget).
 */
export function pickBackroom(staff: StaffMember[], counts: BackroomCounts, opts: BackroomOptions = {}): BackroomResult {
  const clean = cleanCounts(counts);
  const wanted = STAFF_ROLES.map((role) => ({ role, n: clean[role.id] ?? 0 })).filter((w) => w.n > 0);
  if (wanted.length === 0) return { kind: "empty" };

  const byId = new Map(staff.map((m) => [m.uniqueId, m]));

  // Locked staff take their slots first, whatever the filters say.
  const lockedPicks: BackroomPick[] = [];
  for (const l of cleanLocks(opts.locked ?? [], clean)) {
    const member = byId.get(l.id);
    if (!member) continue;
    const role = STAFF_ROLE_BY_ID[l.role];
    const s = scoreStaffRole(member, role);
    lockedPicks.push({ role, member, score: s?.score ?? 0, coverage: s?.coverage ?? 0, locked: true });
  }
  const lockedIds = new Set(lockedPicks.map((p) => p.member.uniqueId));
  const lockedPer = (roleId: string) => lockedPicks.filter((p) => p.role.id === roleId).length;
  const candOpts = { ...opts, excluded: [...(opts.excluded ?? []), ...lockedIds] };

  const pools = wanted
    .map(({ role, n }) => ({ role, n: n - lockedPer(role.id) }))
    .filter((p) => p.n > 0)
    .map(({ role, n }) => ({ role, n, cands: backroomCandidates(staff, role, candOpts) }));
  const slots: XiSlot[] = [];
  const slotRole: StaffRole[] = [];
  const coverage = new Map<string, number>();
  for (const { role, n, cands } of pools) {
    const candidates = cands.map((c) => {
      coverage.set(`${role.id}|${c.member.uniqueId}`, c.coverage);
      return { id: c.member.uniqueId, score: c.score, cost: 0 };
    });
    for (let i = 0; i < n; i++) {
      slots.push({ key: role.id, candidates });
      slotRole.push(role);
    }
  }

  let solved: BackroomPick[] = [];
  if (slots.length > 0) {
    const res = solveBestXi(slots);
    if (res.status !== "ok") {
      const unfilled = new Set(res.unfilled.map((i) => slotRole[i].id));
      return {
        kind: "short",
        roles: pools
          .filter((p) => unfilled.has(p.role.id))
          .map((p) => ({ role: p.role, wanted: p.n, eligible: p.cands.length })),
      };
    }
    solved = res.picks.map((c, i) => ({
      role: slotRole[i],
      member: byId.get(c.id)!,
      score: c.score,
      coverage: coverage.get(`${slotRole[i].id}|${c.id}`) ?? 1,
      locked: false,
    }));
  }

  const picks = [...lockedPicks, ...solved];
  // Within a role, best first.
  picks.sort(
    (a, b) => STAFF_ROLES.indexOf(a.role) - STAFF_ROLES.indexOf(b.role) || b.score - a.score,
  );
  return { kind: "ok", picks, totalScore: picks.reduce((sum, p) => sum + p.score, 0) };
}
