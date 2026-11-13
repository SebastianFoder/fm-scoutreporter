/**
 * A desktop scan: the records the reader (reader/, ScoutReporter.Reader.exe) writes, schema
 * "scoutreporter-scan" version 2 (a lines file, one record per line; see ./README.md), which the
 * desktop app keeps as a scan database (./db). Money is in GBP (FM's internal currency), dates are
 * ISO yyyy-mm-dd, attributes are 1..20.
 */

export const SCAN_SCHEMA = "scoutreporter-scan";
export const SCAN_SCHEMA_VERSION = 2;

/** FM's position ratings (1..20) by position; missing = 0. */
export type ScanPositionKey =
  | "GK"
  | "SW"
  | "DL"
  | "DC"
  | "DR"
  | "DM"
  | "ML"
  | "MC"
  | "MR"
  | "AML"
  | "AMC"
  | "AMR"
  | "ST"
  | "WBL"
  | "WBR";

export interface ScanMeta {
  /** When the scan ran (UTC, ISO 8601). */
  scannedAt: string;
  readerVersion: string;
  /** "FM27" or "FM26": the memory layout used. */
  game: string;
  /** game_plugin.dll file version, null when unreadable. */
  gameVersion: string | null;
  /** The version the offsets were pinned on ("27.0"). */
  supportedVersion: string;
  /** False when the game version differs from the pinned one: the data may be wrong. */
  versionOk: boolean;
  /** In-game date (the manager's next match date), null when not found. */
  gameDate: string | null;
  gameDateSource: "schedule" | "none";
  gameYear: number;
  manager: string | null;
  myClub: string | null;
  database: "men" | "women" | "both";
  currency: "GBP";
  /** Share of FM's memory that could not be read (0..1). */
  unreadFraction: number;
}

export interface ScanPersonality {
  ambition: number | null;
  loyalty: number | null;
  professionalism: number | null;
  adaptability: number | null;
  pressure: number | null;
  sportsmanship: number | null;
  temperament: number | null;
  controversy: number | null;
}

interface ScanPersonBase {
  uid: number;
  name: string;
  birthDate: string | null;
  age: number | null;
  nationality: string | null;
  nationId?: number;
  female?: boolean;
  club: string | null;
  division: string | null;
  ca: number;
  pa: number;
  /** GBP per week. */
  wage: number | null;
  contractExpires: string | null;
  personality: ScanPersonality;
  reputation: { current: number; world: number };
}

export interface ScanPlayer extends ScanPersonBase {
  /** The club holding the contract, only when it differs from `club` (a loan). */
  ownerClub?: string;
  /** 0 = first team, ~3 = reserves, 10+ = youth. */
  teamType?: number;
  positions: Partial<Record<ScanPositionKey, number>>;
  foot: { left: number; right: number };
  height: number | null;
  /** FM's transfer value, GBP. */
  value: number | null;
  askingPrice: number | null;
  transferStatus: { listed: boolean; loanListed: boolean; notForSale: boolean; setForRelease: boolean };
  /** Visible attributes 1..20, keyed like the app's PlayerAttributes (teamWork, freeKickTaking...). */
  attributes: Record<string, number>;
  /** Hidden attributes 1..20: consistency, dirtiness, importantMatches, injuryProneness, versatility. */
  hidden: Record<string, number>;
}

export interface ScanStaff extends ScanPersonBase {
  /** Current job (English), null without a contract. */
  job: string | null;
  jobId?: number;
  /** Job groups (0..14, see JOB_GROUPS) with the top preference score; empty without a clear preference. */
  preferredJobs: number[];
  /** All 15 preference scores (1..20), null when unreadable. */
  jobPreferences: number[] | null;
  /** Staff attributes 1..20, keyed like the app's StaffAttributeKey. */
  attributes: Record<string, number>;
}

export interface ScanFile {
  schema: typeof SCAN_SCHEMA;
  schemaVersion: number;
  meta: ScanMeta;
  players: ScanPlayer[];
  staff: ScanStaff[];
}

/** FM's job preference groups, by index, as the preferred job names the app knows. */
export const JOB_GROUPS: readonly string[] = [
  "Manager",
  "Assistant Manager",
  "Coach",
  "Physio",
  "Scout",
  "Goalkeeping Coach",
  "Fitness Coach",
  "",
  "Director",
  "Director of Football",
  "Head of Youth Development",
  "Loan Manager",
  "Performance Analyst",
  "Sports Scientist",
  "Technical Director",
];

/** Throws when `value` is not a scan this version of the app can read. */
export function assertScanFile(value: unknown): asserts value is ScanFile {
  const v = value as Partial<ScanFile> | null;
  if (!v || typeof v !== "object" || v.schema !== SCAN_SCHEMA) throw new Error("Not a Scout Reporter scan file.");
  if (v.schemaVersion !== SCAN_SCHEMA_VERSION) {
    throw new Error(`Scan format version ${String(v.schemaVersion)} is not supported (expected ${SCAN_SCHEMA_VERSION}).`);
  }
  if (!v.meta || !Array.isArray(v.players) || !Array.isArray(v.staff)) throw new Error("The scan file is incomplete.");
}
