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
import { groupPlayerAttributes } from "../parser/attribute-grouper";
import { ageBenchmark, bestFm27Role, fm27BenchmarkProfiles } from "./benchmarks";
import { CA_COSTS } from "./ca-costs";
import { ALL_ATTRIBUTE_KEYS } from "../attribute-keys";

const fixture = (name: string) => readFileSync(join(process.cwd(), "fixtures", name), "utf8");

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
  assert.equal(fm27BenchmarkProfiles().length, 5);
  assert.equal(ageBenchmark(14), 10.3);
  assert.equal(ageBenchmark(19), 12.6);
  assert.equal(ageBenchmark(31), 13.8);
  const best = bestFm27Role(() => 15, false);
  assert.equal(best.score, 15);
});
