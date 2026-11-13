import { solveBestXi, type XiSlot } from "@scoutreporter/core/best-xi/solver";
import type { PositionSlot } from "@scoutreporter/core/position-slots";
import { statusTier } from "./squad-fields";

/**
 * Squad analysis for one formation: the strongest eleven, the strongest eleven from who is left
 * (the cover), and what that says about each position. Players only count at their natural
 * positions, the same rule as Best XI.
 */

/** A squad player who can play a slot, scored on that slot's role (1–20). */
export interface SquadCandidate {
  id: string;
  score: number;
  /** Score on the same role at projected full potential; null without CA/PA. */
  potential: number | null;
}

export interface SquadSlotInput {
  /** Slots with the same key share a position and role, and so the same candidates. */
  key: string;
  candidates: SquadCandidate[];
}

export interface CoachStars {
  ability: number;
  potential: number;
}

export interface SquadPlayerInfo {
  id: string;
  age: number;
  /** The coach's star ratings (relative to the squad), from a Squad view export. */
  stars?: CoachStars | null;
  /** Agreed playing time (squad status), from a Squad view export. */
  playingTime?: string | null;
  /** In the starting eleven of the FM team sheet; leave undefined when the export has no Picked column. */
  pickedToStart?: boolean;
  /** Where the FM team sheet starts them ("D (C)" → DC), when it does. */
  pickedAt?: PositionSlot | null;
}

export type Unavailable = "loan" | "injured";

export interface SquadAnalysisInput {
  slots: SquadSlotInput[];
  players: SquadPlayerInfo[];
  /** Index of the goalkeeper slot(s): keepers age later and need cover more. */
  goalkeeperSlots?: number[];
  /** Scores are already at full potential, so there is no separate prospect check. */
  potentialBasis?: boolean;
  /** Players who cannot be picked now; they stay out of both elevens. */
  unavailable?: Map<string, Unavailable>;
  /** The export position each slot needs, to pair changes to the FM team sheet by position. */
  slotPositions?: PositionSlot[];
}

export type Pick = SquadCandidate;

export interface SlotReport {
  key: string;
  starter: Pick | null;
  backup: Pick | null;
  /** Other available squad players who can play here, best first (starters elsewhere included). */
  others: (Pick & { xi: 1 | 2 | null })[];
  /** Available squad players who can play here. */
  natural: number;
}

export type Severity = "high" | "medium" | "info";

type SlotFinding = { severity: Severity; index: number } & (
  | { kind: "empty"; count: number }
  | { kind: "weak"; starter: Pick; gap: number }
  | { kind: "no-cover"; starter: Pick }
  | { kind: "drop-off"; starter: Pick; backup: Pick; gap: number }
  | { kind: "ageing"; starter: Pick; age: number; successor: (Pick & { age: number }) | null }
  | ({ kind: "prospect"; starter: Pick; prospect: Pick & { age: number } } & ProspectBasis)
  /** Starts in this eleven on a squad status that promises little football. */
  | { kind: "status-starting"; starter: Pick; playingTime: string }
);

/** Promised a starting place (squad status) but not in the first eleven. Index: where they fit best, if anywhere. */
type PlayerFinding = { severity: Severity; index: number | null } & {
  kind: "status-benched";
  id: string;
  playingTime: string;
  xi: 2 | null;
};

export type Finding = SlotFinding | PlayerFinding;

/**
 * Why a young player counts as a prospect: their projection beats what the starter will be. With
 * CA/PA that is the starter's own projection (their current score once they stop growing); without
 * it, the coach's stars: potential a full star above the starter's ability and above their potential.
 */
export type ProspectBasis =
  | { by: "attributes"; projected: number; against: number; starterAtPotential: boolean }
  | { by: "stars"; potentialStars: number; starterAbility: number; starterPotential: number };

export type MemberStatus =
  /** Projected to beat the starter at full potential (or rated well above them by the coach). */
  | "prospect"
  /** 21 or younger, not (yet) projected to start. */
  | "young"
  /** Not in either eleven. */
  | "surplus"
  /** No natural position in this formation. */
  | "no-fit"
  | Unavailable;

export interface SquadMember {
  id: string;
  age: number;
  /** Slot they fit best: the one where they are closest to the starter. */
  index: number | null;
  score: number | null;
  potential: number | null;
  /** Score minus that slot's starter (negative = below). */
  gap: number | null;
  status: MemberStatus;
}

