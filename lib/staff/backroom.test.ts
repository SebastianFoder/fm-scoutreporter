import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseStaffCsv } from "./staff-parser";
import { BACKROOM_PRESETS, backroomCandidates, cleanCounts, matchingPreset, pickBackroom } from "./backroom";
import { STAFF_ROLE_BY_ID } from "./staff-roles";

const { staff } = parseStaffCsv(readFileSync(join(process.cwd(), "fixtures", "staff.csv"), "utf8"));
const full = BACKROOM_PRESETS.find((p) => p.id === "full")!;

test("pickBackroom fills the full backroom with distinct staff", () => {
  const res = pickBackroom(staff, full.counts);
  assert.equal(res.kind, "ok");
  if (res.kind !== "ok") return;
  const wanted = Object.values(full.counts).reduce((a, b) => a + b, 0);
  assert.equal(res.picks.length, wanted);
  assert.equal(new Set(res.picks.map((p) => p.member.uniqueId)).size, wanted);
  assert.ok(Math.abs(res.totalScore - res.picks.reduce((s, p) => s + p.score, 0)) < 1e-6);
});

test("pickBackroom beats a greedy role-by-role pick", () => {
  const res = pickBackroom(staff, full.counts);
  assert.equal(res.kind, "ok");
  if (res.kind !== "ok") return;
  const used = new Set<string>();
  let greedy = 0;
  for (const [id, n] of Object.entries(full.counts)) {
    const cands = backroomCandidates(staff, STAFF_ROLE_BY_ID[id]).sort((a, b) => b.score - a.score);
    for (const c of cands.filter((c) => !used.has(c.member.uniqueId)).slice(0, n)) {
      used.add(c.member.uniqueId);
      greedy += c.score;
    }
  }
  assert.ok(res.totalScore >= greedy - 1e-9);
});

test("pickBackroom moves a two-role specialist to where they add most", () => {
  const header = "Person,UID,GK,Phy,SpS,Mot,Auth,Det,Mgm,Pos,Yng";
  const mentals = "Average,Average,Average,Average,Average,Average";
  const csv = [header, `A,1,Elite,Elite,Average,${mentals}`, `B,2,Very Good,Unsuited,Average,${mentals}`].join("\n");
  const res = pickBackroom(parseStaffCsv(csv).staff, { "coach-goalkeeping": 1, physio: 1 });
  assert.equal(res.kind, "ok");
  if (res.kind !== "ok") return;
  const who = Object.fromEntries(res.picks.map((p) => [p.role.id, p.member.name]));
  assert.deepEqual(who, { "coach-goalkeeping": "B", physio: "A" });
});

test("pickBackroom reports roles it cannot fill", () => {
  const res = pickBackroom(staff, { physio: 5 }, { preferredJobOnly: true });
  assert.equal(res.kind, "short");
  if (res.kind !== "short") return;
  assert.equal(res.roles[0].role.id, "physio");
  assert.equal(res.roles[0].wanted, 5);
  assert.equal(res.roles[0].eligible, 1); // one physio in the fixture (listed twice)
});

test("pickBackroom respects exclusions and the free agent filter", () => {
  const first = pickBackroom(staff, { scout: 1 });
  assert.equal(first.kind, "ok");
  if (first.kind !== "ok") return;
  const top = first.picks[0].member.uniqueId;
  const again = pickBackroom(staff, { scout: 1 }, { excluded: [top] });
  assert.ok(again.kind === "ok" && again.picks[0].member.uniqueId !== top);

  const free = pickBackroom(staff, full.counts, { freeAgentsOnly: true });
  assert.ok(free.kind === "ok" && free.picks.every((p) => !p.member.club));
});

test("pickBackroom with nothing wanted is empty", () => {
  assert.equal(pickBackroom(staff, {}).kind, "empty");
});

test("cleanCounts and matchingPreset", () => {
  assert.deepEqual(cleanCounts({ scout: 3.4, physio: 0, nope: 2, physio2: "x", "sports-scientist": 99 }), {
    scout: 3,
    "sports-scientist": 10,
  });
  assert.equal(matchingPreset(full.counts)?.id, "full");
  assert.equal(matchingPreset({ ...full.counts, scout: 9 }), null);
});
