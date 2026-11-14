/**
 * The desktop app's preload API (`window.scoutReporterDesktop`): the only way the screens talk to
 * the Electron main process. Shared by apps/desktop (which implements it) and packages/ui (which
 * uses it when present). On the website it is undefined.
 */
import type { GrowthSort, PlayerGrowth } from "../scan/growth";
import type { ScanFile } from "../scan/schema";
import type { DesktopRelease } from "./releases";

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
  /** Size of the stored scan on disk. */
  bytes?: number;
  /** Players in FM's Player Search result when the scan ran (0 or missing: none found). */
  searchPlayers?: number;
  /** The same for FM's Staff Search. */
  searchStaff?: number;
  /** "search": the scan holds only FM's search result and your club. Missing or "full": the whole save. */
  scope?: ScanScope;
}

/**
 * What a scan keeps. "search": the people in FM's Player Search or Staff Search result when the
 * scan ran, plus your own club (an export of the search on screen). "full": the whole database.
 */
export type ScanScope = "search" | "full";

/**
 * Which part of a scan the screens load. A full FM database (about 400,000 players) is too much for
 * the window, so a big scan loads your club plus the players worth scouting. A scan that fits under
 * the limits is loaded whole.
 */
export interface LoadScope {
  /** Players at or above this CA. */
  minCa: number;
  /** Plus young players up to this age... */
  youngMaxAge: number;
  /** ...with at least this PA. */
  youngMinPa: number;
  /** At most this many players (best CA first; your club always). */
  maxPlayers: number;
  /** Staff at or above this CA. */
  staffMinCa: number;
  maxStaff: number;
  /**
   * From a whole-save scan, load only people from FM's search result (plus your club), when the
   * scan has one. Not a stored setting: the app loads a whole-save scan by the limits (see
   * loadScopeFor). A scan that kept only the search is loaded whole either way.
   */
  onlySearch: boolean;
}

/** The limits part of LoadScope: what the settings store. */
export type LoadLimits = Omit<LoadScope, "onlySearch">;

export const DEFAULT_LOAD_LIMITS: LoadLimits = {
  minCa: 100,
  youngMaxAge: 21,
  youngMinPa: 130,
  maxPlayers: 40_000,
  staffMinCa: 80,
  maxStaff: 40_000,
};

export const DEFAULT_LOAD_SCOPE: LoadScope = { ...DEFAULT_LOAD_LIMITS, onlySearch: false };

/** A stored scan as the screens get it: the loaded part, and the totals of the whole scan. */
export interface LoadedScan extends Omit<ScanFile, "schema" | "schemaVersion"> {
  totalPlayers: number;
  totalStaff: number;
  /** People in FM's search result in this scan (0: none). */
  searchPlayers: number;
  searchStaff: number;
  /** Whether only FM's search result (plus your club) was loaded. */
  bySearch: { players: boolean; staff: boolean };
  /** What the scan itself holds. */
  scope: ScanScope;
}

export interface GrowthQuery {
  /** Only players who gained at least this much CA. */
  minCaGain?: number;
  maxAge?: number;
  /** Player or club name contains. */
  query?: string;
  sort: GrowthSort;
  dir: "asc" | "desc";
  offset?: number;
  limit: number;
}

export interface GrowthPage {
  /** The requested page of players found in both scans. */
  rows: PlayerGrowth[];
  /** Players found in both scans that match the filters. */
  total: number;
  /** Players in the later scan with no earlier scan (youth intakes, newly loaded leagues). */
  newPlayers: number;
  /** In-game days between the scans, when both have a date. */
  days: number | null;
}

export interface DesktopSettings {
  /** Scans to keep; older ones are deleted after each new scan. */
  retention: number;
  /** F9 starts a search scan from anywhere (also inside FM) while the app runs. */
  hotkey: boolean;
  /** Which half of FM's database to scan. */
  database: "men" | "women" | "both";
  /** Hide CA, PA and hidden attributes (for players who consider them cheating). */
  hideHidden: boolean;
  /** How much the screens load from a whole-save scan, which is too big for the window. */
  load: LoadLimits;
  /** Ask GitHub for a newer version when the app starts and every few hours. */
  checkUpdates: boolean;
}

export const DEFAULT_DESKTOP_SETTINGS: DesktopSettings = {
  retention: 10,
  hotkey: true,
  database: "men",
  hideHidden: false,
  load: DEFAULT_LOAD_LIMITS,
  checkUpdates: true,
};

/** What the screens load with these settings: a search scan whole, a whole-save scan by the limits. */
export function loadScopeFor(settings: Pick<DesktopSettings, "load">): LoadScope {
  return { ...settings.load, onlySearch: false };
}

export interface ScanProgress {
  phase: string;
  /** 0..1 */
  progress: number;
}

export type ScanOutcome =
  | { ok: true; snapshot: SnapshotInfo; log: string[] }
  | {
      ok: false;
      /** The reader's error code: not-running, no-access, not-loaded, nothing-found, too-much-unread, no-search, busy, failed, missing-reader. */
      code: string;
      message: string;
      log: string[];
    };

