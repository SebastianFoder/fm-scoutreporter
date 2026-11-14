/**
 * The only bridge between the screens and the main process: a fixed set of calls, no generic IPC.
 * Runs sandboxed with context isolation; the page sees `window.scoutReporterDesktop`.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { IPC, type DesktopBridge, type ScanOutcome, type ScanProgress, type UpdateState } from "@scoutreporter/core/desktop/bridge";

function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, value: T) => listener(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

/** The main process passes the app version as `--sr-version=x.y.z` (webPreferences.additionalArguments). */
const version = process.argv.find((a) => a.startsWith("--sr-version="))?.slice("--sr-version=".length) ?? "";

const bridge: DesktopBridge = {
  version,
  scan: (scope) => ipcRenderer.invoke(IPC.scan, scope),
  onScanProgress: (listener) => subscribe<ScanProgress>(IPC.scanProgress, listener),
  onScanFinished: (listener) => subscribe<ScanOutcome>(IPC.scanFinished, listener),
  listSnapshots: () => ipcRenderer.invoke(IPC.listSnapshots),
  loadSnapshot: (id) => ipcRenderer.invoke(IPC.loadSnapshot, String(id)),
  compareSnapshots: (fromId, toId, query) => ipcRenderer.invoke(IPC.compareSnapshots, String(fromId), String(toId), query),
  deleteSnapshot: (id) => ipcRenderer.invoke(IPC.deleteSnapshot, String(id)),
  loadSampleScan: () => ipcRenderer.invoke(IPC.loadSample),
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  setSettings: (patch) => ipcRenderer.invoke(IPC.setSettings, patch),
  openDataFolder: () => ipcRenderer.invoke(IPC.openDataFolder),
  getUpdateState: () => ipcRenderer.invoke(IPC.getUpdateState),
  checkForUpdate: () => ipcRenderer.invoke(IPC.checkForUpdate),
  installUpdate: () => ipcRenderer.invoke(IPC.installUpdate),
  onUpdateState: (listener) => subscribe<UpdateState>(IPC.updateState, listener),
};

contextBridge.exposeInMainWorld("scoutReporterDesktop", bridge);
