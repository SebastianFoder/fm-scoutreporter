"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import { assertScanFile, type ScanFile } from "@scoutreporter/core/scan/schema";
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
  scan: () => Promise<void>;
  loadSnapshot: (id: string) => Promise<void>;
  /** A stored scan, parsed. */
  readSnapshot: (id: string) => Promise<ScanFile>;
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

  const readSnapshot = useCallback(
    async (id: string) => {
      const scan: unknown = JSON.parse(await bridge.loadSnapshot(id));
      assertScanFile(scan);
      return scan;
    },
    [bridge],
  );

  const loadSnapshot = useCallback(
    async (id: string) => {
      setLoadError(null);
      try {
        const scan = await readSnapshot(id);
        const info = snapshots.find((s) => s.id === id);
        const source: ImportSource = {
          kind: "scan",
          label: scanLabel({ gameDate: scan.meta.gameDate, scannedAt: scan.meta.scannedAt, sample: info?.sample }),
          snapshotId: id,
          scannedAt: scan.meta.scannedAt,
          gameDate: scan.meta.gameDate,
        };
        const hide = settings?.hideHidden === true;
        const strip = (list: PlayerAttributes[]) => (hide ? list.map(withoutHidden) : list);
        await players.importRecords(strip(scanPlayers(scan)), source);
        if (scan.meta.myClub) await squad.importRecords(strip(scanPlayers(scan, { club: scan.meta.myClub })), source);
        await staff.importRecords(scanStaff(scan), SCAN_STAFF_COLUMNS, source);
        setActiveId(id);
        try {
          window.localStorage.setItem(ACTIVE_KEY, id);
        } catch {
          // remembered for this session only
        }
      } catch (e) {
        setLoadError((e as Error).message);
      }
    },
    [readSnapshot, snapshots, settings, players, squad, staff],
  );

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
      scan,
      loadSnapshot,
      readSnapshot,
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
      scan,
      loadSnapshot,
      readSnapshot,
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