/** A player FM starts now, at the slot a change is about. */
export interface TeamSheetPlayer {
  id: string;
  /** Where FM starts them. */
  pickedAt: PositionSlot | null;
  /** Their score at this slot, or null when it is not one of their natural positions. */
  score: number | null;
}

/**
 * One change from the FM team sheet to this first eleven, at a slot: who comes in, who makes way.
 * `samePosition` is true when the player making way starts at this very position in FM; otherwise
 * the pairing is the closest one left (FM plays a different shape, or a slot is empty).
 */
export interface TeamSheetChange {
  index: number | null;
  in: Pick | null;
  out: TeamSheetPlayer | null;
  samePosition: boolean;
}

/** A player who starts in both, but at another position in FM. */
export interface TeamSheetMove {
  index: number;
  id: string;
  from: PositionSlot | null;
}

/** The first eleven next to the starting eleven on the FM team sheet. */
export interface SelectionComparison {
  /** Players in both. */
  matching: number;
  /** In this first eleven but not starting in FM. */
  notPicked: string[];
  /** Starting in FM but not in this first eleven. */
  dropped: string[];
  /** Who replaces whom, position by position. */
  changes: TeamSheetChange[];
  moves: TeamSheetMove[];
}

export interface SquadAnalysis {
  slots: SlotReport[];
  firstXi: { average: number | null; filled: number; averageAge: number | null };
  secondXi: { average: number | null; filled: number };
  findings: Finding[];
  /** Squad players in neither eleven, unavailable players included. */
  rest: SquadMember[];
  /** Null when the export has no team sheet (no Picked column, or nobody picked). */
  selection: SelectionComparison | null;
}

/** A starter this far below the eleven's average is its weak link. */
export const WEAK_GAP = 1;
/** A backup this far below the starter is a real drop when he plays. */
export const DROP_OFF_GAP = 1.5;
/** Starters from this age decline within a season or two. */
export const AGEING_AGE = 31;
export const AGEING_AGE_GK = 34;
/** Youngest-side cut-off for a successor or prospect. */
export const YOUNG_AGE = 23;
export const DEVELOPMENT_AGE = 21;
/** A successor this close to the starter is ready to step in. */
const SUCCESSOR_MARGIN = 0.5;
/** A prospect must project at least this much above the starter. */
const PROSPECT_MARGIN = 0.5;
/** Without CA/PA: a prospect's potential stars must beat the starter's ability stars by this much. */
export const STAR_MARGIN = 1;

const GAP_ID = "__gap|";
const GAP_SCORE = -1000;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Best eleven from the candidates not in `exclude`, leaving a slot empty (null) when nobody can play it. */
export function pickEleven(slots: SquadSlotInput[], exclude: Set<string> = new Set()): (Pick | null)[] {
  const perKey = new Map<string, number>();
  for (const s of slots) perKey.set(s.key, (perKey.get(s.key) ?? 0) + 1);

  const byKey = new Map<string, Map<string, Pick>>();
  const xi: XiSlot[] = slots.map((s) => {
    const lookup = byKey.get(s.key) ?? new Map(s.candidates.map((c) => [c.id, c]));
    byKey.set(s.key, lookup);
    const real = s.candidates.filter((c) => !exclude.has(c.id)).map((c) => ({ id: c.id, score: c.score, cost: 0 }));
    // One stand-in per slot of this key, scored so low that a real player always wins.
    const gaps = Array.from({ length: perKey.get(s.key)! }, (_, j) => ({
      id: `${GAP_ID}${s.key}|${j}`,
      score: GAP_SCORE,
      cost: 0,
    }));
    return { key: s.key, candidates: [...real, ...gaps] };
  });

  const res = solveBestXi(xi);
  if (res.status !== "ok") return slots.map(() => null);
  return res.picks.map((c, i) => (c.id.startsWith(GAP_ID) ? null : byKey.get(slots[i].key)!.get(c.id)!));
}

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, info: 2 };
const KIND_ORDER: Record<Finding["kind"], number> = {
  empty: 0,
  "no-cover": 1,
  weak: 2,
  "drop-off": 3,
  ageing: 4,
  "status-benched": 5,
  prospect: 6,
  "status-starting": 7,
};

