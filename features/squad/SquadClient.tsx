"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { usePlayersData, type PlayerWithGroups } from "@/components/PlayersDataProvider";
import { useSquadData } from "@/components/SquadDataProvider";
import { ImportPanel, STORAGE_FULL_MESSAGE } from "@/components/ImportPanel";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { useWeightProfiles } from "@/components/WeightConfig";
import { weightedAverage } from "@/lib/fm27/benchmarks";
import { parsePositionSlots } from "@/lib/position-slots";
import { DEFAULT_FORMATION, SLOT_LABEL } from "@/lib/best-xi/formations";
import { parseSlotSettings, resolveRole, settingsFor, type Role, type SlotSetting } from "@/lib/best-xi/roles";
import { VIEW_SQUAD, VIEW_SQUAD_HIDDEN } from "@/lib/view-files";
import { analyseSquad, findUpgrades, type SquadSlotInput, type Unavailable } from "@/lib/squad/analysis";
import { isInjured, isOnLoan, isPickedToStart } from "@/lib/squad/squad-fields";
import type { AttributeKey } from "@/types/weights";
import { FormationEditor } from "@/features/best-xi/FormationEditor";
import { ScoreBasisToggle } from "@/features/best-xi/ScoreBasisToggle";
import { SquadOverview } from "./SquadOverview";
import { DepthChart } from "./DepthChart";
import { SquadRest } from "./SquadRest";
import { SquadUpgrades } from "./SquadUpgrades";

const STORAGE_KEY = "squadAnalysisSettings";

type Basis = "current" | "potential";
type Settings = {
  slots: SlotSetting[];
  basis: Basis;
  /** Count players out on loan at other clubs (Squad view exports). */
  includeLoans: boolean;
  /** Leave injured players out of the elevens. */
  excludeInjured: boolean;
};

const DEFAULTS: Settings = {
  slots: settingsFor(DEFAULT_FORMATION.spots),
  basis: "current",
  includeLoans: false,
  excludeInjured: false,
};

function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      slots: parseSlotSettings(s.slots) ?? DEFAULTS.slots,
      basis: s.basis === "potential" ? "potential" : "current",
      includeLoans: s.includeLoans === true,
      excludeInjured: s.excludeInjured === true,
    };
  } catch {
    return DEFAULTS;
  }
}

/** Score every player who can play each slot on that slot's role, now and at full potential. */
function scoreSlots(players: PlayerWithGroups[], slots: SlotSetting[], roles: Role[], basis: Basis): SquadSlotInput[] {
  const eligible = players.map((p) => ({ p, at: new Set(parsePositionSlots(p.raw.position)) }));
  const cache = new Map<string, SquadSlotInput["candidates"]>();
  return slots.map((s, i) => {
    const role = roles[i];
    const key = `${s.slot}|${role.id}`;
    let candidates = cache.get(key);
    if (!candidates) {
      candidates = eligible
        .filter((e) => e.at.has(s.slot))
        .map(({ p }) => {
          const now = weightedAverage((k: AttributeKey) => p.raw[k], role.weights, role.emphasis);
          const pa = p.potential?.attributes;
          const potential = pa ? weightedAverage((k: AttributeKey) => pa[k], role.weights, role.emphasis) : null;
          const score = basis === "potential" && potential !== null ? potential : now;
          return { id: p.raw.uniqueId, score, potential };
        });
      cache.set(key, candidates);
    }
    return { key, candidates };
  });
}

