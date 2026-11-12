/**
 * The desktop app's preload API (`window.scoutReporterDesktop`): the only way the screens talk to
 * the Electron main process. Shared by apps/desktop (which implements it) and packages/ui (which
 * uses it when present). On the website it is undefined.
 */

/** One stored scan. */
export interface SnapshotInfo {
  id: string;
  /** UTC, ISO 8601. */
  scannedAt: string;
  gameDate: string | null;
  game: string;
  gameVersion: string | null;
  versionOk: boolean;
  manager: string | null;
  myClub: string | null;
  players: number;
  staff: number;
  database: string;
  /** True for the bundled sample scan (loaded without FM). */
  sample?: boolean;
}

export interface DesktopSettings {
  /** Scans to keep; older ones are deleted after each new scan. */
  retention: number;
  /** F9 starts a scan from anywhere (also inside FM) while the app runs. */
  hotkey: boolean;
  /** Which half of FM's database to scan. */
  database: "men" | "women" | "both";
  /** Hide CA, PA and hidden attributes (for players who consider them cheating). */
  hideHidden: boolean;
}

export const DEFAULT_DESKTOP_SETTINGS: DesktopSettings = {
  retention: 20,
  hotkey: true,
  database: "men",
  hideHidden: false,
};

export interface ScanProgress {
  phase: string;
  /** 0..1 */
  progress: number;
}

export type ScanOutcome =
  | { ok: true; snapshot: SnapshotInfo; log: string[] }
  | {
      ok: false;
      /** The reader's error code: not-running, no-access, not-loaded, nothing-found, too-much-unread, busy, failed, missing-reader. */
      code: string;
      message: string;
      log: string[];
    };

export interface DesktopBridge {
  /** The desktop app's version. */
  version: string;
  /** Run the reader against FM. Resolves when the scan is stored (or failed). */
  scan(): Promise<ScanOutcome>;
  /** Progress of a running scan (also one started with F9). Returns an unsubscribe. */
  onScanProgress(listener: (progress: ScanProgress) => void): () => void;
  /** Every finished scan, including F9 scans. Returns an unsubscribe. */
  onScanFinished(listener: (outcome: ScanOutcome) => void): () => void;
  /** Stored scans, newest first. */
  listSnapshots(): Promise<SnapshotInfo[]>;
  /** A stored scan's JSON text (see @scoutreporter/core/scan). */
  loadSnapshot(id: string): Promise<string>;
  deleteSnapshot(id: string): Promise<void>;
  /** Store the bundled sample scan as a snapshot, to try the app without FM. */
  loadSampleScan(): Promise<ScanOutcome>;
  getSettings(): Promise<DesktopSettings>;
  setSettings(patch: Partial<DesktopSettings>): Promise<DesktopSettings>;
  /** Open the folder with the stored scans and diagnostics. */
  openDataFolder(): Promise<void>;
}

/** The IPC channel names behind the bridge (main process and preload). */
export const IPC = {
  scan: "sr:scan",
  scanProgress: "sr:scan-progress",
  scanFinished: "sr:scan-finished",
  listSnapshots: "sr:list-snapshots",
  loadSnapshot: "sr:load-snapshot",
  deleteSnapshot: "sr:delete-snapshot",
  loadSample: "sr:load-sample",
  getSettings: "sr:get-settings",
  setSettings: "sr:set-settings",
  openDataFolder: "sr:open-data-folder",
} as const;

/** Clamp and fill settings read from disk or sent by the renderer. */
export function normaliseSettings(value: unknown): DesktopSettings {
  const v = (value && typeof value === "object" ? value : {}) as Partial<DesktopSettings>;
  const retention = Number(v.retention);
  return {
    retention: Number.isFinite(retention) ? Math.min(500, Math.max(1, Math.round(retention))) : DEFAULT_DESKTOP_SETTINGS.retention,
    hotkey: typeof v.hotkey === "boolean" ? v.hotkey : DEFAULT_DESKTOP_SETTINGS.hotkey,
    database: v.database === "women" || v.database === "both" ? v.database : "men",
    hideHidden: v.hideHidden === true,
  };
}