export function analyseSquad(input: SquadAnalysisInput): SquadAnalysis {
  const unavailable = input.unavailable ?? new Map<string, Unavailable>();
  const out = new Set(unavailable.keys());
  const slots = input.slots.map((s) => ({ key: s.key, candidates: s.candidates.filter((c) => !out.has(c.id)) }));
  const info = new Map(input.players.map((p) => [p.id, p]));
  const ageOf = (id: string) => info.get(id)?.age ?? 0;
  const starsOf = (id: string) => info.get(id)?.stars ?? null;
  const gkSlots = new Set(input.goalkeeperSlots ?? []);

  const first = pickEleven(slots);
  const firstIds = new Set(first.filter((p): p is Pick => p !== null).map((p) => p.id));
  const second = pickEleven(slots, firstIds);
  const secondIds = new Set(second.filter((p): p is Pick => p !== null).map((p) => p.id));

  const reports: SlotReport[] = slots.map((s, i) => {
    const starter = first[i];
    const backup = second[i];
    const others = [...s.candidates]
      .filter((c) => c.id !== starter?.id && c.id !== backup?.id)
      .sort((a, b) => b.score - a.score)
      .map((c) => ({ ...c, xi: firstIds.has(c.id) ? (1 as const) : secondIds.has(c.id) ? (2 as const) : null }));
    return { key: s.key, starter, backup, others, natural: s.candidates.length };
  });

  const starters = first.filter((p): p is Pick => p !== null);
  const backups = second.filter((p): p is Pick => p !== null);
  const xiAverage = mean(starters.map((p) => p.score));

  /** Would a candidate outgrow this starter, by projected attributes or else by the coach's stars? */
  const prospectAgainst = (c: Pick, starter: Pick): ProspectBasis | null => {
    if (input.potentialBasis) return null;
    if (c.potential !== null) {
      const starterAtPotential = starter.potential !== null && starter.potential > starter.score;
      const against = starterAtPotential ? starter.potential! : starter.score;
      return c.potential >= against + PROSPECT_MARGIN
        ? { by: "attributes", projected: c.potential, against, starterAtPotential }
        : null;
    }
    const mine = starsOf(c.id);
    const theirs = starsOf(starter.id);
    if (!mine || !theirs) return null;
    return mine.potential >= theirs.ability + STAR_MARGIN && mine.potential > theirs.potential
      ? { by: "stars", potentialStars: mine.potential, starterAbility: theirs.ability, starterPotential: theirs.potential }
      : null;
  };
  /** How far a prospect outgrows the starter, to rank them. */
  const margin = (b: ProspectBasis) =>
    b.by === "attributes" ? b.projected - b.against : b.potentialStars - Math.max(b.starterAbility, b.starterPotential);

  const findings: Finding[] = [];
  const emptyKeys = new Set<string>();
  reports.forEach((r, i) => {
    const gk = gkSlots.has(i);
    if (!r.starter) {
      if (!emptyKeys.has(r.key)) {
        emptyKeys.add(r.key);
        const count = reports.filter((x) => x.key === r.key && !x.starter).length;
        findings.push({ kind: "empty", severity: "high", index: i, count });
      }
      return;
    }
    const starter = r.starter;

    if (xiAverage !== null && starters.length > 1) {
      const gap = xiAverage - starter.score;
      if (gap >= WEAK_GAP) {
        findings.push({ kind: "weak", severity: gap >= 1.5 * WEAK_GAP ? "high" : "medium", index: i, starter, gap });
      }
    }

    if (!r.backup) {
      findings.push({ kind: "no-cover", severity: gk ? "high" : "medium", index: i, starter });
    } else {
      const gap = starter.score - r.backup.score;
      if (gap >= DROP_OFF_GAP) {
        findings.push({
          kind: "drop-off",
          severity: gap >= 2 * DROP_OFF_GAP ? "high" : "medium",
          index: i,
          starter,
          backup: r.backup,
          gap,
        });
      }
    }

    const age = ageOf(starter.id);
    if (age >= (gk ? AGEING_AGE_GK : AGEING_AGE)) {
      // Anyone young who already plays near the starter's level, or will at full potential.
      const successor =
        [r.backup, ...r.others]
          .filter((c): c is Pick => c !== null && c.id !== starter.id)
          .map((c) => ({ ...c, age: ageOf(c.id) }))
          .filter((c) => c.age <= YOUNG_AGE)
          .filter((c) => Math.max(c.score, c.potential ?? -Infinity) >= starter.score - SUCCESSOR_MARGIN)
          .sort((a, b) => b.score - a.score)[0] ?? null;
      findings.push({ kind: "ageing", severity: successor ? "info" : "medium", index: i, starter, age, successor });
    }

    const playingTime = info.get(starter.id)?.playingTime;
    if (playingTime && statusTier(playingTime) === "backup") {
      findings.push({ kind: "status-starting", severity: "info", index: i, starter, playingTime });
    }
  });

  // Prospects: young players outside the first eleven who will outgrow a position's weakest starter.
  // Each position gets at most one, and each prospect is named once, where they outgrow it most.
  const options: { key: string; index: number; starter: Pick; c: Pick; basis: ProspectBasis }[] = [];
  const seen = new Set<string>();
  reports.forEach((r) => {
    if (seen.has(r.key)) return;
    seen.add(r.key);
    const group = reports.map((x, j) => ({ x, j })).filter(({ x }) => x.key === r.key && x.starter);
    if (group.length === 0) return;
    const weakest = group.reduce((p, q) => (q.x.starter!.score < p.x.starter!.score ? q : p));
    const target = weakest.x.starter!;
    for (const c of slots[weakest.j].candidates) {
      if (firstIds.has(c.id) || ageOf(c.id) > YOUNG_AGE) continue;
      const basis = prospectAgainst(c, target);
      if (basis) options.push({ key: r.key, index: weakest.j, starter: target, c, basis });
    }
  });
  // Projected attributes before stars, then the biggest margin.
  options.sort(
    (p, q) => Number(p.basis.by === "stars") - Number(q.basis.by === "stars") || margin(q.basis) - margin(p.basis),
  );
  const keyTaken = new Set<string>();
  const prospectTaken = new Set<string>();
  for (const o of options) {
    if (keyTaken.has(o.key) || prospectTaken.has(o.c.id)) continue;
    keyTaken.add(o.key);
    prospectTaken.add(o.c.id);
    findings.push({
      kind: "prospect",
      severity: "info",
      index: o.index,
      starter: o.starter,
      prospect: { ...o.c, age: ageOf(o.c.id) },
      ...o.basis,
    });
  }

  // Everyone else: where they fit best and how far off the starter they are.
  const rest: SquadMember[] = [];
  for (const p of input.players) {
    if (firstIds.has(p.id) || secondIds.has(p.id)) continue;
    let best: { index: number; c: Pick; gap: number } | null = null;
    input.slots.forEach((s, i) => {
      const c = s.candidates.find((x) => x.id === p.id);
      if (!c) return;
      const gap = c.score - (first[i]?.score ?? 0);
      if (!best || gap > best.gap) best = { index: i, c, gap };
    });
    const b = best as { index: number; c: Pick; gap: number } | null;
    const startsAt = b ? first[b.index] : null;
    let status: MemberStatus;
    const away = unavailable.get(p.id);
    if (away) status = away;
    else if (!b) status = "no-fit";
    else if (startsAt && prospectAgainst(b.c, startsAt)) status = "prospect";
    else if (p.age <= DEVELOPMENT_AGE) status = "young";
    else status = "surplus";
    rest.push({
      id: p.id,
      age: p.age,
      index: b?.index ?? null,
      score: b?.c.score ?? null,
      potential: b?.c.potential ?? null,
      gap: b ? b.gap : null,
      status,
    });

    // Promised a starting place but not in the first eleven.
    if (!away && p.playingTime && statusTier(p.playingTime) === "starter") {
      findings.push({
        kind: "status-benched",
        severity: "medium",
        index: b?.index ?? null,
        id: p.id,
        playingTime: p.playingTime,
        xi: null,
      });
    }
  }
  for (const id of secondIds) {
    const p = info.get(id);
    if (p?.playingTime && statusTier(p.playingTime) === "starter" && !unavailable.has(id)) {
      findings.push({
        kind: "status-benched",
        severity: "medium",
        index: second.findIndex((x) => x?.id === id),
        id,
        playingTime: p.playingTime,
        xi: 2,
      });
    }
  }

  findings.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      (a.index ?? 99) - (b.index ?? 99),
  );

  const STATUS_ORDER: Record<MemberStatus, number> = {
    prospect: 0,
    young: 1,
    surplus: 2,
    "no-fit": 3,
    injured: 4,
    loan: 5,
  };
  rest.sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      (b.gap ?? -Infinity) - (a.gap ?? -Infinity) ||
      a.age - b.age,
  );

  let selection: SelectionComparison | null = null;
  const fmStarters = input.players.filter((p) => p.pickedToStart).map((p) => p.id);
  if (fmStarters.length > 0) {
    const fm = new Set(fmStarters);
    selection = {
      matching: starters.filter((p) => fm.has(p.id)).length,
      notPicked: starters.filter((p) => !fm.has(p.id)).map((p) => p.id),
      dropped: fmStarters.filter((id) => !firstIds.has(id)),
      ...pairTeamSheet(input, first, fm),
    };
  }

  return {
    slots: reports,
    firstXi: { average: xiAverage, filled: starters.length, averageAge: mean(starters.map((p) => ageOf(p.id))) },
    secondXi: { average: mean(backups.map((p) => p.score)), filled: backups.length },
    findings,
    rest,
    selection,
  };
}

