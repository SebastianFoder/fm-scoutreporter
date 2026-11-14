import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePlayersCsv } from "../parser/csv-parser";
import { parsePositionGroups } from "./positions";
import {
  calibrateCaModel,
  computeDatasetPotentials,
  DEFAULT_CA_MODEL,
  growthRates,
  projectPotential,
} from "./potential";
import { developmentPlan } from "./development";
import { GRADE_SCALE, gradeFor } from "../grades";
import { groupPlayerAttributes } from "../parser/attribute-grouper";
import { ageBenchmark, bestFm27Role, fm27BenchmarkProfiles, fm27RoleScores, FM27_ROLES, type Fm27Role } from "./benchmarks";
import { deriveGoalkeeperWeights, deriveOutfieldWeights, type MatchLabPosition } from "./match-lab";
import { FM_SCORING_FM27_WEIGHTS } from "./fm-scoring-weights";
import { migrateWeightConfig, WEIGHT_SEED_VERSION } from "./profile-migration";
import { DEFAULT_SLOT_ROLE } from "../best-xi/formations";
import type { WeightProfile } from "../types/weights";
import { CA_COSTS } from "./ca-costs";
import { ALL_ATTRIBUTE_KEYS } from "../attribute-keys";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "..", "fixtures", name), "utf8");

test("parsePositionGroups maps FM position strings to CA cost groups", () => {
  assert.deepEqual(parsePositionGroups("GK"), ["GK"]);
  assert.deepEqual(parsePositionGroups("D (C)"), ["CB"]);
  assert.deepEqual(parsePositionGroups("D (RLC)"), ["CB", "FB"]);
  assert.deepEqual(parsePositionGroups("D/WB (R), DM, M (C)"), ["FB", "WB", "DM", "CM"]);
  assert.deepEqual(parsePositionGroups("M/AM (R), ST (C)"), ["WM", "AMW", "ST"]);
  assert.deepEqual(parsePositionGroups("AM (RLC), ST (C)"), ["AMC", "AMW", "ST"]);
  assert.deepEqual(parsePositionGroups(""), []);
});

test("CA cost table only uses known attribute keys", () => {
  const keys = new Set<string>(ALL_ATTRIBUTE_KEYS);
  for (const table of Object.values(CA_COSTS)) {
    for (const k of Object.keys(table)) assert.ok(keys.has(k), k);
  }
});

test("CA model fits the FM27 Hidden Attributes export closely", () => {
  const players = parsePlayersCsv(fixture("attribute-fm27-hidden.csv"));
  const { global, byGroup } = calibrateCaModel(players);
  const gk = byGroup.GK ?? global;
  assert.equal(gk.n, 109);
  assert.ok((gk.r ?? 0) > 0.98, `r=${gk.r}`);
  assert.ok((gk.rmse ?? 99) < 3, `rmse=${gk.rmse}`);
});

test("projectPotential reaches PA and never lowers an attribute", () => {
  const players = parsePlayersCsv(fixture("attribute-fm27-hidden.csv"));
  const { models, byId } = computeDatasetPotentials(players);
  assert.equal(byId.size, players.length);

  for (const p of players) {
    const proj = byId.get(p.uniqueId)!;
    for (const k of ALL_ATTRIBUTE_KEYS) {
      assert.ok(proj.attributes[k] >= p[k], `${p.player} ${k}`);
      assert.ok(proj.attributes[k] <= 20);
    }
    // Personality attributes stay put.
    assert.equal(proj.attributes.determination, p.determination);
  }

  // The projected attributes should be worth ~PA under the same model (within rounding + fit error).
  const shirkey = players.find((p) => p.player === "Mason Shirkey")!;
  const proj = projectPotential(shirkey, models)!;
  const projected = { ...shirkey, ...proj.attributes };
  const atPa = projectPotential({ ...projected, currentAbility: 1, potentialAbility: 1 }, models)!;
  const gain = atPa.predictedCa - proj.predictedCa;
  assert.ok(Math.abs(gain - (shirkey.potentialAbility! - shirkey.currentAbility!)) < 4, `gain=${gain}`);
  assert.ok(proj.attributes.reflexes > shirkey.reflexes);
});

test("growth rates follow the training test: position profile, fixed personality, keepers later", () => {
  const st = growthRates(["ST"], 18);
  const cb = growthRates(["CB"], 18);
  assert.ok(st.get("finishing")! > cb.get("finishing")!);
  assert.ok(cb.get("marking")! > st.get("marking")!);
  for (const k of ["determination", "aggression", "bravery"] as const) {
    assert.equal(st.get(k), 0);
    assert.equal(growthRates(["GK"], 18).get(k), 0);
  }
  // Outfielders never grow goalkeeping attributes; keepers don't grow outfield finishing.
  assert.equal(st.get("reflexes"), 0);
  assert.equal(growthRates(["GK"], 18).get("finishing"), 0);
  assert.ok(growthRates(["GK"], 18).get("reflexes")! > 0);
  // At 24 a keeper's physicals still grow at full rate; an outfielder's have slowed.
  assert.ok(growthRates(["GK"], 24).get("agility")! / growthRates(["GK"], 18).get("agility")! === 1);
  assert.ok(growthRates(["CM"], 24).get("agility")! < growthRates(["CM"], 18).get("agility")!);
});

