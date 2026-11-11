import test from "node:test";
import assert from "node:assert/strict";
import {
  formatMoney,
  parseBudgetInput,
  parseMoney,
  parseTransferValue,
  parseWeeklyWage,
} from "./money";
import { FORMATIONS, SPOT_XY, findFormation, isValidFormation, spotsForSlots } from "./formations";
import { parseSlotSettings } from "./roles";
import { solveBestXi, xiCostRange, type XiCandidate, type XiSlot } from "./solver";

test("parses FM money strings", () => {
  assert.equal(parseMoney("€2.5M"), 2_500_000);
  assert.equal(parseMoney("€140K"), 140_000);
  assert.equal(parseMoney("£330"), 330);
  assert.equal(parseMoney("2,5M"), 2_500_000);
  assert.equal(parseMoney("2,500,000"), 2_500_000);
  assert.equal(parseMoney("Not for Sale"), null);
});

test("parses transfer value ranges", () => {
  assert.deepEqual(parseTransferValue("€250K - €2.5M"), { kind: "range", low: 250_000, high: 2_500_000 });
  assert.deepEqual(parseTransferValue("€35K"), { kind: "range", low: 35_000, high: 35_000 });
  assert.deepEqual(parseTransferValue(null), { kind: "none" });
  assert.deepEqual(parseTransferValue("€0"), { kind: "none" });
  assert.deepEqual(parseTransferValue("Not for Sale"), { kind: "unavailable" });
});

test("normalises wages to per week", () => {
  assert.equal(parseWeeklyWage("€1.9K p/w"), 1900);
  assert.equal(parseWeeklyWage("€52K p/a"), 1000);
  assert.equal(parseWeeklyWage(null), null);
});

test("reads typed budgets and formats amounts", () => {
  assert.deepEqual(parseBudgetInput(""), { value: null, valid: true });
  assert.deepEqual(parseBudgetInput("15m"), { value: 15_000_000, valid: true });
  assert.deepEqual(parseBudgetInput("€750K"), { value: 750_000, valid: true });
  assert.equal(parseBudgetInput("lots").valid, false);
  assert.equal(formatMoney(2_500_000), "€2.5M");
  assert.equal(formatMoney(12_400_000, "£"), "£12.4M");
  assert.equal(formatMoney(750_000), "€750K");
  assert.equal(formatMoney(330), "€330");
});

test("every preset is a valid, distinct FM formation with a pitch point per spot", () => {
  for (const f of FORMATIONS) {
    assert.ok(isValidFormation(f.spots), f.id);
    assert.equal(f.slots.length, 11, f.id);
    const points = f.spots.map((s) => SPOT_XY[s].join(","));
    assert.equal(new Set(points).size, 11, f.id);
    assert.equal(findFormation(f.spots), f, `${f.id} duplicates another preset`);
  }
  assert.equal(new Set(FORMATIONS.map((f) => f.id)).size, FORMATIONS.length);
});

test("lays out settings saved before the tactics pitch on FM spots", () => {
  assert.deepEqual(
    spotsForSlots(["GK", "DR", "DC", "DC", "DL", "DM", "DM", "AMR", "AMC", "AML", "ST"]),
    ["GK", "DR", "DCR", "DCL", "DL", "DMCR", "DMCL", "AMR", "AMC", "AML", "STC"],
  );
  assert.equal(spotsForSlots(["GK", "DC", "DC", "DC", "DC", "MC", "MC", "MC", "AMC", "ST", "ST"]), null);
  const legacy = ["GK", "DR", "DC", "DC", "DL", "MR", "MC", "MC", "ML", "ST", "ST"].map((slot) => ({ slot, role: "auto" }));
  legacy[9].role = "my-profile";
  const parsed = parseSlotSettings(legacy)!;
  assert.equal(findFormation(parsed.map((s) => s.spot))?.id, "4-4-2");
  assert.equal(parsed.find((s) => s.role === "my-profile")?.slot, "ST");
  assert.equal(parseSlotSettings(parsed.map((s) => ({ ...s, spot: "GK" }))), null, "two keepers are rejected");
});

const c = (id: string, score: number, cost: number): XiCandidate => ({ id, score, cost });

test("picks the best distinct players when there is no budget", () => {
  const dc = [c("a", 15, 10), c("b", 14, 1), c("d", 12, 1)];
  const res = solveBestXi([
    { key: "DC", candidates: dc },
    { key: "DC", candidates: dc },
    // "a" is also the best striker, but is worth more at the back.
    { key: "ST", candidates: [c("a", 13, 10), c("e", 12.5, 3)] },
  ]);
  assert.equal(res.status, "ok");
  if (res.status !== "ok") return;
  assert.equal(res.optimal, true);
  assert.deepEqual(res.picks.map((p) => p.id).sort(), ["a", "b", "e"]);
  assert.equal(res.totalScore, 41.5);
});

