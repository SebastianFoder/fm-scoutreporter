"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { PageHeader } from "@scoutreporter/ui/components/PageHeader";
import { Notice } from "@scoutreporter/ui/components/Notice";
import { Button } from "@scoutreporter/ui/components/Button";
import type { GrowthSort } from "@scoutreporter/core/scan/growth";
import type { GrowthPage } from "@scoutreporter/core/desktop/bridge";
import { attributeLabel } from "@scoutreporter/core/fm27/development";
import type { AttributeKey } from "@scoutreporter/core/types/weights";
import { usePlayersData } from "@scoutreporter/ui/components/PlayersDataProvider";
import { scanLabel, useDesktop } from "./DesktopProvider";

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

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function changeClass(n: number): string {
  return n > 0 ? "text-positive font-semibold" : n < 0 ? "text-red font-semibold" : "text-muted";
}

/**
 * Growth between two stored scans: CA and attribute change per player, for every player in both
 * scans (the comparison runs in the scan databases, not only on the loaded players). Desktop app only.
 */
export function GrowthClient() {
  const desktop = useDesktop();
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

  // Only loaded players have a profile page; the rest of the database is listed without a link.
  const loaded = useMemo(() => new Set(playersState.players.map((p) => p.raw.uniqueId)), [playersState.players]);
  const rows = report?.rows ?? [];

  if (!desktop) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10 text-ink">
        <PageHeader title="Growth">Growth compares stored scans and is part of the Scout Reporter desktop app.</PageHeader>
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
      <PageHeader title="Growth">
        How much every player improved between two scans of your save. Scan regularly (every few in-game months) to follow
        your youngsters and spot breakout players worldwide.
      </PageHeader>

      {snapshots.length < 2 ? (
        <Notice title="Two scans needed">
          Growth compares two scans. You have {snapshots.length}. <Link href="/desktop" className="link">Scan FM</Link> again later in your
          save.
        </Notice>
      ) : (
        <>
          <div className="panel flex flex-wrap items-end gap-4 px-4 py-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="font-semibold">From</span>
              <select className="rounded-md border border-line bg-surface px-2 py-1" value={base} onChange={(e) => { setBaseId(e.target.value); setLimit(PAGE); }}>
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {scanLabel(s)} ({s.players.toLocaleString("en-GB")} players)
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-semibold">To</span>
              <select className="rounded-md border border-line bg-surface px-2 py-1" value={current} onChange={(e) => { setCurrentId(e.target.value); setLimit(PAGE); }}>
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {scanLabel(s)} ({s.players.toLocaleString("en-GB")} players)
                  </option>
                ))}
              </select>
            </label>
            {!hide && (
              <label className="flex flex-col gap-1">
                <span className="font-semibold">Gained at least</span>
                <span className="flex items-center gap-1">
                  <input type="number" className="w-20 rounded-md border border-line bg-surface px-2 py-1" value={minCaGain} placeholder="any" onChange={(e) => { setMinCaGain(e.target.value); setLimit(PAGE); }} />
                  <span className="text-muted">CA</span>
                </span>
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="font-semibold">Max age</span>
              <input type="number" className="w-20 rounded-md border border-line bg-surface px-2 py-1" value={maxAge} placeholder="any" onChange={(e) => { setMaxAge(e.target.value); setLimit(PAGE); }} />
            </label>
            <label className="flex min-w-48 flex-1 flex-col gap-1">
              <span className="font-semibold">Search</span>
              <input type="search" className="rounded-md border border-line bg-surface px-2 py-1" value={query} placeholder="Player or club" onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} />
            </label>
          </div>

          {base === current && <Notice title="Same scan twice">Pick two different scans.</Notice>}
          {error && <Notice title="Could not compare the scans">{error}</Notice>}
          {loading && !report && <p className="text-sm text-muted" role="status">Comparing scans…</p>}

          {report && (
            <section className="panel" aria-label="Growth" aria-busy={loading}>
              <p className="border-b border-line px-4 py-2.5 text-[13px] text-muted">
                {report.total.toLocaleString("en-GB")} players
                {report.days !== null && ` over ${report.days} in-game days`}
                {report.newPlayers > 0 && `, plus ${report.newPlayers.toLocaleString("en-GB")} new players (youth intakes or newly loaded leagues) with no earlier scan`}
                .{loading && " Updating…"}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm tabular-nums">
                  <thead className="bg-paper text-[12px] text-muted">
                    <tr>
                      {header("name", "Player")}
                      {header("age", "Age")}
                      <th scope="col" className="px-3 py-2 font-semibold">Club</th>
                      {!hide && header("ca", "CA")}
                      {!hide && header("caChange", "CA change")}
                      {!hide && header("paChange", "PA change")}
                      {header("attributeChange", "Attributes")}
                      <th scope="col" className="px-3 py-2 font-semibold">Biggest changes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((r) => (
                      <tr key={r.player.uid}>
                        <td className="px-3 py-1.5 font-semibold">
                          {loaded.has(String(r.player.uid)) ? (
                            <Link href={`/attribute/players/${r.player.uid}`} className="hover:underline">{r.player.name}</Link>
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
                          {r.changes.slice(0, 4).map((c) => `${attributeLabel(c.key as AttributeKey)} ${signed(c.to - c.from)}`).join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {report.total > rows.length && (
                <div className="border-t border-line px-4 py-2.5">
                  <Button color="alt" variant="outline" size="md" disabled={loading || limit >= 1000} onClick={() => setLimit(Math.min(1000, limit + PAGE))}>
                    {limit >= 1000 ? "Showing the first 1,000: narrow the filters to see others" : `Show ${Math.min(PAGE, report.total - rows.length)} more`}
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
