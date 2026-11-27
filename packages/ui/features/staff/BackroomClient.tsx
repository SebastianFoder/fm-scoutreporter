"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "../../i18n/navigation";
import { ArrowLeft, Lock, LockOpen, Minus, Plus, RotateCcw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useStaffData } from "@scoutreporter/ui/components/StaffDataProvider";
import { PageHeader } from "@scoutreporter/ui/components/PageHeader";
import { Button } from "@scoutreporter/ui/components/Button";
import { Notice } from "@scoutreporter/ui/components/Notice";
import { GradeStamp } from "@scoutreporter/ui/components/GradeStamp";
import {
  BACKROOM_PRESETS,
  MAX_PER_ROLE,
  cleanCounts,
  cleanLocks,
  matchingPreset,
  pickBackroom,
  type BackroomCounts,
  type BackroomLock,
  type BackroomPick,
} from "@scoutreporter/core/staff/backroom";
import { STAFF_ROLES, STAFF_ROLE_GROUPS, rolesForJob, scoreStaff } from "@scoutreporter/core/staff/staff-roles";
import { StaffImportPanel } from "./StaffImportPanel";
import { NoImport } from "@scoutreporter/ui/components/ImportPanel";
import { StaffDetailModal } from "./StaffDetailModal";
import { useFormatNumber } from "@scoutreporter/ui/i18n/hooks";
import { ScoreCell, useStaffRoleText } from "./StaffCells";

const STORAGE_KEY = "bestBackroomSettings";

type Settings = {
  counts: BackroomCounts;
  freeAgentsOnly: boolean;
  preferredJobOnly: boolean;
  excluded: string[];
  /** Staff kept in their slot (signed, or still negotiating) while the rest is re-picked. */
  locked: BackroomLock[];
};

const DEFAULTS: Settings = {
  counts: BACKROOM_PRESETS[0].counts,
  freeAgentsOnly: false,
  preferredJobOnly: false,
  excluded: [],
  locked: [],
};

function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const s = JSON.parse(raw) as Partial<Settings>;
    const counts = s.counts ? cleanCounts(s.counts) : DEFAULTS.counts;
    return {
      counts,
      freeAgentsOnly: s.freeAgentsOnly === true,
      preferredJobOnly: s.preferredJobOnly === true,
      excluded: Array.isArray(s.excluded) ? s.excluded.filter((x) => typeof x === "string") : [],
      locked: cleanLocks(s.locked, counts),
    };
  } catch {
    return DEFAULTS;
  }
}

const kbd = (chunks: ReactNode) => (
  <kbd className="rounded border border-line bg-surface px-1.5 text-[12px] font-semibold text-ink">{chunks}</kbd>
);

