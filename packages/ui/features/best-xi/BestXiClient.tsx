"use client";

import { useEffect, useMemo, useState } from "react";
import { PlayerLink } from "@scoutreporter/ui/components/PlayerPanel";
import { RotateCcw, X } from "lucide-react";
import { usePlayersData } from "@scoutreporter/ui/components/PlayersDataProvider";
import { CsvImportPanel } from "@scoutreporter/ui/components/CsvImportPanel";
import { PageHeader } from "@scoutreporter/ui/components/PageHeader";
import { PLAYERS_TABS, SectionTabs } from "@scoutreporter/ui/components/SectionTabs";
import { Button } from "@scoutreporter/ui/components/Button";
import { Notice } from "@scoutreporter/ui/components/Notice";
import { useWeightProfiles } from "@scoutreporter/ui/components/WeightConfig";
import type { PlayerWithGroups } from "@scoutreporter/core/players";
import { weightedAverage } from "@scoutreporter/core/fm27/benchmarks";
import { parsePositionSlots, type PositionSlot } from "@scoutreporter/core/position-slots";
import { DEFAULT_FORMATION, SLOT_LABEL } from "@scoutreporter/core/best-xi/formations";
import { parseSlotSettings, resolveRole, settingsFor, shortRole, type Role, type SlotSetting } from "@scoutreporter/core/best-xi/roles";
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
import { FormationEditor } from "./FormationEditor";
import { ScoreBasisToggle } from "./ScoreBasisToggle";
import { PitchLineup } from "./PitchLineup";

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

const VALUATION_LABEL: Record<Valuation, string> = {
  low: "Low end of range",
  mid: "Midpoint of range",
  high: "High end of range",
};

