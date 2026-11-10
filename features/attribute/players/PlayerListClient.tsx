"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PlayerWithGroups } from "@/data/players-store";
import type { AttributeKey } from "@/types/weights";
import {
  computeWeightedAverage,
  computeWeightedAverageOf,
  getPlayerAttributeValue,
  scaleScore,
} from "@/lib/scoring";
import { attributeLabel } from "@/lib/attribute-labels";
import { ageBenchmark } from "@/lib/fm27/benchmarks";
import {
  getBandForValue,
  useActiveAttributeProfile,
} from "@/components/AttributeColorConfig";
import { useActiveWeightProfile } from "@/components/WeightConfig";
import { useHighlightedAttributes } from "@/components/HighlightedAttributesConfig";
import Link from "next/link";
import { ArrowDown, ArrowUp, ExternalLink, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  PaginationControls,
  parsePageParam,
  parsePageSizeParam,
  type PageSizeChoice,
} from "@/components/PaginationControls";

interface Props {
  players: PlayerWithGroups[];
  selectable?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
}

type SortDir = "asc" | "desc";

type Row = {
  p: PlayerWithGroups;
  score: number;
  /** Weighted average ÷ FM27 age benchmark (1 = on track for a prime high-end Championship / low-end PL player). */
  vsAge: number;
  /** Score with the projected attributes at PA; null without a Hidden Attributes export. */
  potential: number | null;
};

const DEFAULT_SORT = "score";
const DEFAULT_SORT_DIR: SortDir = "desc";

function isDefaultSort(sort: string, dir: SortDir): boolean {
  return sort === DEFAULT_SORT && dir === DEFAULT_SORT_DIR;
}

function buildListQuery(
  pathname: string,
  opts: {
    page: number;
    pageSize: PageSizeChoice;
    sort: string;
    sortDir: SortDir;
    q?: string;
  },
): string {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.page > 1) p.set("page", String(opts.page));
  if (opts.pageSize !== 10) {
    p.set("pageSize", opts.pageSize === "all" ? "all" : String(opts.pageSize));
  }
  if (!isDefaultSort(opts.sort, opts.sortDir)) {
    p.set("sort", opts.sort);
    p.set("sortDir", opts.sortDir);
  }
  const qs = p.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function parseListSort(
  searchParams: URLSearchParams,
  highlighted: AttributeKey[],
): { sort: string; sortDir: SortDir } {
  const rawSort = searchParams.get("sort");
  const rawDir = searchParams.get("sortDir");
  const sortDir: SortDir =
    rawDir === "asc" || rawDir === "desc" ? rawDir : DEFAULT_SORT_DIR;

  if (!rawSort) {
    return { sort: DEFAULT_SORT, sortDir: DEFAULT_SORT_DIR };
  }

  if (
    rawSort === "player" ||
    rawSort === "position" ||
    rawSort === "score" ||
    rawSort === "vsAge" ||
    rawSort === "potential" ||
    rawSort === "age"
  ) {
    return { sort: rawSort, sortDir };
  }

  if (rawSort.startsWith("attr:")) {
    const key = rawSort.slice(5) as AttributeKey;
    if (highlighted.includes(key)) {
      return { sort: rawSort, sortDir };
    }
  }

  return { sort: DEFAULT_SORT, sortDir: DEFAULT_SORT_DIR };
}

function getSearchQuery(searchParams: URLSearchParams): string {
  return (searchParams.get("q") ?? "").trim();
}

