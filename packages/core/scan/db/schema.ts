/**
 * The scan database: how the desktop app stores a scan (`scan.sqlite`, one per stored scan). A full
 * FM27 database is about 400,000 players; as JSON that is over 700 MB, more than a JavaScript string
 * can hold, so scans are stored as SQLite with one column per value (about 7x smaller) and the
 * screens query the part they need.
 *
 * Clubs and nations are stored once and referenced by id. Every 1..20 value (attributes, hidden
 * attributes, personality, position ratings, staff attributes) has its own column, so a query can
 * filter and sort on any of them. See ../README.md.
 */
import type { ScanPositionKey } from "../schema";

/** Bumped when the tables change; stored as SQLite's user_version. */
export const SCAN_DB_VERSION = 2;

export const POSITION_KEYS: readonly ScanPositionKey[] = [
  "GK", "SW", "DL", "DC", "DR", "DM", "ML", "MC", "MR", "AML", "AMC", "AMR", "ST", "WBL", "WBR",
];

export const PERSONALITY_KEYS = [
  "ambition", "loyalty", "professionalism", "adaptability", "pressure", "sportsmanship", "temperament", "controversy",
] as const;

/** Visible player attributes, as the reader names them (the app's PlayerAttributes keys). */
export const PLAYER_ATTRIBUTE_KEYS = [
  "crossing", "dribbling", "finishing", "heading", "longShots", "marking", "offTheBall", "passing", "penaltyTaking",
  "tackling", "vision", "handling", "aerialReach", "commandOfArea", "communication", "kicking", "throwing",
  "anticipation", "decisions", "oneOnOnes", "positioning", "reflexes", "firstTouch", "technique", "flair", "corners",
  "teamWork", "workRate", "longThrows", "eccentricity", "rushingOutTendency", "punching", "acceleration",
  "freeKickTaking", "strength", "stamina", "pace", "jumpingReach", "leadership", "balance", "bravery", "aggression",
  "agility", "naturalFitness", "determination", "composure", "concentration",
] as const;

export const HIDDEN_KEYS = ["dirtiness", "consistency", "importantMatches", "injuryProneness", "versatility"] as const;

export const STAFF_ATTRIBUTE_KEYS = [
  "attacking", "defending", "fitness", "possession", "technical", "tacticalCoaching", "setPieces", "determination",
  "manManagement", "motivating", "judgingCurrentAbility", "judgingPotentialAbility", "judgingStaffAbility",
  "negotiating", "tacticalKnowledge", "physiotherapy", "sportsScience", "analysingData", "workingWithYoungsters",
  "authority", "goalkeeping", "adaptability",
] as const;

/** Column names of the keyed values. */
export const posCol = (k: string) => `pos_${k}`;
export const perCol = (k: string) => `per_${k}`;
export const attrCol = (k: string) => `a_${k}`;
export const hidCol = (k: string) => `h_${k}`;

/** Columns both tables share, in insert order. */
const PERSON_COLUMNS = [
  "uid INTEGER PRIMARY KEY",
  "name TEXT NOT NULL",
  "birth_date TEXT",
  "age INTEGER",
  "nation_id INTEGER",
  "fm_nation_id INTEGER",
  "female INTEGER NOT NULL DEFAULT 0",
  "club_id INTEGER",
  "ca INTEGER NOT NULL",
  "pa INTEGER NOT NULL",
  "wage INTEGER",
  "contract_expires TEXT",
  "rep_current INTEGER",
  "rep_world INTEGER",
  /** 1 when the person was in FM's search result at scan time. */
  "in_search INTEGER NOT NULL DEFAULT 0",
  ...PERSONALITY_KEYS.map((k) => `${perCol(k)} INTEGER`),
];

export const PLAYER_COLUMNS = [
  ...PERSON_COLUMNS,
  "owner_club_id INTEGER",
  "team_type INTEGER",
  "foot_left INTEGER",
  "foot_right INTEGER",
  "height INTEGER",
  "value INTEGER",
  "asking_price INTEGER",
  /** Bit flags: 1 listed, 2 loan listed, 4 not for sale, 8 set for release. */
  "transfer_flags INTEGER NOT NULL DEFAULT 0",
  ...POSITION_KEYS.map((k) => `${posCol(k)} INTEGER`),
  ...PLAYER_ATTRIBUTE_KEYS.map((k) => `${attrCol(k)} INTEGER`),
  ...HIDDEN_KEYS.map((k) => `${hidCol(k)} INTEGER`),
];

export const STAFF_COLUMNS = [
  ...PERSON_COLUMNS,
  "job TEXT",
  "job_id INTEGER",
  /** Comma-separated job group indexes. */
  "preferred_jobs TEXT NOT NULL DEFAULT ''",
  /** Comma-separated 15 preference scores, null when unreadable. */
  "job_preferences TEXT",
  ...STAFF_ATTRIBUTE_KEYS.map((k) => `${attrCol(k)} INTEGER`),
];

export const columnName = (definition: string) => definition.split(" ")[0];

/** Create the tables. Indexes come after the bulk insert (see INDEXES), which is much faster. */
export const CREATE_TABLES = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE club (id INTEGER PRIMARY KEY, name TEXT NOT NULL, division TEXT, reputation INTEGER, UNIQUE (name, division));
CREATE TABLE nation (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE player (${PLAYER_COLUMNS.join(", ")}) WITHOUT ROWID;
CREATE TABLE staff (${STAFF_COLUMNS.join(", ")}) WITHOUT ROWID;
`;

export const INDEXES = `
CREATE INDEX player_club ON player (club_id);
CREATE INDEX player_ca ON player (ca);
CREATE INDEX player_age_pa ON player (age, pa);
CREATE INDEX staff_club ON staff (club_id);
CREATE INDEX staff_ca ON staff (ca);
`;
