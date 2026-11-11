import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { STAFF_ATTRIBUTES, bandForValue, parseStaffRating } from "./staff-attributes";
import { isFreeAgent, parseStaffCsv } from "./staff-parser";
import {
  STAFF_ROLES,
  STAFF_ROLE_BY_ID,
  rolesForJob,
  scoreStaff,
  scoreStaffRole,
  weightedAttributes,
} from "./staff-roles";

const fixture = readFileSync(join(process.cwd(), "fixtures", "staff.csv"), "utf8");

test("parseStaffRating maps FM26 words to their 1–20 ranges", () => {
  assert.equal(parseStaffRating("Unsuited")?.band.max, 3);
  assert.equal(parseStaffRating("Competent")?.band.min, 7);
  assert.equal(parseStaffRating("Average")?.value, 10.5);
  assert.equal(parseStaffRating("very good")?.band.word, "Very Good");
  assert.equal(parseStaffRating("Elite")?.value, 20);
  assert.equal(parseStaffRating(""), null);
  assert.equal(parseStaffRating("-"), null);
});

test("parseStaffRating accepts 1–20 numbers from older exports", () => {
  const r = parseStaffRating("15");
  assert.equal(r?.value, 15);
  assert.equal(r?.exact, true);
  assert.equal(r?.band.word, "Very Good");
  assert.equal(parseStaffRating("0"), null);
  assert.equal(parseStaffRating("21"), null);
  assert.equal(bandForValue(11).word, "Average");
  assert.equal(bandForValue(12).word, "Good");
});

test("parseStaffCsv reads the Staff view export and drops duplicate people", () => {
  const { staff, columns, isStaffExport, duplicates } = parseStaffCsv(fixture);
  assert.equal(isStaffExport, true);
  assert.equal(columns.length, STAFF_ATTRIBUTES.length);
  assert.equal(staff.length, 398);
  assert.equal(duplicates, 120);

  const first = staff[0];
  assert.equal(first.name, "Igor Aase");
  assert.equal(first.preferredJob, "Coach");
  assert.equal(first.uniqueId, "53055066");
  assert.equal(first.status, "FrA");
  assert.equal(first.personality, "Fairly Professional");
  assert.equal(first.euNational, true);
  assert.equal(first.attributes.judgingStaffAbility?.band.word, "Unsuited");
  assert.equal(first.attributes.judgingPotentialAbility?.band.word, "Very Good");
  assert.equal(first.attributes.workingWithYoungsters?.band.word, "Very Good");
  assert.equal(isFreeAgent(first), true);

  const atClub = staff.find((s) => s.name === "Tobias Ackerman")!;
  assert.equal(atClub.club, "Falkenbergs FF");
  assert.equal(atClub.status, "");
  assert.equal(isFreeAgent(atClub), false);
});

test("parseStaffCsv rejects a player export", () => {
  const players = readFileSync(join(process.cwd(), "fixtures", "attribute.csv"), "utf8");
  assert.equal(parseStaffCsv(players).isStaffExport, false);
});

test("rolesForJob maps FM preferred jobs to fm-scoring roles", () => {
  assert.deepEqual(rolesForJob("Goalkeeping Coach").map((r) => r.short), ["GKC"]);
  assert.deepEqual(rolesForJob("Head of Youth Development").map((r) => r.short), ["HoYD"]);
  assert.deepEqual(rolesForJob("Technical Director").map((r) => r.short), ["DoF"]);
  assert.equal(rolesForJob("Coach").length, 6);
  assert.deepEqual(rolesForJob("General Manager"), []);
  assert.deepEqual(rolesForJob("Loan Manager"), []);
});

test("weightedAttributes lists a job's relevant attributes", () => {
  assert.deepEqual(
    [...weightedAttributes(rolesForJob("Scout")).keys()].sort(),
    ["determination", "judgingCurrentAbility", "judgingPotentialAbility", "tacticalKnowledge"],
  );
  const coach = weightedAttributes(rolesForJob("Coach"));
  assert.equal(coach.get("attacking"), 4);
  assert.equal(coach.get("workingWithYoungsters"), 1);
  assert.equal(coach.has("goalkeeping"), false);
  assert.equal(coach.has("judgingCurrentAbility"), false);
});

test("fm-scoring gives Adaptability, Judging Staff Ability and Negotiating no weight", () => {
  const used = weightedAttributes(STAFF_ROLES);
  for (const k of ["adaptability", "judgingStaffAbility", "negotiating"] as const) assert.equal(used.has(k), false);
  assert.equal(STAFF_ROLES.length, 17);
});

test("every role weights only known attributes", () => {
  const keys = new Set(STAFF_ATTRIBUTES.map((a) => a.key));
  for (const role of STAFF_ROLES) {
    for (const k of Object.keys(role.weights)) assert.ok(keys.has(k as never), `${role.id}: ${k}`);
  }
});

test("scoreStaff ranks a goalkeeping specialist as a goalkeeping coach", () => {
  const { staff } = parseStaffCsv(fixture);
  const achterberg = staff.find((s) => s.name === "John Achterberg")!;
  const scores = scoreStaff(achterberg);
  assert.equal(scores.preferred?.role.id, "coach-goalkeeping");
  // GK Outstanding ×4, Mot Outstanding ×3, Auth Very Good ×2, Det Outstanding ×2, Mgm Very Good ×2,
  // Pos Good ×2, Yng Very Good ×1.
  const expected = (18.5 * 4 + 18.5 * 3 + 16 * 2 + 18.5 * 2 + 16 * 2 + 13 * 2 + 16) / 16;
  assert.ok(Math.abs(scores.preferred!.score - expected) < 1e-9);
  assert.equal(scores.best?.role.id, "coach-goalkeeping");
});

test("scoreStaffRole ignores unknown attributes and reports coverage", () => {
  const { staff } = parseStaffCsv("Person,UID,GK,Det\nA Keeper,1,Elite,Good\n");
  const r = scoreStaffRole(staff[0], STAFF_ROLE_BY_ID["coach-goalkeeping"])!;
  assert.equal(r.score, (20 * 4 + 13 * 2) / 6);
  assert.equal(r.coverage, 6 / 16);
  assert.equal(scoreStaffRole(staff[0], STAFF_ROLE_BY_ID.physio)?.coverage, 2 / 12);
});
