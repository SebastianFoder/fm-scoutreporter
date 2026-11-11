import test from "node:test";
import assert from "node:assert/strict";
import { analyseSquad, findUpgrades, pickEleven, type SquadCandidate, type SquadSlotInput } from "./analysis";

const c = (id: string, score: number, potential: number | null = null): SquadCandidate => ({ id, score, potential });
const slot = (key: string, ...candidates: SquadCandidate[]): SquadSlotInput => ({ key, candidates });

test("leaves a slot empty instead of failing when nobody can play it", () => {
  const picks = pickEleven([slot("GK"), slot("DC", c("a", 12), c("b", 11)), slot("DC", c("a", 12), c("b", 11))]);
  assert.equal(picks[0], null);
  assert.deepEqual(picks.slice(1).map((p) => p?.id).sort(), ["a", "b"]);
});

test("second eleven only uses players left out of the first", () => {
  const slots = [slot("ST", c("a", 14), c("b", 12), c("d", 9)), slot("AMR", c("b", 13), c("e", 10))];
  const first = pickEleven(slots);
  assert.deepEqual(first.map((p) => p?.id), ["a", "b"]);
  const second = pickEleven(slots, new Set(["a", "b"]));
  assert.deepEqual(second.map((p) => p?.id), ["d", "e"]);
});

test("flags empty positions, missing cover, weak starters and drop-offs", () => {
  const res = analyseSquad({
    slots: [
      slot("GK", c("gk", 13)),
      slot("DL"),
      slot("DC", c("d1", 14), c("d2", 13.5), c("d3", 13), c("d4", 11)),
      slot("DC", c("d1", 14), c("d2", 13.5), c("d3", 13), c("d4", 11)),
      slot("ST", c("s1", 11), c("s2", 10.5)),
    ],
    players: ["gk", "d1", "d2", "d3", "d4", "s1", "s2"].map((id) => ({ id, age: 25 })),
    goalkeeperSlots: [0],
  });
  const kinds = res.findings.map((f) => `${f.kind}@${f.index}`);
  assert.ok(kinds.includes("empty@1"));
  assert.ok(kinds.includes("no-cover@0"));
  assert.equal(res.findings.find((f) => f.kind === "no-cover")?.severity, "high", "a lone keeper is high priority");
  assert.ok(kinds.includes("weak@4"), "the striker is the weak link");
  // d4 (11) covers d1 (14): 3 points lower.
  const drop = res.findings.find((f) => f.kind === "drop-off");
  assert.ok(drop && drop.kind === "drop-off" && drop.backup.id === "d4");
  assert.equal(res.findings[0].severity, "high");
  assert.equal(res.firstXi.filled, 4);
  assert.equal(res.secondXi.filled, 3);
});

test("ageing starter names a young successor when there is one", () => {
  const res = analyseSquad({
    slots: [slot("ST", c("old", 14), c("kid", 12, 15)), slot("AMC", c("x", 14), c("y", 13))],
    players: [
      { id: "old", age: 33 },
      { id: "kid", age: 19 },
      { id: "x", age: 25 },
      { id: "y", age: 25 },
    ],
  });
  const ageing = res.findings.find((f) => f.kind === "ageing");
  assert.ok(ageing && ageing.kind === "ageing");
  assert.equal(ageing.successor?.id, "kid");
  assert.equal(ageing.severity, "info");
  const prospect = res.findings.find((f) => f.kind === "prospect");
  assert.ok(prospect && prospect.kind === "prospect" && prospect.prospect.id === "kid");
});

test("no prospect check when scores are already at full potential", () => {
  const res = analyseSquad({
    slots: [slot("ST", c("a", 14), c("kid", 12, 16))],
    players: [
      { id: "a", age: 25 },
      { id: "kid", age: 18 },
    ],
    potentialBasis: true,
  });
  assert.equal(res.findings.some((f) => f.kind === "prospect"), false);
});

