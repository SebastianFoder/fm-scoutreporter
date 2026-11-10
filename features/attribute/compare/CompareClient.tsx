"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlayerWithGroups } from "@/data/players-store";
import type { AttributeKey } from "@/types/weights";
import { computeScore } from "@/lib/scoring";
import { useActiveWeightProfile } from "@/components/WeightConfig";
import { useHighlightedAttributes } from "@/components/HighlightedAttributesConfig";
import Link from "next/link";
import { Button } from "@/components/Button";
import { getGroupedAttributeValue } from "@/lib/grouped-attribute-value";

interface Props {
  players: PlayerWithGroups[];
  initialSelectedIds?: string[];
}

const FALLBACK_HIGHLIGHTED_KEYS: AttributeKey[] = [
  "finishing",
  "offTheBall",
  "pace",
];

export default function CompareClient({
  players,
  initialSelectedIds = [],
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const { weights, emphasis } = useActiveWeightProfile();
  const highlighted = useHighlightedAttributes();

  const highlightedKeys =
    highlighted.length > 0 ? highlighted : FALLBACK_HIGHLIGHTED_KEYS;

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(t);
  }, [query]);

  const filteredPlayers = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => {
      const name = p.raw.player.toLowerCase();
      const pos = p.raw.position.toLowerCase();
      return name.includes(q) || pos.includes(q) || p.raw.uniqueId.includes(q);
    });
  }, [players, debouncedQuery]);

  const PAGE_SIZE = 50;
  const pageCount = Math.max(1, Math.ceil(filteredPlayers.length / PAGE_SIZE));
  const pagedPlayers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredPlayers.slice(start, start + PAGE_SIZE);
  }, [filteredPlayers, page]);

  const selected = useMemo(
    () => players.filter((p) => selectedIds.includes(p.raw.uniqueId)),
    [players, selectedIds],
  );

  const scored = useMemo(
    () =>
      selected.map((p) => ({
        p,
        score: computeScore(p, weights, emphasis),
      })),
    [selected, weights, emphasis],
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 text-[oklch(var(--text))]">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-black uppercase tracking-tight">Compare</h1>
          <p className="text-sm text-[oklch(var(--text))]/75">
            Pick players to compare. Gold/silver/bronze are awarded per row
            relative to the selected players.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            color="alt"
            variant="outline"
            size="sm"
            onClick={() => setSelectedIds([])}
            disabled={selectedIds.length === 0}
          >
            Clear selection
          </Button>
          <Button
            color="alt"
            variant="solid"
            size="sm"
            onClick={() => {
              const top = filteredPlayers
                .slice(0, 10)
                .map((p) => p.raw.uniqueId);
              setSelectedIds(top);
            }}
            disabled={filteredPlayers.length === 0}
          >
            Select first 10
          </Button>
        </div>
      </header>

      {/* Selection */}
      <section className="rounded-lg border-2 border-[oklch(var(--border))] bg-[oklch(var(--surface))] p-4 shadow-[4px_4px_0_oklch(var(--border))]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-black uppercase tracking-wide">Selected</h2>
            <p className="font-mono text-xs text-[oklch(var(--text))]/70">
              {selectedIds.length} selected
            </p>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, position, or ID…"
            className="w-full rounded-lg border-2 border-[oklch(var(--border))] bg-[oklch(var(--background))] px-3 py-2 text-sm outline-none placeholder:text-[oklch(var(--text))]/55 focus:ring-3 focus:ring-[oklch(var(--primary))] sm:max-w-sm"
          />
        </div>

        {selectedIds.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {selected.map((p) => (
              <button
                key={p.raw.uniqueId}
                type="button"
                onClick={() => toggleSelected(p.raw.uniqueId)}
                className="inline-flex items-center gap-2 rounded-lg border-2 border-[oklch(var(--border))] bg-[oklch(var(--background))] px-3 py-1 text-xs font-bold shadow-[2px_2px_0_oklch(var(--border))] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_oklch(var(--border))]"
              >
                <span>{p.raw.player}</span>
                <span className="font-mono text-[oklch(var(--text))]/65">
                  {p.raw.position}
                </span>
                <span className="font-black text-[oklch(var(--red-bg))]">×</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border-2 border-[oklch(var(--border))]">
          <div className="divide-y-2 divide-[oklch(var(--border))]/20">
            {pagedPlayers.map((p) => {
              const checked = selectedIds.includes(p.raw.uniqueId);
              return (
                <label
                  key={p.raw.uniqueId}
                  className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 hover:bg-[oklch(var(--primary))]/10 ${checked ? "bg-[oklch(var(--primary))]/15" : "bg-[oklch(var(--background))]"}`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">
                      {p.raw.player}
                    </div>
                    <div className="truncate font-mono text-xs text-[oklch(var(--text))]/65">
                      {p.raw.position} · {p.raw.uniqueId}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[oklch(var(--primary))]"
                    checked={checked}
                    onChange={() => toggleSelected(p.raw.uniqueId)}
                  />
                </label>
              );
            })}

            {filteredPlayers.length === 0 && (
              <div className="px-3 py-6 text-center text-sm font-bold text-[oklch(var(--text))]/70">
                No players match that search.
              </div>
            )}
          </div>
        </div>

        {filteredPlayers.length > 0 && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="font-mono text-xs text-[oklch(var(--text))]/70">
              {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, filteredPlayers.length)} of{" "}
              {filteredPlayers.length}
            </div>
            <div className="flex items-center gap-2">
              <Button
                color="alt"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <div className="font-mono text-xs font-bold text-[oklch(var(--text))]/70">
                {page} / {pageCount}
              </div>
              <Button
                color="alt"
                variant="outline"
                size="sm"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </section>

      {selected.length > 0 && (
        <section className="rounded-lg border-2 border-[oklch(var(--border))] bg-[oklch(var(--surface))] p-4 shadow-[4px_4px_0_oklch(var(--border))]">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-black uppercase tracking-wide">
              Comparison ({selected.length})
            </h2>
            <p className="font-mono text-xs text-[oklch(var(--text))]/70">
              score + {highlightedKeys.length} attributes
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border-2 border-[oklch(var(--border))]">
            <table className="min-w-full text-xs">
              <thead className="bg-[oklch(var(--border))]/10">
                <tr>
                  <th className="sticky left-0 z-10 border-b-2 border-r-2 border-[oklch(var(--border))] bg-[oklch(var(--surface))] px-3 py-2.5 text-left text-xs font-black uppercase tracking-wider">
                    Metric
                  </th>
                  {scored.map(({ p }) => (
                    <th key={p.raw.uniqueId} className="border-b-2 border-[oklch(var(--border))] px-3 py-2.5 text-left">
                      <div className="font-bold">
                        <Link
                          href={`/attribute/players/${p.raw.uniqueId}`}
                          className="underline decoration-2 underline-offset-2 hover:decoration-[oklch(var(--primary))]"
                        >
                          {p.raw.player}
                        </Link>
                      </div>
                      <div className="font-mono text-[10px] text-[oklch(var(--text))/0.65]">
                        {p.raw.position}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b-2 border-[oklch(var(--border))]/30 bg-[oklch(var(--border))]/5">
                  <td className="sticky left-0 z-10 border-r-2 border-[oklch(var(--border))] bg-[oklch(var(--surface))] px-3 py-2 font-black uppercase text-xs">
                    Weighted score
                  </td>
                  {(() => {
                    const medals = medalsByPlayerId(
                      scored.map(({ p, score }) => ({
                        id: p.raw.uniqueId,
                        value: score,
                      })),
                    );

                    return scored.map(({ p, score }) => {
                      const medal = medals[p.raw.uniqueId];
                      return (
                        <td
                          key={p.raw.uniqueId}
                          className="px-3 py-2 text-right"
                        >
                          <span
                            className={[
                              "font-mono text-sm font-black",
                              medal ? medalTextClass[medal] : "",
                            ].join(" ")}
                          >
                            {score.toFixed(2)}
                          </span>
                        </td>
                      );
                    });
                  })()}
                </tr>

                {highlightedKeys.map((key, idx) => {
                  const values = scored.map(({ p }) => {
                    const value = getGroupedAttributeValue(p.grouped, key);
                    return { id: p.raw.uniqueId, value };
                  });

                  const medals = medalsByPlayerId(values);

                  return (
                    <tr
                      key={key}
                      className={[
                        "border-b-2 border-[oklch(var(--border))]/15 last:border-0",
                        idx % 2 === 0
                          ? "bg-transparent"
                          : "bg-[oklch(var(--border))]/5",
                      ].join(" ")}
                    >
                      <td className="sticky left-0 z-10 border-r-2 border-[oklch(var(--border))] bg-[oklch(var(--surface))] px-3 py-2 font-bold uppercase text-xs">
                        {key}
                      </td>
                      {scored.map(({ p }) => {
                        const v =
                          values.find((x) => x.id === p.raw.uniqueId)?.value ??
                          0;
                        const medal = medals[p.raw.uniqueId];
                        return (
                          <td
                            key={p.raw.uniqueId + key}
                            className={[
                              "px-3 py-2 text-right font-mono text-sm",
                              medal
                                ? medalTextClass[medal]
                                : "text-[oklch(var(--text))]/85",
                            ].join(" ")}
                          >
                            {v}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selected.length === 0 && (
        <div className="rounded-lg border-2 border-[oklch(var(--border))] bg-[oklch(var(--surface))] p-6 text-sm font-bold text-[oklch(var(--text))]/75 shadow-[4px_4px_0_oklch(var(--border))]">
          Select at least 2 players above to start comparing.
        </div>
      )}
    </div>
  );
}

type Medal = "gold" | "silver" | "bronze";

const medalTextClass: Record<Medal, string> = {
  gold: "text-[oklch(var(--gold-bg))] font-black",
  silver: "text-[oklch(var(--silver-bg))] font-black",
  bronze: "text-[oklch(var(--bronze-bg))] font-black",
};

function medalsByPlayerId(
  items: Array<{ id: string; value: number }>,
): Record<string, Medal | null> {
  const sorted = [...items].sort((a, b) => b.value - a.value);

  const medals: Record<string, Medal | null> = Object.fromEntries(
    items.map((i) => [i.id, null]),
  );

  const distinctValues: number[] = [];
  for (const item of sorted) {
    if (!distinctValues.includes(item.value)) distinctValues.push(item.value);
    if (distinctValues.length >= 3) break;
  }

  const valueToMedal = new Map<number, Medal>();
  if (distinctValues[0] !== undefined)
    valueToMedal.set(distinctValues[0], "gold");
  if (distinctValues[1] !== undefined)
    valueToMedal.set(distinctValues[1], "silver");
  if (distinctValues[2] !== undefined)
    valueToMedal.set(distinctValues[2], "bronze");

  for (const item of items) {
    medals[item.id] = valueToMedal.get(item.value) ?? null;
  }

  return medals;
}
