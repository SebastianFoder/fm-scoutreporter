"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, FolderOpen } from "lucide-react";
import { Button } from "@scoutreporter/ui/components/Button";
import { usePlayersData } from "@scoutreporter/ui/components/PlayersDataProvider";
import { useStaffData } from "@scoutreporter/ui/components/StaffDataProvider";
import { Notice } from "@scoutreporter/ui/components/Notice";
import { PageHeader } from "@scoutreporter/ui/components/PageHeader";
import { useSettings } from "@scoutreporter/ui/components/Settings";
import { useDesktop } from "./DesktopProvider";
import { ScanButton } from "./ScanButton";
import { StoredScanRow } from "./StoredScanRow";

const ERROR_TITLES: Record<string, string> = {
  "not-running": "Football Manager is not running",
  "no-access": "Football Manager runs as administrator",
  "not-loaded": "No save loaded yet",
  "nothing-found": "No players found",
  "too-much-unread": "Scan incomplete",
  "no-search": "No search found in Football Manager",
  busy: "A scan is already running",
  "missing-reader": "Reader missing",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function formatBytes(bytes: number): string {
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1e6))} MB`;
}

const n = (v: number) => v.toLocaleString("en-GB");

/** The desktop app's home: scan FM, the stored scans and credits. Its settings are in Settings > App. */
export function DesktopHomeClient() {
  const desktop = useDesktop();
  const { state: playersState } = usePlayersData();
  const { state: staffState } = useStaffData();
  const { openSettings } = useSettings();
  if (!desktop) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10 text-ink">
        <PageHeader title="Desktop app">
          This page belongs to the Scout Reporter desktop app, which reads your Football Manager save directly. On the
          website, import a CSV export instead: see the <Link href="/how-to-use" className="link">setup guide</Link>.
        </PageHeader>
      </div>
    );
  }

  const {
    bridge,
    settings,
    snapshots,
    activeId,
    scanning,
    progress,
    lastOutcome,
    loadError,
    loading,
    scan,
    loadSnapshot,
    deleteSnapshot,
    updateSnapshot,
    loadSample,
  } = desktop;
  const active = snapshots.find((s) => s.id === activeId) ?? null;
  const pct = progress ? Math.round(progress.progress * 100) : 0;
  const diskBytes = snapshots.reduce((sum, s) => sum + (s.bytes ?? 0), 0);
  // What the screens hold now, when it is only part of the scan in use.
  const fromScan = playersState.source?.snapshotId === activeId ? playersState.source : null;
  const loadedPlayers = playersState.players.length;
  const loadedStaff = staffState.staff.length;
  const partial =
    fromScan && active && (loadedPlayers < active.players || loadedStaff < active.staff)
      ? { players: loadedPlayers, staff: loadedStaff, totalPlayers: active.players, totalStaff: active.staff }
      : null;
  const hotkeyHint = settings?.hotkey ? "" : " once the hotkey is on";
  // FM's search result in the scan in use, and whether the screens were loaded from it.
  const staffFromScan = staffState.source?.snapshotId === activeId ? staffState.source : null;
  const searchText = (s: { players: number; staff: number }) =>
    [s.players > 0 && `${n(s.players)} players`, s.staff > 0 && `${n(s.staff)} staff`].filter(Boolean).join(" and ");
  // What was loaded next to your club, for the kinds (players, staff) of which only part was loaded.
  const loadedFrom = [
    partial && partial.players < partial.totalPlayers &&
      (fromScan?.search ? `players from FM's player search (${n(fromScan.search)} found)` : "the players worth scouting"),
    partial && partial.staff < partial.totalStaff &&
      (staffFromScan?.search ? `staff from FM's staff search (${n(staffFromScan.search)} found)` : "the staff worth hiring"),
  ]
    .filter(Boolean)
    .join(" and ");
  const lastScan = lastOutcome?.ok ? lastOutcome.snapshot : null;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-5 py-6 text-ink">
      <PageHeader
        title="Scan Football Manager"
        aside={<ScanButton variant="page" />}
      >
        <span className="font-semibold text-ink">Scan search</span> (or F9{hotkeyHint}, also inside FM): open Player Search or Staff
        Search in Football Manager, set your filters, and the app takes the people FM found plus your own club.{" "}
        <span className="font-semibold text-ink">Scan save</span>: every player and staff member in the save, no search needed.
        Every screen (Players, Best XI, Squad, Staff) works on the scan. Nothing in your game is changed. The F9 key, hidden
        attributes and updates are under{" "}
        <button type="button" className="link" onClick={() => openSettings("app")}>
          Settings
        </button>
        .
      </PageHeader>

      {scanning && (
        <div className="panel px-4 py-3" role="status">
          <p className="text-sm font-semibold">
            {progress?.phase === "importing" ? "Saving the scan…" : `Reading ${progress?.phase ?? "memory"}…`}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
            <div className="h-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {lastOutcome && !scanning && !lastOutcome.ok && (
        <div role="alert" className="flex items-start gap-2.5 rounded-md border border-red bg-red/8 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red" aria-hidden />
          <div>
            <p className="font-semibold">{ERROR_TITLES[lastOutcome.code] ?? "The scan failed"}</p>
            <p className="text-muted">{lastOutcome.message}</p>
            {lastOutcome.code === "no-search" && (
              <p className="text-muted">
                Or{" "}
                <button type="button" className="link" onClick={() => void scan("full")}>
                  scan the whole save
                </button>{" "}
                instead.
              </p>
            )}
          </div>
        </div>
      )}

      {lastScan && !scanning && (
        <div role="status" className="flex items-start gap-2.5 rounded-md border border-line bg-surface px-4 py-3 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden />
          <p>
            <span className="font-semibold">{n(lastScan.players)} players</span> and {n(lastScan.staff)} staff{" "}
            {lastScan.scope === "search"
              ? `kept: your FM search (${searchText({ players: lastScan.searchPlayers ?? 0, staff: lastScan.searchStaff ?? 0 })}) plus your club${lastScan.myClub ? `, ${lastScan.myClub}` : ""}`
              : `scanned${lastScan.myClub ? `, your club: ${lastScan.myClub}` : ""}`}
            . Open{" "}
            <Link href="/players" className="link">Players</Link>, <Link href="/squad" className="link">Squad</Link> or{" "}
            <Link href="/growth" className="link">Growth</Link>.
          </p>
        </div>
      )}

      {loading && (
        <p className="text-sm text-muted" role="status">
          Loading the scan into the screens…
        </p>
      )}
      {partial && !loading && (
        <p className="text-[13px] text-muted">
          The screens hold {n(partial.players)} of {n(partial.totalPlayers)} players and {n(partial.staff)} of {n(partial.totalStaff)} staff
          from this scan: your club plus {loadedFrom}, best CA first, to keep the screens quick. Growth
          always compares every player in both scans.
        </p>
      )}

      {active && !active.versionOk && (
        <Notice title="Unrecognised Football Manager version">
          This scan came from FM {active.gameVersion ?? "(unknown version)"}, but the reader was made for {active.game}. Check a few players
          against the game before trusting the numbers, and look for a Scout Reporter update.
        </Notice>
      )}
      {loadError && <Notice title="Could not load the scan">{loadError}</Notice>}

      <section className="panel" aria-labelledby="scans-title">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h2 id="scans-title" className="section-title">Stored scans</h2>
            <p className="text-[13px] text-muted">
              The newest {settings?.retention ?? "…"} are kept, plus starred ones, so <Link href="/growth" className="link">Growth</Link> can
              compare them.
              {diskBytes > 0 && ` They use ${formatBytes(diskBytes)} on disk.`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button color="alt" variant="ghost" size="md" icon={<FolderOpen className="h-4 w-4" aria-hidden />} onClick={() => void bridge.openDataFolder()}>
              Open folder
            </Button>
            <Button color="alt" variant="outline" size="md" onClick={() => void loadSample()}>
              Load sample scan
            </Button>
          </div>
        </div>
        {snapshots.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No scans yet. Press Scan search or Scan save, or load the sample scan to look around.</p>
        ) : (
          <ul className="divide-y divide-line">
            {/* Starred scans first, then the rest; newest first within each. */}
            {[...snapshots.filter((s) => s.favorite), ...snapshots.filter((s) => !s.favorite)].map((s) => (
              <StoredScanRow
                key={s.id}
                scan={s}
                inUse={s.id === activeId}
                loading={loading}
                onUse={() => void loadSnapshot(s.id)}
                onDelete={() => void deleteSnapshot(s.id)}
                onUpdate={(patch) => updateSnapshot(s.id, patch)}
                details={
                  <>
                    {n(s.players)} players · {n(s.staff)} staff · {s.myClub ?? "no club"} · {s.game} {s.gameVersion ?? ""} · scanned{" "}
                    {formatTime(s.scannedAt)}
                    {s.bytes !== undefined && ` · ${formatBytes(s.bytes)}`}
                    {s.scope === "search"
                      ? ` · your FM search (${searchText({ players: s.searchPlayers ?? 0, staff: s.searchStaff ?? 0 })}) and your club`
                      : `${s.sample ? "" : " · whole save"}${
                          s.searchPlayers || s.searchStaff
                            ? ` · FM search: ${searchText({ players: s.searchPlayers ?? 0, staff: s.searchStaff ?? 0 })}`
                            : ""
                        }`}
                  </>
                }
              />
            ))}
          </ul>
        )}
      </section>

      <section className="panel space-y-1.5 px-4 py-3 text-[13px] text-muted" aria-labelledby="about-title">
        <h2 id="about-title" className="section-title text-ink">About</h2>
        <p>Scout Reporter desktop {bridge.version}. Supports Football Manager 27 (27.0) and 26 (26.3) on Windows, from Steam, Epic or Game Pass.</p>
        <p>
          The reader only reads Football Manager&apos;s memory; it never changes your game or save. It is adapted from{" "}
          <a href="https://github.com/mavarobli/FMSuperScout" className="link" target="_blank" rel="noreferrer">
            FMSuperScout
          </a>{" "}
          by mavarobli (MIT licence). Thank you!
        </p>
        <p>
          Scoring weights from{" "}
          <a href="https://github.com/jamiebolden/fm-scoring" className="link" target="_blank" rel="noreferrer">
            jamiebolden/fm-scoring
          </a>
          ; training research by harvestgreen22.
        </p>
      </section>
    </div>
  );
}
