"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  DesktopBridge,
  DesktopSettings,
  ScanOutcome,
  ScanProgress,
  SnapshotInfo,
} from "@scoutreporter/core/desktop/bridge";
import { SCAN_STAFF_COLUMNS, scanPlayers, scanStaff } from "@scoutreporter/core/scan/convert";
import type { PlayerAttributes } from "@scoutreporter/core/types/player-attributes";
import type { ImportSource } from "@scoutreporter/core/storage/stored-records";
import { usePlayersData } from "@scoutreporter/ui/components/PlayersDataProvider";
import { useSquadData } from "@scoutreporter/ui/components/SquadDataProvider";
import { useStaffData } from "@scoutreporter/ui/components/StaffDataProvider";

declare global {
  interface Window {
    /** Set by the desktop app's preload script; undefined on the website. */
    scoutReporterDesktop?: DesktopBridge;
  }
}

const noSubscribe = () => () => {};

/** The desktop bridge, or null on the website (and during server rendering). */
export function useDesktopBridge(): DesktopBridge | null {
  return useSyncExternalStore(
    noSubscribe,
    () => window.scoutReporterDesktop ?? null,
    () => null,
  );
}

/** localStorage key of the snapshot currently loaded into the app. */
const ACTIVE_KEY = "desktopActiveSnapshot";