/** Split display name into words (commas treated as spaces, for "Surname, First" exports). */
function normalizeNameWords(display: string): string[] {
  return display
    .replace(/,/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function splitPlayerNameParts(words: string[]): {
  first: string;
  middle: string[];
  last: string;
} {
  if (words.length === 0) {
    return { first: "", middle: [], last: "" };
  }
  if (words.length === 1) {
    const w = words[0];
    return { first: w, middle: [], last: w };
  }
  return {
    first: words[0],
    middle: words.slice(1, -1),
    last: words[words.length - 1],
  };
}

function partMatchesToken(part: string, tokenLower: string): boolean {
  return part.toLowerCase().includes(tokenLower);
}

/**
 * Space-separated terms are ANDed. Each term may match first name, last name,
 * any middle segment, or any substring of the full name (single-term behavior).
 */
function playerMatchesNameSearch(display: string, query: string): boolean {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) return true;

  const words = normalizeNameWords(display);
  const { first, middle, last } = splitPlayerNameParts(words);
  const fullLower = display.toLowerCase();

  return tokens.every((token) => {
    if (partMatchesToken(first, token)) return true;
    if (partMatchesToken(last, token)) return true;
    for (const m of middle) {
      if (partMatchesToken(m, token)) return true;
    }
    if (fullLower.includes(token)) return true;
    return false;
  });
}

function compareRows(a: Row, b: Row, sort: string, sortDir: SortDir): number {
  const m = sortDir === "asc" ? 1 : -1;
  if (sort === "player") {
    return (
      m *
      a.p.raw.player.localeCompare(b.p.raw.player, undefined, {
        sensitivity: "base",
      })
    );
  }
  if (sort === "position") {
    return (
      m *
      a.p.raw.position.localeCompare(b.p.raw.position, undefined, {
        sensitivity: "base",
      })
    );
  }
  if (sort === "score") {
    return m * (a.score - b.score);
  }
  if (sort === "vsAge") {
    return m * (a.vsAge - b.vsAge);
  }
  if (sort === "age") {
    return m * (a.p.raw.age - b.p.raw.age);
  }
  if (sort === "potential") {
    return m * ((a.potential ?? -1) - (b.potential ?? -1));
  }
  if (sort.startsWith("attr:")) {
    const key = sort.slice(5) as AttributeKey;
    return (
      m *
      (getPlayerAttributeValue(a.p, key) - getPlayerAttributeValue(b.p, key))
    );
  }
  return m * (a.score - b.score);
}

function nextSortFromClick(
  column: string,
  currentSort: string,
  currentDir: SortDir,
): { sort: string; sortDir: SortDir } {
  if (currentSort === column) {
    return {
      sort: column,
      sortDir: currentDir === "asc" ? "desc" : "asc",
    };
  }
  const defaultDir: SortDir =
    column === "player" || column === "position" || column === "age" ? "asc" : "desc";
  return { sort: column, sortDir: defaultDir };
}

function SortableTh({
  label,
  align,
  columnSort,
  listSort,
  listSortDir,
  onSort,
}: {
  label: ReactNode;
  align: "left" | "right";
  columnSort: string;
  listSort: string;
  listSortDir: SortDir;
  onSort: () => void;
}) {
  const active = listSort === columnSort;
  const ariaSort = active
    ? listSortDir === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={align === "left" ? "text-left" : "text-right"}
    >
      <button
        type="button"
        onClick={onSort}
        className={`inline-flex w-full cursor-pointer items-center gap-1 px-3 py-2 hover:text-ink focus-visible:-outline-offset-2 ${
          align === "right" ? "justify-end" : "justify-start"
        }`}
      >
        <span>{label}</span>
        {active &&
          (listSortDir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ))}
      </button>
    </th>
  );
}

