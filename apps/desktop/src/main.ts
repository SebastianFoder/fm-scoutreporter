/**
 * Scout Reporter desktop: the website's screens in a window, plus scanning Football Manager's
 * database with the reader (reader/, ScoutReporter.Reader.exe). Windows only for now.
 *
 * Layout of the installed app's resources folder:
 *   web/        Next.js standalone server (apps/web built with SCOUTREPORTER_TARGET=desktop)
 *   reader/     ScoutReporter.Reader.exe
 *   sample/     scan-sample.json (the "Load sample scan" button)
 * User data (%APPDATA%/Scout Reporter): settings.json, scans/<id>/scan.json, scans/latest (work dir).
 */
import { app, BrowserWindow, globalShortcut, ipcMain, session, shell, Menu, type IpcMainInvokeEvent } from "electron";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  IPC,
  normaliseSettings,
  type DesktopSettings,
  type ScanOutcome,
  type ScanProgress,
} from "@scoutreporter/core/desktop/bridge";
import { runReader } from "./reader";
import { SnapshotStore } from "./snapshots";
import { startWebServer, type WebServer } from "./server";

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
let win: BrowserWindow | null = null;
let scanning: Promise<ScanOutcome> | null = null;

async function loadSettings() {
  try {
    settings = normaliseSettings(JSON.parse(await readFile(settingsFile(), "utf8")));
  } catch {
    settings = normaliseSettings({});
  }
}

async function saveSettings(patch: unknown) {
  settings = normaliseSettings({ ...settings, ...(patch && typeof patch === "object" ? patch : {}) });
  await mkdir(userData(), { recursive: true });
  await writeFile(settingsFile(), JSON.stringify(settings, null, 2));
  applyHotkey();
  return settings;
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
    const run = await runReader(paths.reader, workDir, settings.database, (p: ScanProgress) => send(IPC.scanProgress, p));
    if (run.done) {
      try {
        const { snapshot } = await store().add(
          run.done.file,
          { players: run.done.players, staff: run.done.staff },
          settings.retention,
          { diagnostics: join(workDir, "diagnostics.txt") },
        );
        outcome = { ok: true, snapshot, log: run.log };
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
    const json = JSON.parse(await readFile(paths.sample, "utf8")) as { players: unknown[]; staff: unknown[] };
    const { snapshot } = await store().add(paths.sample, { players: json.players.length, staff: json.staff.length }, settings.retention, {
      copy: true,
      sample: true,
    });
    outcome = { ok: true, snapshot, log: ["Loaded the sample scan."] };
  } catch (e) {
    outcome = { ok: false, code: "failed", message: `The sample scan could not be loaded: ${(e as Error).message}`, log: [] };
  }
  send(IPC.scanFinished, outcome);
  return outcome;
}

/** Only our own pages may use the bridge. */
function fromApp(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url ?? "";
  return !!server && url.startsWith(`${server.origin}/`);
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
  handle(IPC.loadSnapshot, (id) => store().read(String(id)));
  handle(IPC.deleteSnapshot, (id) => store().delete(String(id)));
  handle(IPC.loadSample, () => loadSample());
  handle(IPC.getSettings, () => settings);
  handle(IPC.setSettings, (patch) => saveSettings(patch));
  handle(IPC.openDataFolder, async () => {
    const dir = join(userData(), "scans");
    await mkdir(dir, { recursive: true });
    await shell.openPath(dir);
  });
}

/** Content Security Policy for our pages. Next's inline bootstrap scripts need 'unsafe-inline'; dev also needs eval. */
function applyCsp(origin: string) {
  const csp = [
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
  session.defaultSession.webRequest.onHeadersReceived({ urls: [`${origin}/*`] }, (details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [csp] } });
  });
}

async function createWindow() {
  if (!server) return;
  const origin = server.origin;
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: "Scout Reporter",
    backgroundColor: "#162232",
    autoHideMenuBar: true,
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
  });

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
  applyCsp(server.origin);
  applyHotkey();
  await createWindow();
}

void main();