function readActive(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

/** Remove what "hide hidden attributes" hides: CA, PA and Professionalism. */
function withoutHidden(p: PlayerAttributes): PlayerAttributes {
  return { ...p, currentAbility: null, potentialAbility: null, professionalism: null };
}

export function scanLabel(s: Pick<SnapshotInfo, "gameDate" | "scannedAt" | "sample">): string {
  if (s.sample) return "Sample scan";
  const date = s.gameDate ?? s.scannedAt.slice(0, 10);
  return `Scan of ${new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

type DesktopContextValue = {
  bridge: DesktopBridge;
  settings: DesktopSettings | null;
  updateSettings: (patch: Partial<DesktopSettings>) => Promise<void>;
  snapshots: SnapshotInfo[];
  refreshSnapshots: () => Promise<void>;
  /** The snapshot loaded into the app's screens. */
  activeId: string | null;
  scanning: boolean;
  progress: ScanProgress | null;
  lastOutcome: ScanOutcome | null;
  /** Error while loading a snapshot into the app. */
  loadError: string | null;
  /** A snapshot is being loaded into the screens. */
  loading: boolean;
  scan: () => Promise<void>;
  loadSnapshot: (id: string) => Promise<void>;
  /** Load the snapshot in use again (after changing what to load, or hiding hidden attributes). */
  reloadActive: () => Promise<void>;
  deleteSnapshot: (id: string) => Promise<void>;
  loadSample: () => Promise<void>;
};

const DesktopContext = createContext<DesktopContextValue | null>(null);

/**
 * In the desktop app: scanning, stored scans, settings, and loading a scan into the player, squad and
 * staff imports so every screen works on it. Renders its children untouched on the website.
 */
export function DesktopProvider({ children }: { children: React.ReactNode }) {
  const bridge = useDesktopBridge();
  if (!bridge) return <>{children}</>;
  return <DesktopProviderInner bridge={bridge}>{children}</DesktopProviderInner>;
}

function DesktopProviderInner({ bridge, children }: { bridge: DesktopBridge; children: React.ReactNode }) {
  const players = usePlayersData();
  const squad = useSquadData();
  const staff = useStaffData();
  const [settings, setSettings] = useState<DesktopSettings | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [lastOutcome, setLastOutcome] = useState<ScanOutcome | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshSnapshots = useCallback(async () => {
    setSnapshots(await bridge.listSnapshots());
  }, [bridge]);

  useEffect(() => {
    let active = true;
    void bridge.getSettings().then((s) => active && setSettings(s));
    void bridge.listSnapshots().then((list) => active && setSnapshots(list));
    const stored = readActive();
    if (stored) queueMicrotask(() => active && setActiveId(stored));
    return () => {
      active = false;
    };
  }, [bridge]);

  // Loads can overlap (a finished scan loads itself while you press Use on another): the latest
  // request wins, and an older one that finishes later is dropped.
  const loadGenRef = useRef(0);

  const loadSnapshot = useCallback(
    async (id: string) => {
      const gen = ++loadGenRef.current;
      const stale = () => gen !== loadGenRef.current;
      setLoadError(null);
      setLoading(true);
      try {
        // Only the part of the scan the load setting picks (a full database does not fit the window).
        const scan = await bridge.loadSnapshot(id);
        if (stale()) return;
        const info = snapshots.find((s) => s.id === id);
        const source: ImportSource = {
          kind: "scan",
          label: scanLabel({ gameDate: scan.meta.gameDate, scannedAt: scan.meta.scannedAt, sample: info?.sample }),
          snapshotId: id,
          scannedAt: scan.meta.scannedAt,
          gameDate: scan.meta.gameDate,
        };
        // Settings load in the background; a scan used before they arrive must still honour them.
        const current = settings ?? (await bridge.getSettings());
        const hide = current.hideHidden === true;
        const strip = (list: PlayerAttributes[]) => (hide ? list.map(withoutHidden) : list);
        if (stale()) return;
        await players.importRecords(strip(scanPlayers(scan)), { ...source, total: scan.totalPlayers });
        if (stale()) return;
        if (scan.meta.myClub) await squad.importRecords(strip(scanPlayers(scan, { club: scan.meta.myClub })), source);
        if (stale()) return;
        await staff.importRecords(scanStaff(scan), SCAN_STAFF_COLUMNS, { ...source, total: scan.totalStaff });
        if (stale()) return;
        setActiveId(id);
        try {
          window.localStorage.setItem(ACTIVE_KEY, id);
        } catch {
          // remembered for this session only
        }
      } catch (e) {
        if (!stale()) setLoadError((e as Error).message);
      } finally {
        if (!stale()) setLoading(false);
      }
    },
    [bridge, snapshots, settings, players, squad, staff],
  );

  const reloadActive = useCallback(async () => {
    if (activeId) await loadSnapshot(activeId);
  }, [activeId, loadSnapshot]);

  // The finished-scan listener is registered once; it calls the latest loadSnapshot through a ref.
  const loadSnapshotRef = useLatest(loadSnapshot);

  // Every finished scan (button or F9): refresh the list and load a successful one.
  useEffect(() => {
    const offProgress = bridge.onScanProgress((p) => {
      setScanning(true);
      setProgress(p);
    });
    const offFinished = bridge.onScanFinished((outcome) => {
      setScanning(false);
      setProgress(null);
      setLastOutcome(outcome);
      void bridge.listSnapshots().then((list) => {
        setSnapshots(list);
        if (outcome.ok) void loadSnapshotRef.current(outcome.snapshot.id);
      });
    });
    return () => {
      offProgress();
      offFinished();
    };
  }, [bridge, loadSnapshotRef]);

  const scan = useCallback(async () => {
    setScanning(true);
    setProgress({ phase: "starting", progress: 0 });
    await bridge.scan();
  }, [bridge]);

  const loadSample = useCallback(async () => {
    await bridge.loadSampleScan();
  }, [bridge]);

  const deleteSnapshot = useCallback(
    async (id: string) => {
      await bridge.deleteSnapshot(id);
      await refreshSnapshots();
    },
    [bridge, refreshSnapshots],
  );

  const updateSettings = useCallback(
    async (patch: Partial<DesktopSettings>) => {
      setSettings(await bridge.setSettings(patch));
    },
    [bridge],
  );

  const value = useMemo<DesktopContextValue>(
    () => ({
      bridge,
      settings,
      updateSettings,
      snapshots,
      refreshSnapshots,
      activeId,
      scanning,
      progress,
      lastOutcome,
      loadError,
      loading,
      scan,
      loadSnapshot,
      reloadActive,
      deleteSnapshot,
      loadSample,
    }),
    [
      bridge,
      settings,
      updateSettings,
      snapshots,
      refreshSnapshots,
      activeId,
      scanning,
      progress,
      lastOutcome,
      loadError,
      loading,
      scan,
      loadSnapshot,
      reloadActive,
      deleteSnapshot,
      loadSample,
    ],
  );

  return <DesktopContext.Provider value={value}>{children}</DesktopContext.Provider>;
}

function useLatest<T>(value: T) {
  const [ref] = useState(() => ({ current: value }));
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/** The desktop context, or null on the website. */
export function useDesktop(): DesktopContextValue | null {
  return useContext(DesktopContext);
}
