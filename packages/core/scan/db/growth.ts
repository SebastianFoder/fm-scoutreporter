/**
 * Growth between two scan databases, in SQL. `prepareGrowth` joins the two scans on uid once (about
 * two seconds for two full 400,000-player databases) into a small `growth` table in a scratch
 * in-memory database; `queryGrowth` then filters, sorts and pages that table in milliseconds, so the
 * Growth screen's filters stay quick. Same results as compareScans in ../growth.ts, which works on
 * in-memory scans.
 *
 * The scan files are attached only while they are read, so they are never held open in between
 * (Windows cannot delete an open file).
 */
import type { GrowthPage, GrowthQuery } from "../../desktop/bridge";
import { daysBetween, playerGrowth, type GrowthSort } from "../growth";
import type { ScanMeta } from "../schema";
import { PLAYER_ATTRIBUTE_KEYS, attrCol } from "./schema";
import { playersByUid } from "./read";
import type { SqlDatabase, SqlRow, SqlValue } from "./sql";

export interface PreparedGrowth {
  /** The later scan's file. */
  newer: string;
  /** The earlier scan's file. */
  older: string;
  /** Players in the later scan with no earlier scan. */
  newPlayers: number;
  days: number | null;
}

/** Sum of every attribute's change (an attribute missing from either scan counts as no change). */
const ATTRIBUTE_CHANGE = PLAYER_ATTRIBUTE_KEYS.map((k) => `COALESCE(n.${attrCol(k)} - o.${attrCol(k)}, 0)`).join(" + ");

const SORT_SQL: Record<GrowthSort, string> = {
  caChange: "ca_change",
  attributeChange: "attribute_change",
  paChange: "pa_change",
  ca: "ca",
  age: "COALESCE(age, 0)",
  name: "name COLLATE NOCASE",
};

/** `LIKE` pattern for a search text (case-insensitive for ASCII; % and _ are literal). */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Run `fn` with `files` attached as schemas a0, a1, ..., detached afterwards. */
function withAttached<T>(db: SqlDatabase, files: string[], fn: (schemas: string[]) => T): T {
  const schemas: string[] = [];
  try {
    for (const file of files) {
      const schema = `a${schemas.length}`;
      db.prepare(`ATTACH DATABASE ? AS ${schema}`).run(file);
      schemas.push(schema);
    }
    return fn(schemas);
  } finally {
    for (const schema of schemas) db.exec(`DETACH DATABASE ${schema}`);
  }
}

function metaOf(db: SqlDatabase, schema: string): ScanMeta {
  const row = db.prepare(`SELECT value FROM ${schema}.meta WHERE key = 'meta'`).get() as SqlRow | undefined;
  if (!row) throw new Error("A scan database has no meta.");
  return JSON.parse(String(row.value)) as ScanMeta;
}

/**
 * Compare the scan databases at `fileA` and `fileB` (either order: the scan times decide which is
 * the earlier one) into a `growth` table in `db`, a scratch database such as `:memory:`.
 */
export function prepareGrowth(db: SqlDatabase, fileA: string, fileB: string): PreparedGrowth {
  return withAttached(db, [fileA, fileB], ([a, b]) => {
    const metaA = metaOf(db, a);
    const metaB = metaOf(db, b);
    const aIsOlder = metaA.scannedAt <= metaB.scannedAt;
    const [older, newer] = aIsOlder ? [a, b] : [b, a];
    db.exec("DROP TABLE IF EXISTS growth");
    db.exec(`
      CREATE TABLE growth AS
      SELECT n.uid AS uid, n.name AS name, n.age AS age, n.ca AS ca, c.name AS club,
             n.ca - o.ca AS ca_change, n.pa - o.pa AS pa_change, (${ATTRIBUTE_CHANGE}) AS attribute_change
      FROM ${newer}.player n
      JOIN ${older}.player o ON o.uid = n.uid
      LEFT JOIN ${newer}.club c ON c.id = n.club_id`);
    const newPlayers = Number(
      (
        db
          .prepare(`SELECT count(*) AS n FROM ${newer}.player n WHERE NOT EXISTS (SELECT 1 FROM ${older}.player o WHERE o.uid = n.uid)`)
          .get() as SqlRow
      ).n,
    );
    const [early, late] = aIsOlder ? [metaA, metaB] : [metaB, metaA];
    return {
      newer: aIsOlder ? fileB : fileA,
      older: aIsOlder ? fileA : fileB,
      newPlayers,
      days: daysBetween(early.gameDate, late.gameDate),
    };
  });
}

/** One page of the prepared comparison, filtered and sorted. */
export function queryGrowth(db: SqlDatabase, prepared: PreparedGrowth, query: GrowthQuery): GrowthPage {
  const where: string[] = [];
  const params: SqlValue[] = [];
  if (query.minCaGain !== undefined) {
    where.push("ca_change >= ?");
    params.push(query.minCaGain);
  }
  if (query.maxAge !== undefined) {
    where.push("COALESCE(age, 0) <= ?");
    params.push(query.maxAge);
  }
  const q = query.query?.trim();
  if (q) {
    where.push("(name LIKE ? ESCAPE '\\' OR club LIKE ? ESCAPE '\\')");
    params.push(likePattern(q), likePattern(q));
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = Number((db.prepare(`SELECT count(*) AS n FROM growth ${whereSql}`).get(...params) as SqlRow).n);
  const dir = query.dir === "asc" ? "ASC" : "DESC";
  const uids = (
    db
      .prepare(`SELECT uid FROM growth ${whereSql} ORDER BY ${SORT_SQL[query.sort]} ${dir}, ca_change DESC, uid LIMIT ? OFFSET ?`)
      .all(...params, query.limit, query.offset ?? 0) as SqlRow[]
  ).map((r) => Number(r.uid));

  // The page's players in full, from both scans.
  const rows = withAttached(db, [prepared.newer, prepared.older], ([newer, older]) => {
    const now = new Map(playersByUid(inSchema(db, newer), uids).map((p) => [p.uid, p]));
    const before = new Map(playersByUid(inSchema(db, older), uids).map((p) => [p.uid, p]));
    return uids.flatMap((uid) => {
      const p = now.get(uid);
      const prev = before.get(uid);
      return p && prev ? [playerGrowth(prev, p)] : [];
    });
  });
  return { rows, total, newPlayers: prepared.newPlayers, days: prepared.days };
}

/** Prepare and query in one go (tests, one-off comparisons). */
export function compareScanDbFiles(db: SqlDatabase, fileA: string, fileB: string, query: GrowthQuery): GrowthPage {
  return queryGrowth(db, prepareGrowth(db, fileA, fileB), query);
}

/** `db` with the scan tables read from an attached schema, so the row readers work on it. */
function inSchema(db: SqlDatabase, schema: string): SqlDatabase {
  const qualify = (sql: string) =>
    sql
      .replace(/\bFROM player\b/g, `FROM ${schema}.player`)
      .replace(/\bJOIN club\b/g, `JOIN ${schema}.club`)
      .replace(/\bJOIN nation\b/g, `JOIN ${schema}.nation`);
  return { exec: (sql) => db.exec(qualify(sql)), prepare: (sql) => db.prepare(qualify(sql)) };
}