test("sorts the rest of the squad into prospects, young players, surplus and no fit", () => {
  const res = analyseSquad({
    slots: [slot("ST", c("a", 14), c("b", 13), c("kid", 10, 15), c("teen", 9), c("vet", 8))],
    players: [
      { id: "a", age: 26 },
      { id: "b", age: 26 },
      { id: "kid", age: 18 },
      { id: "teen", age: 17 },
      { id: "vet", age: 30 },
      { id: "gk", age: 28 },
    ],
  });
  const status = Object.fromEntries(res.rest.map((m) => [m.id, m.status]));
  assert.deepEqual(status, { kid: "prospect", teen: "young", vet: "surplus", gk: "no-fit" });
  assert.equal(res.rest.find((m) => m.id === "vet")?.gap, -6);
});

test("upgrades beat the weakest starter of a position by the margin", () => {
  const analysis = analyseSquad({
    slots: [slot("DC", c("d1", 14), c("d2", 12)), slot("DC", c("d1", 14), c("d2", 12)), slot("GK")],
    players: [
      { id: "d1", age: 25 },
      { id: "d2", age: 25 },
    ],
  });
  const pool = [
    slot("DC", c("s1", 12.3), c("s2", 12.6), c("s3", 15)),
    slot("DC", c("s1", 12.3), c("s2", 12.6), c("s3", 15)),
    slot("GK", c("g1", 9)),
  ];
  const ups = findUpgrades(analysis, pool);
  const dc = ups.find((u) => u.key === "DC")!;
  assert.deepEqual(dc.indices, [0, 1]);
  assert.equal(dc.starter?.id, "d2");
  assert.deepEqual(dc.candidates.map((x) => x.id), ["s3", "s2"]);
  // Nobody in the squad plays GK, so any keeper is an upgrade.
  assert.deepEqual(ups.find((u) => u.key === "GK")!.candidates.map((x) => x.id), ["g1"]);
});

test("unavailable players stay out of both elevens but are listed with the reason", () => {
  const res = analyseSquad({
    slots: [slot("ST", c("a", 15), c("b", 13), c("d", 12), c("e", 11))],
    players: [
      { id: "a", age: 25 },
      { id: "b", age: 25 },
      { id: "d", age: 25 },
      { id: "e", age: 25 },
    ],
    unavailable: new Map([
      ["a", "injured"],
      ["b", "loan"],
    ]),
  });
  assert.equal(res.slots[0].starter?.id, "d");
  assert.equal(res.slots[0].backup?.id, "e");
  const status = Object.fromEntries(res.rest.map((m) => [m.id, m.status]));
  assert.deepEqual(status, { a: "injured", b: "loan" });
});

test("without CA/PA the coach's stars find prospects", () => {
  const res = analyseSquad({
    slots: [slot("ST", c("star", 14), c("kid", 10), c("meh", 9))],
    players: [
      { id: "star", age: 27, stars: { ability: 3, potential: 3 } },
      { id: "kid", age: 18, stars: { ability: 1.5, potential: 4.5 } },
      { id: "meh", age: 18, stars: { ability: 1.5, potential: 3.5 } },
    ],
  });
  const prospect = res.findings.find((f) => f.kind === "prospect");
  assert.ok(prospect && prospect.kind === "prospect");
  assert.equal(prospect.prospect.id, "kid");
  assert.equal(prospect.by, "stars");
  assert.equal(prospect.by === "stars" && prospect.potentialStars, 4.5);
  // "meh" (3.5 against 3.0) is not a full star above the starter.
  assert.equal(res.rest.find((m) => m.id === "meh")?.status, "young");
});

test("squad status: promised starters left out, and backups who start", () => {
  const res = analyseSquad({
    slots: [slot("ST", c("fringe", 15), c("star", 12), c("important", 11), c("x", 10))],
    players: [
      { id: "fringe", age: 25, playingTime: "Fringe Player" },
      { id: "star", age: 25, playingTime: "Star Player" },
      { id: "important", age: 25, playingTime: "Important Player" },
      { id: "x", age: 25, playingTime: "Squad Player" },
    ],
  });
  const benched = res.findings.filter((f) => f.kind === "status-benched");
  assert.deepEqual(
    benched.map((f) => f.kind === "status-benched" && [f.id, f.xi]),
    [
      ["important", null],
      ["star", 2],
    ],
  );
  assert.ok(res.findings.some((f) => f.kind === "status-starting" && f.starter.id === "fringe"));
});

