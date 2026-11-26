"use client";

import type { ReactNode } from "react";
import { Link } from "../i18n/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, FolderOpen } from "lucide-react";
import { Button } from "@scoutreporter/ui/components/Button";
import { usePlayersData } from "@scoutreporter/ui/components/PlayersDataProvider";
import { useStaffData } from "@scoutreporter/ui/components/StaffDataProvider";
import { Notice } from "@scoutreporter/ui/components/Notice";
import { PageHeader } from "@scoutreporter/ui/components/PageHeader";
import { useSettings } from "@scoutreporter/ui/components/Settings";
import { useFormatNumber, useIntlLocale } from "@scoutreporter/ui/i18n/hooks";
import { useDesktop } from "./DesktopProvider";
import { ScanButton } from "./ScanButton";
import { StoredScanRow } from "./StoredScanRow";

/** The reader's error codes → keys in desktop.home.errors (anything else: "failed"). */
const ERROR_KEYS: Record<string, string> = {
  "not-running": "notRunning",
  "no-access": "noAccess",
  "not-loaded": "notLoaded",
  "nothing-found": "nothingFound",
  "too-much-unread": "tooMuchUnread",
  "no-search": "noSearch",
  busy: "busy",
  "missing-reader": "missingReader",
};

const bold = (chunks: ReactNode) => <span className="font-semibold text-ink">{chunks}</span>;
const strong = (chunks: ReactNode) => <span className="font-semibold">{chunks}</span>;
const pageLink = (href: string) => {
  const PageLink = (chunks: ReactNode) => (
    <Link href={href} className="link">
      {chunks}
    </Link>
  );
  return PageLink;
};
const externalLink = (href: string) => {
  const ExternalLink = (chunks: ReactNode) => (
    <a href={href} className="link" target="_blank" rel="noreferrer">
      {chunks}
    </a>
  );
  return ExternalLink;
};

