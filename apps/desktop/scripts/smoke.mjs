/**
 * End-to-end smoke test of the built desktop app (release/win-unpacked), without Football Manager:
 * starts the app with a throwaway profile, then drives the page over the Chrome DevTools protocol.
 * Checks the bridge exists, a scan without FM fails cleanly, the sample scan is stored as a SQLite
 * scan database and loads into every screen, and Growth compares two scans.
 *
 * With Football Manager running, the scan step scans the real game instead: first with the default
 * setting (FM's search and your club; refused with an explanation when FM has no search result),
 * then the whole save. It checks the scans were read and stored, deletes them, and carries on with
 * the sample scans.
 *
 *   node apps/desktop/scripts/smoke.mjs [path to Scout Reporter.exe]
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const exe = process.argv[2] ?? join(desktopDir, "release", "win-unpacked", "Scout Reporter.exe");
const profile = mkdtempSync(join(tmpdir(), "sr-smoke-"));
const debugPort = 9333;
const sampleFile = join(desktopDir, "..", "..", "packages", "core", "fixtures", "scan-sample.json");
const sample = JSON.parse(readFileSync(sampleFile, "utf8"));
const samplePlayer = sample.players[0];

const app = spawn(exe, [`--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
  if (!ok) failures++;
}

async function pageSocket() {
  for (let i = 0; i < 60; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
      const page = targets.find((t) => t.type === "page" && t.url.includes("/desktop"));
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // not up yet
    }
    await sleep(500);
  }
  throw new Error("The app's window did not open.");
}

function cdp(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };
  const ready = new Promise((r) => (ws.onopen = r));
  return {
    ready,
    close: () => ws.close(),
    async eval(expression) {
      const n = ++id;
      const res = new Promise((r) => pending.set(n, r));
      ws.send(JSON.stringify({ id: n, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
      const msg = await res;
      if (msg.result?.exceptionDetails) throw new Error(msg.result.exceptionDetails.exception?.description ?? "evaluation failed");
      return msg.result?.result?.value;
    },
  };
}

async function waitFor(page, expression, timeoutMs = 20_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await page.eval(expression).catch(() => false)) return true;
    await sleep(250);
  }
  return false;
}

/** The header and the start of the page, to show what the page looked like when a check failed. */
const pageText = (page) =>
  page
    .eval("`${location.pathname} | header: ${document.querySelector('header')?.innerText ?? ''} | main: ${document.querySelector('main')?.innerText ?? ''}`.replace(/\\s+/g, ' ').slice(0, 600)")
    .catch((e) => `page unreachable (${e.message})`);

/** True when the player list's table has a column headed `name`. */
const listColumn = (name) => `[...document.querySelectorAll("main th")].some((th) => th.innerText.includes(${JSON.stringify(name)}))`;

/** Open a page and wait until it is the one showing: setting location.href only starts the load. */
const navigate = async (page, path) => {
  const url = `new URL(${JSON.stringify(path)}, location.origin).href`;
  await page.eval(`(location.href = ${url}, true)`);
  await waitFor(page, `location.href === ${url} && document.readyState === "complete"`);
};

