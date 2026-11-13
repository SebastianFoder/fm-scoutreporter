/**
 * Reading a scan database: the meta, the players and staff the screens load (a "load scope", so a
 * 400,000-player database does not have to fit in the window), and rows turned back into the same
 * ScanPlayer / ScanStaff records the JSON scan had.
 */
import type { LoadScope, LoadedScan } from "../../desktop/bridge";
import type { ScanMeta, ScanPersonality, ScanPlayer, ScanStaff } from "../schema";
import {
  HIDDEN_KEYS,
  PERSONALITY_KEYS,
  PLAYER_ATTRIBUTE_KEYS,
  POSITION_KEYS,
  STAFF_ATTRIBUTE_KEYS,
  SCAN_DB_VERSION,
  attrCol,
  hidCol,
  perCol,
  posCol,
} from "./schema";
import { num, str, type SqlDatabase, type SqlRow, type SqlValue } from "./sql";

/** Throws unless `db` is a scan database this version of the app can read. */
export function assertScanDb(db: SqlDatabase) {
  const version = Number((db.prepare("PRAGMA user_version").get() as { user_version: number } | undefined)?.user_version);
  let schema: string | null = null;
  try {
    schema = str((db.prepare("SELECT value FROM meta WHERE key = 'schema'").get() as SqlRow | undefined)?.value);
  } catch {
    // no meta table: not a scan database
  }
  if (schema !== "scoutreporter-scan") throw new Error("Not a Scout Reporter scan database.");
  if (version !== SCAN_DB_VERSION) {
    throw new Error(`Scan database version ${version} is not supported (expected ${SCAN_DB_VERSION}). Scan again.`);
  }
}

export function readScanMeta(db: SqlDatabase): ScanMeta {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'meta'").get() as SqlRow | undefined;
  if (!row) throw new Error("The scan database has no meta.");
  return JSON.parse(String(row.value)) as ScanMeta;
}

export function scanDbCounts(db: SqlDatabase): { players: number; staff: number } {
  const count = (table: string) => Number((db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as SqlRow).n);
  return { players: count("player"), staff: count("staff") };
}

const PLAYER_SELECT = `
SELECT p.*, c.name AS club_name, c.division AS club_division, oc.name AS owner_name, n.name AS nation_name
FROM player p
LEFT JOIN club c ON c.id = p.club_id
LEFT JOIN club oc ON oc.id = p.owner_club_id
LEFT JOIN nation n ON n.id = p.nation_id`;

const STAFF_SELECT = `
SELECT s.*, c.name AS club_name, c.division AS club_division, n.name AS nation_name
FROM staff s
LEFT JOIN club c ON c.id = s.club_id
LEFT JOIN nation n ON n.id = s.nation_id`;

/** The non-null columns of `keys` as a map (attributes, hidden, positions). */
function keyed(row: SqlRow, keys: readonly string[], col: (k: string) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of keys) {
    const v = row[col(k)];
    if (v !== null && v !== undefined) out[k] = Number(v);
  }
  return out;
}

function personFields(row: SqlRow) {
  const personality = {} as ScanPersonality;
  for (const k of PERSONALITY_KEYS) personality[k] = num(row[perCol(k)]);
  const fmNation = num(row.fm_nation_id);
  return {
    uid: Number(row.uid),
    name: String(row.name),
    birthDate: str(row.birth_date),
    age: num(row.age),
    nationality: str(row.nation_name),
    ...(fmNation !== null && { nationId: fmNation }),
    ...(Number(row.female) === 1 && { female: true }),
    club: str(row.club_name),
    division: str(row.club_division),
    ca: Number(row.ca),
    pa: Number(row.pa),
    wage: num(row.wage),
    contractExpires: str(row.contract_expires),
    personality,
    reputation: { current: Number(row.rep_current ?? 0), world: Number(row.rep_world ?? 0) },
  };
}

