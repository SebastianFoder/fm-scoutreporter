"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { PlayerWithGroups } from "@scoutreporter/core/players";
import type { AttributeKey } from "@scoutreporter/core/types/weights";
import { computeScore } from "@scoutreporter/core/scoring";
import { useActiveWeightProfile } from "@scoutreporter/ui/components/WeightConfig";
import { useHighlightedAttributes } from "@scoutreporter/ui/components/HighlightedAttributesConfig";
import { PlayerLink } from "@scoutreporter/ui/components/PlayerPanel";
import { Button } from "@scoutreporter/ui/components/Button";
import { PageHeader } from "@scoutreporter/ui/components/PageHeader";
import { getGroupedAttributeValue } from "@scoutreporter/core/grouped-attribute-value";
import { useTranslations } from "next-intl";
import { useAttributeLabel, useFormatNumber } from "@scoutreporter/ui/i18n/hooks";

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
  const t = useTranslations("players");
  const tFm = useTranslations("fm.terms");
  const attributeLabel = useAttributeLabel();
  const formatNumber = useFormatNumber();

  const highlightedKeys =
    highlighted.length > 0 ? highlighted : FALLBACK_HIGHLIGHTED_KEYS;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
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
    <div className="mx-auto max-w-7xl space-y-5 px-5 py-6 text-ink md:py-8">
      <PageHeader
        title={t("compare.title")}
        aside={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              color="alt"
              variant="ghost"
              size="md"
              onClick={() => setSelectedIds([])}
              disabled={selectedIds.length === 0}
            >
              {t("compare.clearSelection")}
            </Button>
            <Button
              color="alt"
              variant="outline"
              size="md"
              onClick={() => {
                const top = filteredPlayers
                  .slice(0, 10)
                  .map((p) => p.raw.uniqueId);
                setSelectedIds(top);
              }}
              disabled={filteredPlayers.length === 0}
            >
              {t("compare.selectFirst", { count: 10 })}
            </Button>
          </div>
        }
      >
        {t("compare.intro")}
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <section
          aria-label={t("compare.choosePlayers")}
          className="panel flex flex-col lg:max-h-[calc(100vh-12rem)] lg:self-start"
        >
          <div className="border-b border-line px-3 py-3">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="section-title">{tFm("players")}</h2>
              <p className="text-[13px] text-muted">{t("selectedCount", { count: selectedIds.length })}</p>
            </div>
            <span className="relative block">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("compare.searchPlaceholder")}
                aria-label={t("compare.searchLabel")}
                className="field h-9 w-full py-2 pl-8 pr-3 text-sm"
              />
            </span>
          </div>

          <div className="max-h-80 min-h-0 flex-1 overflow-y-auto lg:max-h-none">
            <div className="divide-y divide-line/70">
              {pagedPlayers.map((p) => {
                const checked = selectedIds.includes(p.raw.uniqueId);
                return (
                  <label
                    key={p.raw.uniqueId}
                    className={`flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-series-1/6 ${checked ? "bg-series-1/12" : ""}`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0"
                      checked={checked}
                      onChange={() => toggleSelected(p.raw.uniqueId)}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{p.raw.player}</div>
                      <div className="truncate text-[12px] text-muted">
                        {p.raw.position} · {p.raw.uniqueId}
                      </div>
                    </div>
                  </label>
                );
              })}

              {filteredPlayers.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-muted">
                  {t("compare.noMatch")}
                </div>
              )}
            </div>
          </div>

          {filteredPlayers.length > 0 && (
            <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
              <div className="text-[12px] text-muted">
                {t("compare.range", {
                  from: (page - 1) * PAGE_SIZE + 1,
                  to: Math.min(page * PAGE_SIZE, filteredPlayers.length),
                  total: filteredPlayers.length,
                })}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  color="alt"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t("compare.prev")}
                </Button>
                <div className="px-1 text-[12px] font-semibold">
                  {page} <span className="font-normal text-muted">/ {pageCount}</span>
                </div>
                <Button
                  color="alt"
                  variant="outline"
                  size="sm"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  {t("compare.next")}
                </Button>
              </div>
            </div>
          )}
        </section>

        <div className="min-w-0 space-y-3">
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((p) => (
                <button
                  key={p.raw.uniqueId}
                  type="button"
                  onClick={() => toggleSelected(p.raw.uniqueId)}
                  aria-label={t("compare.removePlayer", { name: p.raw.player })}
                  className="group inline-flex items-center gap-1.5 rounded border border-line bg-surface py-1 pl-2.5 pr-1.5 text-[13px] font-medium hover:border-red/60"
                >
                  <span>{p.raw.player}</span>
                  <X className="h-3.5 w-3.5 text-muted group-hover:text-red" aria-hidden />
                </button>
              ))}
            </div>
          )}

          {selected.length > 0 && (
            <section aria-label={t("compare.comparison")} className="panel overflow-hidden">
              <div className="flex items-baseline justify-between gap-3 px-4 py-3">
                <h2 className="section-title">
                  {t.rich("compare.comparisonTitle", {
                    count: selected.length,
                    muted: (chunks) => <span className="font-normal text-muted">{chunks}</span>,
                  })}
                </h2>
                <p className="text-[13px] text-muted">
                  {t("compare.summary", { count: highlightedKeys.length })}
                </p>
              </div>

              <div className="overflow-x-auto border-t border-line">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 border-r border-line px-3 py-2 text-left">
                        {t("compare.metric")}
                      </th>
                      {scored.map(({ p }) => (
                        <th key={p.raw.uniqueId} className="px-3 py-2 text-right align-bottom">
                          <PlayerLink
                            id={p.raw.uniqueId}
                            scoring="profile"
                            className="block font-sans text-sm font-semibold text-ink hover:text-accent hover:underline"
                          >
                            {p.raw.player}
                          </PlayerLink>
                          <span className="block text-[12px] font-normal">{p.raw.position}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="sticky left-0 z-10 border-r border-line bg-surface px-3 py-2 font-semibold">
                        {t("compare.weightedScore")}
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
                            <td key={p.raw.uniqueId} className="px-3 py-2 text-right">
                              <MedalValue medal={medal} className="font-bold">
                                {formatNumber(score, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </MedalValue>
                            </td>
                          );
                        });
                      })()}
                    </tr>

                    {highlightedKeys.map((key) => {
                      const values = scored.map(({ p }) => {
                        const value = getGroupedAttributeValue(p.grouped, key);
                        return { id: p.raw.uniqueId, value };
                      });

                      const medals = medalsByPlayerId(values);

                      return (
                        <tr key={key}>
                          <td className="sticky left-0 z-10 border-r border-line bg-surface px-3 py-2">
                            {attributeLabel(key)}
                          </td>
                          {scored.map(({ p }) => {
                            const v =
                              values.find((x) => x.id === p.raw.uniqueId)?.value ??
                              0;
                            const medal = medals[p.raw.uniqueId];
                            return (
                              <td key={p.raw.uniqueId + key} className="px-3 py-2 text-right">
                                <MedalValue medal={medal}>{v}</MedalValue>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ul
                className="flex flex-wrap items-center gap-4 border-t border-line px-4 py-2 text-[12px] text-muted"
                aria-label={t("compare.legend")}
              >
                <li className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-[2px] bg-gold" aria-hidden /> {t("compare.best")}
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-[2px] bg-silver" aria-hidden /> {t("compare.medals.silver")}
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-[2px] bg-bronze" aria-hidden /> {t("compare.medals.bronze")}
                </li>
              </ul>
            </section>
          )}

          {selected.length === 0 && (
            <div className="rounded-md border border-dashed border-line p-8 text-center text-sm text-muted">
              {t("compare.empty")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type Medal = "gold" | "silver" | "bronze";

const medalClass: Record<Medal, string> = {
  gold: "bg-gold text-on-gold",
  silver: "bg-silver text-on-silver",
  bronze: "bg-bronze text-on-bronze",
};

function MedalValue({
  medal,
  className,
  children,
}: {
  medal: Medal | null | undefined;
  className?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("players.compare.medals");
  return (
    <span
      className={[
        "inline-block min-w-[2.25rem] rounded-[3px] px-1.5 py-0.5 text-right",
        medal ? `${medalClass[medal]} font-bold` : "",
        className ?? "",
      ].join(" ")}
      title={medal ? t(medal) : undefined}
    >
      {children}
    </span>
  );
}

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
