import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePlayersCsv } from "./csv-parser";
import { detectDelimiter, splitCsvLine } from "./csv-utils";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "..", "fixtures", name), "utf8");

test("parsePlayersCsv parses FM26 semicolon export", () => {
  const rows = parsePlayersCsv(fixture("attribute.csv"));
  assert.ok(rows.length > 0);
  assert.equal(rows[0].player, "Yastin Cuevas");
  assert.equal(rows[0].position, "AM (R), ST (C)");
  assert.equal(rows[0].crossing, 14);
  assert.equal(rows[0].aerialReach, 3);
});

test("parsePlayersCsv parses FM27 comma export", () => {
  const rows = parsePlayersCsv(fixture("attribute-fm27.csv"));
  assert.equal(rows.length, 109);
  const first = rows[0];
  assert.equal(first.player, "Morgan Maliska");
  assert.equal(first.handling, 15);
  assert.equal(first.position, "GK");
  assert.equal(first.uniqueId, "2002083443");
  assert.equal(first.wage, null);
  assert.equal(first.aerialReach, 14);
  assert.equal(rows[1].wage, "€150 p/w");
  assert.equal(rows[1].transferValueRange, "€6K - €60K");
});

test("parsePlayersCsv handles quoted multi-position values in FM27 comma export", () => {
  const rows = parsePlayersCsv(fixture("attribute-fm27-outfield.csv"));
  assert.equal(rows.length, 74);
  assert.ok(rows.every((r) => /^\d+$/.test(r.uniqueId)));
  const frati = rows.find((r) => r.player === "Fabrizio Frati");
  assert.ok(frati);
  assert.equal(frati.position, "M (C), AM (RLC), ST (C)");
  assert.equal(frati.uniqueId, "2000584576");
  assert.equal(frati.technique, 12);
  assert.equal(frati.aerialReach, 2);
  assert.equal(frati.transferValueRange, "€200K - €2M");
});

test("splitCsvLine keeps quoted commas together", () => {
  assert.equal(detectDelimiter("Player,Position,Age"), ",");
  assert.deepEqual(splitCsvLine('Jo,"AM (R), ST (C)",21', ","), ["Jo", "AM (R), ST (C)", "21"]);
  assert.deepEqual(splitCsvLine('a,"say ""hi""",b', ","), ["a", 'say "hi"', "b"]);
});

test("parsePlayersCsv reads the Hidden Attributes view (Professionalism, CA, PA) by header", () => {
  const rows = parsePlayersCsv(fixture("attribute-fm27-hidden.csv"));
  assert.equal(rows.length, 109);
  const first = rows[0];
  assert.equal(first.player, "Morgan Maliska");
  assert.equal(first.professionalism, 15);
  assert.equal(first.currentAbility, 106);
  assert.equal(first.potentialAbility, 124);
  assert.equal(first.position, "GK");
  assert.equal(first.uniqueId, "2002083443");
  assert.equal(first.technique, 8);
  assert.equal(first.aerialReach, 14);
  assert.equal(rows[1].wage, "€150 p/w");
  assert.equal(rows[1].transferValueRange, "€6K - €60K");
});

test("parsePlayersCsv leaves hidden fields null for Standard view exports", () => {
  const rows = parsePlayersCsv(fixture("attribute.csv"));
  assert.equal(rows[0].currentAbility, null);
  assert.equal(rows[0].potentialAbility, null);
  assert.equal(rows[0].professionalism, null);
});

/**
 * Header + first data row of a real fixture, with some cells replaced by header name. Used to
 * build rows the way a partly scouted player could come out of FM or an exporter.
 */
function withCells(name: string, cells: Record<string, string>): string {
  const [header, row] = fixture(name).replace(/^\uFEFF/, "").split(/\r?\n/);
  const delimiter = detectDelimiter(header);
  const headers = splitCsvLine(header, delimiter);
  const values = splitCsvLine(row, delimiter);
  for (const [h, v] of Object.entries(cells)) {
    const i = headers.indexOf(h);
    assert.ok(i >= 0, `fixture ${name} has no "${h}" column`);
    values[i] = v;
  }
  const quote = (v: string) => (v.includes(delimiter) || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
  return `${header}\n${values.map(quote).join(delimiter)}\n`;
}

const RANGE_CELLS = {
  Pace: "12-15",
  Acceleration: "12 - 15",
  Stamina: "12\u201315",
  "Work Rate": "8 - 10",
  Crossing: "-",
  Finishing: "?",
  Dribbling: "",
};

for (const name of ["attribute.csv", "attribute-fm27.csv"]) {
  test(`parsePlayersCsv scores attribute ranges at their midpoint (${name})`, () => {
    const [p] = parsePlayersCsv(withCells(name, RANGE_CELLS));
    assert.equal(p.pace, 14, "12-15");
    assert.equal(p.acceleration, 14, "12 - 15");
    assert.equal(p.stamina, 14, "12–15 (en dash)");
    assert.equal(p.workRate, 9, "8 - 10");
  });

  test(`parsePlayersCsv keeps unknown attributes at 0 and flags estimated ones (${name})`, () => {
    const [exact] = parsePlayersCsv(fixture(name));
    const [p] = parsePlayersCsv(withCells(name, RANGE_CELLS));
    assert.equal(p.crossing, 0);
    assert.equal(p.finishing, 0);
    assert.equal(p.dribbling, 0);
    assert.deepEqual(
      [...(p.estimatedAttributes ?? [])].sort(),
      ["acceleration", "crossing", "dribbling", "finishing", "pace", "stamina", "workRate"],
    );
    assert.equal(p.technique, exact.technique, "untouched cells parse as before");
    assert.equal(p.age, exact.age);
  });
}

test("parsePlayersCsv leaves exact exports unflagged", () => {
  for (const name of ["attribute.csv", "attribute-fm27.csv", "attribute-fm27-outfield.csv", "attribute-fm27-hidden.csv"]) {
    assert.ok(parsePlayersCsv(fixture(name)).every((p) => p.estimatedAttributes === undefined), name);
  }
});

test("parsePlayersCsv reads a decimal comma attribute as a number, not as digits run together", () => {
  const [p] = parsePlayersCsv(withCells("attribute-fm27.csv", { Pace: "13,5", Balance: "12,5 - 14,5" }));
  assert.equal(p.pace, 14);
  assert.equal(p.balance, 14);
});
