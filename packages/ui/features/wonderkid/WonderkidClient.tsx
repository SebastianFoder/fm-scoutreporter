"use client";

import { useMemo, useState, type ReactNode } from "react";
import { PlayerLink } from "@scoutreporter/ui/components/PlayerPanel";
import { AlertTriangle, ArrowDown, ArrowUp } from "lucide-react";
import { usePlayersData } from "@scoutreporter/ui/components/PlayersDataProvider";
import { CsvImportPanel } from "@scoutreporter/ui/components/CsvImportPanel";
import { PageHeader } from "@scoutreporter/ui/components/PageHeader";
import { PaginationControls, type PageSizeChoice } from "@scoutreporter/ui/components/PaginationControls";
import type { PlayerWithGroups } from "@scoutreporter/core/players";
import { fm27PlayerScores, type Fm27PlayerScores } from "@scoutreporter/core/fm27/player-scores";
import { PRIME_BENCHMARK, type Fm27Role } from "@scoutreporter/core/fm27/benchmarks";
import type { CaModel } from "@scoutreporter/core/fm27/potential";
import { GradeStamp } from "@scoutreporter/ui/components/GradeStamp";
import { compareNames } from "@scoutreporter/core/text";

type Row = { p: PlayerWithGroups; s: Fm27PlayerScores };

type SortKey =
  | "player"
  | "age"
  | "prof"
  | "ca"
  | "pa"
  | "now"
  | "vsAge"
  | "potential"
  | "vsPrime";

const ROLE_FILTERS: { value: "all" | Fm27Role; label: string }[] = [
  { value: "all", label: "All roles" },
  { value: "GK", label: "GK" },
  { value: "CB", label: "CB" },
  { value: "WB/6", label: "WB / DM (6)" },
  { value: "10", label: "AM / Winger (10)" },
  { value: "9", label: "Striker (9)" },
];

function sortValue(r: Row, key: SortKey): number | string {
  switch (key) {
    case "player":
      return r.p.raw.player;
    case "age":
      return r.p.raw.age;
    case "prof":
      return r.p.raw.professionalism ?? -1;
    case "ca":
      return r.p.raw.currentAbility ?? -1;
    case "pa":
      return r.p.raw.potentialAbility ?? -1;
    case "now":
      return r.s.best.score;
    case "vsAge":
      return r.s.vsAge;
    case "potential":
      return r.s.bestPotential?.score ?? -1;
    case "vsPrime":
      return r.s.potentialVsPrime ?? -1;
  }
}

function pct(v: number | null): string {
  return v === null ? "–" : `${Math.round(v * 100)}%`;
}

