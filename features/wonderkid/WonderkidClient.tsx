"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { usePlayersData } from "@/components/PlayersDataProvider";
import { CsvImportPanel } from "@/components/CsvImportPanel";
import { PaginationControls, type PageSizeChoice } from "@/components/PaginationControls";
import type { PlayerWithGroups } from "@/data/players-store";
import { fm27PlayerScores, type Fm27PlayerScores } from "@/lib/fm27/player-scores";
import { PRIME_BENCHMARK, type Fm27Role } from "@/lib/fm27/benchmarks";
import type { CaModel } from "@/lib/fm27/potential";

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
        return m * String(va).localeCompare(String(vb), undefined, { sensitivity: "base" });
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
      className={`border-b-2 border-[oklch(var(--border))] px-2 py-2.5 ${align === "left" ? "text-left" : "text-right"}`}
    >
      <button
        type="button"
        title={title}
        onClick={() => onSort(key)}
        className={`inline-flex w-full items-center gap-1 rounded-lg px-1 py-0.5 text-xs font-black uppercase tracking-wider hover:bg-[oklch(var(--text))]/10 ${
          align === "right" ? "justify-end" : "justify-start"
        }`}
      >
        <span>{label}</span>
        {sort === key &&
          (dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden />)}
      </button>
    </th>
  );

  const inputClass =
    "rounded-lg border-2 border-[oklch(var(--border))] bg-[oklch(var(--background))] px-2 py-1 text-sm font-bold shadow-[2px_2px_0_oklch(var(--border))] focus:outline-none focus:ring-3 focus:ring-[oklch(var(--primary))]";

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
    <div className="min-h-screen bg-[oklch(var(--background))] text-[oklch(var(--text))]">
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="space-y-2">
          <h1 className="text-4xl font-black uppercase tracking-tight">Wonderkid Mode</h1>
          <p className="max-w-3xl text-sm text-[oklch(var(--text))/0.75]">
            Estimates each player&apos;s attributes at full potential (PA) from a v2 export, then
            scores them on the FM27 benchmark roles. A potential score of{" "}
            <span className="font-mono font-bold">{PRIME_BENCHMARK.toFixed(1)}</span> (100% vs
            prime) is a high-end Championship / low-end Premier League player in their prime.
          </p>
        </header>

        <CsvImportPanel testFixture="attribute-fm27-v2" onImported={() => setPage(1)} />

        {players.length === 0 && (
          <p className="text-sm font-bold text-[oklch(var(--text))/0.6]">
            No CSV imported yet. Export with the v2 view (Professionalism, CA, PA) and import it above.
          </p>
        )}

        {players.length > 0 && !caModels && (
          <div className="rounded-lg border-2 border-[oklch(var(--border))] bg-[oklch(var(--surface))] px-4 py-3 text-sm">
            <p className="font-bold">This import has no CA / PA columns.</p>
            <p className="text-[oklch(var(--text))]/70">
              Current FM27 role scores and vs Age are shown, but full-potential estimates need an
              export made with the v2 view.
            </p>
          </div>
        )}

        {players.length > 0 && (
          <>
            <section className="flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-wider text-[oklch(var(--text))]/60">
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
              <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-wider text-[oklch(var(--text))]/60">
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
              <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-wider text-[oklch(var(--text))]/60">
                Best role
                <select
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value as "all" | Fm27Role);
                    setPage(1);
                  }}
                  className={inputClass}
                >
                  {ROLE_FILTERS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-wider text-[oklch(var(--text))]/60">
                Search
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Player name"
                  className={`${inputClass} w-48 font-normal`}
                />
              </label>
              <p className="ml-auto font-mono text-sm font-bold">
                {total} of {players.length} players
              </p>
            </section>

            <div className="overflow-x-auto rounded-lg border-2 border-[oklch(var(--border))] bg-[oklch(var(--surface))] shadow-[4px_4px_0_oklch(var(--border))]">
              <table className="min-w-full text-sm">
                <thead className="bg-[oklch(var(--border))]/10">
                  <tr>
                    {th("player", "Player", undefined, "left")}
                    <th className="border-b-2 border-[oklch(var(--border))] px-2 py-2.5 text-left text-xs font-black uppercase tracking-wider">
                      Pos
                    </th>
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
                    <tr key={p.raw.uniqueId} className="border-b-2 border-[oklch(var(--border))]/30">
                      <td className="px-2 py-2">
                        <Link
                          href={`/attribute/players/${p.raw.uniqueId}`}
                          className="font-bold underline decoration-2 underline-offset-2 hover:decoration-[oklch(var(--primary))]"
                        >
                          {p.raw.player}
                        </Link>
                      </td>
                      <td className="px-2 py-2 font-mono text-xs uppercase">{p.raw.position}</td>
                      <td className="px-2 py-2 text-right font-mono text-xs">{p.raw.age}</td>
                      <td className="px-2 py-2 text-right font-mono text-xs">{p.raw.professionalism ?? "–"}</td>
                      <td className="px-2 py-2 text-right font-mono text-xs">{p.raw.currentAbility ?? "–"}</td>
                      <td className="px-2 py-2 text-right font-mono text-xs font-bold">{p.raw.potentialAbility ?? "–"}</td>
                      <td className="px-2 py-2 text-right font-mono text-xs">
                        {s.best.score.toFixed(1)}{" "}
                        <span className="text-[oklch(var(--text))]/55">{s.best.role}</span>
                      </td>
                      <td
                        className={`px-2 py-2 text-right font-mono text-xs font-bold ${
                          s.vsAge >= 1 ? "text-[oklch(var(--primary))]" : ""
                        }`}
                      >
                        {pct(s.vsAge)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-sm font-black">
                        {s.bestPotential ? (
                          <>
                            {s.bestPotential.score.toFixed(1)}{" "}
                            <span className="text-xs font-normal text-[oklch(var(--text))]/55">
                              {s.bestPotential.role}
                            </span>
                          </>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td
                        className={`px-2 py-2 text-right font-mono text-xs font-bold ${
                          (s.potentialVsPrime ?? 0) >= 1 ? "text-[oklch(var(--primary))]" : ""
                        }`}
                      >
                        {pct(s.potentialVsPrime)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
          </>
        )}

        <section className="space-y-2 rounded-lg border-2 border-[oklch(var(--border))]/50 bg-[oklch(var(--surface))] px-5 py-4 text-xs text-[oklch(var(--text))]/75">
          <h2 className="text-sm font-black uppercase tracking-wide text-[oklch(var(--text))]">
            How the estimate works
          </h2>
          <p>
            FM27 CA is a near-linear function of the position-weighted attribute sum. Using the
            FM27 CA-cost table from{" "}
            <a
              href="https://github.com/jamiebolden/fm-scoring"
              target="_blank"
              rel="noreferrer"
              className="font-bold underline"
            >
              fm-scoring
            </a>
            , the extra CA between CA and PA is converted to attribute points and spread over the
            attributes that can still grow, in proportion to their room below 20. Attributes that
            cost CA for the player&apos;s positions grow at full rate, others at half; physicals slow
            down after 21; personality attributes (Determination, Flair, Bravery, Leadership…) stay
            put. Multi-position players use the average cost of their positions.
          </p>
          <p>
            Roles and age benchmarks are fm-scoring&apos;s FM27 weights, tuned on harvestgreen22&apos;s
            match-engine attribute test. Reaching PA is never guaranteed: professionalism, playing
            time and training decide how much of it a player realises.
          </p>
          {modelLines.length > 0 && (
            <p className="font-mono">CA fit on this import: {modelLines.join(" · ")}</p>
          )}
        </section>
      </main>
    </div>
  );
}
