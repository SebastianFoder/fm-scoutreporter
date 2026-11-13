import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import {
  importBackendKind,
  loadImport,
  readImport,
  removeImport,
  resetImportStore,
  resetImportStoreToMemory,
  writeImport,
} from "./import-store";

/** A Storage stand-in; `quota` makes setItem throw past that many characters, like a full localStorage. */
class MemoryStorage {
  private map = new Map<string, string>();
  constructor(private quota = Infinity) {}
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (value.length > this.quota) throw new Error("QuotaExceededError");
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

const g = globalThis as unknown as { window?: unknown; indexedDB?: unknown };

function setUp({ withIndexedDb, quota }: { withIndexedDb: boolean; quota?: number }) {
  const localStorage = new MemoryStorage(quota);
  const sessionStorage = new MemoryStorage();
  g.window = { localStorage, sessionStorage };
  if (withIndexedDb) g.indexedDB = new IDBFactory();
  else delete g.indexedDB;
  resetImportStore();
  return { localStorage, sessionStorage };
}

beforeEach(() => setUp({ withIndexedDb: true }));

test("uses IndexedDB when it is available", async () => {
  assert.equal(await importBackendKind(), "indexeddb");
});

test("stores and reads back a value larger than localStorage allows", async () => {
  setUp({ withIndexedDb: true, quota: 10 });
  const big = "x".repeat(10_000);
  assert.equal(await writeImport("importedPlayersCsv", big), true);
  assert.equal(await readImport("importedPlayersCsv"), big);
});

test("stores objects as well as strings", async () => {
  const dump = { players: [{ uid: 1, ca: 150 }] };
  assert.equal(await writeImport("scan", dump), true);
  assert.deepEqual(await readImport("scan"), dump);
});

test("returns null for a missing key and after removal", async () => {
  assert.equal(await readImport("nothing"), null);
  await writeImport("k", "v");
  await removeImport("k");
  assert.equal(await readImport("k"), null);
});

test("moves a localStorage import into IndexedDB on first load", async () => {
  const { localStorage } = setUp({ withIndexedDb: true });
  localStorage.setItem("importedSquadCsv", "csv text");
  assert.equal(await loadImport("importedSquadCsv"), "csv text");
  assert.equal(localStorage.getItem("importedSquadCsv"), null);
  assert.equal(await loadImport("importedSquadCsv"), "csv text");
});

test("moves the old sessionStorage player import too", async () => {
  const { sessionStorage } = setUp({ withIndexedDb: true });
  sessionStorage.setItem("importedPlayersCsv", "old");
  assert.equal(await loadImport("importedPlayersCsv", { legacySessionKey: "importedPlayersCsv" }), "old");
  assert.equal(sessionStorage.getItem("importedPlayersCsv"), null);
  assert.equal(await readImport("importedPlayersCsv"), "old");
});

test("writing removes a stale localStorage copy", async () => {
  const { localStorage } = setUp({ withIndexedDb: true });
  localStorage.setItem("importedStaffCsv", "stale");
  await writeImport("importedStaffCsv", "new");
  assert.equal(localStorage.getItem("importedStaffCsv"), null);
  assert.equal(await loadImport("importedStaffCsv"), "new");
});

test("falls back to localStorage without IndexedDB, keeping legacy values in place", async () => {
  const { localStorage } = setUp({ withIndexedDb: false });
  assert.equal(await importBackendKind(), "localstorage");
  localStorage.setItem("importedStaffCsv", "legacy");
  assert.equal(await loadImport("importedStaffCsv"), "legacy");
  assert.equal(localStorage.getItem("importedStaffCsv"), "legacy");
  assert.equal(await writeImport("importedStaffCsv", "next"), true);
  assert.equal(localStorage.getItem("importedStaffCsv"), "next");
});

test("reports a failed write when the fallback storage is full", async () => {
  setUp({ withIndexedDb: false, quota: 3 });
  assert.equal(await writeImport("importedPlayersCsv", "too long"), false);
});

test("the memory store is per tab and reports writes as not persisted", async () => {
  resetImportStoreToMemory();
  assert.equal(await importBackendKind(), "memory");
  assert.equal(await writeImport("k", "v"), false);
  assert.equal(await readImport("k"), "v");
});
