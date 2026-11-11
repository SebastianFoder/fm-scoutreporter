import { parseAndGroup } from "../components/PlayersDataProvider";
import type { PlayerWithGroups } from "../data/players-store";
import { isGoalkeeperPosition } from "../lib/fm27/benchmarks";
import fm26Csv from "../fixtures/attribute.csv?raw";
import fm27OutfieldCsv from "../fixtures/attribute-fm27-outfield.csv?raw";
import fm27HiddenCsv from "../fixtures/attribute-fm27-hidden.csv?raw";
import staffCsv from "../fixtures/staff.csv?raw";

/**
 * CSV fixtures available to stories.
 * - `fm26`: FM26 Standard view export, mixed positions (1 GK), no CA/PA
 * - `fm27outfield`: FM27 export, outfield only (all U21), no CA/PA
 * - `fm27hidden`: FM27 Hidden Attributes view export with CA/PA/Professionalism (enables potential + Wonderkid).
 *   Note: every player in this fixture is a goalkeeper.
 */
export const FIXTURE_CSV = {
  fm26: fm26Csv,
  fm27outfield: fm27OutfieldCsv,
  fm27hidden: fm27HiddenCsv,
} as const;

export type FixtureName = keyof typeof FIXTURE_CSV;

/** Names served by the app's /api/fixtures/[name] route, mapped to their CSV. */
export const API_FIXTURES: Record<string, string> = {
  attribute: fm26Csv,
  "attribute-fm27-hidden": fm27HiddenCsv,
  staff: staffCsv,
};

/** FM26 Staff view export (words, 518 rows with 120 duplicates), for Staff mode. */
export const STAFF_FIXTURE_CSV = staffCsv;

const cache = new Map<FixtureName, ReturnType<typeof parseAndGroup>>();

export function fixtureDataset(name: FixtureName) {
  let ds = cache.get(name);
  if (!ds) {
    ds = parseAndGroup(FIXTURE_CSV[name]);
    cache.set(name, ds);
  }
  return ds;
}

export function fixturePlayers(name: FixtureName): PlayerWithGroups[] {
  return fixtureDataset(name).players;
}

/** First player in a fixture matching the predicate (throws if none, so broken fixtures fail loudly). */
export function fixturePlayer(
  name: FixtureName,
  predicate: (p: PlayerWithGroups) => boolean = () => true,
): PlayerWithGroups {
  const player = fixturePlayers(name).find(predicate);
  if (!player) throw new Error(`No matching player in fixture "${name}"`);
  return player;
}

export const isGoalkeeper = (p: PlayerWithGroups) => isGoalkeeperPosition(p.raw.position);
export const isOutfield = (p: PlayerWithGroups) => !isGoalkeeper(p);
