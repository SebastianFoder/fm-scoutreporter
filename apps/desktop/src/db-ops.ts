/**
 * The scan database work the app does: import the reader's lines file (or the sample scan) into a
 * new scan.sqlite, load what the screens need, and compare two scans. It runs in its own process
 * (db-process.ts), so a 400,000-player import never blocks the window. No Electron imports, so it is
 * unit-tested.
 */
import { createReadStream, existsSync, rmSync, statSync } from "node:fs";
import { readFile, rename } from "node:fs/promises";
import { createInterface } from "node:readline";
import type { GrowthPage, GrowthQuery, LoadScope, LoadedScan } from "@scoutreporter/core/desktop/bridge";
import { prepareGrowth, queryGrowth, type PreparedGrowth } from "@scoutreporter/core/scan/db/growth";
import { createScanDb, openScanDb, openScratchDb, type ScanDb } from "@scoutreporter/core/scan/db/open";
import { assertScanDb, loadScan, readScanMeta } from "@scoutreporter/core/scan/db/read";
import { importScanLines, writeScanFile, type ScanDbCounts } from "@scoutreporter/core/scan/db/write";
import { assertScanFile, type ScanMeta } from "@scoutreporter/core/scan/schema";

export interface ImportResult {
  meta: ScanMeta;
  counts: ScanDbCounts;
  bytes: number;
}

/** Build `target` through a temp file, so a failed import never leaves a half-written database. */
async function buildDb(target: string, fill: (db: ScanDb) => Promise<{ meta: ScanMeta; counts: ScanDbCounts }>): Promise<ImportResult> {
  const tmp = `${target}.tmp`;
  rmSync(tmp, { force: true });
  const db = createScanDb(tmp);
  let result: { meta: ScanMeta; counts: ScanDbCounts };
  try {
    result = await fill(db);
    db.close();
  } catch (e) {
    db.close();
    rmSync(tmp, { force: true });
    throw e;
  }
  await rename(tmp, target);
  return { ...result, bytes: statSync(target).size };
}

/** Import the reader's lines file (scan.ndjson). `onProgress` gets the share of the file read (0..1). */
export function importLinesFile(source: string, target: string, onProgress: (share: number) => void = () => {}): Promise<ImportResult> {
  const total = statSync(source).size || 1;
  return buildDb(target, async (db) => {
    const stream = createReadStream(source, { highWaterMark: 1 << 20 });
    const lines = createInterface({ input: stream, crlfDelay: Infinity });
    try {
      return await importScanLines(db, lines, () => onProgress(Math.min(1, stream.bytesRead / total)));
    } finally {
      lines.close();
      stream.destroy();
    }
  });
}

/** Import a whole-file JSON scan (the bundled sample scan). */
export function importJsonFile(source: string, target: string): Promise<ImportResult> {
  return buildDb(target, async (db) => {
    const scan: unknown = JSON.parse(await readFile(source, "utf8"));
    assertScanFile(scan);
    return { meta: scan.meta, counts: writeScanFile(db, scan) };
  });
}

function withDb<T>(file: string, fn: (db: ScanDb) => T): T {
  if (!existsSync(file)) throw new Error("This scan's file is missing. It may have been deleted.");
  const db = openScanDb(file);
  try {
    assertScanDb(db);
    return fn(db);
  } finally {
    db.close();
  }
}

export function scanMeta(file: string): ScanMeta {
  return withDb(file, readScanMeta);
}

export function loadScanFile(file: string, scope: LoadScope): LoadedScan {
  return withDb(file, (db) => loadScan(db, scope));
}

/**
 * The last compared pair of scans: joining two full databases takes a couple of seconds, so it is
 * done once per pair, and the Growth screen's filters then query the prepared table.
 */
let growthCache: { key: string; db: ScanDb; prepared: PreparedGrowth } | null = null;

export function compareScanFiles(file: string, otherFile: string, query: GrowthQuery): GrowthPage {
  for (const f of [file, otherFile]) {
    if (!existsSync(f)) throw new Error("A scan's file is missing. It may have been deleted.");
    withDb(f, () => undefined); // a readable scan database of this version
  }
  // Same pair either way round; a changed file (same path, new scan) is a new pair.
  const key = [file, otherFile].map((f) => `${f}@${statSync(f).mtimeMs}`).sort().join("|");
  if (growthCache?.key !== key) {
    growthCache?.db.close();
    growthCache = null;
    const db = openScratchDb();
    try {
      growthCache = { key, db, prepared: prepareGrowth(db, file, otherFile) };
    } catch (e) {
      db.close();
      throw e;
    }
  }
  return queryGrowth(growthCache.db, growthCache.prepared, query);
}

/** The requests db-process.ts answers. */
export type DbRequest =
  | { op: "import-lines"; source: string; target: string }
  | { op: "import-json"; source: string; target: string }
  | { op: "load"; file: string; scope: LoadScope }
  | { op: "compare"; file: string; otherFile: string; query: GrowthQuery };

export async function handleDbRequest(req: DbRequest, onProgress: (share: number) => void): Promise<unknown> {
  switch (req.op) {
    case "import-lines":
      return importLinesFile(req.source, req.target, onProgress);
    case "import-json":
      return importJsonFile(req.source, req.target);
    case "load":
      return loadScanFile(req.file, req.scope);
    case "compare":
      return compareScanFiles(req.file, req.otherFile, req.query);
  }
}
