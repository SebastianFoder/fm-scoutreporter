/**
 * Scout Reporter desktop: the website's screens in a window, plus scanning Football Manager's
 * database with the reader (reader/, ScoutReporter.Reader.exe). Windows only for now.
 *
 * Layout of the installed app's resources folder:
 *   web/        Next.js standalone server (apps/web built with SCOUTREPORTER_TARGET=desktop)
 *   reader/     ScoutReporter.Reader.exe
 *   sample/     scan-sample.json (the "Load sample scan" button)
 * User data (%APPDATA%/Scout Reporter): settings.json, scans/<id>/scan.sqlite, scans/latest (work dir).
 *
 * A scan: the reader writes scans/latest/scan.ndjson (one JSON object per line), the database process
 * (db-process.ts) imports it into a new scan.sqlite, and the store keeps it. By default a scan keeps
 * only FM's search result and your club (settings.scanMode "search"), which the screens load whole;
 * a whole-save scan ("full") is loaded in part (settings.load). Growth compares two scans in SQL.
 */
import { app, BrowserWindow, globalShortcut, ipcMain, net, session, shell, Menu, type IpcMainInvokeEvent } from "electron";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  IPC,
  loadScopeFor,
  normaliseSettings,
  type DesktopSettings,
  type GrowthPage,
  type GrowthQuery,
  type LoadedScan,
  type ScanOutcome,
  type ScanProgress,
  type UpdateState,
} from "@scoutreporter/core/desktop/bridge";
import { compareVersions } from "@scoutreporter/core/desktop/releases";
import type { GrowthSort } from "@scoutreporter/core/scan/growth";
import { DbClient } from "./db-client";
import type { ImportResult } from "./db-ops";
import { runReader } from "./reader";
import { SnapshotStore } from "./snapshots";
import { startWebServer, type WebServer } from "./server";
import { APP_ORIGIN, registerAppScheme, serveAppScheme } from "./app-origin";
import { downloadInstaller, findLatestRelease, startInstaller } from "./update";

const isDev = !app.isPackaged;
// The app folder (apps/desktop in development, resources/app.asar when installed). Not __dirname:
// the bundler bakes that in at build time.
const appRoot = app.getAppPath();
const repoRoot = join(appRoot, "..", "..");
const resources = isDev ? null : process.resourcesPath;

const paths = {
  web: resources ? join(resources, "web") : join(repoRoot, "apps", "web", ".next-desktop", "standalone"),
  reader: resources
    ? join(resources, "reader", "ScoutReporter.Reader.exe")
    : join(repoRoot, "reader", "dist", "ScoutReporter.Reader.exe"),
  sample: resources
    ? join(resources, "sample", "scan-sample.json")
    : join(repoRoot, "packages", "core", "fixtures", "scan-sample.json"),
  preload: join(appRoot, "dist", "preload.js"),
  dbProcess: join(appRoot, "dist", "db-process.js"),
};

// `--user-data-dir=<folder>` keeps settings, scans and the browser profile there instead of
// %APPDATA%\Scout Reporter (the smoke test runs with a throwaway folder).
const customUserData = process.argv.find((a) => a.startsWith("--user-data-dir="))?.slice("--user-data-dir=".length);
if (customUserData) app.setPath("userData", customUserData);

const userData = () => app.getPath("userData");
const store = () => new SnapshotStore(join(userData(), "scans"));
const settingsFile = () => join(userData(), "settings.json");

let settings: DesktopSettings = normaliseSettings({});
let server: WebServer | null = null;
/**
 * Where the window shows the pages: scoutreporter://app (app-origin.ts), the same on every start so
 * what the pages store survives restarts and updates. In development, next dev's own fixed address.
 */
let pageOrigin = "";
let win: BrowserWindow | null = null;

// Has to happen before the app is ready.
registerAppScheme();
let scanning: Promise<ScanOutcome> | null = null;
const db = new DbClient(paths.dbProcess);

/** Share of the progress bar for reading FM; importing into the database takes the rest. */
const READ_SHARE = 0.7;

async function loadSettings() {
  try {
    settings = normaliseSettings(JSON.parse(await readFile(settingsFile(), "utf8")));
  } catch {
    settings = normaliseSettings({});
  }
}

