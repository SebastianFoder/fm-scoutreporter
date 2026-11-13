import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { groupPlayerAttributes } from "../parser/attribute-grouper";
import { parseTransferValue, parseWeeklyWage } from "../best-xi/money";
import { parsePositionGroups } from "../fm27/positions";
import { fm27PlayerScores } from "../fm27/player-scores";
import { scoreStaff, rolesForJob } from "../staff/staff-roles";
import {
  footWord,
  fmDate,
  positionString,
  preferredJobName,
  scanPlayerToAttributes,
  scanPlayers,
  scanStaffToMember,
} from "./convert";
import { compareScans, filterGrowth, sortGrowth } from "./growth";
import { assertScanFile, type ScanFile, type ScanPlayer } from "./schema";

const sample = JSON.parse(readFileSync(join(import.meta.dirname, "..", "fixtures", "scan-sample.json"), "utf8")) as ScanFile;

test("the sample fixture is a valid scan", () => {
  assert.doesNotThrow(() => assertScanFile(sample));
  assert.throws(() => assertScanFile({ schema: "other" }), /Not a Scout Reporter scan/);
  assert.throws(() => assertScanFile({ ...sample, schemaVersion: 99 }), /not supported/);
});

test("writes FM's position string from position ratings", () => {
  assert.equal(positionString({ GK: 20 }), "GK");
  assert.equal(positionString({ DR: 20, DC: 16, WBR: 15, DM: 12 }), "D (RC), WB (R)");
  assert.equal(positionString({ MC: 18, DM: 15, AML: 17, AMR: 19, AMC: 15, ST: 15 }), "DM, M (C), AM (RLC), ST");
  // Nothing at 15+: the best-rated position.
  assert.equal(positionString({ MC: 12, DM: 9 }), "M (C)");
  assert.equal(positionString({}), "");
  assert.deepEqual(parsePositionGroups(positionString({ DR: 20, DC: 16, WBR: 15 })), ["CB", "FB", "WB"]);
});

test("formats foot ratings and dates like the export", () => {
  assert.equal(footWord(20), "Very Strong");
  assert.equal(footWord(10), "Reasonable");
  assert.equal(footWord(1), "Very Weak");
  assert.equal(fmDate("2030-06-30"), "30/06/2030");
  assert.equal(fmDate(null), "");
});

test("converts a scanned player into an import row the app can score", () => {
  const p = sample.players[0];
  const raw = scanPlayerToAttributes(p);
  assert.equal(raw.uniqueId, String(p.uid));
  assert.equal(raw.player, p.name);
  assert.equal(raw.currentAbility, p.ca);
  assert.equal(raw.potentialAbility, p.pa);
  assert.equal(raw.pace, p.attributes.pace);
  assert.equal(raw.teamWork, p.attributes.teamWork);
  assert.equal(parseWeeklyWage(raw.wage), p.wage);
  const value = parseTransferValue(raw.transferValueRange);
  assert.equal(value.kind, "range");
  // Formatted to 2-3 significant figures, so within 1%.
  if (value.kind === "range") assert.ok(Math.abs(value.low - p.value!) / p.value! < 0.01);
  const scores = fm27PlayerScores({ raw, grouped: groupPlayerAttributes(raw) });
  assert.ok(scores.best.score > 0);
});

test("filters players by club for squad mode", () => {
  const club = sample.players[0].club!;
  const squad = scanPlayers(sample, { club });
  assert.ok(squad.length > 0 && squad.length < sample.players.length);
  assert.equal(scanPlayers(sample).length, sample.players.length);
});

test("converts scanned staff with exact ratings and a preferred job", () => {
  const coach = sample.staff.find((s) => s.preferredJobs.includes(2))!;
  const member = scanStaffToMember(coach);
  assert.equal(member.preferredJob, "Coach");
  assert.ok(rolesForJob(member.preferredJob).length > 0);
  const attacking = member.attributes.attacking!;
  assert.equal(attacking.exact, true);
  assert.equal(attacking.value, coach.attributes.attacking);
  assert.ok(scoreStaff(member).best);
  assert.equal(preferredJobName({ ...coach, preferredJobs: [], job: "Scout" }), "Scout");
  assert.equal(scanStaffToMember({ ...coach, club: null }).status, "FrA");
});

function withChanges(scan: ScanFile, change: (p: ScanPlayer, i: number) => ScanPlayer): ScanFile {
  return { ...scan, meta: { ...scan.meta, gameDate: "2028-08-14" }, players: scan.players.map(change) };
}

test("compares two scans per player", () => {
  const later = withChanges(sample, (p, i) =>
    i === 0 ? { ...p, ca: p.ca + 12, attributes: { ...p.attributes, pace: p.attributes.pace + 2, finishing: p.attributes.finishing - 1 } } : p,
  );
  const newcomer = { ...sample.players[1], uid: 999_999_999, name: "Newgen" };
  later.players.push(newcomer);

  const report = compareScans(sample, later);
  assert.equal(report.rows.length, sample.players.length);
  assert.deepEqual(report.newPlayers.map((p) => p.name), ["Newgen"]);
  assert.equal(report.days, 366); // 2027-08-14 to 2028-08-14 (leap year)

  const grown = report.rows.find((r) => r.player.uid === sample.players[0].uid)!;
  assert.equal(grown.caChange, 12);
  assert.equal(grown.attributeChange, 1);
  assert.deepEqual(grown.changes[0], { key: "pace", from: sample.players[0].attributes.pace, to: sample.players[0].attributes.pace + 2 });

  assert.deepEqual(filterGrowth(report.rows, { minCaGain: 10 }).map((r) => r.player.uid), [sample.players[0].uid]);
  assert.equal(sortGrowth(report.rows, "caChange")[0].player.uid, sample.players[0].uid);
  assert.equal(sortGrowth(report.rows, "caChange", "asc").at(-1)!.player.uid, sample.players[0].uid);
});
