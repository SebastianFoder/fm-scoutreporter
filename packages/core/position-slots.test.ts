import test from "node:test";
import assert from "node:assert/strict";
import { parsePositionSlots } from "./position-slots";

const sorted = (xs: string[]) => [...xs].sort();

test("sided roles expand to each listed side", () => {
  assert.deepEqual(sorted(parsePositionSlots("AM (RLC), ST (C)")), sorted(["AMC", "AML", "AMR", "ST"]));
});

test("shared sides apply to every role in a slash group", () => {
  assert.deepEqual(sorted(parsePositionSlots("D/WB (R), DM, M (C)")), sorted(["DM", "DR", "MC", "WBR"]));
});

test("unsided roles default to the centre (or both flanks for WB)", () => {
  assert.deepEqual(parsePositionSlots("GK"), ["GK"]);
  assert.deepEqual(parsePositionSlots("M"), ["MC"]);
  assert.deepEqual(sorted(parsePositionSlots("WB")), ["WBL", "WBR"]);
});

test("ignores unknown tokens and blanks", () => {
  assert.deepEqual(parsePositionSlots(", ??? , ST"), ["ST"]);
});
