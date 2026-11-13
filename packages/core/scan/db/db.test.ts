import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DEFAULT_LOAD_SCOPE, type GrowthQuery, type LoadScope } from "../../desktop/bridge";
import { compareScans, filterGrowth, sortGrowth, type GrowthSort } from "../growth";
import { SCAN_SCHEMA_VERSION, type ScanFile, type ScanPlayer } from "../schema";
import { compareScanDbFiles, prepareGrowth, queryGrowth } from "./growth";
import { createScanDb } from "./open";
import { allPlayers, allStaff, assertScanDb, loadScan, readScanMeta, scanDbCounts } from "./read";
import { importScanLines, scanToLines, writeScanFile } from "./write";

const sample = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "..", "fixtures", "scan-sample.json"), "utf8"),
) as ScanFile;
const dir = mkdtempSync(join(tmpdir(), "sr-scan-db-"));
after(() => rmSync(dir, { recursive: true, force: true }));

const byUid = <T extends { uid: number }>(list: T[]) => [...list].sort((a, b) => a.uid - b.uid);

function memoryDb(scan: ScanFile = sample) {
  const db = new DatabaseSync(":memory:");
  writeScanFile(db, scan);
  return db;
}

let fileNo = 0;
function fileDb(scan: ScanFile): string {
  const file = join(dir, `scan-${++fileNo}.sqlite`);
  const db = createScanDb(file);
  writeScanFile(db, scan);
  db.close();
  return file;
}

test("the sample fixture uses the current scan format version", () => {
  assert.equal(sample.schemaVersion, SCAN_SCHEMA_VERSION);
});

test("a scan survives the database unchanged", () => {
  const db = memoryDb();
  assertScanDb(db);
  assert.deepEqual(readScanMeta(db), sample.meta);
  assert.deepEqual(scanDbCounts(db), { players: sample.players.length, staff: sample.staff.length });
  assert.deepEqual(allPlayers(db), byUid(sample.players));
  assert.deepEqual(allStaff(db), byUid(sample.staff));
});

test("keeps optional fields: loans, female players, unknown values, missing positions", () => {
  const p = sample.players[0];
  const odd: ScanPlayer = {
    ...p,
    uid: 1,
    ownerClub: "Parent FC",
    female: true,
    teamType: 12,
    wage: null,
    value: null,
    height: null,
    birthDate: null,
    age: null,
    club: null,
    division: null,
    positions: { GK: 20, SW: 1 },
    transferStatus: { listed: true, loanListed: false, notForSale: true, setForRelease: false },
    personality: { ...p.personality, controversy: null },
    hidden: {},
  };
  const db = memoryDb({ ...sample, players: [odd], staff: [] });
  assert.deepEqual(allPlayers(db), [odd]);
});

test("imports the reader's lines file, the same as an in-memory scan", async () => {
  const db = new DatabaseSync(":memory:");
  let batches = 0;
  const { meta, counts } = await importScanLines(db, scanToLines(sample), () => batches++);
  assert.deepEqual(meta, sample.meta);
  assert.deepEqual(counts, { players: sample.players.length, staff: sample.staff.length });
  assert.deepEqual(allPlayers(db), byUid(sample.players));
  assert.deepEqual(allStaff(db), byUid(sample.staff));
});

test("rejects files that are not scans, and leaves nothing half-written", async () => {
  const lines = [...scanToLines(sample)];
  const fresh = () => new DatabaseSync(":memory:");
  await assert.rejects(importScanLines(fresh(), ['{"schema":"other"}']), /Not a Scout Reporter scan/);
  await assert.rejects(importScanLines(fresh(), [lines[0].replace(`"schemaVersion":${SCAN_SCHEMA_VERSION}`, '"schemaVersion":99')]), /not supported/);
  await assert.rejects(importScanLines(fresh(), []), /empty/);
  const db = fresh();
  await assert.rejects(importScanLines(db, [lines[0], lines[1], "{oops"]), /Line 3 .* not valid JSON/);
  assert.equal(scanDbCounts(db).players, 0);
  assert.throws(() => assertScanDb(new DatabaseSync(":memory:")), /Not a Scout Reporter scan database/);
});

test("a scan that fits under the limits loads whole", () => {
  const loaded = loadScan(memoryDb(), DEFAULT_LOAD_SCOPE);
  assert.equal(loaded.players.length, sample.players.length);
  assert.equal(loaded.staff.length, sample.staff.length);
  assert.equal(loaded.totalPlayers, sample.players.length);
  assert.deepEqual(loaded.meta, sample.meta);
});