export default function BackroomClient() {
  const t = useTranslations("staff");
  const tFm = useTranslations("fm");
  const roleText = useStaffRoleText();
  const { state } = useStaffData();
  const { staff } = state;

  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  // The staff member in the detail panel, and the role they were picked for.
  const [opened, setOpened] = useState<{ id: string; role: string } | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- post-SSR localStorage hydration */
  useEffect(() => {
    setSettings(loadSettings());
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // storage full or blocked: settings last for this visit only
    }
  }, [settings, hydrated]);

  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));
  /** New counts drop locks the roles no longer have room for. */
  const setCounts = (next: (c: BackroomCounts) => BackroomCounts) =>
    setSettings((s) => {
      const counts = cleanCounts(next(s.counts));
      return { ...s, counts, locked: cleanLocks(s.locked, counts) };
    });
  const setCount = (roleId: string, n: number) => setCounts((c) => ({ ...c, [roleId]: n }));
  const toggleLock = (role: string, id: string) =>
    setSettings((s) => ({
      ...s,
      locked: s.locked.some((l) => l.id === id)
        ? s.locked.filter((l) => l.id !== id)
        : [...s.locked, { role, id }],
    }));
  /** Contract talks failed, or they're just not wanted: drop any lock and leave them out. */
  const exclude = (id: string) =>
    setSettings((s) => ({
      ...s,
      excluded: [...s.excluded, id],
      locked: s.locked.filter((l) => l.id !== id),
    }));

  const result = useMemo(
    () =>
      staff.length === 0
        ? null
        : pickBackroom(staff, settings.counts, {
            freeAgentsOnly: settings.freeAgentsOnly,
            preferredJobOnly: settings.preferredJobOnly,
            excluded: settings.excluded,
            locked: settings.locked,
          }),
    [staff, settings],
  );

  const preset = matchingPreset(settings.counts);
  const wanted = Object.values(settings.counts).reduce((a, b) => a + b, 0);
  const excludedStaff = useMemo(() => {
    const ids = new Set(settings.excluded);
    return staff.filter((s) => ids.has(s.uniqueId));
  }, [staff, settings.excluded]);
  const open = opened ? staff.find((s) => s.uniqueId === opened.id) ?? null : null;

  const labelClass = "flex flex-col gap-1 text-[13px] text-muted";

  return (
    <div className="text-ink">
      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6 md:py-8">
        <PageHeader
          title={t("backroom.title")}
          aside={
            <Link href="/staff" className="btn h-9 border border-line bg-surface px-3 text-sm hover:bg-paper">
              <ArrowLeft className="h-4 w-4" aria-hidden /> {t("backroom.staffList")}
            </Link>
          }
        >
          {t("backroom.intro")}
        </PageHeader>

        <StaffImportPanel onImported={() => update({ excluded: [] })} />

        {staff.length === 0 && (
          <NoImport desktop={t.rich("noImport.desktop", { kbd })}>{t("backroom.noImport")}</NoImport>
        )}

        {staff.length > 0 && (
          <div className="grid items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <section aria-labelledby="backroom-setup" className="panel">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 id="backroom-setup" className="section-title">
                  {tFm("terms.roles")}
                </h2>
                <Button
                  color="alt"
                  variant="ghost"
                  size="sm"
                  icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden />}
                  onClick={() => setSettings(DEFAULTS)}
                >
                  {t("backroom.reset")}
                </Button>
              </div>

              <div className="flex flex-col gap-3.5 px-4 py-3.5">
                <label className={labelClass}>
                  {t("backroom.preset")}
                  <select
                    value={preset?.id ?? "custom"}
                    onChange={(e) => {
                      const p = BACKROOM_PRESETS.find((x) => x.id === e.target.value);
                      if (p) setCounts(() => p.counts);
                    }}
                    className="field h-9 pl-2.5 text-sm text-ink"
                  >
                    {BACKROOM_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {tFm.has(`backroomSets.${p.id}`) ? tFm(`backroomSets.${p.id}`) : p.name}
                      </option>
                    ))}
                    <option value="custom" disabled>
                      {t("backroom.custom")}
                    </option>
                  </select>
                </label>

                {STAFF_ROLE_GROUPS.map((g) => (
                  <fieldset key={g}>
                    <legend className="mb-1 text-[13px] font-semibold">{roleText.group(g)}</legend>
                    <ul className="flex flex-col">
                      {STAFF_ROLES.filter((r) => r.group === g).map((r) => {
                        const n = settings.counts[r.id] ?? 0;
                        const name = roleText.name(r);
                        return (
                          <li
                            key={r.id}
                            className="flex items-center justify-between gap-2 border-b border-line py-1 last:border-b-0"
                          >
                            <span className={`min-w-0 truncate text-sm ${n > 0 ? "" : "text-muted"}`} title={roleText.summary(r)}>
                              {roleText.shortName(r)}
                            </span>
                            <span className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setCount(r.id, n - 1)}
                                disabled={n === 0}
                                aria-label={t("backroom.oneFewer", { role: name })}
                                className="btn h-7 w-7 border border-line text-muted hover:bg-paper hover:text-ink disabled:opacity-40"
                              >
                                <Minus className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              <span
                                className={`w-5 text-center text-sm tabular-nums ${n > 0 ? "font-semibold" : "text-muted"}`}
                                aria-label={t("backroom.roleCount", { role: name, count: n })}
                              >
                                {n}
                              </span>
                              <button
                                type="button"
                                onClick={() => setCount(r.id, n + 1)}
                                disabled={n >= MAX_PER_ROLE}
                                aria-label={t("backroom.oneMore", { role: name })}
                                className="btn h-7 w-7 border border-line text-muted hover:bg-paper hover:text-ink disabled:opacity-40"
                              >
                                <Plus className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </fieldset>
                ))}

                <div className="flex flex-col gap-2 border-t border-line pt-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.freeAgentsOnly}
                      onChange={(e) => update({ freeAgentsOnly: e.target.checked })}
                      className="h-4 w-4 accent-accent"
                    />
                    {t("list.freeAgentsOnly")}
                  </label>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={settings.preferredJobOnly}
                      onChange={(e) => update({ preferredJobOnly: e.target.checked })}
                      className="mt-0.5 h-4 w-4 accent-accent"
                    />
                    <span>
                      {t("backroom.preferredJobOnly")}
                      <span className="block text-[12px] text-muted">{t("backroom.preferredJobOnlyHint")}</span>
                    </span>
                  </label>
                </div>
              </div>
            </section>

            <div className="flex min-w-0 flex-col gap-4">
              {result?.kind === "empty" && (
                <Notice title={t("backroom.empty.title")}>{t("backroom.empty.body")}</Notice>
              )}

              {result?.kind === "short" && (
                <Notice title={t("backroom.short.title")}>
                  {result.roles
                    .map((r) =>
                      t("backroom.short.role", { role: roleText.name(r.role), wanted: r.wanted, eligible: r.eligible }),
                    )
                    .join(" ")}{" "}
                  {t("backroom.short.explain", {
                    filtered:
                      settings.freeAgentsOnly || settings.preferredJobOnly || settings.excluded.length > 0 ? "yes" : "no",
                  })}
                </Notice>
              )}

              {result?.kind === "ok" && (
                <BackroomResultPanel
                  picks={result.picks}
                  totalScore={result.totalScore}
                  wanted={wanted}
                  onOpen={(id, role) => setOpened({ id, role })}
                  onExclude={exclude}
                  onToggleLock={toggleLock}
                  onUnlockAll={() => update({ locked: [] })}
                />
              )}

              {excludedStaff.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="text-muted">{t("backroom.excluded")}</span>
                  {excludedStaff.map((s) => (
                    <button
                      key={s.uniqueId}
                      type="button"
                      onClick={() => update({ excluded: settings.excluded.filter((id) => id !== s.uniqueId) })}
                      className="btn h-7 gap-1 border border-line bg-surface px-2 text-[13px] font-normal hover:bg-paper"
                      title={t("backroom.allowAgainTitle")}
                    >
                      {s.name}
                      <X className="h-3.5 w-3.5 text-muted" aria-hidden />
                      <span className="sr-only">{t("backroom.allowAgain")}</span>
                    </button>
                  ))}
                  <button type="button" className="link ml-1 text-[13px]" onClick={() => update({ excluded: [] })}>
                    {t("backroom.clearAll")}
                  </button>
                </div>
              )}

              <p className="max-w-3xl text-[13px] leading-relaxed text-muted">
                {t.rich("backroom.footer", {
                  link: (chunks) => (
                    <Link href="/staff" className="link">
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            </div>
          </div>
        )}
      </main>

      {open && (
        <StaffDetailModal
          member={open}
          scores={scoreStaff(open)}
          rankBy={opened?.role}
          mode="words"
          open
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  );
}

function BackroomResultPanel({
  picks,
  totalScore,
  wanted,
  onOpen,
  onExclude,
  onToggleLock,
  onUnlockAll,
}: {
  picks: BackroomPick[];
  totalScore: number;
  wanted: number;
  onOpen: (id: string, role: string) => void;
  onExclude: (id: string) => void;
  onToggleLock: (role: string, id: string) => void;
  onUnlockAll: () => void;
}) {
  const t = useTranslations("staff");
  const tFm = useTranslations("fm");
  const roleText = useStaffRoleText();
  const formatNumber = useFormatNumber();
  const lockedCount = picks.filter((p) => p.locked).length;
  const offJob = picks.filter((p) => !rolesForJob(p.member.preferredJob).some((r) => r.id === p.role.id)).length;

  return (
    <section aria-labelledby="backroom-result" className="panel">
      <div className="border-b border-line px-4 py-3">
        <h2 id="backroom-result" className="section-title">
          {t("backroom.result.title")}
        </h2>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
          <span>{t("backroom.result.summary", { count: wanted })}</span>
          <span className="font-semibold text-ink">
            {formatNumber(totalScore / picks.length, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <GradeStamp score={totalScore / picks.length} label={t("backroom.result.averageLabel")} />
          {offJob > 0 && <span>{t("backroom.result.offJob", { count: offJob })}</span>}
          {lockedCount > 0 && (
            <span>
              {t("backroom.result.locked", { count: lockedCount })}{" "}
              <button type="button" className="link text-[13px]" onClick={onUnlockAll}>
                {t("backroom.result.unlockAll")}
              </button>
            </span>
          )}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="px-2.5 py-2 text-left">{tFm("terms.role")}</th>
              <th className="px-2.5 py-2 text-left">{tFm("terms.staff")}</th>
              <th className="px-2.5 py-2 text-left">{t("preferredJob")}</th>
              <th className="px-2.5 py-2 text-right" title={t("backroom.result.scoreTitle")}>
                {t("backroom.result.score")}
              </th>
              <th className="px-2.5 py-2">
                <span className="sr-only">{t("backroom.result.lockOrRemove")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {STAFF_ROLE_GROUPS.map((g) => {
              const rows = picks.filter((p) => p.role.group === g);
              if (rows.length === 0) return null;
              return (
                <Fragment key={g}>
                  <tr>
                    <th colSpan={5} scope="colgroup" className="bg-paper px-2.5 py-1.5 text-left text-[13px] font-semibold text-ink">
                      {roleText.group(g)}
                    </th>
                  </tr>
                  {rows.map((p, i) => {
                    const firstOfRole = i === 0 || rows[i - 1].role.id !== p.role.id;
                    const onJob = rolesForJob(p.member.preferredJob).some((r) => r.id === p.role.id);
                    const roleName = roleText.name(p.role);
                    return (
                      <tr key={`${p.role.id}-${p.member.uniqueId}`} className={p.locked ? "bg-accent/5" : undefined}>
                        <td className="whitespace-nowrap px-2.5 py-1.5 text-[13px]" title={roleText.summary(p.role)}>
                          {firstOfRole ? roleName : <span className="sr-only">{roleName}</span>}
                        </td>
                        <td className="px-2.5 py-1.5">
                          <button
                            type="button"
                            onClick={() => onOpen(p.member.uniqueId, p.role.id)}
                            className="cursor-pointer text-left font-semibold hover:text-accent hover:underline"
                          >
                            {p.member.name}
                          </button>
                          <span className="block text-[12px] text-muted">
                            {p.member.club || t("freeAgent")}
                            {p.member.personality && ` · ${p.member.personality}`}
                          </span>
                        </td>
                        <td
                          className={`whitespace-nowrap px-2.5 py-1.5 text-[13px] ${onJob ? "" : "text-muted"}`}
                          title={onJob ? undefined : t("backroom.result.offJobTitle")}
                        >
                          {p.member.preferredJob || "–"}
                        </td>
                        <td className="px-2.5 py-1.5 text-right">
                          <ScoreCell score={{ role: p.role, score: p.score, coverage: p.coverage }} />
                        </td>
                        <td className="px-1.5 py-1 text-right">
                          <span className="inline-flex items-center gap-0.5">
                            <Button
                              color={p.locked ? "primary" : "alt"}
                              variant={p.locked ? "outline" : "ghost"}
                              size="sm"
                              aria-label={
                                p.locked
                                  ? t("backroom.result.unlock", { name: p.member.name })
                                  : t("backroom.result.lockIn", { name: p.member.name })
                              }
                              aria-pressed={p.locked}
                              title={p.locked ? t("backroom.result.lockedTitle") : t("backroom.result.lockTitle")}
                              onClick={() => onToggleLock(p.role.id, p.member.uniqueId)}
                              icon={
                                p.locked ? (
                                  <Lock className="h-4 w-4" aria-hidden />
                                ) : (
                                  <LockOpen className="h-4 w-4 text-muted" aria-hidden />
                                )
                              }
                            />
                            <Button
                              color="alt"
                              variant="ghost"
                              size="sm"
                              aria-label={t("backroom.result.exclude", { name: p.member.name })}
                              title={t("backroom.result.excludeTitle")}
                              onClick={() => onExclude(p.member.uniqueId)}
                              icon={<X className="h-4 w-4" aria-hidden />}
                            />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
