"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PlayerLink } from "@scoutreporter/ui/components/PlayerPanel";
import { Link } from "../../i18n/navigation";
import { useTranslations } from "next-intl";
import { useIntlLocale } from "../../i18n/hooks";
import { ArrowLeft, RotateCcw, X } from "lucide-react";
import { usePlayersData } from "@scoutreporter/ui/components/PlayersDataProvider";
import { CsvImportPanel } from "@scoutreporter/ui/components/CsvImportPanel";
import { NoImport } from "@scoutreporter/ui/components/ImportPanel";
import { PageHeader } from "@scoutreporter/ui/components/PageHeader";
import { Button } from "@scoutreporter/ui/components/Button";
import { Notice } from "@scoutreporter/ui/components/Notice";
import { useWeightProfiles } from "@scoutreporter/ui/components/WeightConfig";
import type { PlayerWithGroups } from "@scoutreporter/core/players";
import { weightedAverage } from "@scoutreporter/core/fm27/benchmarks";
import { parsePositionSlots, type PositionSlot } from "@scoutreporter/core/position-slots";
import { DEFAULT_FORMATION, SLOT_LABEL } from "@scoutreporter/core/best-xi/formations";
import { parseSlotSettings, resolveRole, settingsFor, type Role, type SlotSetting } from "@scoutreporter/core/best-xi/roles";
import {
  currencyPrefix,
  formatMoney,
  parseBudgetInput,
  parseTransferValue,
  parseWeeklyWage,
  valueEstimate,
  type Valuation,
} from "@scoutreporter/core/best-xi/money";
import { solveBestXi, xiCostRange, type XiCandidate, type XiSlot } from "@scoutreporter/core/best-xi/solver";
import type { AttributeKey } from "@scoutreporter/core/types/weights";
import { FormationEditor, useRoleName } from "./FormationEditor";
import { ScoreBasisToggle } from "./ScoreBasisToggle";
import { PitchLineup, useFixed } from "./PitchLineup";

const STORAGE_KEY = "bestXiSettings";

type Settings = {
  slots: SlotSetting[];
  basis: "current" | "potential";
  valuation: Valuation;
  minBudget: string;
  maxBudget: string;
  includeFree: boolean;
  excluded: string[];
};

const DEFAULTS: Settings = {
  slots: settingsFor(DEFAULT_FORMATION.spots),
  basis: "current",
  valuation: "mid",
  minBudget: "",
  maxBudget: "",
  includeFree: true,
  excluded: [],
};

function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      slots: parseSlotSettings(s.slots) ?? DEFAULTS.slots,
      basis: s.basis === "potential" ? "potential" : "current",
      valuation: s.valuation === "low" || s.valuation === "high" ? s.valuation : "mid",
      minBudget: typeof s.minBudget === "string" ? s.minBudget : "",
      maxBudget: typeof s.maxBudget === "string" ? s.maxBudget : "",
      includeFree: s.includeFree !== false,
      excluded: Array.isArray(s.excluded) ? s.excluded.filter((x) => typeof x === "string") : [],
    };
  } catch {
    return DEFAULTS;
  }
}

type Pick = {
  setting: SlotSetting;
  role: Role;
  player: PlayerWithGroups;
  score: number;
  cost: number;
  wage: number | null;
};

type Outcome =
  | { kind: "ok"; picks: Pick[]; totalScore: number; totalCost: number; optimal: boolean; gap: number }
  | { kind: "slots"; unfilled: SlotSetting[] }
  | { kind: "budget"; range: { min: number; max: number } | null };

const VALUATIONS: Valuation[] = ["low", "mid", "high"];