/** The desktop app's home: scan FM, the stored scans and credits. Its settings are in Settings > App. */
export function DesktopHomeClient() {
  const desktop = useDesktop();
  const { state: playersState } = usePlayersData();
  const { state: staffState } = useStaffData();
  const { openSettings } = useSettings();
  const t = useTranslations("desktop");
  const formatNumber = useFormatNumber();
  const locale = useIntlLocale();
  if (!desktop) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10 text-ink">
        <PageHeader title={t("home.notDesktop.title")}>
          {t.rich("home.notDesktop.body", { link: pageLink("/how-to-use") })}
        </PageHeader>
      </div>
    );
  }

  const formatTime = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  const formatBytes = (bytes: number) =>
    bytes >= 1e9
      ? formatNumber(bytes / 1e9, { style: "unit", unit: "gigabyte", minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : formatNumber(Math.max(1, Math.round(bytes / 1e6)), { style: "unit", unit: "megabyte" });

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
  // FM's search result in the scan in use, and whether the screens were loaded from it.
  const staffFromScan = staffState.source?.snapshotId === activeId ? staffState.source : null;
  const searchText = (s: { players: number; staff: number }) =>
    s.players > 0 && s.staff > 0
      ? t("counts.playersAndStaff", { players: s.players, staff: s.staff })
      : s.staff > 0
        ? t("counts.staff", { count: s.staff })
        : t("counts.players", { count: s.players });
  // What was loaded next to your club, for the kinds (players, staff) of which only part was loaded.
  const loadedFrom = new Intl.ListFormat(locale, { type: "conjunction" }).format(
    [
      partial &&
        partial.players < partial.totalPlayers &&
        (fromScan?.search
          ? t("home.loadedFrom.playersSearch", { count: fromScan.search })
          : t("home.loadedFrom.playersBest")),
      partial &&
        partial.staff < partial.totalStaff &&
        (staffFromScan?.search
          ? t("home.loadedFrom.staffSearch", { count: staffFromScan.search })
          : t("home.loadedFrom.staffBest")),
    ].filter((x): x is string => typeof x === "string"),
  );
  const lastScan = lastOutcome?.ok ? lastOutcome.snapshot : null;
  const screenLinks = {
    b: strong,
    playersLink: pageLink("/players"),
    squadLink: pageLink("/squad"),
    growthLink: pageLink("/growth"),
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-5 py-6 text-ink">
      <PageHeader
        title={t("home.title")}
        aside={<ScanButton variant="page" />}
      >
        {t.rich("home.intro", {
          hotkey: settings?.hotkey ? "on" : "off",
          b: bold,
          settings: (chunks) => (
            <button type="button" className="link" onClick={() => openSettings("app")}>
              {chunks}
            </button>
          ),
        })}
      </PageHeader>

      {scanning && (
        <div className="panel px-4 py-3" role="status">
          <p className="text-sm font-semibold">{t("home.phase", { phase: progress?.phase ?? "memory" })}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
            <div className="h-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {lastOutcome && !scanning && !lastOutcome.ok && (
        <div role="alert" className="flex items-start gap-2.5 rounded-md border border-red bg-red/8 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red" aria-hidden />
          <div>
            <p className="font-semibold">{t(`home.errors.${ERROR_KEYS[lastOutcome.code] ?? "failed"}`)}</p>
            <p className="text-muted">{lastOutcome.message}</p>
            {lastOutcome.code === "no-search" && (
              <p className="text-muted">
                {t.rich("home.scanWholeSave", {
                  link: (chunks) => (
                    <button type="button" className="link" onClick={() => void scan("full")}>
                      {chunks}
                    </button>
                  ),
                })}
              </p>
            )}
          </div>
        </div>
      )}

      {lastScan && !scanning && (
        <div role="status" className="flex items-start gap-2.5 rounded-md border border-line bg-surface px-4 py-3 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden />
          <p>
            {lastScan.scope === "search"
              ? t.rich("home.doneSearch", {
                  players: lastScan.players,
                  staff: lastScan.staff,
                  search: searchText({ players: lastScan.searchPlayers ?? 0, staff: lastScan.searchStaff ?? 0 }),
                  hasClub: lastScan.myClub ? "yes" : "no",
                  club: lastScan.myClub ?? "",
                  ...screenLinks,
                })
              : t.rich("home.doneFull", {
                  players: lastScan.players,
                  staff: lastScan.staff,
                  hasClub: lastScan.myClub ? "yes" : "no",
                  club: lastScan.myClub ?? "",
                  ...screenLinks,
                })}
          </p>
        </div>
      )}

      {loading && (
        <p className="text-sm text-muted" role="status">
          {t("home.loading")}
        </p>
      )}
      {partial && !loading && (
        <p className="text-[13px] text-muted">
          {t("home.partial", {
            players: partial.players,
            totalPlayers: partial.totalPlayers,
            staff: partial.staff,
            totalStaff: partial.totalStaff,
            loadedFrom,
          })}
        </p>
      )}

      {active && !active.versionOk && (
        <Notice title={t("home.version.title")}>
          {t("home.version.body", { version: active.gameVersion ?? t("home.version.unknown"), game: active.game })}
        </Notice>
      )}
      {loadError && <Notice title={t("home.loadError")}>{loadError}</Notice>}

      <section className="panel" aria-labelledby="scans-title">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h2 id="scans-title" className="section-title">{t("home.stored.title")}</h2>
            <p className="text-[13px] text-muted">
              {t.rich("home.stored.kept", {
                retention: settings ? formatNumber(settings.retention) : "…",
                link: pageLink("/growth"),
              })}
              {diskBytes > 0 && ` ${t("home.stored.disk", { size: formatBytes(diskBytes) })}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button color="alt" variant="ghost" size="md" icon={<FolderOpen className="h-4 w-4" aria-hidden />} onClick={() => void bridge.openDataFolder()}>
              {t("home.stored.openFolder")}
            </Button>
            <Button color="alt" variant="outline" size="md" onClick={() => void loadSample()}>
              {t("home.stored.loadSample")}
            </Button>
          </div>
        </div>
        {snapshots.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">{t("home.stored.empty")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {/* Starred scans first, then the rest; newest first within each. */}
            {[...snapshots.filter((s) => s.favorite), ...snapshots.filter((s) => !s.favorite)].map((s) => {
              const search = searchText({ players: s.searchPlayers ?? 0, staff: s.searchStaff ?? 0 });
              const details = [
                t("counts.players", { count: s.players }),
                t("counts.staff", { count: s.staff }),
                s.myClub ?? t("home.details.noClub"),
                `${s.game} ${s.gameVersion ?? ""}`.trim(),
                t("home.details.scanned", { time: formatTime(s.scannedAt) }),
                s.bytes !== undefined && formatBytes(s.bytes),
                s.scope === "search" && t("home.details.search", { search }),
                s.scope !== "search" && !s.sample && t("home.details.wholeSave"),
                s.scope !== "search" && (s.searchPlayers || s.searchStaff) && t("home.details.fmSearch", { search }),
              ].filter((x): x is string => typeof x === "string" && x !== "");
              return (
                <StoredScanRow
                  key={s.id}
                  scan={s}
                  inUse={s.id === activeId}
                  loading={loading}
                  onUse={() => void loadSnapshot(s.id)}
                  onDelete={() => void deleteSnapshot(s.id)}
                  onUpdate={(patch) => updateSnapshot(s.id, patch)}
                  details={details.join(" · ")}
                />
              );
            })}
          </ul>
        )}
      </section>

      <section className="panel space-y-1.5 px-4 py-3 text-[13px] text-muted" aria-labelledby="about-title">
        <h2 id="about-title" className="section-title text-ink">{t("home.about.title")}</h2>
        <p>{t("home.about.version", { version: bridge.version })}</p>
        <p>{t.rich("home.about.reader", { link: externalLink("https://github.com/mavarobli/FMSuperScout") })}</p>
        <p>
          {t.rich("home.about.credits", {
            matchLab: externalLink("https://github.com/caiograco289/Fm-Match-Lab"),
            scoring: externalLink("https://github.com/jamiebolden/fm-scoring"),
          })}
        </p>
      </section>
    </div>
  );
}