test("respects a maximum and a minimum budget", () => {
  const slots: XiSlot[] = [
    { key: "GK", candidates: [c("g1", 14, 8), c("g2", 12, 1)] },
    { key: "ST", candidates: [c("s1", 16, 9), c("s2", 13, 2), c("s3", 10, 0)] },
  ];
  const capped = solveBestXi(slots, { maxBudget: 10 });
  assert.equal(capped.status, "ok");
  if (capped.status === "ok") {
    // g2 + s1 scores 28 at exactly the limit, ahead of g1 + s2 on 27.
    assert.deepEqual(capped.picks.map((p) => p.id), ["g2", "s1"]);
    assert.equal(capped.totalCost, 10);
  }
  const floor = solveBestXi(slots, { minBudget: 16 });
  assert.equal(floor.status, "ok");
  if (floor.status === "ok") assert.deepEqual(floor.picks.map((p) => p.id), ["g1", "s1"]);

  const band = solveBestXi(slots, { minBudget: 2, maxBudget: 4 });
  assert.equal(band.status, "ok");
  if (band.status === "ok") assert.deepEqual(band.picks.map((p) => p.id), ["g2", "s2"]);
});

test("reports why no line-up exists", () => {
  const dc = [c("a", 15, 5)];
  const short = solveBestXi([
    { key: "DC", candidates: dc },
    { key: "DC", candidates: dc },
    { key: "GK", candidates: [] },
  ]);
  assert.equal(short.status, "infeasible");
  if (short.status === "infeasible") {
    assert.equal(short.reason, "slots");
    // One of the two centre-back slots, and the keeper.
    assert.equal(short.unfilled.length, 2);
    assert.ok(short.unfilled.includes(2));
  }
  const slots = [{ key: "DC", candidates: dc }];
  assert.deepEqual(solveBestXi(slots, { maxBudget: 4 }), {
    status: "infeasible",
    reason: "budget",
    unfilled: [],
  });
  assert.deepEqual(xiCostRange(slots), { min: 5, max: 5 });
});

/** Exhaustive search, for checking the solver on small instances. */
function bruteForce(slots: XiSlot[], min: number, max: number): number | null {
  let best: number | null = null;
  const used = new Set<string>();
  const go = (i: number, score: number, cost: number) => {
    if (i === slots.length) {
      if (cost >= min && cost <= max && (best === null || score > best)) best = score;
      return;
    }
    for (const cand of slots[i].candidates) {
      if (used.has(cand.id)) continue;
      used.add(cand.id);
      go(i + 1, score + cand.score, cost + cand.cost);
      used.delete(cand.id);
    }
  };
  go(0, 0, 0);
  return best;
}

test("matches exhaustive search on random squads", () => {
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const layout = ["GK", "DC", "DC", "MC", "MC", "ST"];
  const keys = [...new Set(layout)];

  for (let round = 0; round < 300; round++) {
    const players = Array.from({ length: 12 }, (_, i) => ({
      id: `p${i}`,
      cost: rand() < 0.2 ? 0 : Math.round(rand() * 50) * 100_000,
      // Each player can play one or two positions, with a score per position.
      scores: new Map(
        keys.filter(() => rand() < 0.45).map((k) => [k, 8 + Math.round(rand() * 80) / 10] as const),
      ),
    }));
    const candidates = new Map(
      keys.map((k) => [
        k,
        players.filter((p) => p.scores.has(k)).map((p) => c(p.id, p.scores.get(k)!, p.cost)),
      ]),
    );
    const slots = layout.map((k) => ({ key: k, candidates: candidates.get(k)! }));

    const mode = round % 4;
    const max = mode === 0 || mode === 2 ? 2_000_000 + rand() * 12_000_000 : Infinity;
    const min = mode === 1 ? rand() * 14_000_000 : mode === 2 ? max * rand() : 0;

    const expected = bruteForce(slots, min, max);
    const res = solveBestXi(slots, { minBudget: min, maxBudget: max });
    if (expected === null) {
      assert.equal(res.status, "infeasible", `round ${round}`);
      continue;
    }
    assert.equal(res.status, "ok", `round ${round}`);
    if (res.status !== "ok") continue;
    assert.ok(Math.abs(res.totalScore - expected) < 1e-6, `round ${round}: ${res.totalScore} vs ${expected}`);
    assert.equal(new Set(res.picks.map((p) => p.id)).size, layout.length, `round ${round}`);
    const cost = res.picks.reduce((s, p) => s + p.cost, 0);
    assert.ok(cost <= max + 1e-6 && cost >= min - 1e-6, `round ${round}`);
    res.picks.forEach((p, i) => assert.ok(slots[i].candidates.some((x) => x.id === p.id)));
  }
});

test("solves a full eleven from a large pool quickly", () => {
  let seed = 99;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const layout = FORMATIONS[0].slots;
  const keys = [...new Set(layout)];
  const pool = new Map<string, XiCandidate[]>(keys.map((k) => [k, []]));
  for (let i = 0; i < 4000; i++) {
    const quality = rand();
    const cost = Math.round(quality ** 3 * 400 * (0.5 + rand())) * 100_000;
    for (const k of keys) {
      if (rand() < 0.2) pool.get(k)!.push(c(`p${i}`, 8 + quality * 8 + rand() * 2, cost));
    }
  }
  const slots = layout.map((k) => ({ key: k as string, candidates: pool.get(k)! }));
  const started = Date.now();
  for (const opts of [{ maxBudget: 30_000_000 }, { minBudget: 20_000_000, maxBudget: 25_000_000 }, {}]) {
    const res = solveBestXi(slots, opts);
    assert.equal(res.status, "ok");
    if (res.status === "ok") assert.equal(res.optimal, true);
  }
  assert.ok(Date.now() - started < 5000, `took ${Date.now() - started}ms`);
});
