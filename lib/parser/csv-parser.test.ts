import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePlayersCsv } from "./csv-parser";
import { detectDelimiter, splitCsvLine } from "./csv-utils";

const fixture = (name: string) => readFileSync(join(process.cwd(), "fixtures", name), "utf8");

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
