/**
 * Stored scans: `<root>/<id>/scan.sqlite` (+ diagnostics.txt), with `<root>/index.json` listing them
 * so the list does not have to open every (100+ MB) scan. No Electron imports, so it is unit-tested.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { cleanSnapshotName, type SnapshotInfo, type SnapshotPatch } from "@scoutreporter/core/desktop/bridge";
import type { ScanMeta } from "@scoutreporter/core/scan/schema";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;

/** The database file in each snapshot folder. */
export const SCAN_FILE = "scan.sqlite";

/**
 * Removing a snapshot folder. Windows cannot delete a scan the database process still has open
 * (loading it into the screens, or comparing it), which takes a second or two: retry meanwhile.
 */
const REMOVE = { recursive: true, force: true, maxRetries: 20, retryDelay: 100 } as const;

/** A snapshot id from its scan time: "2026-11-12T18-00-00Z" (file-name safe, sorts by time). */
export function snapshotId(scannedAt: string, taken: Set<string> = new Set()): string {
  const base = scannedAt.replace(/:/g, "-").replace(/\.\d+/, "");
  let id = ID_PATTERN.test(base) ? base : `scan-${Date.now()}`;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
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
    return join(this.dir(id), SCAN_FILE);
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
   * Move a finished scan database into the store and delete the oldest scans beyond `retention`.
   * Starred scans are never deleted and do not count towards it. Returns the new snapshot and the
   * ids that were deleted.
   */
  async add(
    scanFile: string,
    scan: { meta: ScanMeta; counts: { players: number; staff: number }; bytes?: number },
    retention: number,
    opts: { diagnostics?: string; sample?: boolean } = {},
  ): Promise<{ snapshot: SnapshotInfo; deleted: string[] }> {
    const { meta, counts } = scan;
    const list = await this.list();
    const id = snapshotId(meta.scannedAt, new Set(list.map((s) => s.id)));
    const dir = this.dir(id);
    await mkdir(dir, { recursive: true });
    await rename(scanFile, this.scanFile(id));
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
      ...(scan.bytes !== undefined && { bytes: scan.bytes }),
      ...(meta.searchPlayers ? { searchPlayers: meta.searchPlayers } : {}),
      ...(meta.searchStaff ? { searchStaff: meta.searchStaff } : {}),
      ...(meta.scope === "search" && { scope: "search" as const }),
    };
    const next = [snapshot, ...list].sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
    const deleted: string[] = [];
    let unstarred = 0;
    const keep = next.filter((s) => {
      if (s.favorite) return true;
      if (++unstarred <= Math.max(1, retention)) return true;
      deleted.push(s.id);
      return false;
    });
    for (const old of deleted) await rm(this.dir(old), REMOVE);
    await this.writeIndex(keep);
    return { snapshot, deleted };
  }

  /** Rename or star a stored scan. Returns it as stored. */
  async update(id: string, patch: SnapshotPatch): Promise<SnapshotInfo> {
    const index = await this.readIndex();
    const at = index.findIndex((s) => s.id === id);
    if (at < 0) throw new Error("This scan is no longer stored.");
    const next: SnapshotInfo = { ...index[at] };
    if (patch.name !== undefined) {
      const name = cleanSnapshotName(patch.name);
      if (name) next.name = name;
      else delete next.name;
    }
    if (patch.favorite !== undefined) {
      if (patch.favorite) next.favorite = true;
      else delete next.favorite;
    }
    index[at] = next;
    await this.writeIndex(index);
    return next;
  }

  async delete(id: string): Promise<void> {
    await rm(this.dir(id), REMOVE);
    await this.writeIndex((await this.readIndex()).filter((s) => s.id !== id));
  }
}