test("outfield projection reaches PA under the CA model", () => {
  const players = parsePlayersCsv(fixture("attribute-fm27-outfield.csv"));
  const models = { global: DEFAULT_CA_MODEL, byGroup: {} };
  const base = players[0];
  const now = projectPotential({ ...base, currentAbility: 100, potentialAbility: 100 }, models)!;
  const ca = Math.round(now.predictedCa);
  const proj = projectPotential({ ...base, currentAbility: ca, potentialAbility: ca + 30 }, models)!;
  const after = projectPotential({ ...base, ...proj.attributes, currentAbility: 1, potentialAbility: 1 }, models)!;
  assert.ok(Math.abs(after.predictedCa - now.predictedCa - 30) < 4, `gain=${after.predictedCa - now.predictedCa}`);
  assert.equal(proj.attributes.handling, base.handling);
  assert.ok(proj.attributes.pace > base.pace);
});

test("developmentPlan gives position-aware advice", () => {
  const outfield = parsePlayersCsv(fixture("attribute-fm27-outfield.csv"));
  const raw = { ...outfield[0], currentAbility: 100, potentialAbility: 140, professionalism: 7 };
  const plan = developmentPlan({ raw, grouped: groupPlayerAttributes(raw) });
  assert.equal(plan.focus.name, "Quickness");
  assert.match(plan.trainingRole.name, /Attacking Midfielder/);
  assert.equal(plan.sessions!.length, 6);
  assert.equal(plan.sessions![0].relative, 1);
  assert.ok(plan.items.some((i) => i.id === "prof" && i.tone === "warning"));
  const share = plan.coaching.reduce((a, c) => a + c.share, 0);
  assert.ok(share > 0.9 && share <= 1.0001, `share=${share}`);

  const cbRaw = { ...raw, position: "D (C)" };
  assert.match(developmentPlan({ raw: cbRaw, grouped: groupPlayerAttributes(cbRaw) }).trainingRole.name, /Defensive Midfielder/);

  const keepers = parsePlayersCsv(fixture("attribute-fm27-hidden.csv"));
  const { byId } = computeDatasetPotentials(keepers);
  const gk = keepers[0];
  const gkPlan = developmentPlan({ raw: gk, grouped: groupPlayerAttributes(gk), potential: byId.get(gk.uniqueId) });
  assert.equal(gkPlan.sessions, null);
  assert.equal(gkPlan.endAge, 27);
  assert.deepEqual(gkPlan.coaching.map((c) => c.group.id).sort(), ["fitness", "goalkeeping"]);

  const veteran = { ...raw, age: 26 };
  const vPlan = developmentPlan({ raw: veteran, grouped: groupPlayerAttributes(veteran) });
  assert.ok(vPlan.items.some((i) => i.id === "gap" && i.tone === "warning"));
});

test("projectPotential returns null without CA/PA (Standard view export)", () => {
  const players = parsePlayersCsv(fixture("attribute-fm27-outfield.csv"));
  const { available } = computeDatasetPotentials(players);
  assert.equal(available, false);
});

test("FM27 benchmark helpers", () => {
  assert.equal(fm27BenchmarkProfiles().length, 6);
  assert.deepEqual(fm27RoleScores(() => 12, false).map((r) => r.role), ["CB", "WB", "DM", "10", "9"]);
  assert.deepEqual(fm27RoleScores(() => 12, true).map((r) => r.role), ["GK"]);
  assert.equal(ageBenchmark(14), 10.3);
  assert.equal(ageBenchmark(19), 12.6);
  assert.equal(ageBenchmark(31), 13.8);
  const best = bestFm27Role(() => 15, false);
  assert.equal(best.score, 15);
});

test("grade scale: anchored on the prime benchmark, S tiers above A+", () => {
  assert.equal(gradeFor(13.8).grade, "B-");
  assert.equal(gradeFor(13.5).grade, "B-");
  assert.equal(gradeFor(13.49).grade, "C+");
  assert.equal(gradeFor(16).grade, "A+");
  assert.equal(gradeFor(16.5).grade, "S");
  assert.equal(gradeFor(17.2).grade, "S+");
  assert.equal(gradeFor(19).grade, "S++");
  assert.equal(gradeFor(10.49).grade, "F");
  assert.equal(gradeFor(1).tier, "f");
  // Every step is 0.5 below the one above it.
  for (let i = 1; i < GRADE_SCALE.length - 1; i += 1) {
    assert.equal(GRADE_SCALE[i - 1].min - GRADE_SCALE[i].min, 0.5);
  }
});

