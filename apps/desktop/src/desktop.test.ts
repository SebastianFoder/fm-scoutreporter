import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DEFAULT_LOAD_SCOPE } from "@scoutreporter/core/desktop/bridge";
import { scanToLines } from "@scoutreporter/core/scan/db/write";
import type { ScanFile } from "@scoutreporter/core/scan/schema";
import { compareScanFiles, importJsonFile, importLinesFile, loadScanFile, scanMeta } from "./db-ops";
import { ReaderOutput } from "./reader";
import { SCAN_FILE, SnapshotStore, snapshotId } from "./snapshots";

const sampleFile = join(import.meta.dirname, "..", "..", "..", "packages", "core", "fixtures", "scan-sample.json");
const sample = JSON.parse(readFileSync(sampleFile, "utf8")) as ScanFile;
const dirs: string[] = [];
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), "sr-desktop-"));
  dirs.push(d);
  return d;
};
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** The reader's lines file for the sample, with a given scan time. */
function writeLines(dir: string, scannedAt: string, scan: ScanFile = sample) {
  const file = join(dir, `scan-${scannedAt.replace(/:/g, "")}.ndjson`);
  writeFileSync(file, [...scanToLines({ ...scan, meta: { ...scan.meta, scannedAt } })].join("\n") + "\n");
  return file;
}

/** A scan database built from the sample's lines file, as after a scan. */
async function importedScan(dir: string, scannedAt: string, scan: ScanFile = sample) {
  const target = join(dir, `scan-${scannedAt.replace(/:/g, "")}.sqlite`);
  return { target, ...(await importLinesFile(writeLines(dir, scannedAt, scan), target)) };
}

test("snapshot ids are file-name safe and unique", () => {
  assert.equal(snapshotId("2026-11-12T18:00:00Z"), "2026-11-12T18-00-00Z");
  assert.equal(snapshotId("2026-11-12T18:00:00Z", new Set(["2026-11-12T18-00-00Z"])), "2026-11-12T18-00-00Z-2");
});

test("imports the reader's lines file into a scan database, reporting progress", async () => {
  const dir = tempDir();
  const target = join(dir, "scan.sqlite");
  const progress: number[] = [];
  const result = await importLinesFile(writeLines(dir, "2026-11-12T18:00:00Z"), target, (p) => progress.push(p));
  assert.deepEqual(result.counts, { players: sample.players.length, staff: sample.staff.length });
  assert.equal(result.meta.myClub, sample.meta.myClub);
  assert.ok(result.bytes > 0);
  assert.equal(scanMeta(target).scannedAt, "2026-11-12T18:00:00Z");
  assert.equal(existsSync(`${target}.tmp`), false);
  assert.ok(progress.every((p) => p >= 0 && p <= 1));
});

test("a failed import leaves no database behind", async () => {
  const dir = tempDir();
  const source = join(dir, "broken.ndjson");
  writeFileSync(source, [...scanToLines(sample)].slice(0, 3).join("\n") + "\n{not json\n");
  const target = join(dir, "scan.sqlite");
  await assert.rejects(importLinesFile(source, target), /not valid JSON/);
  assert.equal(existsSync(target), false);
  assert.equal(existsSync(`${target}.tmp`), false);
});

test("imports the bundled sample scan and loads it whole", async () => {
  const target = join(tempDir(), "sample.sqlite");
  const result = await importJsonFile(sampleFile, target);
  assert.equal(result.counts.players, sample.players.length);
  const loaded = loadScanFile(target, DEFAULT_LOAD_SCOPE);
  assert.equal(loaded.players.length, sample.players.length);
  assert.equal(loaded.staff.length, sample.staff.length);
  assert.equal(loaded.totalPlayers, sample.players.length);
  assert.throws(() => loadScanFile(join(tempDir(), "gone.sqlite"), DEFAULT_LOAD_SCOPE), /missing/);
});

test("compares two stored scans either way round", async () => {
  const dir = tempDir();
  const later: ScanFile = {
    ...sample,
    players: sample.players.map((p, i) => (i === 0 ? { ...p, ca: p.ca + 9 } : p)),
  };
  const a = await importedScan(dir, "2026-11-10T10:00:00Z");
  const b = await importedScan(dir, "2026-11-12T10:00:00Z", later);
  for (const [file, other] of [[b.target, a.target], [a.target, b.target]]) {
    const page = compareScanFiles(file, other, { sort: "caChange", dir: "desc", limit: 3 });
    assert.equal(page.total, sample.players.length);
    assert.equal(page.rows[0].player.uid, sample.players[0].uid);
    assert.equal(page.rows[0].caChange, 9);
  }
});

test("stores scans newest first and prunes past the retention", async () => {
  const work = tempDir();
  const store = new SnapshotStore(join(work, "scans"));
  const add = async (at: string) => {
    const scan = await importedScan(work, at);
    return store.add(scan.target, scan, 2);
  };
  const a = await add("2026-11-10T10:00:00Z");
  const b = await add("2026-11-11T10:00:00Z");
  assert.deepEqual(a.deleted, []);
  assert.deepEqual(b.deleted, []);
  const c = await add("2026-11-12T10:00:00Z");
  assert.deepEqual(c.deleted, [a.snapshot.id]);
  assert.equal(existsSync(store.dir(a.snapshot.id)), false);
  const list = await store.list();
  assert.deepEqual(list.map((s) => s.id), [c.snapshot.id, b.snapshot.id]);
  assert.equal(list[0].players, sample.players.length);
  assert.equal(list[0].myClub, sample.meta.myClub);
  assert.ok((list[0].bytes ?? 0) > 0);
  assert.equal(store.scanFile(b.snapshot.id), join(store.dir(b.snapshot.id), SCAN_FILE));
  assert.equal(scanMeta(store.scanFile(b.snapshot.id)).scannedAt, "2026-11-11T10:00:00Z");

  await store.delete(b.snapshot.id);
  assert.deepEqual((await store.list()).map((s) => s.id), [c.snapshot.id]);
});

test("marks the sample scan", async () => {
  const dir = tempDir();
  const store = new SnapshotStore(join(dir, "scans"));
  const target = join(dir, "sample.sqlite");
  const imported = await importJsonFile(sampleFile, target);
  const { snapshot } = await store.add(target, imported, 5, { sample: true });
  assert.equal(snapshot.sample, true);
  assert.ok(existsSync(sampleFile));
});

test("rejects ids that could leave the store", () => {
  const store = new SnapshotStore(tempDir());
  assert.throws(() => store.dir("../../etc"), /Invalid snapshot id/);
  assert.throws(() => store.dir("a/b"), /Invalid snapshot id/);
});

test("follows the reader's JSON lines across chunks", () => {
  const progress: number[] = [];
  const out = new ReaderOutput((p) => progress.push(p.progress));
  out.push('{"type":"progress","phase":"scanning","progress":0.2}\n{"type":"log","mess');
  out.push('age":"hello"}\nnot json\n');
  out.push('{"type":"done","file":"x","players":5,"staff":2,"versionOk":true,"game":"FM27","gameVersion":"27.0.1.0"}');
  const run = out.finish(0);
  assert.deepEqual(progress, [0.2]);
  assert.deepEqual(run.log, ["hello", "not json"]);
  assert.equal(run.done?.players, 5);
  assert.equal(run.error, null);
});

test("reports the reader's error, or a missing result", () => {
  const out = new ReaderOutput();
  out.push('{"type":"error","code":"not-running","message":"Football Manager is not running."}\n');
  assert.equal(out.finish(2).error?.code, "not-running");
  assert.equal(new ReaderOutput().finish(1).error?.code, "failed");
});
