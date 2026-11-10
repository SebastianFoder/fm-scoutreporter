/**
 * Pick one distinct player per slot to maximise the total score, with the total cost
 * held between an optional minimum and maximum budget.
 *
 * Without a budget this is the assignment problem, solved exactly by the Hungarian
 * method. A budget adds a knapsack constraint, handled by branch and bound: each node is
 * bounded by the Lagrangian relaxation (put a price ν on cost, solve the assignment on
 * score − ν·cost, and tune ν until the bound is tightest), then split on a player the
 * over-budget and in-budget line-ups disagree about.
 */
export interface XiCandidate {
  id: string;
  score: number;
  cost: number;
}

export interface XiSlot {
  /** Slots with the same key must offer the same candidates (e.g. two centre-backs on one role). */
  key: string;
  candidates: XiCandidate[];
}

export interface XiOptions {
  minBudget?: number;
  maxBudget?: number;
  /** Stop proving optimality after this long; the best line-up found so far is returned. */
  timeLimitMs?: number;
  /** Total-score gap below which a line-up counts as the best. */
  tolerance?: number;
}

export type XiResult =
  | {
      status: "ok";
      /** One candidate per input slot, in input order. */
      picks: XiCandidate[];
      totalScore: number;
      totalCost: number;
      /** False when the time limit was hit before the search could prove this is the best. */
      optimal: boolean;
      /** When not proven: how much higher the best possible total score could still be. */
      gap: number;
    }
  | {
      status: "infeasible";
      /** "slots": some slots have too few eligible players. "budget": no line-up fits the budget. */
      reason: "slots" | "budget";
      /** Input slot indices that cannot be filled (reason "slots"). */
      unfilled: number[];
    };

/** Drop candidates that `need` others beat on score without being worse on cost. */
function pruneDominated(cands: XiCandidate[], need: number, cheaperIsBetter: boolean): XiCandidate[] {
  const dir = cheaperIsBetter ? 1 : -1;
  const sorted = [...cands].sort((a, b) => dir * (a.cost - b.cost) || b.score - a.score);
  const top: number[] = []; // best `need` scores seen so far, ascending
  const kept: XiCandidate[] = [];
  for (const c of sorted) {
    if (top.length < need) {
      kept.push(c);
      top.push(c.score);
      top.sort((a, b) => a - b);
    } else if (c.score > top[0]) {
      kept.push(c);
      top[0] = c.score;
      top.sort((a, b) => a - b);
    }
  }
  return kept;
}

function topByScore(cands: XiCandidate[], need: number): XiCandidate[] {
  return [...cands].sort((a, b) => b.score - a.score || a.cost - b.cost).slice(0, need);
}

interface Problem {
  rows: number;
  cols: number;
  /** Slots sharing a candidate list share a group. */
  groupOf: number[];
  /** rows × cols; -Infinity where the player cannot play the slot. */
  score: Float64Array;
  cost: Float64Array;
  cand: (XiCandidate | undefined)[];
  /** Columns still eligible for at least one row. */
  alive: Uint8Array;
}

function buildProblem(slots: XiSlot[], prune: (c: XiCandidate[]) => XiCandidate[]): Problem {
  const groups = new Map<string, { index: number; cands: XiCandidate[] }>();
  const groupOf = slots.map((s) => {
    let g = groups.get(s.key);
    if (!g) {
      g = { index: groups.size, cands: prune(s.candidates) };
      groups.set(s.key, g);
    }
    return g.index;
  });
  const groupCands = [...groups.values()].map((g) => g.cands);

  const colOf = new Map<string, number>();
  for (const cands of groupCands) {
    for (const c of cands) if (!colOf.has(c.id)) colOf.set(c.id, colOf.size);
  }
  const rows = slots.length;
  const cols = colOf.size;
  const score = new Float64Array(rows * cols).fill(-Infinity);
  const cost = new Float64Array(rows * cols);
  const cand: (XiCandidate | undefined)[] = new Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    for (const c of groupCands[groupOf[r]]) {
      const i = r * cols + colOf.get(c.id)!;
      score[i] = c.score;
      cost[i] = c.cost;
      cand[i] = c;
    }
  }
  return { rows, cols, groupOf, score, cost, cand, alive: new Uint8Array(cols).fill(1) };
}