async function saveSettings(patch: unknown) {
  const p = (patch && typeof patch === "object" ? patch : {}) as Partial<DesktopSettings>;
  settings = normaliseSettings({ ...settings, ...p, load: { ...settings.load, ...(p.load ?? {}) } });
  await mkdir(userData(), { recursive: true });
  await writeFile(settingsFile(), JSON.stringify(settings, null, 2));
  applyHotkey();
  applyUpdateChecks();
  return settings;
}

// ---------- updates ----------

/** How often the app asks GitHub for a newer version while it runs. */
const UPDATE_CHECK_MS = 6 * 60 * 60 * 1000;
/** Installers are downloaded here; the folder is cleared on the next start. */
const updateDir = () => join(app.getPath("temp"), "scout-reporter-update");

let update: UpdateState = {
  current: app.getVersion(),
  latest: null,
  available: false,
  checkedAt: null,
  checking: false,
  error: null,
  install: null,
};
let updateTimer: ReturnType<typeof setInterval> | null = null;

function setUpdate(patch: Partial<UpdateState>) {
  update = { ...update, ...patch };
  send(IPC.updateState, update);
}

/** Ask GitHub for the newest desktop release. Only the request itself is sent: no data about you. */
async function checkForUpdate(): Promise<UpdateState> {
  if (update.checking || update.install) return update;
  setUpdate({ checking: true, error: null });
  try {
    const latest = await findLatestRelease((url, init) => net.fetch(url, init), `ScoutReporter-Desktop/${update.current}`);
    setUpdate({
      latest,
      available: !!latest && compareVersions(latest.version, update.current) > 0,
      checkedAt: new Date().toISOString(),
      checking: false,
    });
  } catch (e) {
    setUpdate({ checking: false, checkedAt: new Date().toISOString(), error: `Could not check for updates: ${(e as Error).message}` });
  }
  return update;
}

/** Check soon after start and every few hours, while the setting is on. */
function applyUpdateChecks(firstDelayMs = 0) {
  if (!settings.checkUpdates) {
    if (updateTimer) clearInterval(updateTimer);
    updateTimer = null;
    return;
  }
  if (updateTimer) return;
  updateTimer = setInterval(() => void checkForUpdate(), UPDATE_CHECK_MS);
  setTimeout(() => void checkForUpdate(), firstDelayMs);
}

/**
 * Download the newest version, check it, and run its installer silently; the app closes so the
 * installer can replace it, and the installer starts it again. Your data is not touched.
 */
async function installUpdate(): Promise<UpdateState> {
  if (update.install) return update;
  if (!app.isPackaged) {
    setUpdate({ error: "Updates install only in the installed app." });
    return update;
  }
  if (scanning) {
    setUpdate({ error: "A scan is running. Update when it has finished." });
    return update;
  }
  if (!update.available) await checkForUpdate();
  const latest = update.latest;
  if (!latest || !update.available) return update;
  let lastSent = 0;
  try {
    setUpdate({ install: { phase: "downloading", progress: 0 }, error: null });
    const file = await downloadInstaller(latest, updateDir(), (url, init) => net.fetch(url, init), (share) => {
      const now = Date.now();
      if (now - lastSent < 250 && share < 1) return;
      lastSent = now;
      setUpdate({ install: { phase: share < 1 ? "downloading" : "verifying", progress: share } });
    });
    setUpdate({ install: { phase: "starting", progress: 1 } });
    startInstaller(file);
    // Give the installer a moment to start, then close so it can replace the program files.
    setTimeout(() => app.quit(), 1000);
  } catch (e) {
    setUpdate({ install: null, error: `The update could not be installed: ${(e as Error).message}.` });
  }
  return update;
}

/** F9 scans from anywhere while the app runs (it is a global shortcut, so other apps lose F9 meanwhile). */
function applyHotkey() {
  globalShortcut.unregister("F9");
  if (settings.hotkey) globalShortcut.register("F9", () => void scan());
}

function send(channel: string, value: unknown) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, value);
}

/** One scan at a time; a second request (button and F9 together) joins the running one. */
function scan(): Promise<ScanOutcome> {
  scanning ??= doScan().finally(() => {
    scanning = null;
  });
  return scanning;
}

