/**
 * A desktop scan holds a whole FM database: 60,000+ people. These tests build a synthetic import of
 * that size from the squad fixture and run the per-player passes the screens use (parse, group,
 * potential, list scores, FM27 role scores, name sort, Best XI). Each pass is timed at 6,000 and at
 * 60,000 players: a linear pass takes about 10x as long, so a ratio far above that means something
 * quadratic crept in. The absolute limits are generous, to stay stable on slow CI machines.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePlayersCsv } from "../parser/csv-parser";
import { groupPlayerAttributes } from "../parser/attribute-grouper";
import { computeDatasetPotentials } from "../fm27/potential";
import { fm27PlayerScores } from "../fm27/player-scores";
import { computeWeightedAverage, computeWeightedAverageOf, scaleScore } from "../scoring";
import { solveBestXi, type XiSlot } from "../best-xi/solver";
import { compareNames } from "../text";
import type { PlayerWithGroups } from "../players";
import type { AttributeWeights } from "../types/weights";

const BOM = String.fromCharCode(0xfeff);
const raw = readFileSync(join(import.meta.dirname, "..", "fixtures", "squad-hidden.csv"), "utf8");
const fixture = raw.startsWith(BOM) ? raw.slice(1) : raw;
const [header, ...rows] = fixture.split(/\r?\n/).filter((l) => l.trim() !== "");
const base = parsePlayersCsv(fixture);
assert.equal(base.length, rows.length);

/**
 * A CSV with `n` players: the fixture's rows repeated with fresh IDs and names. Cells can be quoted
 * and contain commas, so the values are replaced in the row text rather than by column.
 */
function syntheticCsv(n: number): string {
  const out = [header];
  for (let i = 0; i < n; i++) {
    const k = i % rows.length;
    out.push(
      rows[k]
        .replace(base[k].uniqueId, String(3_000_000_000 + i))
        .replace(base[k].player, `${base[k].player} ${i}`),
    );
  }
  return out.join("\n");
}

const weights = {
  pace: 5,
  acceleration: 5,
  stamina: 4,
  anticipation: 3,
  finishing: 2,
} as unknown as AttributeWeights;

type Timings = Record<string, number>;

function run(n: number): Timings {
  const t: Timings = {};
  const time = <T>(name: string, fn: () => T): T => {
    const start = performance.now();
    const result = fn();
    t[name] = performance.now() - start;
    return result;
  };

  const csv = syntheticCsv(n);
  const parsed = time("parse", () => parsePlayersCsv(csv));
  assert.equal(parsed.length, n);
  const potentials = time("potential", () => computeDatasetPotentials(parsed));
  const players: PlayerWithGroups[] = time("group", () =>
    parsed.map((p) => ({
      raw: p,
      grouped: groupPlayerAttributes(p),
      potential: potentials.byId.get(p.uniqueId) ?? null,
    })),
  );
  time("list scores", () =>
    players.map((p) => ({
      score: scaleScore(computeWeightedAverage(p, weights, 2)),
      potential: p.potential ? computeWeightedAverageOf(p.potential.attributes, weights, 2) : null,
    })),
  );
  const roleScores = time("role scores", () => players.map((p) => fm27PlayerScores(p)));
  time("name sort", () => [...players].sort((a, b) => compareNames(a.raw.player, b.raw.player)));
  time("best xi", () => {
    const candidates = players.map((p, i) => ({
      id: p.raw.uniqueId,
      score: roleScores[i].best.score,
      cost: (i % 97) * 100_000,
    }));
    const slots: XiSlot[] = Array.from({ length: 11 }, (_, s) => ({
      key: `S${s % 6}`,
      candidates: candidates.filter((_, i) => i % 6 === s % 6),
    }));
    const res = solveBestXi(slots, { maxBudget: 30_000_000, timeLimitMs: 2_000 });
    assert.equal(res.status, "ok");
  });
  return t;
}

test("every per-player pass scales linearly up to 60,000 players", () => {
  run(600); // warm up the JIT
  const small = run(6_000);
  const large = run(60_000);
  const total = Object.values(large).reduce((a, b) => a + b, 0);
  const report = Object.keys(large)
    .map((k) => `${k}: ${small[k].toFixed(0)}ms -> ${large[k].toFixed(0)}ms`)
    .join(", ");
  console.log(`60k import: ${total.toFixed(0)}ms total (${report})`);
  for (const pass of Object.keys(large)) {
    // 10x the players: linear is ~10x. Allow noise and n log n, but not n^2 (100x).
    if (large[pass] > 200) {
      assert.ok(large[pass] / Math.max(small[pass], 1) < 30, `${pass} looks super-linear: ${report}`);
    }
  }
  assert.ok(total < 60_000, `60k import took ${total.toFixed(0)}ms`);
});
