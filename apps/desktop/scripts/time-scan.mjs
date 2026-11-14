/**
 * Times scans in the desktop app with Football Manager running: clicks "Scan search" and measures until
 * the scan has finished and until the screen shows the players, like a user pressing F9 and
 * waiting. Prints the reader's steps and the app's own reader/import times for each run. Uses a
 * throwaway profile, so the app's settings apply (by default a search scan: FM's Player Search must
 * be on screen). See reader/PERFORMANCE.md.
 *
 *   node apps/desktop/scripts/time-scan.mjs [--runs 3] [--exe <Scout Reporter.exe>]
 *
 * Without --exe it runs the unpackaged app (node apps/desktop/scripts/build.mjs all, then
 * build.mjs electron), which uses reader/dist/ScoutReporter.Reader.exe.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
};
const runs = Math.max(1, Number(arg("--runs") ?? 3) || 3);
const debugPort = 9334;
const profile = mkdtempSync(join(tmpdir(), "sr-time-scan-"));
const appArgs = [`--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`];
const app = arg("--exe")
  ? spawn(arg("--exe"), appArgs, { stdio: "ignore" })
  : spawn(createRequire(join(desktopDir, "package.json"))("electron"), [desktopDir, ...appArgs], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function finish(code) {
  app.kill();
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    // the app may still hold files for a moment
  }
  process.exit(code);
}

let target;
for (let i = 0; i < 120 && !target; i++) {
  await sleep(500);
  try {
    const list = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
    target = list.find((t) => t.type === "page" && t.url.includes("/desktop"));
  } catch {
    // not up yet
  }
}
if (!target) {
  console.error("The app window did not appear.");
  finish(1);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let nextId = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const id = ++nextId;
    pending.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) =>
  (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

const scanButton = `[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Scan search")`;
for (let i = 0; i < 120 && !(await evaluate(`!!${scanButton}`)); i++) await sleep(250);

// In the page: click Scan search, note when the scan finishes, then when the header shows the players.
const oneScan = `new Promise((resolve) => {
  const t0 = performance.now();
  let finished = null, outcome = null;
  const off = window.scoutReporterDesktop.onScanFinished((o) => { finished = performance.now() - t0; outcome = o; off(); });
  ${scanButton}.click();
  const poll = () => {
    const text = document.body.innerText;
    const shown = finished !== null && /[\\d,.]+ players/.test(text) && !/Scanning \\d+%/.test(text);
    if (finished !== null && (shown || !outcome?.ok)) {
      return resolve({ ok: !!outcome?.ok, message: outcome?.message, finishedMs: Math.round(finished),
        shownMs: Math.round(performance.now() - t0), players: (text.match(/([\\d,.]+) players/) ?? [])[1],
        log: (outcome?.log ?? []).filter((l) => /^(App|Steps):/.test(l)) });
    }
    if (performance.now() - t0 > 180000) return resolve({ ok: false, message: "timed out" });
    setTimeout(poll, 20);
  };
  poll();
})`;

let failed = false;
for (let run = 1; run <= runs; run++) {
  const r = await evaluate(oneScan);
  if (!r?.ok) {
    console.log(`Run ${run}: the scan failed: ${r?.message ?? "no answer"}`);
    failed = true;
    break;
  }
  console.log(`Run ${run}: scan finished after ${r.finishedMs} ms, ${r.players} players on screen after ${r.shownMs} ms`);
  for (const line of r.log) console.log(`  ${line}`);
  await sleep(1000);
}
ws.close();
finish(failed ? 1 : 0);