function NewTabPlayerLink({ uniqueId, name }: { uniqueId: string; name: string }) {
  return (
    <Link
      href={`/attribute/players/${uniqueId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 rounded p-1 text-muted/70 hover:bg-ink/6 hover:text-ink"
      aria-label={`Open ${name} in new tab`}
      title="Open in new tab"
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );
}

function PlayersListClientInner({
  players,
  selectable = false,
  selectedIds = [],
  onToggleSelect,
}: Props) {
  const highlighted = useHighlightedAttributes();
  const { weights, emphasis } = useActiveWeightProfile();
  const profile = useActiveAttributeProfile();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingScrollYRef = useRef<number | null>(null);

  const replacePreservingScroll = useCallback(
    (href: string) => {
      pendingScrollYRef.current = window.scrollY;
      router.replace(href, { scroll: false });
    },
    [router],
  );

  const listQueryKey = searchParams.toString();

  useLayoutEffect(() => {
    const y = pendingScrollYRef.current;
    if (y === null) return;
    pendingScrollYRef.current = null;
    window.scrollTo(0, y);
  }, [listQueryKey]);

  const { sort: listSort, sortDir: listSortDir } = useMemo(
    () => parseListSort(searchParams, highlighted),
    [searchParams, highlighted],
  );

  const searchQuery = useMemo(
    () => getSearchQuery(searchParams),
    [searchParams],
  );
  /* Search box text. It follows the URL's `q` until the user types; typing pins
     it to the query it was typed against, so back/forward navigation still resets it. */
  const [draftState, setDraftState] = useState<{ q: string; value: string } | null>(null);
  const draft =
    draftState && draftState.q === searchQuery ? draftState.value : searchQuery;
  const setDraft = useCallback(
    (value: string) => setDraftState({ q: searchQuery, value }),
    [searchQuery],
  );

  const urlPage = parsePageParam(searchParams.get("page"));
  const urlPageSize = parsePageSizeParam(searchParams.get("pageSize"));
  const pageSize: PageSizeChoice = urlPageSize;

  const rows = useMemo<Row[]>(
    () =>
      players.map((p) => {
        const avg = computeWeightedAverage(p, weights, emphasis);
        return {
          p,
          score: scaleScore(avg),
          vsAge: avg / ageBenchmark(p.raw.age),
          potential: p.potential
            ? scaleScore(computeWeightedAverageOf(p.potential.attributes, weights, emphasis))
            : null,
        };
      }),
    [players, weights, emphasis],
  );
  const hasPotential = useMemo(() => rows.some((r) => r.potential !== null), [rows]);

  const filteredRows = useMemo(() => {
    if (!searchQuery) return rows;
    return rows.filter((r) => playerMatchesNameSearch(r.p.raw.player, searchQuery));
  }, [rows, searchQuery]);

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    copy.sort((a, b) => compareRows(a, b, listSort, listSortDir));
    return copy;
  }, [filteredRows, listSort, listSortDir]);

  const total = sortedRows.length;

  const pageCount =
    total === 0
      ? 1
      : pageSize === "all"
        ? 1
        : Math.max(1, Math.ceil(total / pageSize));

  const rawPage = urlPage;
  const page = Math.min(rawPage, pageCount);

  const listQueryOpts = useMemo(
    () => ({ page, pageSize, sort: listSort, sortDir: listSortDir, q: searchQuery }),
    [page, pageSize, listSort, listSortDir, searchQuery],
  );

  useEffect(() => {
    const trimmed = draft.trim();
    if (trimmed === searchQuery) return;
    const id = setTimeout(() => {
      replacePreservingScroll(
        buildListQuery(pathname, {
          page: 1,
          pageSize,
          sort: listSort,
          sortDir: listSortDir,
          q: trimmed,
        }),
      );
    }, 300);
    return () => clearTimeout(id);
  }, [
    draft,
    searchQuery,
    pathname,
    pageSize,
    listSort,
    listSortDir,
    replacePreservingScroll,
  ]);

  useEffect(() => {
    if (rawPage === page) return;
    replacePreservingScroll(
      buildListQuery(pathname, { ...listQueryOpts, page }),
    );
  }, [rawPage, page, pathname, replacePreservingScroll, listQueryOpts]);

  const effectiveSize = pageSize === "all" ? Math.max(1, total) : pageSize;
  const pageItems =
    pageSize === "all"
      ? sortedRows
      : sortedRows.slice((page - 1) * pageSize, page * pageSize);

  const showingFrom = total === 0 ? 0 : (page - 1) * effectiveSize + 1;
  const showingTo =
    total === 0 ? 0 : Math.min(page * effectiveSize, total);

  const replaceListUrl = (opts: {
    page: number;
    pageSize: PageSizeChoice;
    sort: string;
    sortDir: SortDir;
    q?: string;
  }) => {
    replacePreservingScroll(buildListQuery(pathname, opts));
  };

  const setUrlPagination = (nextPage: number, nextSize: PageSizeChoice) => {
    const nextCount =
      total === 0
        ? 1
        : nextSize === "all"
          ? 1
          : Math.max(1, Math.ceil(total / nextSize));
    const clampedPage = Math.min(Math.max(1, nextPage), nextCount);
    replaceListUrl({
      page: clampedPage,
      pageSize: nextSize,
      sort: listSort,
      sortDir: listSortDir,
      q: searchQuery,
    });
  };

  const onPageChange = (next: number) => {
    setUrlPagination(next, pageSize);
  };

  const onPageSizeChange = (nextSize: PageSizeChoice) => {
    setUrlPagination(1, nextSize);
  };

  const onColumnSort = (column: string) => {
    const next = nextSortFromClick(column, listSort, listSortDir);
    replaceListUrl({
      page: 1,
      pageSize,
      sort: next.sort,
      sortDir: next.sortDir,
      q: searchQuery,
    });
  };

  return (
    <div className="text-ink">
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="section-title">Players</h2>

        <label className="relative block w-full sm:w-96">
          <span className="sr-only">Search players by name</span>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search name: first, middle or last"
            className="field h-9 w-full py-1.5 pl-8 pr-8 text-sm"
          />
          {draft && (
            <button
              type="button"
              onClick={() => setDraft("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:bg-ink/6 hover:text-ink"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
      </div>

      {searchQuery && total === 0 && (
        <p className="px-4 pb-3 text-sm text-muted">
          No players match &ldquo;{searchQuery}&rdquo;
        </p>
      )}

      <div className="overflow-x-auto border-y border-line">
        <table className="data-table">
          <thead>
            <tr>
              {selectable && (
                <th className="w-10 px-3 py-2 text-left">
                  <span className="sr-only">Select</span>
                </th>
              )}
              <SortableTh
                label="Player"
                align="left"
                columnSort="player"
                listSort={listSort}
                listSortDir={listSortDir}
                onSort={() => onColumnSort("player")}
              />
              <SortableTh
                label="Pos"
                align="left"
                columnSort="position"
                listSort={listSort}
                listSortDir={listSortDir}
                onSort={() => onColumnSort("position")}
              />
              <SortableTh
                label="Age"
                align="right"
                columnSort="age"
                listSort={listSort}
                listSortDir={listSortDir}
                onSort={() => onColumnSort("age")}
              />
              <SortableTh
                label="Score"
                align="right"
                columnSort="score"
                listSort={listSort}
                listSortDir={listSortDir}
                onSort={() => onColumnSort("score")}
              />
              <SortableTh
                label={<span title="Weighted average vs the FM27 benchmark for the player's age">vs Age</span>}
                align="right"
                columnSort="vsAge"
                listSort={listSort}
                listSortDir={listSortDir}
                onSort={() => onColumnSort("vsAge")}
              />
              {hasPotential && (
                <SortableTh
                  label={<span title="Score with attributes projected to PA (Hidden Attributes export)">Potential</span>}
                  align="right"
                  columnSort="potential"
                  listSort={listSort}
                  listSortDir={listSortDir}
                  onSort={() => onColumnSort("potential")}
                />
              )}
              {highlighted.map((key) => (
                <SortableTh
                  key={key}
                  label={attributeLabel(key)}
                  align="right"
                  columnSort={`attr:${key}`}
                  listSort={listSort}
                  listSortDir={listSortDir}
                  onSort={() => onColumnSort(`attr:${key}`)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {pageItems.map(({ p, score, vsAge, potential }) => (
              <tr
                key={p.raw.uniqueId}
                data-selected={selectable && selectedIds.includes(p.raw.uniqueId)}
              >
                {selectable && (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer"
                      aria-label={`Select ${p.raw.player}`}
                      checked={selectedIds.includes(p.raw.uniqueId)}
                      onChange={() => onToggleSelect?.(p.raw.uniqueId)}
                    />
                  </td>
                )}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <Link
                      href={`/attribute/players/${p.raw.uniqueId}`}
                      className="font-semibold hover:text-accent hover:underline"
                    >
                      {p.raw.player}
                    </Link>
                    <NewTabPlayerLink uniqueId={p.raw.uniqueId} name={p.raw.player} />
                  </div>
                </td>
                <td className="px-3 py-2 text-[13px] text-muted">{p.raw.position}</td>
                <td className="px-3 py-2 text-right">{p.raw.age}</td>
                <td className="px-3 py-2 text-right font-bold">
                  {score.toFixed(2)}
                </td>
                <td
                  className={`px-3 py-2 text-right ${
                    vsAge >= 1 ? "font-semibold text-positive" : "text-muted"
                  }`}
                >
                  {Math.round(vsAge * 100)}%
                </td>
                {hasPotential && (
                  <td className="px-3 py-2 text-right font-semibold">
                    {potential === null ? "–" : potential.toFixed(2)}
                  </td>
                )}
                {highlighted.map((key) => {
                  const value = getPlayerAttributeValue(p, key);
                  const band = getBandForValue(value, profile.thresholds);
                  return (
                    <td key={key} className="px-2 py-1.5 text-right">
                      <span className="attr" data-band={band}>
                        {value}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3">
      <PaginationControls
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        totalItems={total}
        showingFrom={showingFrom}
        showingTo={showingTo}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
      </div>
    </div>
  );
}

export default function PlayersListClient(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-6 text-sm text-muted">
          Loading table…
        </div>
      }
    >
      <PlayersListClientInner {...props} />
    </Suspense>
  );
}