export interface Upgrade {
  key: string;
  /** Slots of this key; the comparison is with the weakest starter among them. */
  indices: number[];
  starter: Pick | null;
  candidates: Pick[];
}

/** Players from another pool (e.g. the scouting import) who would beat the weakest starter at each position. */
export function findUpgrades(
  analysis: SquadAnalysis,
  pool: SquadSlotInput[],
  { margin = 0.5, limit = 3 }: { margin?: number; limit?: number } = {},
): Upgrade[] {
  const out = new Map<string, Upgrade>();
  analysis.slots.forEach((r, i) => {
    const u = out.get(r.key);
    if (!u) {
      out.set(r.key, { key: r.key, indices: [i], starter: r.starter, candidates: [] });
      return;
    }
    u.indices.push(i);
    if (!r.starter || (u.starter && r.starter.score < u.starter.score)) u.starter = r.starter;
  });
  for (const u of out.values()) {
    const bar = (u.starter?.score ?? -Infinity) + margin;
    const cands = pool[u.indices[0]]?.candidates ?? [];
    u.candidates = cands
      .filter((c) => c.score >= bar)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  return [...out.values()];
}

/**
 * Pair the first eleven with the FM team sheet. Each newcomer replaces the FM starter at the same
 * position when there is one; the rest are paired with whoever is left, preferring someone who can
 * play the slot naturally.
 */
function pairTeamSheet(
  input: SquadAnalysisInput,
  first: (Pick | null)[],
  fm: Set<string>,
): { changes: TeamSheetChange[]; moves: TeamSheetMove[] } {
  const at = (i: number) => input.slotPositions?.[i] ?? null;
  const pickedAt = new Map(input.players.map((p) => [p.id, p.pickedAt ?? null]));
  const ours = new Set(first.filter((p): p is Pick => p !== null).map((p) => p.id));
  const scoreAt = (id: string, i: number) => input.slots[i]?.candidates.find((c) => c.id === id)?.score ?? null;
  const outPlayer = (id: string, i: number): TeamSheetPlayer => ({ id, pickedAt: pickedAt.get(id) ?? null, score: scoreAt(id, i) });

  const leaving = [...fm].filter((id) => !ours.has(id));
  const incoming = first.flatMap((p, i) => (p && !fm.has(p.id) ? [i] : []));
  const changes: TeamSheetChange[] = [];
  const paired = new Set<number>();

  // Same position first: the newcomer takes that player's place outright.
  for (const i of incoming) {
    const j = leaving.findIndex((id) => at(i) !== null && pickedAt.get(id) === at(i));
    if (j < 0) continue;
    changes.push({ index: i, in: first[i], out: outPlayer(leaving[j], i), samePosition: true });
    leaving.splice(j, 1);
    paired.add(i);
  }
  // Then the closest fit left: someone who can play the slot naturally, else anyone.
  for (const i of incoming) {
    if (paired.has(i)) continue;
    let j = leaving.findIndex((id) => scoreAt(id, i) !== null);
    if (j < 0) j = leaving.length > 0 ? 0 : -1;
    changes.push({ index: i, in: first[i], out: j >= 0 ? outPlayer(leaving[j], i) : null, samePosition: false });
    if (j >= 0) leaving.splice(j, 1);
  }
  // FM starters left over (this eleven has an empty slot).
  for (const id of leaving) {
    changes.push({ index: null, in: null, out: { id, pickedAt: pickedAt.get(id) ?? null, score: null }, samePosition: false });
  }
  changes.sort((a, b) => (a.index ?? 99) - (b.index ?? 99));

  const moves: TeamSheetMove[] = [];
  first.forEach((p, i) => {
    if (!p || !fm.has(p.id)) return;
    const from = pickedAt.get(p.id) ?? null;
    if (at(i) !== null && from !== null && from !== at(i)) moves.push({ index: i, id: p.id, from });
  });

  return { changes, moves };
}
