/**
 * Stored scans: `<root>/<id>/scan.json` (+ diagnostics.txt), with `<root>/index.json` listing them so
 * the list does not have to open every (tens of MB) scan. No Electron imports, so it is unit-tested.
 */
import { existsSync } from "node:fs";
import { mkdir, open, readFile, rename, rm, writeFile, copyFile } from "node:fs/promises";
import { join } from "node:path";
import type { SnapshotInfo } from "@scoutreporter/core/desktop/bridge";
import type { ScanMeta } from "@scoutreporter/core/scan/schema";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;

/** A snapshot id from its scan time: "2026-11-12T18-00-00Z" (file-name safe, sorts by time). */
export function snapshotId(scannedAt: string, taken: Set<string> = new Set()): string {
  const base = scannedAt.replace(/:/g, "-").replace(/\.\d+/, "");
  let id = ID_PATTERN.test(base) ? base : `scan-${Date.now()}`;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

/**
 * The `meta` object of a scan file without parsing the whole file: the reader writes `schema`,
 * `schemaVersion` and `meta` before `players`, so the head of the file holds them.
 */
export async function readScanMeta(file: string): Promise<ScanMeta> {
  const handle = await open(file, "r");
  try {
    const buf = Buffer.alloc(64 * 1024);
    const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
    const head = buf.subarray(0, bytesRead).toString("utf8");
    const end = head.search(/,\s*"players"\s*:/);
    if (end < 0) throw new Error("The scan file has no players list.");
    const parsed = JSON.parse(`${head.slice(0, end)}}`) as { schema?: string; meta?: ScanMeta };
    if (parsed.schema !== "scoutreporter-scan" || !parsed.meta) throw new Error("Not a Scout Reporter scan file.");
    return parsed.meta;
  } finally {
    await handle.close();
  }
}

export class SnapshotStore {
  constructor(readonly root: string) {}

  private get indexFile() {
    return join(this.root, "index.json");
  }

  /** The folder of a snapshot. Throws for an id that could escape the store. */
  dir(id: string): string {
    if (!ID_PATTERN.test(id)) throw new Error("Invalid snapshot id.");
    return join(this.root, id);
  }

  scanFile(id: string): string {
    return join(this.dir(id), "scan.json");
  }

  private async readIndex(): Promise<SnapshotInfo[]> {
    try {
      const parsed = JSON.parse(await readFile(this.indexFile, "utf8")) as unknown;
      return Array.isArray(parsed) ? (parsed as SnapshotInfo[]).filter((s) => s && ID_PATTERN.test(s.id)) : [];
    } catch {
      return [];
    }
  }

  private async writeIndex(list: SnapshotInfo[]) {
    await mkdir(this.root, { recursive: true });
    const tmp = `${this.indexFile}.tmp`;
    await writeFile(tmp, JSON.stringify(list, null, 1));
    await rename(tmp, this.indexFile);
  }

  /** Stored scans, newest first (entries whose file is gone are dropped). */
  async list(): Promise<SnapshotInfo[]> {
    const list = (await this.readIndex()).filter((s) => existsSync(this.scanFile(s.id)));
    return list.sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
  }

  /**
   * Move a finished scan into the store and delete the oldest scans beyond `retention`. Returns the
   * new snapshot and the ids that were deleted.
   */
  async add(
    scanFile: string,
    counts: { players: number; staff: number },
    retention: number,
    opts: { diagnostics?: string; sample?: boolean; copy?: boolean } = {},
  ): Promise<{ snapshot: SnapshotInfo; deleted: string[] }> {
    const meta = await readScanMeta(scanFile);
    const list = await this.list();
    const id = snapshotId(meta.scannedAt, new Set(list.map((s) => s.id)));
    const dir = this.dir(id);
    await mkdir(dir, { recursive: true });
    if (opts.copy) await copyFile(scanFile, join(dir, "scan.json"));
    else await rename(scanFile, join(dir, "scan.json"));
    if (opts.diagnostics && existsSync(opts.diagnostics)) await copyFile(opts.diagnostics, join(dir, "diagnostics.txt"));

    const snapshot: SnapshotInfo = {
      id,
      scannedAt: meta.scannedAt,
      gameDate: meta.gameDate,
      game: meta.game,
      gameVersion: meta.gameVersion,
      versionOk: meta.versionOk,
      manager: meta.manager,
      myClub: meta.myClub,
      players: counts.players,
      staff: counts.staff,
      database: meta.database,
      ...(opts.sample && { sample: true }),
    };
    const next = [snapshot, ...list].sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
    const keep = next.slice(0, Math.max(1, retention));
    const deleted = next.slice(keep.length).map((s) => s.id);
    for (const old of deleted) await rm(this.dir(old), { recursive: true, force: true });
    await this.writeIndex(keep);
    return { snapshot, deleted };
  }

  async delete(id: string): Promise<void> {
    await rm(this.dir(id), { recursive: true, force: true });
    await this.writeIndex((await this.readIndex()).filter((s) => s.id !== id));
  }

  async read(id: string): Promise<string> {
    return readFile(this.scanFile(id), "utf8");
  }
}
