/**
 * Writing a scan database: from the reader's lines file (one JSON object per line, streamed, so a
 * 700 MB scan never has to be in memory at once) or from an in-memory ScanFile (the sample scan).
 */
import {
  SCAN_SCHEMA,
  SCAN_SCHEMA_VERSION,
  type ScanFile,
  type ScanMeta,
  type ScanPlayer,
  type ScanStaff,
} from "../schema";
import {
  CREATE_TABLES,
  HIDDEN_KEYS,
  INDEXES,
  PERSONALITY_KEYS,
  PLAYER_ATTRIBUTE_KEYS,
  PLAYER_COLUMNS,
  POSITION_KEYS,
  SCAN_DB_VERSION,
  STAFF_ATTRIBUTE_KEYS,
  STAFF_COLUMNS,
  columnName,
} from "./schema";
import type { SqlDatabase, SqlStatement, SqlValue } from "./sql";

export interface ScanDbCounts {
  players: number;
  staff: number;
}

const int = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v);

/** An insert for every column of a table, in column order. */
function insertFor(db: SqlDatabase, table: string, columns: string[]): SqlStatement {
  const names = columns.map(columnName);
  return db.prepare(`INSERT OR REPLACE INTO ${table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})`);
}

/**
 * Fills an empty database. Call `meta` first, then `player` / `staff` for every record, then
 * `finish` (indexes, counts). Wrap the calls in transactions for speed: `importScanLines` and
 * `writeScanFile` do.
 */
export class ScanDbWriter {
  private readonly clubs = new Map<string, number>();
  private readonly clubsByName = new Map<string, number>();
  private readonly nations = new Map<string, number>();
  private readonly insertClub: SqlStatement;
  private readonly insertNation: SqlStatement;
  private readonly insertPlayer: SqlStatement;
  private readonly insertStaff: SqlStatement;

  constructor(private readonly db: SqlDatabase) {
    db.exec(`PRAGMA user_version = ${SCAN_DB_VERSION};`);
    db.exec(CREATE_TABLES);
    this.insertClub = db.prepare("INSERT INTO club (id, name, division) VALUES (?, ?, ?)");
    this.insertNation = db.prepare("INSERT INTO nation (id, name) VALUES (?, ?)");
    this.insertPlayer = insertFor(db, "player", PLAYER_COLUMNS);
    this.insertStaff = insertFor(db, "staff", STAFF_COLUMNS);
  }

  meta(meta: ScanMeta) {
    const insert = this.db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)");
    insert.run("schema", SCAN_SCHEMA);
    insert.run("schemaVersion", String(SCAN_SCHEMA_VERSION));
    insert.run("meta", JSON.stringify(meta));
  }

  private clubId(name: string | null | undefined, division: string | null | undefined): number | null {
    if (!name) return null;
    const key = `${name}\u0000${division ?? ""}`;
    let id = this.clubs.get(key);
    if (id === undefined) {
      id = this.clubs.size + 1;
      this.clubs.set(key, id);
      this.insertClub.run(id, name, division ?? null);
      if (!this.clubsByName.has(name)) this.clubsByName.set(name, id);
    }
    return id;
  }

  private nationId(name: string | null | undefined): number | null {
    if (!name) return null;
    let id = this.nations.get(name);
    if (id === undefined) {
      id = this.nations.size + 1;
      this.nations.set(name, id);
      this.insertNation.run(id, name);
    }
    return id;
  }

  private person(p: ScanPlayer | ScanStaff): SqlValue[] {
    return [
      p.uid,
      p.name,
      p.birthDate,
      int(p.age),
      this.nationId(p.nationality),
      int(p.nationId),
      p.female ? 1 : 0,
      this.clubId(p.club, p.division),
      p.ca,
      p.pa,
      int(p.wage),
      p.contractExpires,
      int(p.reputation?.current),
      int(p.reputation?.world),
      ...PERSONALITY_KEYS.map((k) => int(p.personality?.[k])),
    ];
  }

  player(p: ScanPlayer) {
    const ts = p.transferStatus;
    // A loan: the owner club comes with a name only; reuse a club of that name when there is one.
    const owner = p.ownerClub ? (this.clubsByName.get(p.ownerClub) ?? this.clubId(p.ownerClub, null)) : null;
    this.insertPlayer.run(
      ...this.person(p),
      owner,
      int(p.teamType),
      int(p.foot?.left),
      int(p.foot?.right),
      int(p.height),
      int(p.value),
      int(p.askingPrice),
      (ts?.listed ? 1 : 0) | (ts?.loanListed ? 2 : 0) | (ts?.notForSale ? 4 : 0) | (ts?.setForRelease ? 8 : 0),
      ...POSITION_KEYS.map((k) => int(p.positions?.[k])),
      ...PLAYER_ATTRIBUTE_KEYS.map((k) => int(p.attributes?.[k])),
      ...HIDDEN_KEYS.map((k) => int(p.hidden?.[k])),
    );
  }

  staff(s: ScanStaff) {
    this.insertStaff.run(
      ...this.person(s),
      s.job,
      int(s.jobId),
      (s.preferredJobs ?? []).join(","),
      s.jobPreferences ? s.jobPreferences.join(",") : null,
      ...STAFF_ATTRIBUTE_KEYS.map((k) => int(s.attributes?.[k])),
    );
  }

  /** Add the indexes and refresh SQLite's statistics. */
  finish(): ScanDbCounts {
    this.db.exec(INDEXES);
    this.db.exec("ANALYZE;");
    // Counted from the tables: a uid seen twice is stored once.
    const count = (table: string) => Number((this.db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n);
    return { players: count("player"), staff: count("staff") };
  }
}