/** What the app knows about updates. */
export interface UpdateState {
  /** The running version. */
  current: string;
  /** The newest desktop release found, when a check succeeded. */
  latest: DesktopRelease | null;
  /** latest is newer than current. */
  available: boolean;
  /** When the last check finished (ISO), null before the first. */
  checkedAt: string | null;
  checking: boolean;
  /** Why the last check or update failed. */
  error: string | null;
  /** Installing an update: downloading (0..1), then starting the installer (the app then closes). */
  install: { phase: "downloading" | "verifying" | "starting"; progress: number } | null;
}

export interface DesktopBridge {
  /** The desktop app's version. */
  version: string;
  /**
   * Run the reader against FM. "search": keep FM's Player Search or Staff Search result and your
   * club (what F9 does). "full": keep the whole save. Resolves when the scan is stored (or failed).
   */
  scan(scope: ScanScope): Promise<ScanOutcome>;
  /** Progress of a running scan (also one started with F9). Returns an unsubscribe. */
  onScanProgress(listener: (progress: ScanProgress) => void): () => void;
  /** Every finished scan, including F9 scans. Returns an unsubscribe. */
  onScanFinished(listener: (outcome: ScanOutcome) => void): () => void;
  /** Stored scans, newest first. */
  listSnapshots(): Promise<SnapshotInfo[]>;
  /** The part of a stored scan the screens load (see LoadScope and the load setting). */
  loadSnapshot(id: string): Promise<LoadedScan>;
  /** Growth between two stored scans, filtered, sorted and paged. */
  compareSnapshots(fromId: string, toId: string, query: GrowthQuery): Promise<GrowthPage>;
  deleteSnapshot(id: string): Promise<void>;
  /** Store the bundled sample scan as a snapshot, to try the app without FM. */
  loadSampleScan(): Promise<ScanOutcome>;
  getSettings(): Promise<DesktopSettings>;
  setSettings(patch: Partial<DesktopSettings>): Promise<DesktopSettings>;
  /** Open the folder with the stored scans and diagnostics. */
  openDataFolder(): Promise<void>;
  /** What the app knows about updates now (no new check). */
  getUpdateState(): Promise<UpdateState>;
  /** Ask GitHub for the newest version now. */
  checkForUpdate(): Promise<UpdateState>;
  /**
   * Download the newest version, check it against the release's SHA-256, and install it over this
   * one: the installer replaces the program only, so settings, scans, weights, highlights and
   * formations stay. The app closes and starts again by itself. Resolves only when it fails.
   */
  installUpdate(): Promise<UpdateState>;
  /** Every change in the update state (checks, download progress). Returns an unsubscribe. */
  onUpdateState(listener: (state: UpdateState) => void): () => void;
}

/** The IPC channel names behind the bridge (main process and preload). */
export const IPC = {
  scan: "sr:scan",
  scanProgress: "sr:scan-progress",
  scanFinished: "sr:scan-finished",
  listSnapshots: "sr:list-snapshots",
  loadSnapshot: "sr:load-snapshot",
  compareSnapshots: "sr:compare-snapshots",
  deleteSnapshot: "sr:delete-snapshot",
  loadSample: "sr:load-sample",
  getSettings: "sr:get-settings",
  setSettings: "sr:set-settings",
  openDataFolder: "sr:open-data-folder",
  getUpdateState: "sr:get-update-state",
  checkForUpdate: "sr:check-for-update",
  installUpdate: "sr:install-update",
  updateState: "sr:update-state",
} as const;

/** A whole number within [min, max], or `fallback`. */
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  return value === null || value === undefined || value === "" || !Number.isFinite(n) ? fallback : Math.min(max, Math.max(min, Math.round(n)));
}

export function normaliseLoadLimits(value: unknown): LoadLimits {
  const v = (value && typeof value === "object" ? value : {}) as Partial<LoadLimits>;
  const d = DEFAULT_LOAD_LIMITS;
  return {
    minCa: clampInt(v.minCa, 1, 200, d.minCa),
    youngMaxAge: clampInt(v.youngMaxAge, 14, 45, d.youngMaxAge),
    youngMinPa: clampInt(v.youngMinPa, 1, 200, d.youngMinPa),
    maxPlayers: clampInt(v.maxPlayers, 100, 100_000, d.maxPlayers),
    staffMinCa: clampInt(v.staffMinCa, 1, 200, d.staffMinCa),
    maxStaff: clampInt(v.maxStaff, 100, 100_000, d.maxStaff),
  };
}

/** Clamp and fill settings read from disk or sent by the renderer. */
export function normaliseSettings(value: unknown): DesktopSettings {
  const v = (value && typeof value === "object" ? value : {}) as Partial<DesktopSettings>;
  return {
    retention: clampInt(v.retention, 1, 500, DEFAULT_DESKTOP_SETTINGS.retention),
    hotkey: typeof v.hotkey === "boolean" ? v.hotkey : DEFAULT_DESKTOP_SETTINGS.hotkey,
    database: v.database === "women" || v.database === "both" ? v.database : "men",
    hideHidden: v.hideHidden === true,
    load: normaliseLoadLimits(v.load),
    checkUpdates: v.checkUpdates !== false,
  };
}