export function rowToPlayer(row: SqlRow): ScanPlayer {
  const flags = Number(row.transfer_flags ?? 0);
  const owner = str(row.owner_name);
  const teamType = num(row.team_type);
  return {
    ...personFields(row),
    ...(owner !== null && { ownerClub: owner }),
    ...(teamType !== null && { teamType }),
    positions: keyed(row, POSITION_KEYS, posCol),
    foot: { left: Number(row.foot_left ?? 0), right: Number(row.foot_right ?? 0) },
    height: num(row.height),
    value: num(row.value),
    askingPrice: num(row.asking_price),
    transferStatus: {
      listed: (flags & 1) !== 0,
      loanListed: (flags & 2) !== 0,
      notForSale: (flags & 4) !== 0,
      setForRelease: (flags & 8) !== 0,
    },
    attributes: keyed(row, PLAYER_ATTRIBUTE_KEYS, attrCol),
    hidden: keyed(row, HIDDEN_KEYS, hidCol),
  };
}

const list = (v: SqlValue | undefined): number[] =>
  v === null || v === undefined || v === "" ? [] : String(v).split(",").map(Number);

export function rowToStaff(row: SqlRow): ScanStaff {
  const jobId = num(row.job_id);
  return {
    ...personFields(row),
    job: str(row.job),
    ...(jobId !== null && { jobId }),
    preferredJobs: list(row.preferred_jobs),
    jobPreferences: row.job_preferences === null || row.job_preferences === undefined ? null : list(row.job_preferences),
    attributes: keyed(row, STAFF_ATTRIBUTE_KEYS, attrCol),
  };
}

/** Players by uid (any order); missing uids are skipped. */
export function playersByUid(db: SqlDatabase, uids: number[]): ScanPlayer[] {
  if (uids.length === 0) return [];
  const rows = db.prepare(`${PLAYER_SELECT} WHERE p.uid IN (SELECT value FROM json_each(?))`).all(JSON.stringify(uids)) as SqlRow[];
  return rows.map(rowToPlayer);
}

/** Every player (tests and small scans only: a full database does not fit in memory as objects). */
export function allPlayers(db: SqlDatabase): ScanPlayer[] {
  return (db.prepare(`${PLAYER_SELECT} ORDER BY p.uid`).all() as SqlRow[]).map(rowToPlayer);
}

export function allStaff(db: SqlDatabase): ScanStaff[] {
  return (db.prepare(`${STAFF_SELECT} ORDER BY s.uid`).all() as SqlRow[]).map(rowToStaff);
}

/**
 * What the screens get from a scan. A scan that fits under the limits is loaded whole. A bigger one
 * (a full FM database is about 400,000 players) loads your club, plus every player at or above
 * `minCa`, plus young players (up to `youngMaxAge`) with a PA of at least `youngMinPa`, best CA first,
 * up to `maxPlayers`; and for staff your club plus everyone at or above `staffMinCa`, up to `maxStaff`.
 */
export function loadScan(db: SqlDatabase, scope: LoadScope): LoadedScan {
  const meta = readScanMeta(db);
  const totals = scanDbCounts(db);
  const myClub = meta.myClub;

  const players =
    totals.players <= scope.maxPlayers
      ? allPlayers(db)
      : (
          db
            .prepare(
              `${PLAYER_SELECT}
               WHERE (c.name IS NOT NULL AND c.name = ?) OR p.ca >= ? OR (p.age <= ? AND p.pa >= ?)
               ORDER BY (c.name IS NOT NULL AND c.name = ?) DESC, p.ca DESC, p.uid
               LIMIT ?`,
            )
            .all(myClub, scope.minCa, scope.youngMaxAge, scope.youngMinPa, myClub, scope.maxPlayers) as SqlRow[]
        ).map(rowToPlayer);

  const staff =
    totals.staff <= scope.maxStaff
      ? allStaff(db)
      : (
          db
            .prepare(
              `${STAFF_SELECT}
               WHERE (c.name IS NOT NULL AND c.name = ?) OR s.ca >= ?
               ORDER BY (c.name IS NOT NULL AND c.name = ?) DESC, s.ca DESC, s.uid
               LIMIT ?`,
            )
            .all(myClub, scope.staffMinCa, myClub, scope.maxStaff) as SqlRow[]
        ).map(rowToStaff);

  return { meta, players, staff, totalPlayers: totals.players, totalStaff: totals.staff };
}