test("a big scan loads your club plus the players and staff worth scouting", () => {
  const myClub = sample.meta.myClub!;
  const scope: LoadScope = { minCa: 140, youngMaxAge: 19, youngMinPa: 150, maxPlayers: 60, staffMinCa: 120, maxStaff: 50, onlySearch: false };
  const loaded = loadScan(memoryDb(), scope);

  const expected = sample.players.filter(
    (p) => p.club === myClub || p.ca >= scope.minCa || ((p.age ?? 99) <= scope.youngMaxAge && p.pa >= scope.youngMinPa),
  );
  assert.ok(expected.length < sample.players.length, "the scope should leave some players out");
  assert.ok(expected.length <= scope.maxPlayers);
  assert.deepEqual(byUid(loaded.players), byUid(expected));
  // Your club first, then best CA first.
  const firstOther = loaded.players.findIndex((p) => p.club !== myClub);
  assert.ok(loaded.players.slice(0, firstOther).every((p) => p.club === myClub));
  const others = loaded.players.slice(firstOther).map((p) => p.ca);
  assert.deepEqual(others, [...others].sort((a, b) => b - a));
  assert.equal(loaded.totalPlayers, sample.players.length);

  const staff = sample.staff.filter((s) => s.club === myClub || s.ca >= scope.staffMinCa);
  assert.deepEqual(byUid(loaded.staff), byUid(staff.length > scope.maxStaff ? loaded.staff : staff));
  assert.ok(loaded.staff.length <= scope.maxStaff);

  // The cap wins: your club is kept first.
  const capped = loadScan(memoryDb(), { ...scope, maxPlayers: 10 });
  assert.equal(capped.players.length, 10);
  assert.ok(capped.players.every((p) => p.club === myClub));
});

/** The sample with FM search results: every second player and staff member who is not at your club. */
function searchedScan(): ScanFile {
  const myClub = sample.meta.myClub!;
  let others = 0;
  const players = sample.players.map((p) => (p.club !== myClub && others++ % 2 === 0 ? { ...p, inSearch: true } : p));
  others = 0;
  const staff = sample.staff.map((s) => (s.club !== myClub && others++ % 2 === 0 ? { ...s, inSearch: true } : s));
  return {
    ...sample,
    meta: { ...sample.meta, searchPlayers: players.filter((p) => p.inSearch).length, searchStaff: staff.filter((s) => s.inSearch).length },
    players,
    staff,
  };
}

test("keeps FM's search result and club reputations", () => {
  const scan = searchedScan();
  scan.players = scan.players.map((p) => (p.club ? { ...p, clubReputation: 4000 + p.club.length } : p));
  const db = memoryDb(scan);
  assert.deepEqual(allPlayers(db), byUid(scan.players));
  assert.deepEqual(allStaff(db), byUid(scan.staff));
  assert.ok(scan.meta.searchPlayers! > 0 && scan.meta.searchStaff! > 0);
});

test("can load only the people from FM's search, plus your club", () => {
  const scan = searchedScan();
  const myClub = scan.meta.myClub!;
  const db = memoryDb(scan);
  const off = loadScan(db, DEFAULT_LOAD_SCOPE);
  assert.equal(off.players.length, scan.players.length);
  assert.deepEqual(off.bySearch, { players: false, staff: false });
  assert.equal(off.searchPlayers, scan.meta.searchPlayers);

  const on = loadScan(db, { ...DEFAULT_LOAD_SCOPE, onlySearch: true });
  assert.deepEqual(on.bySearch, { players: true, staff: true });
  assert.deepEqual(byUid(on.players), byUid(scan.players.filter((p) => p.inSearch || p.club === myClub)));
  assert.deepEqual(byUid(on.staff), byUid(scan.staff.filter((s) => s.inSearch || s.club === myClub)));
  assert.ok(on.players.some((p) => p.inSearch) && on.players.some((p) => p.club === myClub && !p.inSearch));

  // A search result over the limit is cut down like a big scan: the CA and PA limits apply inside it.
  const scope: LoadScope = { ...DEFAULT_LOAD_SCOPE, onlySearch: true, maxPlayers: 5, minCa: 150, youngMaxAge: 0, youngMinPa: 200 };
  const cut = loadScan(db, scope);
  assert.ok(cut.players.length <= 5);
  assert.ok(cut.players.every((p) => p.club === myClub || (p.inSearch && p.ca >= 150)));
});

