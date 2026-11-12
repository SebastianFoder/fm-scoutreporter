/**
 * Builds scan-sample.json, a small desktop scan in the reader's format, from the CSV fixtures (the
 * squad with hidden attributes and the staff export). Used by tests and by the desktop app's
 * "Load sample scan" when FM is not running. Values that CSVs do not carry (exact wages, values,
 * birth dates) are made up deterministically.
 *
 *   bun packages/core/fixtures/make-scan-sample.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parsePlayersCsv } from "../parser/csv-parser";
import { parseStaffCsv } from "../staff/staff-parser";
import { parsePositionSlots } from "../position-slots";
import { parseTransferValue, parseWeeklyWage } from "../best-xi/money";
import { ALL_ATTRIBUTE_KEYS } from "../attribute-keys";
import { JOB_GROUPS, SCAN_SCHEMA, SCAN_SCHEMA_VERSION, type ScanFile, type ScanPlayer, type ScanStaff } from "../scan/schema";

const dir = import.meta.dirname;
const players = parsePlayersCsv(readFileSync(join(dir, "squad-hidden.csv"), "utf8"));
const { staff } = parseStaffCsv(readFileSync(join(dir, "staff.csv"), "utf8"));
const EUR_TO_GBP = 1 / 1.16;
const CLUB = "Scout Reporter FC";

const scanPlayers: ScanPlayer[] = players.map((p, i) => {
  const positions: ScanPlayer["positions"] = {};
  for (const slot of parsePositionSlots(p.position)) positions[slot] = 20;
  const attributes: Record<string, number> = {};
  for (const k of ALL_ATTRIBUTE_KEYS) attributes[k] = p[k];
  const value = parseTransferValue(p.transferValueRange);
  const wage = parseWeeklyWage(p.wage);
  return {
    uid: Number(p.uniqueId),
    name: p.player,
    birthDate: `${2027 - p.age}-0${(i % 9) + 1}-1${i % 10}`,
    age: p.age,
    nationality: i % 3 === 0 ? "Netherlands" : "United States",
    // A third of the squad plays for another club, so squad filtering has something to filter.
    club: i % 3 === 2 ? "Other FC" : CLUB,
    division: "Sample League",
    teamType: 0,
    ca: p.currentAbility ?? 100,
    pa: p.potentialAbility ?? 120,
    wage: wage === null ? null : Math.round(wage * EUR_TO_GBP),
    contractExpires: "2030-06-30",
    personality: {
      ambition: 12,
      loyalty: 10,
      professionalism: p.professionalism,
      adaptability: 11,
      pressure: 13,
      sportsmanship: 12,
      temperament: 14,
      controversy: 5,
    },
    reputation: { current: 2000 + i * 10, world: 1500 + i * 10 },
    positions,
    foot: { left: 8 + (i % 10), right: 20 - (i % 6) },
    height: 170 + (i % 25),
    value: value.kind === "range" ? Math.round(value.low * EUR_TO_GBP) : null,
    askingPrice: null,
    transferStatus: { listed: i % 11 === 0, loanListed: false, notForSale: false, setForRelease: false },
    attributes,
    hidden: { consistency: 12, dirtiness: 6, importantMatches: 13, injuryProneness: 7, versatility: 10 },
  };
});

const jobGroup = (job: string) => {
  const i = JOB_GROUPS.findIndex((g) => g && g.toLowerCase() === job.trim().toLowerCase());
  return i >= 0 ? [i] : [];
};

const scanStaff: ScanStaff[] = staff.slice(0, 120).map((s, i) => {
  const attributes: Record<string, number> = {};
  for (const [k, r] of Object.entries(s.attributes)) if (r) attributes[k] = Math.round(r.value);
  return {
    uid: 50_000_000 + i,
    name: s.name,
    birthDate: null,
    age: s.age,
    nationality: s.nationality || null,
    club: s.club || null,
    division: null,
    ca: 100,
    pa: 120,
    wage: null,
    contractExpires: null,
    personality: {
      ambition: null,
      loyalty: null,
      professionalism: null,
      adaptability: attributes.adaptability ?? null,
      pressure: null,
      sportsmanship: null,
      temperament: null,
      controversy: null,
    },
    reputation: { current: 0, world: 0 },
    job: s.preferredJob || null,
    preferredJobs: jobGroup(s.preferredJob),
    jobPreferences: null,
    attributes,
  };
});

const scan: ScanFile = {
  schema: SCAN_SCHEMA,
  schemaVersion: SCAN_SCHEMA_VERSION,
  meta: {
    scannedAt: "2026-11-12T18:00:00Z",
    readerVersion: "0.1.0",
    game: "FM27",
    gameVersion: "27.0.1.0",
    supportedVersion: "27.0",
    versionOk: true,
    gameDate: "2027-08-14",
    gameDateSource: "schedule",
    gameYear: 2027,
    manager: "Sample Manager",
    myClub: CLUB,
    database: "men",
    currency: "GBP",
    unreadFraction: 0,
  },
  players: scanPlayers,
  staff: scanStaff,
};

writeFileSync(join(dir, "scan-sample.json"), JSON.stringify(scan, null, 1) + "\n");
console.log(`scan-sample.json: ${scanPlayers.length} players, ${scanStaff.length} staff`);