export default function BestXiClient() {
  const { state } = usePlayersData();
  const { players, caModels } = state;
  const profiles = useWeightProfiles();
  const t = useTranslations("bestXi");
  const tTerms = useTranslations("fm.terms");

  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

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
  const basis = settings.basis === "potential" && caModels ? "potential" : "current";
  const minBudget = parseBudgetInput(settings.minBudget);
  const maxBudget = parseBudgetInput(settings.maxBudget);
  const budgetsCross =
    minBudget.value !== null && maxBudget.value !== null && minBudget.value > maxBudget.value;

  const currency = useMemo(() => {
    for (const p of players) {
      const prefix = currencyPrefix(p.raw.transferValueRange) ?? currencyPrefix(p.raw.wage);
      if (prefix) return prefix;
    }
    return "€";
  }, [players]);
  const intlLocale = useIntlLocale();
  const money = (n: number) => formatMoney(n, currency, intlLocale);

  // Per player: where they can play and what they count for against the budget.
  const pool = useMemo(() => {
    const excluded = new Set(settings.excluded);
    let unavailable = 0;
    const eligible: { p: PlayerWithGroups; slots: Set<PositionSlot>; cost: number }[] = [];
    for (const p of players) {
      if (excluded.has(p.raw.uniqueId)) continue;
      const value = parseTransferValue(p.raw.transferValueRange);
      if (value.kind === "unavailable") {
        unavailable++;
        continue;
      }
      if (value.kind === "none" && !settings.includeFree) continue;
      eligible.push({
        p,
        slots: new Set(parsePositionSlots(p.raw.position)),
        cost: value.kind === "range" ? valueEstimate(value, settings.valuation) : 0,
      });
    }
    return { eligible, unavailable };
  }, [players, settings.excluded, settings.includeFree, settings.valuation]);

  const outcome = useMemo<Outcome | null>(() => {
    if (players.length === 0) return null;
    const roles = settings.slots.map((s) => resolveRole(s, profiles));
    const byId = new Map<string, PlayerWithGroups>();
    const groups = new Map<string, XiCandidate[]>();

    const xiSlots: XiSlot[] = settings.slots.map((setting, i) => {
      const role = roles[i];
      const key = `${setting.slot}|${role.id}`;
      let candidates = groups.get(key);
      if (!candidates) {
        candidates = [];
        for (const { p, slots, cost } of pool.eligible) {
          if (!slots.has(setting.slot)) continue;
          const attrs = basis === "potential" ? p.potential?.attributes : undefined;
          const score = weightedAverage(
            (k: AttributeKey) => (attrs ? attrs[k] : p.raw[k]),
            role.weights,
            role.emphasis,
          );
          candidates.push({ id: p.raw.uniqueId, score, cost });
          byId.set(p.raw.uniqueId, p);
        }
        groups.set(key, candidates);
      }
      return { key, candidates };
    });

    const res = solveBestXi(xiSlots, {
      minBudget: minBudget.value ?? undefined,
      maxBudget: maxBudget.value ?? undefined,
    });
    if (res.status === "infeasible") {
      return res.reason === "slots"
        ? { kind: "slots", unfilled: res.unfilled.map((i) => settings.slots[i]) }
        : { kind: "budget", range: xiCostRange(xiSlots) };
    }
    return {
      kind: "ok",
      totalScore: res.totalScore,
      totalCost: res.totalCost,
      optimal: res.optimal,
      gap: res.gap,
      picks: res.picks.map((c, i) => {
        const player = byId.get(c.id)!;
        return {
          setting: settings.slots[i],
          role: roles[i],
          player,
          score: c.score,
          cost: c.cost,
          wage: parseWeeklyWage(player.raw.wage),
        };
      }),
    };
  }, [players.length, settings.slots, profiles, pool, basis, minBudget.value, maxBudget.value]);

  const excludedPlayers = useMemo(() => {
    const ids = new Set(settings.excluded);
    return players.filter((p) => ids.has(p.raw.uniqueId));
  }, [players, settings.excluded]);

  const fieldClass = "field h-9 px-2.5 text-sm text-ink";
  const labelClass = "flex flex-col gap-1 text-[13px] text-muted";

  return (
    <div className="text-ink">
      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6 md:py-8">
        <PageHeader
          title={tTerms("bestXi")}
          aside={
            <Link href="/players" className="btn h-9 border border-line bg-surface px-3 text-sm hover:bg-paper">
              <ArrowLeft className="h-4 w-4" aria-hidden /> {tTerms("players")}
            </Link>
          }
        >
          {t("intro")}
        </PageHeader>

        <CsvImportPanel testFixture="attribute" onImported={() => update({ excluded: [] })} />

        {players.length === 0 && (
          <NoImport
            desktop={t.rich("noImport.desktop", {
              kbd: (chunks) => (
                <kbd className="rounded border border-line bg-surface px-1.5 text-[12px] font-semibold text-ink">{chunks}</kbd>
              ),
            })}
          >
            {t("noImport.web")}
          </NoImport>
        )}

        {players.length > 0 && (
          <div className="grid items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <section aria-labelledby="xi-setup" className="panel">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 id="xi-setup" className="section-title">
                  {t("setup.title")}
                </h2>
                <Button
                  color="alt"
                  variant="ghost"
                  size="sm"
                  icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden />}
                  onClick={() => setSettings(DEFAULTS)}
                >
                  {t("setup.reset")}
                </Button>
              </div>

              <div className="flex flex-col gap-3.5 px-4 py-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <label className={labelClass}>
                    {t("setup.minBudget", { currency })}
                    <input
                      type="text"
                      inputMode="decimal"
                      value={settings.minBudget}
                      onChange={(e) => update({ minBudget: e.target.value })}
                      placeholder={t("setup.noMinimum")}
                      aria-invalid={!minBudget.valid}
                      className={`${fieldClass} w-full`}
                    />
                  </label>
                  <label className={labelClass}>
                    {t("setup.maxBudget", { currency })}
                    <input
                      type="text"
                      inputMode="decimal"
                      value={settings.maxBudget}
                      onChange={(e) => update({ maxBudget: e.target.value })}
                      placeholder={t("setup.noLimit")}
                      aria-invalid={!maxBudget.valid}
                      className={`${fieldClass} w-full`}
                    />
                  </label>
                  <p className="col-span-2 -mt-1.5 text-[12px] text-muted">
                    {!minBudget.valid || !maxBudget.valid ? (
                      <span className="text-red">{t("setup.budgetInvalid")}</span>
                    ) : (
                      t("setup.budgetHint")
                    )}
                  </p>
                </div>

                <label className={labelClass}>
                  {t("setup.valuation")}
                  <select
                    value={settings.valuation}
                    onChange={(e) => update({ valuation: e.target.value as Valuation })}
                    className={`${fieldClass} w-full pl-2.5`}
                  >
                    {VALUATIONS.map((v) => (
                      <option key={v} value={v}>
                        {t(`setup.valuations.${v}`)}
                      </option>
                    ))}
                  </select>
                </label>

                <ScoreBasisToggle
                  value={basis}
                  onChange={(b) => update({ basis: b })}
                  potentialAvailable={Boolean(caModels)}
                />

                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.includeFree}
                    onChange={(e) => update({ includeFree: e.target.checked })}
                    className="mt-0.5 h-4 w-4 accent-[oklch(var(--primary))]"
                  />
                  <span>
                    {t("setup.includeFree")}
                    <span className="block text-[12px] text-muted">
                      {t("setup.includeFreeHint", { amount: money(0) })}
                    </span>
                  </span>
                </label>
              </div>

              <div className="border-t border-line px-4 py-3.5">
                <FormationEditor
                  slots={settings.slots}
                  onChange={(slots) => update({ slots })}
                  profiles={profiles}
                />
              </div>
            </section>

            <div className="flex min-w-0 flex-col gap-4">
              {budgetsCross && (
                <Notice title={t("notices.budgetsCross.title")}>
                  {t("notices.budgetsCross.body", { min: money(minBudget.value!), max: money(maxBudget.value!) })}
                </Notice>
              )}

              {outcome?.kind === "slots" && (
                <Notice title={t("notices.slots.title")}>
                  {t("notices.slots.body", {
                    positions: [...new Set(outcome.unfilled.map((s) => SLOT_LABEL[s.slot]))].join(", "),
                  })}
                  {(settings.excluded.length > 0 || !settings.includeFree) && ` ${t("notices.slots.leftOut")}`}
                </Notice>
              )}

              {outcome?.kind === "budget" && !budgetsCross && (
                <Notice title={t("notices.budget.title")}>
                  {outcome.range
                    ? t("notices.budget.range", { min: money(outcome.range.min), max: money(outcome.range.max) })
                    : t("notices.budget.wider")}
                </Notice>
              )}

              {outcome?.kind === "ok" && (
                <XiResultPanel
                  outcome={outcome}
                  money={money}
                  basis={basis}
                  valuation={settings.valuation}
                  minBudget={minBudget.value}
                  maxBudget={maxBudget.value}
                  onExclude={(id) => update({ excluded: [...settings.excluded, id] })}
                />
              )}

              {excludedPlayers.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="text-muted">{t("excluded.label")}</span>
                  {excludedPlayers.map((p) => (
                    <button
                      key={p.raw.uniqueId}
                      type="button"
                      onClick={() =>
                        update({ excluded: settings.excluded.filter((id) => id !== p.raw.uniqueId) })
                      }
                      className="btn h-7 gap-1 border border-line bg-surface px-2 text-[13px] font-normal hover:bg-paper"
                      title={t("excluded.allowAgain")}
                    >
                      {p.raw.player}
                      <X className="h-3.5 w-3.5 text-muted" aria-hidden />
                      <span className="sr-only">{t("excluded.allowAgainHidden")}</span>
                    </button>
                  ))}
                  <button type="button" className="link ml-1 text-[13px]" onClick={() => update({ excluded: [] })}>
                    {t("excluded.clearAll")}
                  </button>
                </div>
              )}

              <p className="max-w-3xl text-[13px] leading-relaxed text-muted">
                {t("footnote")}
                {pool.unavailable > 0 && ` ${t("unpriced", { count: pool.unavailable })}`}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function XiResultPanel({
  outcome,
  money,
  basis,
  valuation,
  minBudget,
  maxBudget,
  onExclude,
}: {
  outcome: Extract<Outcome, { kind: "ok" }>;
  money: (n: number) => string;
  basis: "current" | "potential";
  valuation: Valuation;
  minBudget: number | null;
  maxBudget: number | null;
  onExclude: (id: string) => void;
}) {
  const t = useTranslations("bestXi.result");
  const tTerms = useTranslations("fm.terms");
  const fixed = useFixed();
  const roleName = useRoleName();
  const { picks, totalScore, totalCost } = outcome;
  const wages = picks.reduce((sum, p) => sum + (p.wage ?? 0), 0);
  const unknownWages = picks.filter((p) => p.wage === null).length;
  const budget =
    maxBudget !== null && minBudget !== null ? "range" : maxBudget !== null ? "max" : minBudget !== null ? "min" : "none";
  const bold = (chunks: ReactNode) => <span className="font-semibold text-ink">{chunks}</span>;

  return (
    <section aria-labelledby="xi-result" className="panel">
      <div className="border-b border-line px-4 py-3">
        <h2 id="xi-result" className="section-title">
          {t("title")}
        </h2>
        <p className="mt-0.5 text-sm text-muted">
          {t.rich("summary", {
            b: bold,
            average: fixed(totalScore / picks.length, 2),
            basis,
            cost: money(totalCost),
            budget,
            min: minBudget === null ? "" : money(minBudget),
            max: maxBudget === null ? "" : money(maxBudget),
            wages: money(wages),
            unknownWages,
          })}
        </p>
        {!outcome.optimal && (
          <p className="mt-1 text-[13px] text-muted">
            {t("notOptimal", { gap: fixed(outcome.gap, 2), total: fixed(totalScore) })}
          </p>
        )}
      </div>

      <div className="flex flex-col xl:flex-row">
        <div className="shrink-0 border-b border-line p-4 xl:w-[23.5rem] xl:border-b-0 xl:border-r">
          <PitchLineup
            label={t("pitchLabel")}
            entries={picks.map((p) => ({ spot: p.setting.spot, name: p.player.raw.player, score: p.score }))}
          />
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="px-2.5 py-2 text-left">{t("columns.pos")}</th>
                <th className="px-2.5 py-2 text-left">{tTerms("player")}</th>
                <th className="px-2.5 py-2 text-right">{tTerms("age")}</th>
                <th className="px-2.5 py-2 text-left">{tTerms("role")}</th>
                <th className="px-2.5 py-2 text-right" title={t("columns.scoreTitle")}>
                  {t("columns.score")}
                </th>
                <th className="px-2.5 py-2 text-right" title={t("columns.valueTitle")}>
                  {tTerms("value")}
                </th>
                <th className="px-2.5 py-2 text-right" title={t("columns.countedTitle", { valuation })}>
                  {t("columns.counted")}
                </th>
                <th className="px-2.5 py-2 text-right">{tTerms("wage")}</th>
                <th className="px-2.5 py-2">
                  <span className="sr-only">{t("columns.exclude")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {picks.map((pick, i) => {
                const raw = pick.player.raw;
                return (
                  <tr key={i}>
                    <td className="whitespace-nowrap px-2.5 py-1.5" title={SLOT_LABEL[pick.setting.slot]}>
                      {pick.setting.spot}
                    </td>
                    <td className="px-2.5 py-1.5">
                      <PlayerLink id={raw.uniqueId} className="font-semibold hover:text-accent hover:underline">
                        {raw.player}
                      </PlayerLink>
                      <span className="block text-[12px] text-muted">{raw.position}</span>
                    </td>
                    <td className="px-2.5 py-1.5 text-right">{raw.age}</td>
                    <td className="px-2.5 py-1.5 text-[13px] text-muted">{roleName(pick.role)}</td>
                    <td className="px-2.5 py-1.5 text-right font-bold">{fixed(pick.score)}</td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 text-right text-[13px] text-muted">
                      {raw.transferValueRange ?? "–"}
                    </td>
                    <td className="px-2.5 py-1.5 text-right">{money(pick.cost)}</td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 text-right text-[13px] text-muted">
                      {raw.wage ?? "–"}
                    </td>
                    <td className="px-1.5 py-1 text-right">
                      <Button
                        color="alt"
                        variant="ghost"
                        size="sm"
                        aria-label={t("excludeLabel", { name: raw.player })}
                        title={t("excludeTitle")}
                        onClick={() => onExclude(raw.uniqueId)}
                        icon={<X className="h-4 w-4" aria-hidden />}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="border-t border-line px-2.5 py-2" colSpan={4}>
                  {t("total")}
                </td>
                <td className="border-t border-line px-2.5 py-2 text-right">{fixed(totalScore)}</td>
                <td className="border-t border-line" />
                <td className="border-t border-line px-2.5 py-2 text-right">{money(totalCost)}</td>
                <td className="whitespace-nowrap border-t border-line px-2.5 py-2 text-right">
                  {t("perWeek", { amount: money(wages) })}
                </td>
                <td className="border-t border-line" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}