export default function SquadClient() {
  const squad = useSquadData();
  const scouting = usePlayersData();
  const profiles = useWeightProfiles();
  const { players, caModels, fields, columns } = squad.state;

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
  const basis: Basis = settings.basis === "potential" && caModels ? "potential" : "current";
  const roles = useMemo(() => settings.slots.map((s) => resolveRole(s, profiles)), [settings.slots, profiles]);
  const byId = useMemo(() => new Map(players.map((p) => [p.raw.uniqueId, p])), [players]);

  const loanCount = useMemo(() => [...fields.values()].filter(isOnLoan).length, [fields]);
  const injuredCount = useMemo(() => [...fields.values()].filter(isInjured).length, [fields]);

  const analysis = useMemo(() => {
    if (players.length === 0) return null;
    const unavailable = new Map<string, Unavailable>();
    for (const [id, f] of fields) {
      if (!settings.includeLoans && isOnLoan(f)) unavailable.set(id, "loan");
      else if (settings.excludeInjured && isInjured(f)) unavailable.set(id, "injured");
    }
    return analyseSquad({
      slots: scoreSlots(players, settings.slots, roles, basis),
      players: players.map((p) => {
        const f = fields.get(p.raw.uniqueId);
        return {
          id: p.raw.uniqueId,
          age: p.raw.age,
          stars:
            f?.abilityStars != null && f.potentialStars != null
              ? { ability: f.abilityStars, potential: f.potentialStars }
              : null,
          playingTime: f?.playingTime ?? null,
          pickedToStart: columns?.picked ? isPickedToStart(f) : undefined,
          pickedAt: isPickedToStart(f) ? (parsePositionSlots(f!.picked!)[0] ?? null) : null,
        };
      }),
      goalkeeperSlots: settings.slots.flatMap((s, i) => (s.slot === "GK" ? [i] : [])),
      slotPositions: settings.slots.map((s) => s.slot),
      potentialBasis: basis === "potential",
      unavailable,
    });
  }, [players, fields, columns, settings.slots, settings.includeLoans, settings.excludeInjured, roles, basis]);

  // Scouting targets: the player import, minus anyone already in the squad.
  const scoutPool = useMemo(
    () => scouting.state.players.filter((p) => !byId.has(p.raw.uniqueId)),
    [scouting.state.players, byId],
  );
  const scoutById = useMemo(() => new Map(scoutPool.map((p) => [p.raw.uniqueId, p])), [scoutPool]);
  const upgrades = useMemo(() => {
    if (!analysis || scoutPool.length === 0) return null;
    return findUpgrades(analysis, scoreSlots(scoutPool, settings.slots, roles, basis));
  }, [analysis, scoutPool, settings.slots, roles, basis]);

  const name = (id: string) => byId.get(id)?.raw.player ?? "Unknown";
  const age = (id: string) => byId.get(id)?.raw.age ?? 0;

  const scoutingCount = scouting.state.players.length;

  return (
    <div className="text-ink">
      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6 md:py-8">
        <PageHeader title="Squad analysis">
          Import your squad, pick the formation you play, and see your first and second eleven, where
          the squad is thin or weak, who is ageing out and which youngsters can step up.
        </PageHeader>

        <ImportPanel
          title={players.length > 0 ? `${players.length} players in your squad` : "Import your squad"}
          description={
            <>
              Export your squad screen with the{" "}
              <a href={VIEW_SQUAD.href} className="link">
                Squad
              </a>{" "}
              or{" "}
              <a href={VIEW_SQUAD_HIDDEN.href} className="link">
                Squad Hidden Attributes
              </a>{" "}
              view (adds potential). Kept separate from your scouting import.
              {columns && !Object.values(columns).some(Boolean) &&
                " This import has no squad columns, so loans, injuries, squad status and the team sheet are not checked."}
            </>
          }
          testFixture="squad-hidden"
          onLoad={(text) => {
            const res = squad.importCsv(text);
            if (!res.ok) return res.error;
            return res.persisted ? null : STORAGE_FULL_MESSAGE;
          }}
          onClear={squad.clear}
        />

        {players.length === 0 && (
          <div className="rounded-md border border-dashed border-line px-6 py-10 text-center text-sm text-muted">
            <p>No squad imported yet. Choose your squad CSV above, or load the test data to look around.</p>
            {scoutingCount > 0 && scouting.state.csvText && (
              <p className="mt-2">
                Already exported your squad as the player import?{" "}
                <button
                  type="button"
                  className="link"
                  onClick={() => squad.importCsv(scouting.state.csvText!)}
                >
                  Use the player import ({scoutingCount} players) as your squad
                </button>
              </p>
            )}
          </div>
        )}

        {analysis && (
          <div className="grid items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <section aria-labelledby="squad-setup" className="panel">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 id="squad-setup" className="section-title">
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
              <div className="px-4 py-3.5">
                <ScoreBasisToggle
                  value={basis}
                  onChange={(b) => update({ basis: b })}
                  potentialAvailable={Boolean(caModels)}
                  hiddenViewName="Squad Hidden Attributes view"
                />
                {(columns?.playingTime || columns?.injury) && (
                  <fieldset className="mt-3.5 flex flex-col gap-2">
                    <legend className="mb-1 text-[13px] text-muted">Availability</legend>
                    {columns.playingTime && (
                      <Checkbox
                        checked={settings.includeLoans}
                        onChange={(includeLoans) => update({ includeLoans })}
                        label="Count players out on loan"
                        hint={`${loanCount} out on loan at other clubs.`}
                      />
                    )}
                    {columns.injury && (
                      <Checkbox
                        checked={settings.excludeInjured}
                        onChange={(excludeInjured) => update({ excludeInjured })}
                        label="Leave out injured players"
                        hint={`${injuredCount} injured now. On: the elevens you can pick today.`}
                      />
                    )}
                  </fieldset>
                )}
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
              {analysis.firstXi.filled < settings.slots.length && (
                <Notice title="Your squad cannot fill this formation.">
                  Nobody plays{" "}
                  {[...new Set(analysis.slots.flatMap((r, i) => (r.starter ? [] : [SLOT_LABEL[settings.slots[i].slot]])))].join(", ")}{" "}
                  as a natural position, so the eleven is short. Only natural positions from the export count.
                </Notice>
              )}

              <SquadOverview
                analysis={analysis}
                slots={settings.slots}
                name={name}
                age={age}
                fields={fields}
                potentialBasis={basis === "potential"}
                squadSize={players.length}
                averageAge={players.reduce((s, p) => s + p.raw.age, 0) / players.length}
                unavailableCount={analysis.rest.filter((m) => m.status === "loan" || m.status === "injured").length}
              />

              <DepthChart
                analysis={analysis}
                slots={settings.slots}
                roles={roles}
                name={name}
                age={age}
                fields={fields}
                potentialBasis={basis === "potential"}
              />

              <SquadRest
                analysis={analysis}
                slots={settings.slots}
                byId={byId}
                fields={fields}
                columns={columns}
                showPotential={Boolean(caModels) && basis === "current"}
              />

              <SquadUpgrades
                upgrades={upgrades}
                slots={settings.slots}
                name={name}
                scoutById={scoutById}
                scoutingCount={scoutingCount}
              />

              <p className="max-w-3xl text-[13px] leading-relaxed text-muted">
                Each position is scored on its role (1–20, with the S++ to F grade) and only counts
                players who list it as a natural position. The first eleven has the highest total
                score; the second eleven is the best eleven from everyone left, so each player covers
                one position.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[oklch(var(--primary))]"
      />
      <span>
        {label}
        <span className="block text-[12px] text-muted">{hint}</span>
      </span>
    </label>
  );
}