test("a scan without an FM search loads as usual when only the search is wanted", () => {
  const loaded = loadScan(memoryDb(), { ...DEFAULT_LOAD_SCOPE, onlySearch: true });
  assert.equal(loaded.players.length, sample.players.length);
  assert.equal(loaded.staff.length, sample.staff.length);
  assert.deepEqual(loaded.bySearch, { players: false, staff: false });
  assert.equal(loaded.searchPlayers, 0);
});

function laterScan(): ScanFile {
  const players = sample.players.map((p, i) => {
    if (i % 3 !== 0) return p;
    const step = (i % 7) - 2;
    return {
      ...p,
      ca: p.ca + step * 3,
      pa: p.pa + (i % 2),
      age: (p.age ?? 20) + 1,
      attributes: { ...p.attributes, pace: p.attributes.pace + step, finishing: p.attributes.finishing - 1 },
    };
  });
  players.splice(5, 1); // left the database
  players.push({ ...sample.players[1], uid: 999_999_999, name: "Newgen" });
  return {
    ...sample,
    meta: { ...sample.meta, gameDate: "2028-08-14", scannedAt: "2026-12-01T10:00:00Z" },
    players,
  };
}

test("growth in SQL matches the in-memory comparison", () => {
  const later = laterScan();
  const olderFile = fileDb(sample);
  const laterFile = fileDb(later);
  const scratch = new DatabaseSync(":memory:");
  const prepared = prepareGrowth(scratch, laterFile, olderFile);
  assert.equal(prepared.older, olderFile);
  assert.equal(prepared.newer, laterFile);
  const report = compareScans(sample, later);

  const queries: Omit<GrowthQuery, "limit">[] = [
    { sort: "caChange", dir: "desc" },
    { sort: "attributeChange", dir: "asc" },
    { sort: "paChange", dir: "desc", minCaGain: 3 },
    { sort: "ca", dir: "desc", maxAge: 22 },
    { sort: "age", dir: "asc", query: sample.players[3].name.slice(0, 4) },
  ];
  const sortValue = (s: GrowthSort, r: (typeof report.rows)[number]) =>
    s === "caChange" ? r.caChange : s === "attributeChange" ? r.attributeChange : s === "paChange" ? r.paChange : s === "ca" ? r.player.ca : r.player.age;

  for (const q of queries) {
    const expected = sortGrowth(filterGrowth(report.rows, q), q.sort, q.dir);
    const page = queryGrowth(scratch, prepared, { ...q, limit: 1000 });
    assert.equal(page.total, expected.length, JSON.stringify(q));
    assert.equal(page.newPlayers, 1);
    assert.equal(page.days, report.days);
    // Same players with the same changes, in the same sort order (ties may differ).
    const want = new Map(expected.map((r) => [r.player.uid, r]));
    for (const row of page.rows) assert.deepEqual(row, want.get(row.player.uid), `${JSON.stringify(q)} uid ${row.player.uid}`);
    assert.deepEqual(page.rows.map((r) => sortValue(q.sort, r)), expected.map((r) => sortValue(q.sort, r)));
  }

  // Paging.
  const all = queryGrowth(scratch, prepared, { sort: "caChange", dir: "desc", limit: 1000 });
  const second = queryGrowth(scratch, prepared, { sort: "caChange", dir: "desc", limit: 10, offset: 10 });
  assert.deepEqual(second.rows.map((r) => r.player.uid), all.rows.slice(10, 20).map((r) => r.player.uid));
  assert.equal(second.total, all.total);
  // The scan files are not held open between queries (Windows could not delete them).
  rmSync(laterFile);
  assert.throws(() => queryGrowth(scratch, prepared, { sort: "caChange", dir: "desc", limit: 5 }));
  scratch.close();
});

test("growth runs from the earlier scan whichever way round the scans are picked", () => {
  const later = laterScan();
  const page = compareScanDbFiles(new DatabaseSync(":memory:"), fileDb(sample), fileDb(later), { sort: "caChange", dir: "desc", limit: 5 });
  const expected = sortGrowth(compareScans(sample, later).rows, "caChange");
  assert.deepEqual(page.rows.map((r) => r.caChange), expected.slice(0, 5).map((r) => r.caChange));
  assert.equal(page.newPlayers, 1);
});
