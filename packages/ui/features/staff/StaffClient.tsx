"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Link } from "../../i18n/navigation";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useIntlLocale } from "@scoutreporter/ui/i18n/hooks";
import { useStaffData } from "@scoutreporter/ui/components/StaffDataProvider";
import { useStoredToggle } from "@scoutreporter/ui/components/useStoredToggle";
import { PageHeader } from "@scoutreporter/ui/components/PageHeader";
import { SegmentedControl } from "@scoutreporter/ui/components/SegmentedControl";
import { PaginationControls, type PageSizeChoice } from "@scoutreporter/ui/components/PaginationControls";
import {
  STAFF_ATTRIBUTES,
  STAFF_ATTRIBUTE_GROUPS,
  STAFF_RATING_BANDS,
  type StaffAttributeDef,
  type StaffAttributeKey,
} from "@scoutreporter/core/staff/staff-attributes";
import { isFreeAgent, type StaffMember } from "@scoutreporter/core/staff/staff-parser";
import {
  STAFF_ROLES,
  STAFF_ROLE_BY_ID,
  STAFF_ROLE_GROUPS,
  rolesForJob,
  scoreStaff,
  weightedAttributes,
  type StaffRoleScore,
  type StaffScores,
} from "@scoutreporter/core/staff/staff-roles";
import { StaffDetailModal } from "./StaffDetailModal";
import { StaffImportPanel } from "./StaffImportPanel";
import { NoImport } from "@scoutreporter/ui/components/ImportPanel";
import { RatingCell, ScoreCell, useFormatScore, useStaffRoleText, type ValueMode } from "./StaffCells";
import { compareNames } from "@scoutreporter/core/text";

type Row = { s: StaffMember; scores: StaffScores };

/** "best" = each person's best role, "preferred" = their FM preferred job, otherwise a role id. */
type RankBy = "best" | "preferred" | string;
type SortKey = "name" | "score" | "best" | StaffAttributeKey;

function rankedScore(r: Row, rankBy: RankBy): StaffRoleScore | null {
  if (rankBy === "best") return r.scores.best;
  if (rankBy === "preferred") return r.scores.preferred;
  return r.scores.byRole.get(rankBy) ?? null;
}

function sortValue(r: Row, key: SortKey, rankBy: RankBy): number | string {
  switch (key) {
    case "name":
      return r.s.name;
    case "score":
      return rankedScore(r, rankBy)?.score ?? -1;
    case "best":
      return r.scores.best?.score ?? -1;
    default:
      return r.s.attributes[key]?.value ?? -1;
  }
}

const ATTRS_BY_GROUP = STAFF_ATTRIBUTE_GROUPS.map((g) => ({
  group: g,
  attrs: STAFF_ATTRIBUTES.filter((a) => a.group === g),
}));

const kbd = (chunks: ReactNode) => (
  <kbd className="rounded border border-line bg-surface px-1.5 text-[12px] font-semibold text-ink">{chunks}</kbd>
);
const bold = (chunks: ReactNode) => <span className="font-semibold text-ink">{chunks}</span>;

