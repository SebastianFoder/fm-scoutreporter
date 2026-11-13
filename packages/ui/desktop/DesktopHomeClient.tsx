"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FolderOpen, Radar, RefreshCw, Trash2 } from "lucide-react";
import type { DesktopSettings, LoadLimits, UpdateState } from "@scoutreporter/core/desktop/bridge";
import { Button } from "@scoutreporter/ui/components/Button";
import { usePlayersData } from "@scoutreporter/ui/components/PlayersDataProvider";
import { useStaffData } from "@scoutreporter/ui/components/StaffDataProvider";
import { Notice } from "@scoutreporter/ui/components/Notice";
import { PageHeader } from "@scoutreporter/ui/components/PageHeader";
import { scanLabel, useDesktop } from "./DesktopProvider";

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

/** A number setting that is saved when you leave the field or press Enter (not on every key). */
/** Under "Check for updates": what the last check found. */
function UpdateStatusLine({ update }: { update: UpdateState }) {
  let text: string;
  if (update.checking) text = "Checking…";
  else if (update.error) text = update.error;
  else if (update.available && update.latest) text = `Version ${update.latest.version} is out (you have ${update.current}): see the bar at the top.`;
  else if (update.checkedAt) text = `You have the newest version (${update.current}).`;
  else text = `Version ${update.current}.`;
  return <span className={`mt-1 block text-[13px] ${update.error ? "text-red" : "text-muted"}`}>{text}</span>;
}

function NumberSetting({
  label,
  value,
  min,
  max,
  onSave,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onSave: (value: number) => void;
  suffix?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const save = () => {
    if (draft !== null && draft.trim() !== "" && Number.isFinite(Number(draft))) onSave(Number(draft));
    setDraft(null);
  };
  return (
    <label className="flex items-center gap-2">
      <span className="font-semibold">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        className="w-24 rounded-md border border-line bg-surface px-2 py-1"
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && save()}
      />
      {suffix && <span className="text-muted">{suffix}</span>}
    </label>
  );
}