export default function WonderkidClient() {
  const { state } = usePlayersData();
  const { players, caModels } = state;

  const [maxAge, setMaxAge] = useState(21);
  const [minProf, setMinProf] = useState(0);
  const [role, setRole] = useState<"all" | Fm27Role>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("potential");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeChoice>(25);

  const scored = useMemo<Row[]>(
    () => players.map((p) => ({ p, s: fm27PlayerScores(p) })),
    [players],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scored.filter(({ p, s }) => {
      if (p.raw.age > maxAge) return false;
      if (minProf > 0 && (p.raw.professionalism ?? 0) < minProf) return false;
      if (role !== "all" && (s.bestPotential ?? s.best).role !== role) return false;
      if (q && !p.raw.player.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [scored, maxAge, minProf, role, query]);

  const sorted = useMemo(() => {
    const m = dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = sortValue(a, sort);
      const vb = sortValue(b, sort);
      if (typeof va === "string" || typeof vb === "string") {
        return m * compareNames(String(va), String(vb));
      }
      return m * (va - vb);
    });
  }, [filtered, sort, dir]);

  const total = sorted.length;
  const pageCount = pageSize === "all" ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const size = pageSize === "all" ? Math.max(1, total) : pageSize;
  const pageItems = sorted.slice((currentPage - 1) * size, currentPage * size);

  const onSort = (key: SortKey) => {
    if (key === sort) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(key);
      setDir(key === "player" || key === "age" ? "asc" : "desc");
    }
    setPage(1);
  };

  const th = (key: SortKey, label: ReactNode, title?: string, align: "left" | "right" = "right") => (
    <th
      scope="col"
      aria-sort={sort === key ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={align === "left" ? "text-left" : "text-right"}
    >
      <button
        type="button"
        title={title}
        onClick={() => onSort(key)}
        className={`inline-flex w-full cursor-pointer items-center gap-1 px-2.5 py-2 hover:text-ink focus-visible:-outline-offset-2 ${
          align === "right" ? "justify-end" : "justify-start"
        }`}
      >
        <span>{label}</span>
        {sort === key &&
          (dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden />)}
      </button>
    </th>
  );

  const inputClass = "field h-9 px-2.5 text-sm text-ink";
  const filterLabel = "flex flex-col gap-1 text-[13px] text-muted";

  const modelLines: string[] = caModels
    ? [
        ["All positions", caModels.global] as const,
        ...(Object.entries(caModels.byGroup) as [string, CaModel][]),
      ].map(([label, m]) =>
        m.source === "default"
          ? `${label}: default FM27 fit (too few players to calibrate)`
          : `${label}: n=${m.n}, r=${m.r?.toFixed(3)}, RMSE=${m.rmse?.toFixed(1)} CA`,
      )
    : [];

  return (
    <div className="text-ink">
      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6 md:py-8">
        <PageHeader title="Wonderkid mode">
          Estimates each player&apos;s attributes at full potential (PA) from a Hidden Attributes view export, then
          scores them on the FM27 benchmark roles. A potential score of{" "}
          <span className="font-semibold text-ink">{PRIME_BENCHMARK.toFixed(1)}</span> (100% vs
          prime) is a high-end Championship / low-end Premier League player in their prime.
        </PageHeader>

        <CsvImportPanel testFixture="attribute-fm27-hidden" onImported={() => setPage(1)} />

        {players.length === 0 && (
          <p className="rounded-md border border-dashed border-line px-6 py-10 text-center text-sm text-muted">
            No CSV imported yet. Export with the Hidden Attributes view (Professionalism, CA, PA) and import it above.
          </p>
        )}

        {players.length > 0 && !caModels && (
          <div role="status" className="flex items-start gap-2.5 rounded-md border border-gold bg-gold/12 px-4 py-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">This import has no CA / PA columns.</p>
              <p className="text-muted">
                Current FM27 role scores and vs Age are shown, but full-potential estimates need an
                export made with the Hidden Attributes view.
              </p>
            </div>
          </div>
        )}

        {players.length > 0 && (
          <section aria-label="Prospects" className="panel">
            <div
              role="group"
              aria-label="Filters"
              className="flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-line px-4 py-3"
            >
              <label className={filterLabel}>
                Max age
                <input
                  type="number"
                  min={14}
                  max={45}
                  value={maxAge}
                  onChange={(e) => {
                    setMaxAge(Number(e.target.value) || 45);
                    setPage(1);
                  }}
                  className={`${inputClass} w-20`}
                />
              </label>
              <label className={filterLabel}>
                Min professionalism
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={minProf}
                  onChange={(e) => {
                    setMinProf(Number(e.target.value) || 0);
                    setPage(1);
                  }}
                  className={`${inputClass} w-20`}
                />
              </label>
              <label className={filterLabel}>
                Best role
                <select
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value as "all" | Fm27Role);
                    setPage(1);
                  }}
                  className={`${inputClass} pl-2.5`}
                >
                  {ROLE_FILTERS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${filterLabel} min-w-48 flex-1 sm:max-w-xs`}>
                Search
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Player name"
                  className={`${inputClass} w-full`}
                />
              </label>
              <p className="ml-auto pb-2 text-sm text-muted">
                <span className="font-semibold text-ink">{total}</span> of {players.length} players
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    {th("player", "Player", undefined, "left")}
                    <th className="px-2.5 py-2 text-left">Pos</th>
                    {th("age", "Age")}
                    {th("prof", "Prof", "Professionalism")}
                    {th("ca", "CA", "Current ability")}
                    {th("pa", "PA", "Potential ability")}
                    {th("now", "Now", "Best FM27 role score today (1–20)")}
                    {th("vsAge", "vs Age", "Best role score ÷ FM27 benchmark for their age")}
                    {th("potential", "Potential", "Best FM27 role score with attributes projected to PA")}
                    {th("vsPrime", "vs Prime", `Potential ÷ prime benchmark (${PRIME_BENCHMARK})`)}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(({ p, s }) => (
                    <tr key={p.raw.uniqueId}>
                      <td className="px-2.5 py-2">
                        <PlayerLink id={p.raw.uniqueId} className="font-semibold hover:text-accent hover:underline">
                          {p.raw.player}
                        </PlayerLink>
                      </td>
                      <td className="px-2.5 py-2 text-[13px] text-muted">{p.raw.position}</td>
                      <td className="px-2.5 py-2 text-right">{p.raw.age}</td>
                      <td className="px-2.5 py-2 text-right">{p.raw.professionalism ?? "–"}</td>
                      <td className="px-2.5 py-2 text-right">{p.raw.currentAbility ?? "–"}</td>
                      <td className="px-2.5 py-2 text-right font-semibold">{p.raw.potentialAbility ?? "–"}</td>
                      <td className="px-2.5 py-2 text-right">
                        <span className="inline-flex items-center justify-end gap-2">
                          <span>
                            {s.best.score.toFixed(1)}{" "}
                            <span className="text-[12px] text-muted">{s.best.role}</span>
                          </span>
                          <GradeStamp score={s.best.score} label="Now" />
                        </span>
                      </td>
                      <td
                        className={`px-2.5 py-2 text-right ${
                          s.vsAge >= 1 ? "font-semibold text-positive" : "text-muted"
                        }`}
                      >
                        {pct(s.vsAge)}
                      </td>
                      <td className="px-2.5 py-2 text-right font-bold">
                        {s.bestPotential ? (
                          <span className="inline-flex items-center justify-end gap-2">
                            <span>
                              {s.bestPotential.score.toFixed(1)}{" "}
                              <span className="text-[12px] font-normal text-muted">
                                {s.bestPotential.role}
                              </span>
                            </span>
                            <GradeStamp score={s.bestPotential.score} label="Potential" />
                          </span>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td
                        className={`px-2.5 py-2 text-right ${
                          (s.potentialVsPrime ?? 0) >= 1 ? "font-semibold text-positive" : "text-muted"
                        }`}
                      >
                        {pct(s.potentialVsPrime)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-line px-4 py-3">
              <PaginationControls
                page={currentPage}
                pageCount={pageCount}
                pageSize={pageSize}
                totalItems={total}
                showingFrom={total === 0 ? 0 : (currentPage - 1) * size + 1}
                showingTo={Math.min(currentPage * size, total)}
                onPageChange={setPage}
                onPageSizeChange={(n) => {
                  setPageSize(n);
                  setPage(1);
                }}
              />
            </div>
          </section>
        )}

        <section aria-labelledby="method" className="max-w-3xl space-y-2.5 text-sm leading-relaxed text-muted">
          <h2 id="method" className="section-title">
            How the estimate works
          </h2>
          <p>
            FM27 CA is a near-linear function of the position-weighted attribute sum. Using the
            FM27 CA-cost table from{" "}
            <a
              href="https://github.com/jamiebolden/fm-scoring"
              target="_blank"
              rel="noreferrer"
              className="link"
            >
              fm-scoring
            </a>
            , the extra CA between CA and PA is converted to attribute points and spread over the
            attributes that can still grow. Each attribute grows in proportion to its room below 20
            and to the rate harvestgreen22&apos;s FM27 training test measured for it, using defensive
            ball work schedules for defenders and DMs and attacking ones for wide players and
            forwards. Physicals slow down after 21 (24 for keepers). Determination, Aggression and
            Bravery stay put. Multi-position players use the average of their positions.
          </p>
          <p>
            Roles and age benchmarks are fm-scoring&apos;s FM27 weights, tuned on harvestgreen22&apos;s
            match-engine attribute test. Reaching PA is never guaranteed: professionalism, playing
            time and training decide how much of it a player realises. Open a player for a
            development plan built on that research.
          </p>
          {modelLines.length > 0 && (
            <p className="codeblock text-ink">CA fit on this import: {modelLines.join(" · ")}</p>
          )}
        </section>
      </main>
    </div>
  );
}
