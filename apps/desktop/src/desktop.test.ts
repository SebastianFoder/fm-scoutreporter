import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ReaderOutput } from "./reader";
import { SnapshotStore, readScanMeta, snapshotId } from "./snapshots";

const sampleFile = join(import.meta.dirname, "..", "..", "..", "packages", "core", "fixtures", "scan-sample.json");
const sample = JSON.parse(readFileSync(sampleFile, "utf8"));
const dirs: string[] = [];
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), "sr-desktop-"));
  dirs.push(d);
  return d;
};
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** A scan file as the reader writes it (compact JSON) with a given scan time. */
function writeScan(dir: string, scannedAt: string) {
  const file = join(dir, `scan-${scannedAt.replace(/:/g, "")}.json`);
  writeFileSync(file, JSON.stringify({ ...sample, meta: { ...sample.meta, scannedAt } }));
  return file;
}

test("snapshot ids are file-name safe and unique", () => {
  assert.equal(snapshotId("2026-11-12T18:00:00Z"), "2026-11-12T18-00-00Z");
  assert.equal(snapshotId("2026-11-12T18:00:00Z", new Set(["2026-11-12T18-00-00Z"])), "2026-11-12T18-00-00Z-2");
});

test("reads a scan's meta from the head of the file, compact or pretty", async () => {
  const dir = tempDir();
  const compact = writeScan(dir, "2026-11-12T18:00:00Z");
  assert.equal((await readScanMeta(compact)).myClub, sample.meta.myClub);
  assert.equal((await readScanMeta(sampleFile)).game, "FM27");
  const bad = join(dir, "bad.json");
  writeFileSync(bad, JSON.stringify({ schema: "other", meta: {}, players: [] }));
  await assert.rejects(readScanMeta(bad), /Not a Scout Reporter scan/);
});

test("stores scans newest first and prunes past the retention", async () => {
  const work = tempDir();
  const store = new SnapshotStore(join(work, "scans"));
  const counts = { players: 66, staff: 120 };
  const a = await store.add(writeScan(work, "2026-11-10T10:00:00Z"), counts, 2);
  const b = await store.add(writeScan(work, "2026-11-11T10:00:00Z"), counts, 2);
  assert.deepEqual(a.deleted, []);
  assert.deepEqual(b.deleted, []);
  const c = await store.add(writeScan(work, "2026-11-12T10:00:00Z"), counts, 2);
  assert.deepEqual(c.deleted, [a.snapshot.id]);
  assert.equal(existsSync(store.dir(a.snapshot.id)), false);
  const list = await store.list();
  assert.deepEqual(list.map((s) => s.id), [c.snapshot.id, b.snapshot.id]);
  assert.equal(list[0].players, 66);
  assert.equal(list[0].myClub, sample.meta.myClub);
  assert.equal(JSON.parse(await store.read(b.snapshot.id)).meta.scannedAt, "2026-11-11T10:00:00Z");

  await store.delete(b.snapshot.id);
  assert.deepEqual((await store.list()).map((s) => s.id), [c.snapshot.id]);
});

test("copies the sample instead of moving it", async () => {
  const store = new SnapshotStore(join(tempDir(), "scans"));
  const { snapshot } = await store.add(sampleFile, { players: 1, staff: 1 }, 5, { copy: true, sample: true });
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