async function doScan(): Promise<ScanOutcome> {
  let outcome: ScanOutcome;
  if (!existsSync(paths.reader)) {
    outcome = {
      ok: false,
      code: "missing-reader",
      message: isDev ? "The reader is not built yet: run bun run reader:build." : "The reader is missing. Reinstall Scout Reporter.",
      log: [],
    };
  } else {
    const workDir = join(userData(), "scans", "latest");
    await mkdir(workDir, { recursive: true });
    // With a real scan stored already, a thinned-out scan is refused rather than stored.
    const previousExists = (await store().list()).some((s) => !s.sample);
    const started = performance.now();
    const run = await runReader(
      paths.reader,
      workDir,
      settings.database,
      (p: ScanProgress) => send(IPC.scanProgress, { phase: p.phase, progress: p.progress * READ_SHARE }),
      [...(settings.scanMode === "search" ? ["--only-search"] : []), ...(previousExists ? ["--previous-exists"] : [])],
    );
    const readerMs = performance.now() - started;
    if (run.done) {
      const target = join(workDir, "scan.sqlite");
      try {
        send(IPC.scanProgress, { phase: "importing", progress: READ_SHARE });
        const importStarted = performance.now();
        const imported = await db.request<ImportResult>({ op: "import-lines", source: run.done.file, target }, (share) =>
          send(IPC.scanProgress, { phase: "importing", progress: READ_SHARE + share * (1 - READ_SHARE) }),
        );
        // How long the app's part took, next to the reader's own steps in diagnostics.txt.
        const timing = `App: reader ${ms(readerMs)} (start to finish), import ${ms(performance.now() - importStarted)}`;
        const diagnostics = join(workDir, "diagnostics.txt");
        await appendFile(diagnostics, `
${timing}
`).catch(() => {});
        const { snapshot } = await store().add(target, imported, settings.retention, { diagnostics });
        // The lines file is several times bigger than the database: drop it once imported.
        await rm(run.done.file, { force: true });
        outcome = { ok: true, snapshot, log: [...run.log, `${timing}, total ${ms(performance.now() - started)}`] };
      } catch (e) {
        outcome = { ok: false, code: "failed", message: `The scan could not be stored: ${(e as Error).message}`, log: run.log };
      }
    } else {
      const error = run.error ?? { code: "failed", message: "The scan failed." };
      outcome = { ok: false, code: error.code, message: error.message, log: run.log };
    }
  }
  send(IPC.scanFinished, outcome);
  return outcome;
}

async function loadSample(): Promise<ScanOutcome> {
  let outcome: ScanOutcome;
  try {
    const workDir = join(userData(), "scans", "latest");
    await mkdir(workDir, { recursive: true });
    const target = join(workDir, "sample.sqlite");
    const imported = await db.request<ImportResult>({ op: "import-json", source: paths.sample, target });
    const { snapshot } = await store().add(target, imported, settings.retention, { sample: true });
    outcome = { ok: true, snapshot, log: ["Loaded the sample scan."] };
  } catch (e) {
    outcome = { ok: false, code: "failed", message: `The sample scan could not be loaded: ${(e as Error).message}`, log: [] };
  }
  send(IPC.scanFinished, outcome);
  return outcome;
}