interface Node {
  /** Column fixed for each row, or -1. */
  forced: Int32Array;
  /** group * cols + col pairs that may not be used. */
  forbidden: Set<number>;
}

interface Assignment {
  col: Int32Array;
  score: number;
  cost: number;
  /** Dual prices per row and column: (wc·cost − ws·score) − rowDual − colDual ≥ 0 for every pair. */
  rowDual: Float64Array;
  colDual: Float64Array;
}

/**
 * Hungarian method: the assignment of free rows to distinct columns maximising
 * Σ (ws·score − wc·cost), or null when the rows cannot all be filled.
 */
function assign(p: Problem, node: Node, ws: number, wc: number): Assignment | null {
  const freeRows: number[] = [];
  const taken = new Uint8Array(p.cols);
  for (let r = 0; r < p.rows; r++) {
    if (node.forced[r] >= 0) taken[node.forced[r]] = 1;
    else freeRows.push(r);
  }
  const freeCols: number[] = [];
  for (let c = 0; c < p.cols; c++) if (!taken[c] && p.alive[c]) freeCols.push(c);
  const n = freeRows.length;
  const m = freeCols.length;
  if (m < n) return null;

  // a[i][j]: cost to minimise (1-based), Infinity where not allowed.
  const a = new Float64Array((n + 1) * (m + 1));
  for (let i = 1; i <= n; i++) {
    const r = freeRows[i - 1];
    const g = p.groupOf[r];
    for (let j = 1; j <= m; j++) {
      const c = freeCols[j - 1];
      const idx = r * p.cols + c;
      const s = p.score[idx];
      a[i * (m + 1) + j] =
        s === -Infinity || node.forbidden.has(g * p.cols + c) ? Infinity : wc * p.cost[idx] - ws * s;
    }
  }

  const u = new Float64Array(n + 1);
  const v = new Float64Array(m + 1);
  const match = new Int32Array(m + 1); // row matched to each column
  const way = new Int32Array(m + 1);
  const minv = new Float64Array(m + 1);
  const used = new Uint8Array(m + 1);
  for (let i = 1; i <= n; i++) {
    match[0] = i;
    let j0 = 0;
    minv.fill(Infinity);
    used.fill(0);
    do {
      used[j0] = 1;
      const i0 = match[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = a[i0 * (m + 1) + j] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      if (delta === Infinity) return null;
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[match[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (match[j0] !== 0);
    do {
      const j1 = way[j0];
      match[j0] = match[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const col = Int32Array.from(node.forced);
  for (let j = 1; j <= m; j++) if (match[j] > 0) col[freeRows[match[j] - 1]] = freeCols[j - 1];
  let score = 0;
  let cost = 0;
  for (let r = 0; r < p.rows; r++) {
    score += p.score[r * p.cols + col[r]];
    cost += p.cost[r * p.cols + col[r]];
  }
  const rowDual = new Float64Array(p.rows);
  const colDual = new Float64Array(p.cols);
  for (let i = 1; i <= n; i++) rowDual[freeRows[i - 1]] = u[i];
  for (let j = 1; j <= m; j++) colDual[freeCols[j - 1]] = v[j];
  return { col, score, cost, rowDual, colDual };
}

interface SearchResult {
  best: Assignment | null;
  optimal: boolean;
  /** How much higher than `best` the true optimum could still be (0 when proven). */
  gap: number;
}

interface Evaluation {
  bound: number;
  branch: [number, number] | null;
  /** The relaxed assignment the bound came from, and its price on cost. */
  relaxed: { a: Assignment; wc: number } | null;
}

function search(p: Problem, minB: number, maxB: number, deadline: number, tol: number): SearchResult {
  let scale = 1;
  for (let i = 0; i < p.cost.length; i++) if (p.cost[i] > scale) scale = p.cost[i];
  const eps = 1e-9 * scale;
  const inBudget = (cost: number) => cost <= maxB + eps && cost >= minB - eps;

  let best: Assignment | null = null;
  const consider = (a: Assignment) => {
    if (inBudget(a.cost) && (!best || a.score > best.score)) best = a;
  };

  /** Upper bound on the node's best in-budget score, plus the player to branch on. */
  const evaluate = (node: Node): Evaluation | null => {
    const free = assign(p, node, 1, 0);
    if (!free) return null;
    consider(free);
    if (inBudget(free.cost)) return { bound: free.score, branch: null, relaxed: null };

    // The budget side the unconstrained line-up breaks: sgn·cost ≤ limit.
    const sgn = free.cost > maxB ? 1 : -1;
    const limit = sgn > 0 ? maxB : -minB;
    let over = free;
    let within = assign(p, node, 0, sgn);
    if (!within || sgn * within.cost > limit + eps) return null;
    consider(within);

    let bound = over.score;
    let relaxed: Evaluation["relaxed"] = { a: free, wc: 0 };
    for (let it = 0; it < 60; it++) {
      const dCost = sgn * (over.cost - within.cost);
      if (dCost <= eps) break;
      // Price at which the two line-ups tie; the relaxed optimum there either confirms it or cuts in.
      const nu = (over.score - within.score) / dCost;
      const a = assign(p, node, 1, sgn * nu);
      if (!a) break;
      consider(a);
      const value = a.score - nu * sgn * a.cost;
      bound = value + nu * limit;
      relaxed = { a, wc: sgn * nu };
      if (value <= over.score - nu * sgn * over.cost + 1e-9) break;
      if (sgn * a.cost > limit + eps) over = a;
      else within = a;
    }

    let branch: [number, number] | null = null;
    let widest = -1;
    for (let r = 0; r < p.rows; r++) {
      if (node.forced[r] >= 0 || over.col[r] === within.col[r]) continue;
      const gap = Math.abs(p.cost[r * p.cols + over.col[r]] - p.cost[r * p.cols + within.col[r]]);
      if (gap > widest) {
        widest = gap;
        branch = [r, within.col[r]];
      }
    }
    return { bound, branch, relaxed };
  };

  const root: Node = { forced: new Int32Array(p.rows).fill(-1), forbidden: new Set() };
  const first = evaluate(root);
  if (!first) return { best, optimal: true, gap: 0 };

  const open: { node: Node; bound: number; branch: [number, number] }[] = [];
  if (first.branch) open.push({ node: root, bound: first.bound, branch: first.branch });

  // Reduced-cost fixing: putting a player in a slot costs at least that pair's reduced cost off
  // the root bound, so pairs that would drop it below the best line-up found can never win.
  // Identical slots are judged together so they stay interchangeable for branching.
  let pairLoss: Float64Array | null = null;
  if (first.relaxed) {
    const { a, wc } = first.relaxed;
    const groupLoss = new Map<number, number>();
    for (let r = 0; r < p.rows; r++) {
      for (let c = 0; c < p.cols; c++) {
        const i = r * p.cols + c;
        if (p.score[i] === -Infinity) continue;
        const loss = wc * p.cost[i] - p.score[i] - a.rowDual[r] - a.colDual[c];
        const key = p.groupOf[r] * p.cols + c;
        groupLoss.set(key, Math.min(groupLoss.get(key) ?? Infinity, loss));
      }
    }
    pairLoss = new Float64Array(p.rows * p.cols);
    for (let r = 0; r < p.rows; r++) {
      for (let c = 0; c < p.cols; c++) {
        pairLoss[r * p.cols + c] = groupLoss.get(p.groupOf[r] * p.cols + c) ?? Infinity;
      }
    }
  }
  let fixedAt = -Infinity;
  const fix = () => {
    const incumbent = (best as Assignment | null)?.score ?? -Infinity;
    if (!pairLoss || incumbent <= fixedAt) return;
    fixedAt = incumbent;
    const slack = first.bound - incumbent + 1e-7;
    p.alive.fill(0);
    for (let r = 0; r < p.rows; r++) {
      for (let c = 0; c < p.cols; c++) {
        const i = r * p.cols + c;
        if (pairLoss[i] > slack) p.score[i] = -Infinity;
        else if (p.score[i] !== -Infinity) p.alive[c] = 1;
      }
    }
  };
  fix();

  while (open.length > 0) {
    let top = 0;
    for (let i = 1; i < open.length; i++) if (open[i].bound > open[top].bound) top = i;
    const incumbent = (best as Assignment | null)?.score ?? -Infinity;
    if (open[top].bound <= incumbent + tol) break;
    if (Date.now() > deadline) {
      return { best, optimal: false, gap: best ? open[top].bound - incumbent : Infinity };
    }
    fix();

    const { node, bound, branch } = open[top];
    open[top] = open[open.length - 1];
    open.pop();
    const [row, col] = branch;

    const withPlayer: Node = { forced: Int32Array.from(node.forced), forbidden: node.forbidden };
    withPlayer.forced[row] = col;
    const withoutPlayer: Node = {
      forced: node.forced,
      forbidden: new Set(node.forbidden).add(p.groupOf[row] * p.cols + col),
    };
    for (const child of [withPlayer, withoutPlayer]) {
      const res = evaluate(child);
      if (!res || !res.branch) continue;
      const childBound = Math.min(res.bound, bound);
      const now = (best as Assignment | null)?.score ?? -Infinity;
      if (childBound > now + tol) open.push({ node: child, bound: childBound, branch: res.branch });
    }
  }
  return { best, optimal: true, gap: 0 };
}

/** Slots left empty by the fullest possible line-up. */
function unfilledSlots(slots: XiSlot[]): number[] {
  const p = buildProblem(slots, (c) => c);
  const cols = p.cols + p.rows; // one stand-in per slot, so a full assignment always exists
  const score = new Float64Array(p.rows * cols);
  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < p.cols; c++) {
      score[r * cols + c] = p.score[r * p.cols + c] === -Infinity ? -Infinity : 1;
    }
  }
  const padded: Problem = {
    ...p,
    cols,
    score,
    cost: new Float64Array(p.rows * cols),
    alive: new Uint8Array(cols).fill(1),
  };
  const a = assign(padded, { forced: new Int32Array(p.rows).fill(-1), forbidden: new Set() }, 1, 0);
  const out: number[] = [];
  a?.col.forEach((c, r) => {
    if (c >= p.cols) out.push(r);
  });
  return out;
}

export function solveBestXi(slots: XiSlot[], opts: XiOptions = {}): XiResult {
  const minB = Math.max(0, opts.minBudget ?? 0);
  const maxB = opts.maxBudget ?? Infinity;
  const tol = opts.tolerance ?? 1e-3;
  const deadline = Date.now() + (opts.timeLimitMs ?? 2000);
  const need = slots.length;

  const done = (p: Problem, a: Assignment, r: SearchResult): XiResult => ({
    status: "ok",
    picks: Array.from(a.col, (c, row) => p.cand[row * p.cols + c]!),
    totalScore: a.score,
    totalCost: a.cost,
    optimal: r.optimal,
    gap: r.optimal ? 0 : r.gap,
  });
  const fits = (cost: number) => cost <= maxB * (1 + 1e-9) && cost >= minB * (1 - 1e-9);

  // Ignoring money, only the top XI's worth of players per slot can matter.
  const open = buildProblem(slots, (c) => topByScore(c, need));
  const free = search(open, 0, Infinity, deadline, tol);
  const unlimited = free.best;
  if (!unlimited) return { status: "infeasible", reason: "slots", unfilled: unfilledSlots(slots) };
  if (fits(unlimited.cost)) return done(open, unlimited, free);

  // Only the side the unlimited line-up breaks usually binds. With one budget side, a player
  // beaten on score by a full XI of others who are no worse on cost is never needed.
  const overMax = unlimited.cost > maxB;
  const oneSided = buildProblem(slots, (c) => pruneDominated(c, need, overMax));
  const relaxed = search(oneSided, overMax ? 0 : minB, overMax ? maxB : Infinity, deadline, tol);
  if (!relaxed.best) return { status: "infeasible", reason: "budget", unfilled: [] };
  if (fits(relaxed.best.cost)) return done(oneSided, relaxed.best, relaxed);

  const full = buildProblem(slots, (c) => c);
  const both = search(full, minB, maxB, deadline, tol);
  if (!both.best) return { status: "infeasible", reason: "budget", unfilled: [] };
  return done(full, both.best, both);
}

/** Cheapest and most expensive total cost any complete line-up can have (null if none exists). */
export function xiCostRange(slots: XiSlot[]): { min: number; max: number } | null {
  const withScore = (sign: 1 | -1) =>
    slots.map((s) => ({
      key: s.key,
      candidates: s.candidates.map((c) => ({ ...c, score: sign * c.cost })),
    }));
  const cheapest = solveBestXi(withScore(-1));
  const priciest = solveBestXi(withScore(1));
  if (cheapest.status !== "ok" || priciest.status !== "ok") return null;
  return { min: cheapest.totalCost, max: priciest.totalCost };
}
