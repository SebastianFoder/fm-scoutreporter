"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PlayerLink } from "@scoutreporter/ui/components/PlayerPanel";
import { ArrowDown, ArrowUp } from "lucide-react";
import { PageHeader } from "@scoutreporter/ui/components/PageHeader";
import { Notice } from "@scoutreporter/ui/components/Notice";
import { Button } from "@scoutreporter/ui/components/Button";
import type { GrowthSort } from "@scoutreporter/core/scan/growth";
import type { GrowthPage } from "@scoutreporter/core/desktop/bridge";
import { usePlayersData } from "@scoutreporter/ui/components/PlayersDataProvider";
import { useAttributeLabel, useFormatNumber } from "@scoutreporter/ui/i18n/hooks";
import { useScanLabel, useDesktop } from "./DesktopProvider";

const PAGE = 100;

/** `value` once it has stopped changing for `ms` (so typing does not query on every key). */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

const optionalNumber = (v: string): number | undefined => (v.trim() === "" || !Number.isFinite(Number(v)) ? undefined : Number(v));

const scansLink = (chunks: ReactNode) => (
  <Link href="/desktop" className="link">
    {chunks}
  </Link>
);

function changeClass(n: number): string {
  return n > 0 ? "text-positive font-semibold" : n < 0 ? "text-red font-semibold" : "text-muted";
}

/**
 * Growth between two stored scans: CA and attribute change per player, for every player in both
 * scans (the comparison runs in the scan databases, not only on the loaded players). Desktop app only.
 */