export default function BestXiClient() {
  const { state } = usePlayersData();
  const { players, caModels } = state;
  const profiles = useWeightProfiles();

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
  const money = (n: number) => formatMoney(n, currency);

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
        <PageHeader title="Best XI">
          Picks the highest-scoring eleven from your import for a formation, with an optional
          minimum and maximum on what the eleven costs in total.
        </PageHeader>
        <SectionTabs tabs={PLAYERS_TABS} label="Player screens" />

        <CsvImportPanel testFixture="attribute" onImported={() => update({ excluded: [] })} />

        {players.length === 0 && (
          <p className="rounded-md border border-dashed border-line px-6 py-10 text-center text-sm text-muted">
            No CSV imported yet. Choose a CSV file above, or load the test data to look around.
          </p>
        )}

        {players.length > 0 && (
          <div className="grid items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <section aria-labelledby="xi-setup" className="panel">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 id="xi-setup" className="section-title">
                  Setup
                </h2>
                <Button
                  color="alt"
                  variant="ghost"
                  size="sm"
                  icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden />}
                  onClick={() => setSettings(DEFAULTS)}
                >
                  Reset
                </Button>
              </div>

              <div className="flex flex-col gap-3.5 px-4 py-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <label className={labelClass}>
                    Min budget ({currency})
                    <input
                      type="text"
                      inputMode="decimal"
                      value={settings.minBudget}
                      onChange={(e) => update({ minBudget: e.target.value })}
                      placeholder="No minimum"
                      aria-invalid={!minBudget.valid}
                      className={`${fieldClass} w-full`}
                    />
                  </label>
                  <label className={labelClass}>
                    Max budget ({currency})
                    <input
                      type="text"
                      inputMode="decimal"
                      value={settings.maxBudget}
                      onChange={(e) => update({ maxBudget: e.target.value })}
                      placeholder="No limit"
                      aria-invalid={!maxBudget.valid}
                      className={`${fieldClass} w-full`}
                    />
                  </label>
                  <p className="col-span-2 -mt-1.5 text-[12px] text-muted">
                    {!minBudget.valid || !maxBudget.valid ? (
                      <span className="text-red">
                        Enter an amount like 15M, 750K or 2500000. Unreadable budgets are ignored.
                      </span>
                    ) : (
                      "Total for the eleven. Type amounts like 15M or 750K."
                    )}
                  </p>
                </div>

                <label className={labelClass}>
                  A player costs
                  <select
                    value={settings.valuation}
                    onChange={(e) => update({ valuation: e.target.value as Valuation })}
                    className={`${fieldClass} w-full pl-2.5`}
                  >
                    {(Object.keys(VALUATION_LABEL) as Valuation[]).map((v) => (
                      <option key={v} value={v}>
                        {VALUATION_LABEL[v]}
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
                    Include players with no transfer value
                    <span className="block text-[12px] text-muted">
                      Mostly free agents. They count as {money(0)}.
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
                <Notice title="The minimum budget is above the maximum.">
                  No eleven can cost at least {money(minBudget.value!)} and at most{" "}
                  {money(maxBudget.value!)}.
                </Notice>
              )}

              {outcome?.kind === "slots" && (
                <Notice title="Not enough players to fill this formation.">
                  No eligible player left for:{" "}
                  {[...new Set(outcome.unfilled.map((s) => SLOT_LABEL[s.slot]))].join(", ")}. Only natural
                  positions from the export count.
                  {(settings.excluded.length > 0 || !settings.includeFree) &&
                    " Excluded players and players with no transfer value are left out."}
                </Notice>
              )}

              {outcome?.kind === "budget" && !budgetsCross && (
                <Notice title="No eleven fits this budget.">
                  {outcome.range
                    ? `With these settings the cheapest possible eleven costs ${money(outcome.range.min)} and the most expensive ${money(outcome.range.max)}.`
                    : "Try a wider budget."}
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
                  <span className="text-muted">Excluded:</span>
                  {excludedPlayers.map((p) => (
                    <button
                      key={p.raw.uniqueId}
                      type="button"
                      onClick={() =>
                        update({ excluded: settings.excluded.filter((id) => id !== p.raw.uniqueId) })
                      }
                      className="btn h-7 gap-1 border border-line bg-surface px-2 text-[13px] font-normal hover:bg-paper"
                      title="Allow this player again"
                    >
                      {p.raw.player}
                      <X className="h-3.5 w-3.5 text-muted" aria-hidden />
                      <span className="sr-only">(allow again)</span>
                    </button>
                  ))}
                  <button type="button" className="link ml-1 text-[13px]" onClick={() => update({ excluded: [] })}>
                    Clear all
                  </button>
                </div>
              )}

              <p className="max-w-3xl text-[13px] leading-relaxed text-muted">
                Each position takes one player who lists it as a natural position, scored on that
                position&apos;s role (1–20). The eleven shown has the highest total score of every
                combination that fits the budget.
                {pool.unavailable > 0 &&
                  ` ${pool.unavailable} player${pool.unavailable === 1 ? " is" : "s are"} left out because the export gives no price (for example "Not for Sale").`}
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
  const { picks, totalScore, totalCost } = outcome;
  const wages = picks.reduce((sum, p) => sum + (p.wage ?? 0), 0);
  const unknownWages = picks.filter((p) => p.wage === null).length;
  const budgetText =
    maxBudget !== null && minBudget !== null
      ? ` (budget ${money(minBudget)} to ${money(maxBudget)})`
      : maxBudget !== null
        ? ` of ${money(maxBudget)}`
        : minBudget !== null
          ? ` (at least ${money(minBudget)})`
          : "";

  return (
    <section aria-labelledby="xi-result" className="panel">
      <div className="border-b border-line px-4 py-3">
        <h2 id="xi-result" className="section-title">
          Best eleven
        </h2>
        <p className="mt-0.5 text-sm text-muted">
          Average score{" "}
          <span className="font-semibold text-ink">{(totalScore / picks.length).toFixed(2)}</span>
          {basis === "potential" && " at full potential"} · Cost{" "}
          <span className="font-semibold text-ink">{money(totalCost)}</span>
          {budgetText} · Wages{" "}
          <span className="font-semibold text-ink">{money(wages)} p/w</span>
          {unknownWages > 0 && ` (${unknownWages} without a contract)`}
        </p>
        {!outcome.optimal && (
          <p className="mt-1 text-[13px] text-muted">
            The search ran out of time before proving this is the very best eleven. A better one
            could add at most {outcome.gap.toFixed(2)} to the total score of {totalScore.toFixed(1)}.
          </p>
        )}
      </div>

      <div className="flex flex-col xl:flex-row">
        <div className="shrink-0 border-b border-line p-4 xl:w-[23.5rem] xl:border-b-0 xl:border-r">
          <PitchLineup
            label="The eleven on the pitch"
            entries={picks.map((p) => ({ spot: p.setting.spot, name: p.player.raw.player, score: p.score }))}
          />
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="px-2.5 py-2 text-left">Pos</th>
                <th className="px-2.5 py-2 text-left">Player</th>
                <th className="px-2.5 py-2 text-right">Age</th>
                <th className="px-2.5 py-2 text-left">Role</th>
                <th className="px-2.5 py-2 text-right" title="Role score on FM's 1–20 scale">
                  Score
                </th>
                <th className="px-2.5 py-2 text-right" title="Transfer value in the export">
                  Value
                </th>
                <th className="px-2.5 py-2 text-right" title={`Counted against the budget: ${VALUATION_LABEL[valuation].toLowerCase()}`}>
                  Counted
                </th>
                <th className="px-2.5 py-2 text-right">Wage</th>
                <th className="px-2.5 py-2">
                  <span className="sr-only">Exclude</span>
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
                    <td className="px-2.5 py-1.5 text-[13px] text-muted">{shortRole(pick.role.name)}</td>
                    <td className="px-2.5 py-1.5 text-right font-bold">{pick.score.toFixed(1)}</td>
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
                        aria-label={`Exclude ${raw.player} and pick again`}
                        title="Exclude and pick again"
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
                  Total
                </td>
                <td className="border-t border-line px-2.5 py-2 text-right">{totalScore.toFixed(1)}</td>
                <td className="border-t border-line" />
                <td className="border-t border-line px-2.5 py-2 text-right">{money(totalCost)}</td>
                <td className="whitespace-nowrap border-t border-line px-2.5 py-2 text-right">
                  {money(wages)} p/w
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