test("FM27 role weights are Match Lab Study 13b's values under the documented rule", () => {
  const position: Record<Exclude<Fm27Role, "GK">, MatchLabPosition> = { CB: "CB", WB: "FB", DM: "DM", "10": "AM", "9": "ST" };
  for (const r of FM27_ROLES) {
    const derived = r.role === "GK" ? deriveGoalkeeperWeights() : deriveOutfieldWeights(position[r.role]);
    assert.deepEqual(r.weights, derived, r.role);
    assert.equal(Math.max(...Object.values(r.weights)), 10, r.role);
  }
  // The study's headline differences survive the rule.
  const w = (role: Fm27Role) => FM27_ROLES.find((r) => r.role === role)!.weights;
  assert.equal(w("CB").jumpingReach, 10);
  assert.equal(w("DM").jumpingReach, undefined);
  assert.equal(w("9").finishing, 6);
  assert.deepEqual(Object.keys(w("GK")).sort(), ["acceleration", "aerialReach", "agility", "determination", "reflexes"]);
});

test("Best XI slots use the split WB and DM roles", () => {
  assert.equal(DEFAULT_SLOT_ROLE.DR, "WB");
  assert.equal(DEFAULT_SLOT_ROLE.WBL, "WB");
  assert.equal(DEFAULT_SLOT_ROLE.DM, "DM");
  assert.equal(DEFAULT_SLOT_ROLE.MC, "DM");
  const roles = new Set(FM27_ROLES.map((r) => r.role));
  for (const role of Object.values(DEFAULT_SLOT_ROLE)) assert.ok(roles.has(role), role);
});

/** A v1 saved config: Default plus the five fm-scoring profiles as WeightConfig stored them. */
function v1Config(): { activeId: string; profiles: WeightProfile[]; seeded: number } {
  const names: Record<string, string> = {
    "fm27-cb": "FM27 · Centre-back",
    "fm27-wb6": "FM27 · Wing-back / DM (6)",
    "fm27-10": "FM27 · Attacker / Winger (10)",
    "fm27-9": "FM27 · Striker (9)",
    "fm27-gk": "FM27 · Goalkeeper",
  };
  const profiles: WeightProfile[] = [
    { id: "default", name: "Default", weights: {}, emphasis: 1 },
    ...Object.entries(FM_SCORING_FM27_WEIGHTS).map(([id, weights]) => ({
      id,
      name: names[id],
      weights: { ...weights, crossing: 0, marking: 0 },
      emphasis: 1 as const,
      builtIn: "fm27" as const,
    })),
    { id: "profile-1", name: "Mine", weights: { pace: 3 }, emphasis: 2 },
  ];
  return { activeId: "fm27-wb6", profiles, seeded: 1 };
}

test("saved fm-scoring profiles move to the Match Lab benchmarks", () => {
  const out = migrateWeightConfig(v1Config());
  assert.equal(out.seeded, WEIGHT_SEED_VERSION);
  assert.deepEqual(out.profiles.map((p) => p.id), ["default", "fm27-cb", "fm27-wb", "fm27-dm", "fm27-10", "fm27-9", "fm27-gk", "profile-1"]);
  assert.equal(out.activeId, "fm27-wb");
  const bench = new Map(fm27BenchmarkProfiles().map((p) => [p.id, p]));
  for (const p of out.profiles.filter((x) => x.builtIn)) assert.deepEqual(p.weights, bench.get(p.id)!.weights, p.id);
  assert.deepEqual(out.profiles.at(-1), v1Config().profiles.at(-1));
  // Idempotent.
  assert.deepEqual(migrateWeightConfig(out), out);
});

test("edited fm-scoring profiles keep the user's weights", () => {
  const config = v1Config();
  config.activeId = "fm27-9";
  for (const p of config.profiles) {
    if (p.id === "fm27-wb6" || p.id === "fm27-9") p.weights = { ...p.weights, pace: 9 };
  }
  config.profiles = config.profiles.filter((p) => p.id !== "fm27-gk"); // deleted by the user: stays deleted
  const out = migrateWeightConfig(config);
  assert.deepEqual(out.profiles.map((p) => p.id), ["default", "fm27-cb", "fm27-wb", "fm27-dm", "fm27-wb6", "fm27-10", "fm27-9", "profile-1"]);
  const wb6 = out.profiles.find((p) => p.id === "fm27-wb6")!;
  assert.equal(wb6.builtIn, undefined);
  assert.equal(wb6.name, "Wing-back / DM (6), edited");
  assert.equal(wb6.weights.pace, 9);
  const striker = out.profiles.find((p) => p.id === "fm27-9")!;
  assert.equal(striker.builtIn, "fm27");
  assert.equal(striker.weights.pace, 9);
  assert.equal(out.activeId, "fm27-9");
});

test("a config from before any seeding gets every Match Lab benchmark", () => {
  const out = migrateWeightConfig({ activeId: "default", profiles: [{ id: "default", name: "Default", weights: {} }] });
  assert.deepEqual(out.profiles.map((p) => p.id), ["default", ...FM27_ROLES.map((r) => r.profileId)]);
  assert.equal(out.activeId, "default");
});