/** "1.23 s" or "456 ms". */
function ms(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(2)} s` : `${Math.round(n)} ms`;
}

const GROWTH_SORTS: GrowthSort[] = ["caChange", "attributeChange", "paChange", "ca", "age", "name"];

/** A Growth query from the page, with only known fields and sane numbers. */
function growthQuery(value: unknown): GrowthQuery {
  const v = (value && typeof value === "object" ? value : {}) as Partial<GrowthQuery>;
  const int = (n: unknown, min: number, max: number) => {
    const x = Number(n);
    return n === undefined || n === null || n === "" || !Number.isFinite(x) ? undefined : Math.min(max, Math.max(min, Math.round(x)));
  };
  return {
    minCaGain: int(v.minCaGain, -200, 200),
    maxAge: int(v.maxAge, 0, 100),
    query: typeof v.query === "string" ? v.query.slice(0, 100) : undefined,
    sort: GROWTH_SORTS.includes(v.sort as GrowthSort) ? (v.sort as GrowthSort) : "caChange",
    dir: v.dir === "asc" ? "asc" : "desc",
    offset: int(v.offset, 0, 1_000_000) ?? 0,
    limit: int(v.limit, 1, 1000) ?? 100,
  };
}

/** Only our own pages may use the bridge. */
function fromApp(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url ?? "";
  return !!pageOrigin && url.startsWith(`${pageOrigin}/`);
}

function handle(channel: string, fn: (...args: unknown[]) => unknown) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!fromApp(event)) throw new Error("Not allowed.");
    return fn(...args);
  });
}

function registerIpc() {
  handle(IPC.scan, () => scan());
  handle(IPC.listSnapshots, () => store().list());
  handle(IPC.loadSnapshot, async (id) => {
    const started = performance.now();
    const loaded = await db.request<LoadedScan>({ op: "load", file: store().scanFile(String(id)), scope: loadScopeFor(settings) });
    console.info(`Loaded scan ${String(id)} in ${ms(performance.now() - started)}`);
    return loaded;
  });
  handle(IPC.compareSnapshots, (fromId, toId, query) =>
    db.request<GrowthPage>({
      op: "compare",
      file: store().scanFile(String(toId)),
      otherFile: store().scanFile(String(fromId)),
      query: growthQuery(query),
    }),
  );
  handle(IPC.deleteSnapshot, (id) => store().delete(String(id)));
  handle(IPC.loadSample, () => loadSample());
  handle(IPC.getSettings, () => settings);
  handle(IPC.setSettings, (patch) => saveSettings(patch));
  handle(IPC.getUpdateState, () => update);
  handle(IPC.checkForUpdate, () => checkForUpdate());
  handle(IPC.installUpdate, () => installUpdate());
  handle(IPC.openDataFolder, async () => {
    const dir = join(userData(), "scans");
    await mkdir(dir, { recursive: true });
    await shell.openPath(dir);
  });
}

/** Content Security Policy for our pages. Next's inline bootstrap scripts need 'unsafe-inline'; dev also needs eval. */
function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** Development: the policy on next dev's responses (the installed app sets it in serveAppScheme). */
function applyCsp(origin: string) {
  const csp = contentSecurityPolicy();
  session.defaultSession.webRequest.onHeadersReceived({ urls: [`${origin}/*`] }, (details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [csp] } });
  });
}

async function createWindow() {
  if (!pageOrigin) return;
  const origin = pageOrigin;
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: "Scout Reporter",
    backgroundColor: "#162232",
    autoHideMenuBar: true,
    // Installed, the window takes the exe's icon (build/icon.ico); in development the exe is
    // Electron's own, so set ours.
    ...(isDev && { icon: join(appRoot, "build", "icon.png") }),
    webPreferences: {
      preload: paths.preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      additionalArguments: [`--sr-version=${app.getVersion()}`],
    },
  });
  // Stay on our pages; everything else (FAQ links, GitHub) opens in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${origin}/`) && url !== origin) {
      event.preventDefault();
      if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    }
  });
  win.on("closed", () => {
    win = null;
  });
  await win.loadURL(`${origin}/desktop`);
}

async function main() {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.on("window-all-closed", () => app.quit());
  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
    server?.stop();
    db.stop();
  });

  // The same id as the installer's shortcuts (electron-builder.yml appId), so Windows groups the
  // window under the Scout Reporter shortcut and its icon on the taskbar.
  app.setAppUserModelId("com.sebastianfoder.scoutreporter");
  await app.whenReady();
  if (!isDev) Menu.setApplicationMenu(null);
  await loadSettings();
  registerIpc();
  try {
    server = await startWebServer(paths.web);
  } catch (e) {
    const { dialog } = await import("electron");
    dialog.showErrorBox("Scout Reporter", (e as Error).message);
    app.quit();
    return;
  }
  if (process.env.SR_DEV_URL) {
    // next dev runs on a fixed port, and its hot reload needs a websocket to it: load it directly.
    pageOrigin = server.origin;
    applyCsp(server.origin);
  } else {
    pageOrigin = APP_ORIGIN;
    serveAppScheme(server.origin, contentSecurityPolicy());
  }
  applyHotkey();
  // An installer left from the last update has done its work.
  void rm(updateDir(), { recursive: true, force: true }).catch(() => {});
  await createWindow();
  applyUpdateChecks(10_000);
}

void main();