/** The desktop app's home: scan FM, the stored scans, settings and credits. */
export function DesktopHomeClient() {
  const desktop = useDesktop();
  const { state: playersState } = usePlayersData();
  const { state: staffState } = useStaffData();
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
    updateSettings,
    snapshots,
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
    update,
    checkForUpdate,
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
  const setLoad = (patch: Partial<LoadLimits>) => void updateSettings({ load: { ...settings!.load, ...patch } });
  /** A setting that changes what the screens get: save it, then load the scan in use again. */
  const applyAndReload = (patch: Partial<DesktopSettings>) => void updateSettings(patch).then(() => reloadActive());
  /** Scans keep only FM's search and your club (the default), not the whole save. */
  const searchMode = settings?.scanMode !== "full";
  const hotkeyHint = settings?.hotkey ? "" : " once the hotkey is on";
  // FM's search result in the scan in use, and whether the screens were loaded from it.
  const staffFromScan = staffState.source?.snapshotId === activeId ? staffState.source : null;
  const activeSearch = active && (active.searchPlayers || active.searchStaff) ? { players: active.searchPlayers ?? 0, staff: active.searchStaff ?? 0 } : null;
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
        aside={
          <Button color="primary" size="lg" icon={<Radar className="h-4 w-4" aria-hidden />} disabled={scanning} onClick={() => void scan()}>
            {scanning ? `Scanning ${pct}%` : "Scan FM"}
          </Button>
        }
      >
        {searchMode ? (
          <>
            In Football Manager 27, open Player Search (or Staff Search), set your filters and leave the search on screen. Then press
            Scan FM (or F9{hotkeyHint}, also inside FM). The app takes the people FM found, plus your own club, and every screen
            (Attribute, Wonderkid, Best XI, Squad, Staff) works on them. Nothing in your game is changed.
          </>
        ) : (
          <>
            Start Football Manager 27, load your save, then press Scan FM (or F9{hotkeyHint}). The whole database is read in seconds,
            read-only, and every screen (Attribute, Wonderkid, Best XI, Squad, Staff) uses it.
          </>
        )}
      </PageHeader>

      {settings && (
        <label className="panel flex items-start gap-2 px-4 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={!settings.hideHidden}
            disabled={loading}
            onChange={(e) => applyAndReload({ hideHidden: !e.target.checked })}
          />
          <span>
            <span className="font-semibold">Use CA, PA and hidden attributes</span>
            <span className="block text-[13px] text-muted">
              On: the screens get every player&apos;s current and potential ability and Professionalism, which Wonderkid mode needs. Off:
              they are left out, as in a normal FM export, and Growth shows attribute changes only. The visible attributes are FM&apos;s
              exact values either way, also for players you have not fully scouted.
            </span>
          </span>
        </label>
      )}

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
                To scan without a search, choose The whole save under <a href="#keep-title" className="link">What a scan keeps</a>.
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
            <Link href="/attribute" className="link">Attribute</Link>, <Link href="/wonderkid" className="link">Wonderkid</Link> or{" "}
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
          from this scan: your club plus {loadedFrom} (see <a href="#keep-title" className="link">What a scan keeps</a>). Growth
          always compares every player in both scans.
        </p>
      )}
      {settings && active && !loading && activeSearch && !searchMode && active.scope !== "search" && (
        <p className="text-[13px] text-muted">
          FM&apos;s search had {searchText(activeSearch)} when this scan ran. To load only those, choose{" "}
          <a href="#keep-title" className="link">My FM search and my club</a>.
        </p>
      )}
      {settings && searchMode && active && !active.sample && active.scope !== "search" && !activeSearch && !loading && (
        <Notice title="This scan has no FM search result">
          This scan holds the whole save, and FM had no search result when it ran, so the screens load it like a whole save. In FM,
          open Player Search, set its filters, leave it on screen and scan again.
        </Notice>
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
              Every scan is kept (up to {settings?.retention ?? "…"}), so <Link href="/growth" className="link">Growth</Link> can compare them.
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
          <p className="px-4 py-8 text-center text-sm text-muted">No scans yet. Scan FM, or load the sample scan to look around.</p>
        ) : (
          <ul className="divide-y divide-line">
            {snapshots.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {scanLabel(s)}
                    {s.id === activeId && <span className="ml-2 rounded bg-accent/12 px-1.5 py-0.5 text-[12px] font-semibold text-accent">In use</span>}
                    {!s.versionOk && <span className="ml-2 text-[12px] font-normal text-red">version differs</span>}
                  </p>
                  <p className="text-[13px] text-muted">
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
                  </p>
                </div>
                <Button color="alt" variant="outline" size="sm" disabled={s.id === activeId || loading} onClick={() => void loadSnapshot(s.id)}>
                  Use
                </Button>
                <Button
                  color="red"
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${scanLabel(s)}`}
                  icon={<Trash2 className="h-4 w-4" aria-hidden />}
                  onClick={() => void deleteSnapshot(s.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {settings && (
        <section className="panel space-y-3 px-4 py-3" aria-labelledby="settings-title">
          <h2 id="settings-title" className="section-title">Settings</h2>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={settings.hotkey} onChange={(e) => void updateSettings({ hotkey: e.target.checked })} />
            <span>
              <span className="font-semibold">F9 scans from anywhere</span>
              <span className="block text-[13px] text-muted">While the app runs, F9 starts a scan, also inside FM. Other apps do not get F9 meanwhile.</span>
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <span className="font-semibold">Database</span>
              <select
                className="rounded-md border border-line bg-surface px-2 py-1"
                value={settings.database}
                onChange={(e) => void updateSettings({ database: e.target.value as typeof settings.database })}
              >
                <option value="men">Men</option>
                <option value="women">Women</option>
                <option value="both">Both</option>
              </select>
            </label>
            <NumberSetting
              label="Keep"
              value={settings.retention}
              min={1}
              max={500}
              suffix="scans (a search is a few MB, a whole save about 140 MB)"
              onSave={(retention) => void updateSettings({ retention })}
            />
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3 border-t border-line pt-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={settings.checkUpdates}
                onChange={(e) => void updateSettings({ checkUpdates: e.target.checked })}
              />
              <span>
                <span className="font-semibold">Check for updates</span>
                <span className="block text-[13px] text-muted">
                  Asks GitHub for the newest version when the app starts and every few hours. Nothing about you or your
                  save is sent. Updating keeps your settings, scans, weights and formations.
                </span>
                {update && <UpdateStatusLine update={update} />}
              </span>
            </label>
            <Button size="sm" color="alt" variant="outline" disabled={!update || update.checking} onClick={() => void checkForUpdate()}>
              {update?.checking ? "Checking…" : "Check now"}
            </Button>
          </div>
        </section>
      )}

      {settings && (
        <section className="panel space-y-3 px-4 py-3" aria-labelledby="keep-title">
          <div>
            <h2 id="keep-title" className="section-title">What a scan keeps</h2>
            <p className="text-[13px] text-muted">
              The reader always reads FM&apos;s whole database, which takes seconds. This sets how much of it a scan keeps.
            </p>
          </div>
          <fieldset className="space-y-2 text-sm">
            <legend className="sr-only">What a scan keeps</legend>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="scan-mode"
                className="mt-1"
                checked={searchMode}
                disabled={loading}
                onChange={() => applyAndReload({ scanMode: "search" })}
              />
              <span>
                <span className="font-semibold">My FM search and my club</span>
                <span className="block text-[13px] text-muted">
                  Like an export of the search on screen: the scan keeps the people in FM&apos;s Player Search or Staff Search, with
                  every filter you set there, plus your own club for Squad and Best XI. Set Player&apos;s interest to Interested and you
                  get only the players FM says would join you: FM&apos;s own answer, not an estimate. Scans are small and load at once.
                  Growth compares the players that are in both scans.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="scan-mode"
                className="mt-1"
                checked={!searchMode}
                disabled={loading}
                onChange={() => applyAndReload({ scanMode: "full" })}
              />
              <span>
                <span className="font-semibold">The whole save</span>
                <span className="block text-[13px] text-muted">
                  Every player and staff member in the save, about 140 MB per scan, with or without a search on screen. A full FM
                  database has about 400,000 players, too many for one window, so the screens load your club plus the people within the
                  limits below. Growth compares every player in the save.
                </span>
              </span>
            </label>
          </fieldset>
          <p className="text-[13px] text-muted">
            <span className="font-semibold text-ink">Limits.</span> A scan with more people than the caps (a whole save, or a very wide
            search) loads your club plus the best by these limits, best CA first.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <NumberSetting label="Players with CA" suffix="or more" value={settings.load.minCa} min={1} max={200} onSave={(minCa) => setLoad({ minCa })} />
            <NumberSetting label="plus players up to age" value={settings.load.youngMaxAge} min={14} max={45} onSave={(youngMaxAge) => setLoad({ youngMaxAge })} />
            <NumberSetting label="with PA" suffix="or more" value={settings.load.youngMinPa} min={1} max={200} onSave={(youngMinPa) => setLoad({ youngMinPa })} />
            <NumberSetting label="At most" suffix="players" value={settings.load.maxPlayers} min={100} max={100_000} onSave={(maxPlayers) => setLoad({ maxPlayers })} />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <NumberSetting label="Staff with CA" suffix="or more" value={settings.load.staffMinCa} min={1} max={200} onSave={(staffMinCa) => setLoad({ staffMinCa })} />
            <NumberSetting label="At most" suffix="staff" value={settings.load.maxStaff} min={100} max={100_000} onSave={(maxStaff) => setLoad({ maxStaff })} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              color="alt"
              variant="outline"
              size="md"
              icon={<RefreshCw className="h-4 w-4" aria-hidden />}
              disabled={!activeId || loading}
              onClick={() => void reloadActive()}
            >
              Load again
            </Button>
            <span className="text-[13px] text-muted">
              The limits apply the next time a scan is loaded. More players means slower screens: 40,000 load in a few seconds.
            </span>
          </div>
        </section>
      )}

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