export default function StaffClient() {
  const t = useTranslations("staff");
  const tFm = useTranslations("fm");
  const roleText = useStaffRoleText();
  const formatScore = useFormatScore();
  const locale = useIntlLocale();
  const { state } = useStaffData();
  const { staff, columns } = state;

  const [rankBy, setRankBy] = useState<RankBy>("best");
  const [job, setJob] = useState("all");
  const [freeOnly, setFreeOnly] = useState(false);
  const [showAllAttrs, setShowAllAttrs] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ValueMode>("words");
  const [sort, setSort] = useState<SortKey>("score");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeChoice>(25);
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo<Row[]>(() => staff.map((s) => ({ s, scores: scoreStaff(s) })), [staff]);

  const jobs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of staff) if (s.preferredJob) counts.set(s.preferredJob, (counts.get(s.preferredJob) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [staff]);

  /** fm-scoring roles for the job filter; empty for "all" and for jobs the research has no weights for. */
  const jobRoles = useMemo(() => (job === "all" ? [] : rolesForJob(job)), [job]);
  const jobWeights = useMemo(() => weightedAttributes(jobRoles), [jobRoles]);
  const narrowToJob = jobRoles.length > 0 && !showAllAttrs;

  const shownAttrs = useMemo(() => {
    const has = new Set(columns);
    const keep = (k: StaffAttributeKey) => has.has(k) && (!narrowToJob || jobWeights.has(k));
    return ATTRS_BY_GROUP.map((g) => ({ ...g, attrs: g.attrs.filter((a) => keep(a.key)) })).filter(
      (g) => g.attrs.length > 0,
    );
  }, [columns, narrowToJob, jobWeights]);

  // Your club, known when the staff came from a scan.
  const myClub = state.source?.myClub ?? null;
  const mine = useMemo(() => (myClub ? staff.filter((s) => s.club === myClub).length : 0), [staff, myClub]);
  const [showMine, setShowMine] = useStoredToggle("staffShowMyClub", true);
  const hideMine = !showMine && mine > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(({ s }) => {
      if (job !== "all" && s.preferredJob !== job) return false;
      if (freeOnly && !isFreeAgent(s)) return false;
      if (hideMine && s.club === myClub) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.club.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, job, freeOnly, query, hideMine, myClub]);

  const sorted = useMemo(() => {
    const m = dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = sortValue(a, sort, rankBy);
      const vb = sortValue(b, sort, rankBy);
      if (typeof va === "string" || typeof vb === "string") {
        return m * compareNames(String(va), String(vb));
      }
      return m * (va - vb) || a.s.name.localeCompare(b.s.name);
    });
  }, [filtered, sort, dir, rankBy]);

  const total = sorted.length;
  const pageCount = pageSize === "all" ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const size = pageSize === "all" ? Math.max(1, total) : pageSize;
  const pageItems = sorted.slice((currentPage - 1) * size, currentPage * size);

  const rankRole = rankBy === "best" || rankBy === "preferred" ? null : STAFF_ROLE_BY_ID[rankBy];
  const weights: Map<string, number> = rankRole
    ? new Map(Object.entries(rankRole.weights))
    : rankBy === "preferred" && jobRoles.length > 0
      ? jobWeights
      : new Map();
  const scoreLabel = rankRole ? roleText.name(rankRole) : rankBy === "preferred" ? t("preferredJob") : t("bestRole");

  const onSort = (key: SortKey) => {
    if (key === sort) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(key);
      setDir(key === "name" ? "asc" : "desc");
    }
    setPage(1);
  };

  const th = (
    key: SortKey,
    label: ReactNode,
    opts: { title?: string; align?: "left" | "right" | "center"; className?: string } = {},
  ) => {
    const align = opts.align ?? "right";
    return (
      <th
        key={key}
        scope="col"
        aria-sort={sort === key ? (dir === "asc" ? "ascending" : "descending") : "none"}
        className={`${align === "left" ? "text-left" : align === "center" ? "text-center" : "text-right"} ${opts.className ?? ""}`}
      >
        <button
          type="button"
          title={opts.title}
          onClick={() => onSort(key)}
          className={`inline-flex w-full cursor-pointer items-center gap-1 whitespace-nowrap px-2 py-2 hover:text-ink focus-visible:-outline-offset-2 ${
            align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"
          }`}
        >
          <span>{label}</span>
          {sort === key &&
            (dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden />)}
        </button>
      </th>
    );
  };

  const inputClass = "field h-9 px-2.5 text-sm text-ink";
  const filterLabel = "flex flex-col gap-1 text-[13px] text-muted";
  const resetPage = () => setPage(1);
  const openRow = openId ? rows.find((r) => r.s.uniqueId === openId) ?? null : null;

  return (
    <div className="text-ink">
      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6 md:py-8">
        <PageHeader
          title={t("list.title")}
          aside={
            <Link href="/staff/backroom" className="btn h-9 border border-line bg-surface px-3 text-sm hover:bg-paper">
              {t("list.bestBackroom")} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          }
        >
          {t("list.intro")}
        </PageHeader>

        <StaffImportPanel onImported={resetPage} />

        {staff.length === 0 && (
          <NoImport desktop={t.rich("noImport.desktop", { kbd })}>{t("list.noImport")}</NoImport>
        )}

        {staff.length > 0 && (
          <section aria-label={t("list.title")} className="panel">
            <div
              role="group"
              aria-label={t("list.filters")}
              className="flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-line px-4 py-3"
            >
              <label className={filterLabel}>
                {t("list.rankBy")}
                <select
                  value={rankBy}
                  onChange={(e) => {
                    setRankBy(e.target.value);
                    setSort("score");
                    setDir("desc");
                    resetPage();
                  }}
                  className={`${inputClass} pl-2.5`}
                >
                  <option value="best">{t("bestRole")}</option>
                  <option value="preferred">{t("preferredJob")}</option>
                  {STAFF_ROLE_GROUPS.map((g) => (
                    <optgroup key={g} label={roleText.group(g)}>
                      {STAFF_ROLES.filter((r) => r.group === g).map((r) => (
                        <option key={r.id} value={r.id}>
                          {roleText.name(r)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className={filterLabel}>
                {t("preferredJob")}
                <select
                  value={job}
                  onChange={(e) => {
                    setJob(e.target.value);
                    if (e.target.value !== "all") {
                      // Score everyone on the job they were filtered by.
                      setRankBy("preferred");
                      setSort("score");
                      setDir("desc");
                    }
                    resetPage();
                  }}
                  className={`${inputClass} pl-2.5`}
                >
                  <option value="all">{t("list.allJobs")}</option>
                  {jobs.map(([j, n]) => (
                    <option key={j} value={j}>
                      {j} ({n})
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${filterLabel} min-w-48 flex-1 sm:max-w-xs`}>
                {t("list.search")}
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    resetPage();
                  }}
                  placeholder={t("list.searchPlaceholder")}
                  className={`${inputClass} w-full`}
                />
              </label>
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={freeOnly}
                  onChange={(e) => {
                    setFreeOnly(e.target.checked);
                    resetPage();
                  }}
                  className="h-4 w-4 accent-accent"
                />
                {t("list.freeAgentsOnly")}
              </label>
              {mine > 0 && (
                <label className="flex h-9 items-center gap-2 text-sm" title={t("list.myClubTitle", { club: myClub ?? "" })}>
                  <input
                    type="checkbox"
                    checked={showMine}
                    onChange={(e) => {
                      setShowMine(e.target.checked);
                      resetPage();
                    }}
                    className="h-4 w-4 accent-accent"
                  />
                  {t("list.showMine", { count: mine })}
                </label>
              )}
              <div className="flex flex-col gap-1 text-[13px] text-muted">
                <span id="value-mode">{t("list.ratingsAs")}</span>
                <SegmentedControl
                  labelledBy="value-mode"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "words", label: t("list.words") },
                    { value: "numbers", label: t("list.numbers") },
                  ]}
                />
              </div>
              <p className="ml-auto pb-2 text-sm text-muted">
                {t.rich("list.count", { shown: total, total: staff.length, b: bold })}
              </p>
            </div>

            {job !== "all" && (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-line px-4 py-2 text-[13px] text-muted">
                {jobRoles.length > 0 ? (
                  <p>
                    {jobRoles.length === 1
                      ? t.rich("list.jobScoredAsOne", { job, role: roleText.name(jobRoles[0]), b: bold })
                      : t.rich("list.jobScoredAsBest", {
                          job,
                          roles: new Intl.ListFormat(locale, { type: "conjunction" }).format(
                            jobRoles.map((r) => roleText.shortName(r)),
                          ),
                          b: bold,
                        })}{" "}
                    {narrowToJob
                      ? t("list.jobShowingWeighted", { count: jobWeights.size })
                      : t("list.jobBoldWeighted", { count: jobWeights.size })}
                  </p>
                ) : (
                  <p>{t.rich("list.jobNoWeights", { job, b: bold })}</p>
                )}
                {jobRoles.length > 0 && (
                  <label className="flex items-center gap-2 text-ink">
                    <input
                      type="checkbox"
                      checked={showAllAttrs}
                      onChange={(e) => setShowAllAttrs(e.target.checked)}
                      className="h-4 w-4 accent-accent"
                    />
                    {t("list.showAllAttributes")}
                  </label>
                )}
              </div>
            )}

            {rankRole && (
              <p className="border-b border-line px-4 py-2 text-[13px] text-muted">
                {t.rich("list.rankRole", { role: roleText.name(rankRole), summary: roleText.summary(rankRole), b: bold })}
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th colSpan={4} className="px-2 pt-2 text-left" />
                    {shownAttrs.map((g) => (
                      <th
                        key={g.group}
                        colSpan={g.attrs.length}
                        scope="colgroup"
                        className="border-l border-line px-2 pt-2 text-center font-semibold text-ink"
                      >
                        {tFm(`staffAttributeGroups.${g.group}`)}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {th("name", t("list.name"), { align: "left" })}
                    <th scope="col" className="px-2 py-2 text-left">
                      {t("list.job")}
                    </th>
                    {th("score", scoreLabel, { title: t("list.scoreTitle") })}
                    {rankBy === "best" ? (
                      <th scope="col" className="px-2 py-2 text-left">
                        {tFm("terms.role")}
                      </th>
                    ) : (
                      th("best", t("bestRole"), { align: "left" })
                    )}
                    {shownAttrs.flatMap((g) =>
                      g.attrs.map((a: StaffAttributeDef, i) =>
                        th(a.key, tFm(`staffAttributeAbbr.${a.key}`), {
                          title: weights.has(a.key)
                            ? t("list.attributeWeight", {
                                label: tFm(`staffAttributes.${a.key}`),
                                weight: weights.get(a.key) ?? 0,
                              })
                            : tFm(`staffAttributes.${a.key}`),
                          align: "center",
                          className: `${i === 0 ? "border-l border-line" : ""} ${
                            weights.has(a.key) ? "font-bold text-ink" : ""
                          }`,
                        }),
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((r) => {
                    const { s, scores } = r;
                    const score = rankedScore(r, rankBy);
                    return (
                      <tr key={s.uniqueId}>
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            onClick={() => setOpenId(s.uniqueId)}
                            className="cursor-pointer whitespace-nowrap text-left font-semibold hover:text-accent hover:underline"
                          >
                            {s.name}
                          </button>
                          <span className="block whitespace-nowrap text-[12px] text-muted">
                            {s.club || t("freeAgent")}
                            {s.personality && ` · ${s.personality}`}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-[13px]">{s.preferredJob || "–"}</td>
                        <td className="px-2 py-1.5 text-right">
                          <ScoreCell score={score} />
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-[13px]">
                          {rankBy === "best" ? (
                            (scores.best ? roleText.name(scores.best.role) : "–")
                          ) : scores.best ? (
                            <>
                              {roleText.name(scores.best.role)}{" "}
                              <span className="text-muted">{formatScore(scores.best.score)}</span>
                            </>
                          ) : (
                            "–"
                          )}
                        </td>
                        {shownAttrs.flatMap((g) =>
                          g.attrs.map((a, i) => (
                            <td
                              key={a.key}
                              className={`px-1 py-1.5 text-center ${i === 0 ? "border-l border-line" : ""}`}
                            >
                              <RatingCell rating={s.attributes[a.key]} mode={mode} />
                            </td>
                          )),
                        )}
                      </tr>
                    );
                  })}
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
            {t("list.method.title")}
          </h2>
          <p>{t("list.method.words")}</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-ink">
            {STAFF_RATING_BANDS.map((b) => (
              <li key={b.word} className="inline-flex items-center gap-1.5">
                <RatingCell rating={{ band: b, value: b.value, exact: false }} mode="words" />
                <span>
                  {b.word} {b.min === b.max ? b.min : `${b.min}–${b.max}`}
                </span>
              </li>
            ))}
          </ul>
          <p>
            {t.rich("list.method.roles", {
              link: (chunks) => (
                <a
                  href="https://github.com/jamiebolden/fm-scoring/blob/main/weights/fm27_staff.md"
                  target="_blank"
                  rel="noreferrer"
                  className="link"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        </section>
      </main>

      {openRow && (
        <StaffDetailModal
          member={openRow.s}
          scores={openRow.scores}
          mode={mode}
          open
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
