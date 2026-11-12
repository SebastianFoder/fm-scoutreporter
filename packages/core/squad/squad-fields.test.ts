import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePlayersCsv } from "@scoutreporter/core/parser/csv-parser";
import {
  isInjured,
  isOnLoan,
  isPickedToStart,
  parseSquadFields,
  parseTimeMissed,
  statusTier,
} from "./squad-fields";

const squad = readFileSync(join(import.meta.dirname, "..", "fixtures", "squad.csv"), "utf8");
const hidden = readFileSync(join(import.meta.dirname, "..", "fixtures", "squad-hidden.csv"), "utf8");

test("reads the squad-only columns of a Squad view export", () => {
  const { byId, columns } = parseSquadFields(squad);
  assert.equal(byId.size, 66);
  assert.deepEqual(columns, {
    picked: true,
    playingTime: true,
    injury: true,
    timeMissed: true,
    happiness: true,
    personality: true,
    stars: true,
  });
  const keeper = byId.get("2002083882")!; // Alex Williamson
  assert.equal(keeper.picked, "GK");
  assert.equal(keeper.playingTime, "Cup Goalkeeper");
  assert.equal(keeper.abilityStars, 2.5);
  assert.equal(keeper.potentialStars, 4);
  assert.equal(keeper.injury, null);
  assert.equal(keeper.happiness, "Delighted");
  assert.equal(keeper.personality, "Resolute");
});

test("flags loans, injuries and the FM starting eleven", () => {
  const { byId } = parseSquadFields(squad);
  const all = [...byId.values()];
  assert.equal(all.filter(isOnLoan).length, 4);
  assert.equal(all.filter(isInjured).length, 2);
  // Eleven picked at a position; S1, S2… are the bench.
  assert.equal(all.filter(isPickedToStart).length, 11);
});

test("the hidden Squad view keeps the stars separate from CA and PA", () => {
  const { byId, columns } = parseSquadFields(hidden);
  assert.equal(columns.stars, true);
  assert.equal(byId.get("2002083882")!.potentialStars, 4);
  const player = parsePlayersCsv(hidden).find((p) => p.uniqueId === "2002083882")!;
  assert.equal(player.potentialAbility, 120);
  assert.equal(player.currentAbility, 112);
  assert.equal(player.professionalism, 15);
  // The Standard-level Squad view has no CA/PA, and the stars are not read as such.
  assert.equal(parsePlayersCsv(squad)[0].potentialAbility, null);
});

test("a player export without squad columns gives no squad fields", () => {
  const { byId, columns } = parseSquadFields(readFileSync(join(import.meta.dirname, "..", "fixtures", "attribute.csv"), "utf8"));
  assert.ok(byId.size > 0);
  assert.equal(Object.values(columns).some(Boolean), false);
});

test("parses time missed and groups squad statuses", () => {
  assert.equal(parseTimeMissed("9 days"), 9);
  assert.equal(parseTimeMissed("3 weeks"), 21);
  assert.equal(parseTimeMissed("2 months"), 60);
  assert.equal(parseTimeMissed("-"), null);
  assert.equal(statusTier("Star Player"), "starter");
  assert.equal(statusTier("First-Choice Goalkeeper"), "starter");
  assert.equal(statusTier("Fringe Player"), "backup");
  assert.equal(statusTier("Breakthrough Prospect"), "prospect");
  assert.equal(statusTier("Out On Loan"), "other");
});
