// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- node-sqlite.d.ts only declares the module, so it cannot be imported
/// <reference path="./node-sqlite.d.ts" />
/**
 * Opening scan databases with Node's built-in SQLite. Only for Node-side code (the desktop app's
 * database process, tests): the screens never import this.
 */
import { DatabaseSync } from "node:sqlite";
import { BULK_LOAD_PRAGMAS } from "./write";

export type ScanDb = DatabaseSync;

/** Open an existing scan database for queries. */
export function openScanDb(file: string): ScanDb {
  return new DatabaseSync(file, { readOnly: true });
}

/** A scratch in-memory database (Growth's prepared comparison). */
export function openScratchDb(): ScanDb {
  return new DatabaseSync(":memory:");
}

/** Create a new scan database to import into (the file must not exist yet). */
export function createScanDb(file: string): ScanDb {
  const db = new DatabaseSync(file);
  db.exec(BULK_LOAD_PRAGMAS);
  return db;
}