test("compares the first eleven with the FM team sheet", () => {
  const res = analyseSquad({
    slots: [slot("ST", c("a", 15), c("b", 13)), slot("GK", c("g", 12), c("h", 11))],
    players: [
      { id: "a", age: 25, pickedToStart: false },
      { id: "b", age: 25, pickedToStart: true },
      { id: "g", age: 25, pickedToStart: true },
      { id: "h", age: 25, pickedToStart: false },
    ],
  });
  const { matching, notPicked, dropped } = res.selection!;
  assert.deepEqual({ matching, notPicked, dropped }, { matching: 1, notPicked: ["a"], dropped: ["b"] });
  const none = analyseSquad({ slots: [slot("ST", c("a", 15))], players: [{ id: "a", age: 25 }] });
  assert.equal(none.selection, null);
});

test("prospects must outgrow what a young starter will become, and are named once", () => {
  const res = analyseSquad({
    slots: [
      // The starter is young and projects to 15: a 15.2 prospect is not enough.
      slot("ST", c("youngStar", 13, 15), c("kid", 10, 15.2)),
      // Here the starter has peaked at 12: kid (14.6) and teen (14) both outgrow them.
      slot("AMC", c("peaked", 12, 12), c("kid", 11, 14.6), c("teen", 10, 14)),
      slot("AMR", c("winger", 12, 12), c("kid", 11, 14.6), c("teen", 10.5, 14)),
    ],
    players: [
      { id: "youngStar", age: 20 },
      { id: "kid", age: 18 },
      { id: "peaked", age: 27 },
      { id: "winger", age: 27 },
      { id: "teen", age: 17 },
    ],
  });
  const prospects = res.findings.flatMap((f) => (f.kind === "prospect" ? [[f.index, f.prospect.id]] : []));
  // kid is named once (AMC, the bigger margin), teen takes AMR, ST gets none.
  assert.deepEqual(prospects.sort(), [
    [1, "kid"],
    [2, "teen"],
  ]);
});

test("a starter elsewhere in the eleven is never a prospect", () => {
  const res = analyseSquad({
    slots: [slot("AML", c("a", 14, 14), c("b", 12, 16)), slot("AMC", c("b", 13, 16), c("d", 11, 11))],
    players: [
      { id: "a", age: 27 },
      { id: "b", age: 19 },
      { id: "d", age: 27 },
    ],
  });
  assert.equal(res.slots[1].starter?.id, "b");
  assert.equal(res.findings.some((f) => f.kind === "prospect" && f.prospect.id === "b"), false);
});

test("pairs each change to the FM team sheet by position", () => {
  const res = analyseSquad({
    slots: [
      slot("AML", c("valan", 13.2), c("ndi", 12.5)),
      slot("ST", c("dutoit", 12.9), c("madsen", 12.7), c("ndi", 11)),
      slot("DM", c("jeong", 12.9), c("ristov", 12.8), c("mid", 9)),
    ],
    slotPositions: ["AML", "ST", "DM"],
    players: [
      { id: "valan", age: 20, pickedToStart: false },
      { id: "ndi", age: 23, pickedToStart: true, pickedAt: "AML" },
      { id: "dutoit", age: 19, pickedToStart: true, pickedAt: "DM" },
      { id: "madsen", age: 20, pickedToStart: true, pickedAt: "ST" },
      { id: "jeong", age: 19, pickedToStart: false },
      { id: "ristov", age: 19, pickedToStart: false },
      { id: "mid", age: 25, pickedToStart: false },
    ],
  });
  const sel = res.selection!;
  // Valan replaces Ndi at AML (same position); Jeong comes in at DM for Madsen, the only one left.
  assert.deepEqual(
    sel.changes.map((ch) => [ch.index, ch.in?.id, ch.out?.id, ch.samePosition, ch.out?.score ?? null]),
    [
      [0, "valan", "ndi", true, 12.5],
      [2, "jeong", "madsen", false, null],
    ],
  );
  // Du Toit starts in both, but at DM in FM and up front here.
  assert.deepEqual(sel.moves, [{ index: 1, id: "dutoit", from: "DM" }]);
});
