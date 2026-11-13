"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FolderOpen, Radar, RefreshCw, Trash2 } from "lucide-react";
import type { LoadScope } from "@scoutreporter/core/desktop/bridge";
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
  const setLoad = (patch: Partial<LoadScope>) => void updateSettings({ load: { ...settings!.load, ...patch } });

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
        Start Football Manager 27, load your save, then press Scan FM (or F9{settings?.hotkey ? "" : " once the hotkey is on"}). The
        whole database is read in seconds, read-only, and every screen (Attribute, Wonderkid, Best XI, Squad, Staff) uses it.
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
          </div>
        </div>
      )}

      {lastOutcome?.ok && !scanning && (
        <div role="status" className="flex items-start gap-2.5 rounded-md border border-line bg-surface px-4 py-3 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden />
          <p>
            <span className="font-semibold">{n(lastOutcome.snapshot.players)} players</span> and {n(lastOutcome.snapshot.staff)} staff
            scanned{lastOutcome.snapshot.myClub ? `, your club: ${lastOutcome.snapshot.myClub}` : ""}. Open{" "}
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
          from this scan: your club plus the ones worth scouting (see <a href="#load-title" className="link">What the screens load</a>).
          Growth always compares every player.
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
            <input type="checkbox" className="mt-1" checked={settings.hideHidden} onChange={(e) => void updateSettings({ hideHidden: e.target.checked })} />
            <span>
              <span className="font-semibold">Hide CA, PA and hidden attributes</span>
              <span className="block text-[13px] text-muted">
                For players who see them as cheating. Applies the next time a scan is loaded (Use, or Load again below).
              </span>
            </span>
          </label>
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
              suffix="scans (a full database is about 140 MB each)"
              onSave={(retention) => void updateSettings({ retention })}
            />
          </div>
        </section>
      )}

      {settings && (
        <section className="panel space-y-3 px-4 py-3" aria-labelledby="load-title">
          <div>
            <h2 id="load-title" className="section-title">What the screens load</h2>
            <p className="text-[13px] text-muted">
              A full FM database has about 400,000 players, too many for one window. A scan that fits under the limits below is loaded
              whole; a bigger one loads your club plus the players and staff worth scouting, best CA first. Growth always compares every
              player in both scans.
            </p>
          </div>
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
              Changes apply the next time a scan is loaded. More players means slower screens: 40,000 load in a few seconds.
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
