"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, FolderOpen, Radar, Trash2 } from "lucide-react";
import { Button } from "@scoutreporter/ui/components/Button";
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

/** The desktop app's home: scan FM, the stored scans, settings and credits. */
export function DesktopHomeClient() {
  const desktop = useDesktop();
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
    scan,
    loadSnapshot,
    deleteSnapshot,
    loadSample,
  } = desktop;
  const active = snapshots.find((s) => s.id === activeId) ?? null;
  const pct = progress ? Math.round(progress.progress * 100) : 0;

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
          <p className="text-sm font-semibold">Reading {progress?.phase ?? "memory"}…</p>
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
            <span className="font-semibold">{lastOutcome.snapshot.players.toLocaleString("en-GB")} players</span> and{" "}
            {lastOutcome.snapshot.staff.toLocaleString("en-GB")} staff loaded
            {lastOutcome.snapshot.myClub ? `, your club: ${lastOutcome.snapshot.myClub}` : ""}. Open{" "}
            <Link href="/attribute" className="link">Attribute</Link>, <Link href="/wonderkid" className="link">Wonderkid</Link> or{" "}
            <Link href="/growth" className="link">Growth</Link>.
          </p>
        </div>
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
                    {s.players.toLocaleString("en-GB")} players · {s.staff.toLocaleString("en-GB")} staff · {s.myClub ?? "no club"} · {s.game}{" "}
                    {s.gameVersion ?? ""} · scanned {formatTime(s.scannedAt)}
                  </p>
                </div>
                <Button color="alt" variant="outline" size="sm" disabled={s.id === activeId} onClick={() => void loadSnapshot(s.id)}>
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
                For players who see them as cheating. Applies the next time a scan is loaded (press Use on the scan).
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
            <label className="flex items-center gap-2">
              <span className="font-semibold">Keep</span>
              <input
                type="number"
                min={1}
                max={500}
                className="w-20 rounded-md border border-line bg-surface px-2 py-1"
                value={settings.retention}
                onChange={(e) => void updateSettings({ retention: Number(e.target.value) })}
              />
              <span className="text-muted">scans</span>
            </label>
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
