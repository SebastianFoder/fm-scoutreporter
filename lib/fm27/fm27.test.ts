import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePlayersCsv } from "../parser/csv-parser";
import { parsePositionGroups } from "./positions";
import { calibrateCaModel, computeDatasetPotentials, projectPotential } from "./potential";
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