try {
  const page = cdp(await pageSocket());
  await page.ready;
  // The window's target can show up while it still holds the first blank page (no preload there),
  // so wait until /desktop itself has loaded before checking anything.
  await waitFor(page, "location.pathname.startsWith('/desktop') && document.readyState === 'complete'");

  check(
    "preload bridge is exposed",
    await waitFor(page, "typeof window.scoutReporterDesktop === 'object'", 10_000),
    await page.eval("location.href").catch(() => "page unreachable"),
  );
  check("Node is not exposed to the page", (await page.eval("typeof require === 'undefined' && typeof process === 'undefined'")) === true);
  // The bundled fonts come through the scoutreporter:// handler; when they fail, the window quietly
  // falls back to a system font with faked bold.
  const fonts = "[...document.fonts].map((f) => `${f.family} ${f.status}`)";
  const fontsOk = await waitFor(
    page,
    "document.fonts.ready.then(() => [...document.fonts].some((f) => f.family === 'Sofia Sans' && f.status === 'loaded') && ![...document.fonts].some((f) => f.status === 'error'))",
  );
  check("the bundled fonts load", fontsOk, fontsOk ? "" : JSON.stringify(await page.eval(fonts)));

  // Scan search (also F9) keeps only FM's search and your club.
  const firstScan = await page.eval("window.scoutReporterDesktop.scan('search')");
  const fmRunning = firstScan?.ok === true || firstScan?.code === "no-search";
  if (firstScan?.ok) {
    // FM is running with a search result: the app took that search.
    const live = firstScan.snapshot;
    const found = (live.searchPlayers ?? 0) + (live.searchStaff ?? 0);
    check(
      "FM is running: the scan keeps FM's search and your club",
      live.scope === "search" && found > 0 && live.players + live.staff >= found && existsSync(join(profile, "scans", live.id, "scan.sqlite")),
      `FM search ${live.searchPlayers ?? 0} players and ${live.searchStaff ?? 0} staff; kept ${live.players} players, ${live.staff} staff, ${Math.round((live.bytes ?? 0) / 1e6)} MB`,
    );
    await page.eval(`window.scoutReporterDesktop.deleteSnapshot(${JSON.stringify(live.id)})`);
  } else if (fmRunning) {
    check("FM is running without a search: the scan is refused with an explanation", typeof firstScan.message === "string" && firstScan.message.includes("Player Search"), firstScan.message);
  } else {
    check("scanning without FM fails cleanly", firstScan && firstScan.ok === false && typeof firstScan.message === "string", firstScan?.code);
  }
  if (fmRunning) {
    // Scan save: the whole save.
    const whole = await page.eval("window.scoutReporterDesktop.scan('full')");
    check(
      "FM is running: a whole-save scan is read and stored as a scan database",
      whole?.ok === true && whole.snapshot.scope !== "search" && whole.snapshot.players > 1000 && existsSync(join(profile, "scans", whole.snapshot.id, "scan.sqlite")),
      whole?.ok ? `${whole.snapshot.players} players, ${whole.snapshot.staff} staff, ${Math.round((whole.snapshot.bytes ?? 0) / 1e6)} MB` : whole?.message,
    );
    if (whole?.ok) await page.eval(`window.scoutReporterDesktop.deleteSnapshot(${JSON.stringify(whole.snapshot.id)})`);
  }

  const stored = await page.eval("window.scoutReporterDesktop.loadSampleScan()");
  check(
    "sample scan is stored as a scan database",
    stored?.ok === true && existsSync(join(profile, "scans", stored.snapshot.id, "scan.sqlite")) && stored.snapshot.bytes > 0,
    stored?.snapshot?.id ?? stored?.message,
  );
  check(
    "sample scan loads into the app",
    await waitFor(page, "document.body.innerText.includes('66 players scanned')"),
  );

  // Rename and star a scan: stored in the index, and shown on the Scans page.
  const renamed = await page.eval(
    `window.scoutReporterDesktop.updateSnapshot(${JSON.stringify(stored?.snapshot?.id)}, { name: "Smoke test scan", favorite: true })`,
  );
  await navigate(page, "/desktop");
  const shown = await waitFor(
    page,
    "[...document.querySelectorAll('main li')].some((li) => li.innerText.includes('Smoke test scan') && li.querySelector('button[aria-pressed=true]'))",
  );
  check("a stored scan can be renamed and starred", renamed?.name === "Smoke test scan" && renamed?.favorite === true && shown, JSON.stringify(renamed));

  await navigate(page, "/players");
  // The Potential column only appears when the import has CA and PA.
  check("player list scores scanned players, with CA/PA", await waitFor(page, `${listColumn("vs Age")} && ${listColumn("Potential")}`));

  // "Show my players": your club's players (the squad from the scan) can be hidden from the list.
  const clubPlayers = sample.players.filter((p) => p.club === sample.meta.myClub).length;
  const toggle = `[...document.querySelectorAll("main label")].find((l) => l.innerText.includes("Show my players (${clubPlayers})"))?.querySelector("input")`;
  const toggleShown = await waitFor(page, `!!${toggle}`);
  if (toggleShown) await page.eval(`(${toggle}.click(), true)`);
  const hidesMine = toggleShown && (await waitFor(page, `document.querySelector("main").innerText.includes("of ${sample.players.length - clubPlayers}")`));
  if (toggleShown) await page.eval(`(${toggle}.click(), true)`);
  const showsAgain = hidesMine && (await waitFor(page, `document.querySelector("main").innerText.includes("of ${sample.players.length}")`));
  check("the player list can hide your own players", showsAgain, toggleShown ? "" : await pageText(page));

  await navigate(page, `/players/${samplePlayer.uid}`);
  check(
    "player profile opens from the scan",
    await waitFor(page, `document.querySelector('main').innerText.includes(${JSON.stringify(samplePlayer.name)}) && document.querySelector('main').innerText.includes("Current ability")`),
  );

  await navigate(page, "/staff");
  check("staff screen shows scanned staff", await waitFor(page, "document.body.innerText.includes('120 staff')"));

  await page.eval("window.scoutReporterDesktop.loadSampleScan()");
  await navigate(page, "/growth");
  check("Growth compares two scans", await waitFor(page, "document.body.innerText.includes('66 players') && document.querySelectorAll('tbody tr').length > 0"));

  const list = await page.eval("window.scoutReporterDesktop.listSnapshots()");
  check("two snapshots stored", Array.isArray(list) && list.length === 2);

  await navigate(page, "/squad");
  const clubSize = sample.players.filter((p) => p.club === sample.meta.myClub).length;
  check("Squad uses the scanned club's players", await waitFor(page, `document.querySelector('main').innerText.includes(${JSON.stringify(sample.players.find((p) => p.club === sample.meta.myClub).name)})`), `${clubSize} players`);

  // Hide hidden attributes: reload the scan, then the player list has no Potential column.
  await page.eval("window.scoutReporterDesktop.setSettings({ hideHidden: true })");
  await navigate(page, "/desktop");
  const useButton = "[...document.querySelectorAll('li')].filter((li) => li.innerText.includes('Sample scan')).flatMap((li) => [...li.querySelectorAll('button')]).find((b) => b.textContent.trim() === 'Use' && !b.disabled)";
  await waitFor(page, `!!${useButton}`);
  // Mark the scan's row, press Use, and wait until the row says "In use" (set once loading is done).
  await page.eval(`(() => { const b = ${useButton}; b.closest('li').dataset.smoke = 'use'; b.click(); return true; })()`);
  const inUse = await waitFor(page, "document.querySelector('[data-smoke=use]')?.innerText.includes('In use')");
  await navigate(page, "/players");
  const hidden = inUse && (await waitFor(page, `${listColumn("vs Age")} && !${listColumn("Potential")}`));
  check("hiding hidden attributes removes CA/PA", hidden, hidden ? "" : inUse ? await pageText(page) : "the scan never showed as in use");

  // The app has no CSV import panel: its data comes from scanning FM.
  const withImport = [];
  for (const path of ["/players", "/players/best-xi", "/squad", "/staff", "/staff/backroom"]) {
    await navigate(page, path);
    await waitFor(page, "!!document.querySelector('main h1')");
    const shown = await page.eval(
      "!!document.querySelector('section[aria-label=Import]') || [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Load test data'))",
    );
    if (shown) withImport.push(path);
  }
  check("no CSV import panel in the app", withImport.length === 0, withImport.join(", "));
  page.close();
} catch (e) {
  check("smoke test ran", false, e.message);
} finally {
  app.kill();
  await sleep(1000);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    // files still locked; the OS cleans the temp folder
  }
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