export function GrowthClient() {
  const desktop = useDesktop();
  const t = useTranslations("desktop.growth");
  const tFm = useTranslations("fm.terms");
  const formatNumber = useFormatNumber();
  const attributeLabel = useAttributeLabel();
  const scanLabel = useScanLabel();
  /** "+3", "-2", "0" in the current language. */
  const signed = (n: number) => formatNumber(n, { signDisplay: "exceptZero" });
  const { state: playersState } = usePlayersData();
  const snapshots = useMemo(() => desktop?.snapshots ?? [], [desktop?.snapshots]);
  const [baseId, setBaseId] = useState<string>("");
  const [currentId, setCurrentId] = useState<string>("");
  const [report, setReport] = useState<GrowthPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [minCaGain, setMinCaGain] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<GrowthSort>("caChange");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [limit, setLimit] = useState(PAGE);
  const hide = desktop?.settings?.hideHidden === true;

  // Default: the newest scan against the one before it.
  const current = currentId || snapshots[0]?.id || "";
  const base = baseId || snapshots.find((s) => s.id !== current)?.id || "";

  // Filters, sorting and paging run in the scan databases (main process), debounced while typing.
  const filters = useDebounced(
    JSON.stringify({
      minCaGain: hide ? undefined : optionalNumber(minCaGain),
      maxAge: optionalNumber(maxAge),
      query: query.trim() || undefined,
      sort: hide && (sort === "caChange" || sort === "paChange" || sort === "ca") ? "attributeChange" : sort,
      dir,
    }),
    250,
  );

  const bridge = desktop?.bridge;
  useEffect(() => {
    if (!bridge || !current || !base || current === base) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setLoading(true);
      setError(null);
    });
    void bridge
      .compareSnapshots(base, current, { ...JSON.parse(filters), limit })
      .then((page) => active && setReport(page))
      .catch((e: Error) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [bridge, base, current, filters, limit]);

  // A scan that kept only FM's search and your club: Growth then covers the players in both scans.
  const searchScans = [base, current].some((id) => snapshots.find((s) => s.id === id)?.scope === "search");

  // Only loaded players have a profile page; the rest of the database is listed without a link.
  const loaded = useMemo(() => new Set(playersState.players.map((p) => p.raw.uniqueId)), [playersState.players]);
  const rows = report?.rows ?? [];

  if (!desktop) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10 text-ink">
        <PageHeader title={t("title")}>{t("notDesktop")}</PageHeader>
      </div>
    );
  }

  const setSortTo = (s: GrowthSort) => {
    setLimit(PAGE);
    if (s === sort) setDir(dir === "desc" ? "asc" : "desc");
    else {
      setSort(s);
      setDir(s === "name" ? "asc" : "desc");
    }
  };
  const header = (s: GrowthSort, label: string, className = "") => (
    <th scope="col" className={`px-3 py-2 font-semibold ${className}`} aria-sort={sort === s ? (dir === "asc" ? "ascending" : "descending") : undefined}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setSortTo(s)}>
        {label}
        {sort === s && (dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden />)}
      </button>
    </th>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-5 py-6 text-ink">
      <PageHeader title={t("title")}>{t("intro")}</PageHeader>

      {snapshots.length < 2 ? (
        <Notice title={t("twoNeeded.title")}>
          {t.rich("twoNeeded.body", { count: snapshots.length, link: scansLink })}
        </Notice>
      ) : (
        <>
          <div className="panel flex flex-wrap items-end gap-4 px-4 py-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="font-semibold">{t("from")}</span>
              <select className="rounded-md border border-line bg-surface px-2 py-1" value={base} onChange={(e) => { setBaseId(e.target.value); setLimit(PAGE); }}>
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {t("option", { label: scanLabel(s), count: s.players })}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-semibold">{t("to")}</span>
              <select className="rounded-md border border-line bg-surface px-2 py-1" value={current} onChange={(e) => { setCurrentId(e.target.value); setLimit(PAGE); }}>
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {t("option", { label: scanLabel(s), count: s.players })}
                  </option>
                ))}
              </select>
            </label>
            {!hide && (
              <label className="flex flex-col gap-1">
                <span className="font-semibold">{t("gainedAtLeast")}</span>
                <span className="flex items-center gap-1">
                  <input type="number" className="w-20 rounded-md border border-line bg-surface px-2 py-1" value={minCaGain} placeholder={t("any")} onChange={(e) => { setMinCaGain(e.target.value); setLimit(PAGE); }} />
                  <span className="text-muted">{t("ca")}</span>
                </span>
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="font-semibold">{t("maxAge")}</span>
              <input type="number" className="w-20 rounded-md border border-line bg-surface px-2 py-1" value={maxAge} placeholder={t("any")} onChange={(e) => { setMaxAge(e.target.value); setLimit(PAGE); }} />
            </label>
            <label className="flex min-w-48 flex-1 flex-col gap-1">
              <span className="font-semibold">{t("search")}</span>
              <input type="search" className="rounded-md border border-line bg-surface px-2 py-1" value={query} placeholder={t("searchPlaceholder")} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} />
            </label>
          </div>

          {searchScans && base !== current && (
            <p className="text-[13px] text-muted">{t.rich("searchScans", { link: scansLink })}</p>
          )}
          {base === current && <Notice title={t("sameScan.title")}>{t("sameScan.body")}</Notice>}
          {error && <Notice title={t("compareError")}>{error}</Notice>}
          {loading && !report && <p className="text-sm text-muted" role="status">{t("comparing")}</p>}

          {report && (
            <section className="panel" aria-label={t("title")} aria-busy={loading}>
              <p className="border-b border-line px-4 py-2.5 text-[13px] text-muted">
                {t("summary", {
                  total: report.total,
                  hasDays: report.days !== null ? "yes" : "no",
                  days: report.days ?? 0,
                  newPlayers: report.newPlayers > 0 ? (searchScans ? "search" : "full") : "none",
                  newCount: report.newPlayers,
                })}
                {loading && ` ${t("updating")}`}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm tabular-nums">
                  <thead className="bg-paper text-[12px] text-muted">
                    <tr>
                      {header("name", tFm("player"))}
                      {header("age", tFm("age"))}
                      <th scope="col" className="px-3 py-2 font-semibold">{tFm("club")}</th>
                      {!hide && header("ca", t("columns.ca"))}
                      {!hide && header("caChange", t("columns.caChange"))}
                      {!hide && header("paChange", t("columns.paChange"))}
                      {header("attributeChange", tFm("attributes"))}
                      <th scope="col" className="px-3 py-2 font-semibold">{t("columns.biggestChanges")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((r) => (
                      <tr key={r.player.uid}>
                        <td className="px-3 py-1.5 font-semibold">
                          {loaded.has(String(r.player.uid)) ? (
                            <PlayerLink id={String(r.player.uid)} className="hover:underline">{r.player.name}</PlayerLink>
                          ) : (
                            r.player.name
                          )}
                        </td>
                        <td className="px-3 py-1.5">{r.player.age ?? ""}</td>
                        <td className="px-3 py-1.5 text-muted">{r.player.club ?? ""}</td>
                        {!hide && <td className="px-3 py-1.5">{r.player.ca}</td>}
                        {!hide && <td className={`px-3 py-1.5 ${changeClass(r.caChange)}`}>{signed(r.caChange)}</td>}
                        {!hide && <td className={`px-3 py-1.5 ${changeClass(r.paChange)}`}>{signed(r.paChange)}</td>}
                        <td className={`px-3 py-1.5 ${changeClass(r.attributeChange)}`}>{signed(r.attributeChange)}</td>
                        <td className="px-3 py-1.5 text-[13px] text-muted">
                          {r.changes.slice(0, 4).map((c) => `${attributeLabel(c.key)} ${signed(c.to - c.from)}`).join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {report.total > rows.length && (
                <div className="border-t border-line px-4 py-2.5">
                  <Button color="alt" variant="outline" size="md" disabled={loading || limit >= 1000} onClick={() => setLimit(Math.min(1000, limit + PAGE))}>
                    {limit >= 1000
                      ? t("firstOnly", { max: 1000 })
                      : t("showMore", { count: Math.min(PAGE, report.total - rows.length) })}
                  </Button>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
