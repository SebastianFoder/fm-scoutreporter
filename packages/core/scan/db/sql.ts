/**
 * The small part of a SQLite driver the scan database needs. Node's built-in `node:sqlite`
 * (DatabaseSync, used by the desktop app and by the tests under Bun) fits it as is, so this package
 * has no SQLite dependency of its own.
 */

export type SqlValue = string | number | bigint | null | Uint8Array;

export interface SqlStatement {
  run(...params: SqlValue[]): unknown;
  all(...params: SqlValue[]): unknown[];
  get(...params: SqlValue[]): unknown;
}

export interface SqlDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqlStatement;
}

/** Run `fn` in one transaction (much faster for bulk inserts); rolled back when it throws. */
export function transaction<T>(db: SqlDatabase, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/** A row as `node:sqlite` returns it. */
export type SqlRow = Record<string, SqlValue>;

export const num = (v: SqlValue | undefined): number | null => (v === null || v === undefined ? null : Number(v));
export const str = (v: SqlValue | undefined): string | null => (v === null || v === undefined ? null : String(v));