/** Settings for a fast one-off bulk load into a new file (it is thrown away if the import fails). */
export const BULK_LOAD_PRAGMAS = "PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; PRAGMA temp_store = MEMORY;";

/** Write an in-memory scan (the sample scan, tests) into an empty database. */
export function writeScanFile(db: SqlDatabase, scan: ScanFile): ScanDbCounts {
  const writer = new ScanDbWriter(db);
  db.exec("BEGIN");
  try {
    writer.meta(scan.meta);
    for (const p of scan.players) writer.player(p);
    for (const s of scan.staff) writer.staff(s);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return writer.finish();
}

/** The first line of the reader's lines file. */
export interface ScanLinesHeader {
  schema: typeof SCAN_SCHEMA;
  schemaVersion: number;
  meta: ScanMeta;
}

export type ScanLine = ({ kind: "player" } & ScanPlayer) | ({ kind: "staff" } & ScanStaff);

export function assertScanHeader(value: unknown): asserts value is ScanLinesHeader {
  const v = value as Partial<ScanLinesHeader> | null;
  if (!v || typeof v !== "object" || v.schema !== SCAN_SCHEMA) throw new Error("Not a Scout Reporter scan file.");
  if (v.schemaVersion !== SCAN_SCHEMA_VERSION) {
    throw new Error(`Scan format version ${String(v.schemaVersion)} is not supported (expected ${SCAN_SCHEMA_VERSION}).`);
  }
  if (!v.meta || typeof v.meta !== "object") throw new Error("The scan file has no meta line.");
}

/** Rows per transaction while streaming: big enough to be fast, small enough to report progress. */
const BATCH = 5_000;

/**
 * Import the reader's lines file into an empty database: line 1 is the header (schema, version,
 * meta), then one player or staff object per line. `lines` can be any (async) iterable of lines,
 * e.g. node:readline over a file stream.
 */
export async function importScanLines(
  db: SqlDatabase,
  lines: AsyncIterable<string> | Iterable<string>,
  onBatch: () => void = () => {},
): Promise<{ meta: ScanMeta; counts: ScanDbCounts }> {
  const writer = new ScanDbWriter(db);
  let meta: ScanMeta | null = null;
  let inBatch = 0;
  let lineNo = 0;
  db.exec("BEGIN");
  try {
    for await (const raw of lines) {
      lineNo++;
      const line = raw.trim();
      if (!line) continue;
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch {
        throw new Error(`Line ${lineNo} of the scan file is not valid JSON${meta ? "" : " (is this a scan file?)"}.`);
      }
      if (!meta) {
        assertScanHeader(value);
        meta = value.meta;
        writer.meta(meta);
        continue;
      }
      const record = value as ScanLine;
      if (record.kind === "player") writer.player(record);
      else if (record.kind === "staff") writer.staff(record);
      if (++inBatch >= BATCH) {
        db.exec("COMMIT");
        onBatch();
        db.exec("BEGIN");
        inBatch = 0;
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  if (!meta) throw new Error("The scan file is empty.");
  return { meta, counts: writer.finish() };
}

/** The lines file for an in-memory scan (tests, and to turn a JSON scan into the reader's format). */
export function* scanToLines(scan: ScanFile): Generator<string> {
  const header: ScanLinesHeader = { schema: SCAN_SCHEMA, schemaVersion: SCAN_SCHEMA_VERSION, meta: scan.meta };
  yield JSON.stringify(header);
  for (const p of scan.players) yield JSON.stringify({ kind: "player", ...p });
  for (const s of scan.staff) yield JSON.stringify({ kind: "staff", ...s });
}
