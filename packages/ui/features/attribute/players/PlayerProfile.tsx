"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { PlayerWithGroups } from "@scoutreporter/core/players";
import { groupPlayerAttributes } from "@scoutreporter/core/parser/attribute-grouper";
import { isGoalkeeperPosition } from "@scoutreporter/core/fm27/benchmarks";
import { fm27PlayerScores } from "@scoutreporter/core/fm27/player-scores";
import { GradeStamp } from "@scoutreporter/ui/components/GradeStamp";
import { EstimatedMark } from "@scoutreporter/ui/components/EstimatedMark";
import { PositionMap } from "@scoutreporter/ui/components/PositionMap";
import { PlayerAttributesClient } from "./PlayerAttributesClient";
import { Fm27RolePanel } from "@scoutreporter/ui/features/fm27/Fm27RolePanel";
import { DevelopmentPlanPanel } from "@scoutreporter/ui/features/fm27/DevelopmentPlanPanel";
import { useTranslations } from "next-intl";
import { useFormatNumber } from "@scoutreporter/ui/i18n/hooks";

/**
 * Everything about one player: grades, facts, attributes (current or at full potential), FM27
 * roles and the development plan. Shown on the player page and, stacked in one column, in the
 * player side panel.
 */
export function PlayerProfile({
  player,
  layout = "page",
  headingId,
}: {
  player: PlayerWithGroups;
  /** "panel": one column for the side panel, with a smaller heading. */
  layout?: "page" | "panel";
  /** id for the player's name, so a surrounding dialog or panel can be labelled by it. */
  headingId?: string;
}) {
  const panel = layout === "panel";
  const t = useTranslations("players.profile");
  const tFm = useTranslations("fm");
  const [view, setView] = useState<"current" | "potential">("current");
  const scores = useMemo(() => fm27PlayerScores(player), [player]);
  const potentialGrouped = useMemo(
    () => (player.potential ? groupPlayerAttributes({ ...player.raw, ...player.potential.attributes }) : null),
    [player],
  );

  const { raw, grouped, potential } = player;
  const isGoalkeeper = isGoalkeeperPosition(raw.position);
  const showPotential = view === "potential" && potentialGrouped !== null;
  const Heading = panel ? "h2" : "h1";

  return (
    <div className="space-y-4">
      <header className={`panel flex flex-col gap-5 px-5 py-4 ${panel ? "" : "sm:flex-row sm:items-start"}`}>
        <div className="min-w-0 flex-1">
          <Heading
            id={headingId}
            className={`${panel ? "text-[1.4rem]" : "text-[1.75rem]"} font-bold leading-tight tracking-[-0.01em]`}
          >
            {raw.player}
          </Heading>
          <p className="mt-0.5 text-[15px] text-muted">
            {t("subtitle", { position: raw.position, age: raw.age, eu: raw.euNational ? "yes" : "no" })}
          </p>

          {scores && (
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2" aria-label={t("grades")}>
              <GradeLine
                label={t("now")}
                role={scores.best.role}
                score={scores.best.score}
                mark={<EstimatedMark player={raw} />}
              />
              {scores.bestPotential && (
                <GradeLine label={tFm("terms.potential")} role={scores.bestPotential.role} score={scores.bestPotential.score} />
              )}
            </div>
          )}

          <div className={panel ? "mt-4 flex items-start gap-5" : ""}>
            <dl
              className={`grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-3 text-sm ${panel ? "" : "mt-4 max-w-2xl sm:grid-cols-3"}`}
            >
              {raw.currentAbility !== null && (
                <Fact label={tFm("attributes.currentAbility")} value={String(raw.currentAbility)} strong />
              )}
              {raw.potentialAbility !== null && (
                <Fact label={tFm("attributes.potentialAbility")} value={String(raw.potentialAbility)} strong />
              )}
              {raw.professionalism !== null && (
                <Fact label={tFm("attributes.professionalism")} value={String(raw.professionalism)} />
              )}
              <Fact label={tFm("terms.value")} value={raw.transferValueRange ?? t("noValuation")} />
              <Fact label={tFm("terms.wage")} value={raw.wage ?? t("noWage")} />
              <Fact label={t("contractExpires")} value={raw.expires} />
              <Fact label={tFm("terms.rightFoot")} value={raw.rightFoot} />
              <Fact label={tFm("terms.leftFoot")} value={raw.leftFoot} />
              <Fact label={t("id")} value={raw.uniqueId} muted />
            </dl>
            {panel && <PositionMap position={raw.position} />}
          </div>
        </div>
        {!panel && <PositionMap position={raw.position} />}
      </header>

      {potentialGrouped && (
        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label={t("attributeView")} className="inline-flex rounded-md border border-line bg-surface p-0.5">
            {(["current", "potential"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`btn h-8 px-3 text-[13px] ${view === v ? "bg-accent text-on-accent" : "text-muted hover:text-ink"}`}
              >
                {v === "current" ? t("current") : t("fullPotential")}
              </button>
            ))}
          </div>
          {showPotential && potential && (
            <p className="text-[13px] text-muted">
              {t("estimated", { pa: potential.pa, ca: potential.ca })}
              {potential.capped && ` ${t("capped")}`}
            </p>
          )}
        </div>
      )}

      <section className={panel ? "space-y-4" : "grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]"}>
        <PlayerAttributesClient
          grouped={showPotential ? potentialGrouped! : grouped}
          baseline={showPotential ? grouped : undefined}
          isGoalkeeper={isGoalkeeper}
        />
        <aside className="flex flex-col gap-4">
          <Fm27RolePanel player={player} />
        </aside>
      </section>

      <DevelopmentPlanPanel player={player} />
    </div>
  );
}

function GradeLine({ label, role, score, mark }: { label: string; role: string; score: number; mark?: ReactNode }) {
  const formatNumber = useFormatNumber();
  return (
    <div className="flex items-center gap-2.5">
      <GradeStamp score={score} size="lg" label={label} />
      <div className="leading-tight">
        <p className="text-[12px] text-muted">{label}</p>
        <p className="text-sm font-semibold">
          {role}{" "}
          <span className="font-normal text-muted">
            {mark}
            {formatNumber(score, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </span>
        </p>
      </div>
    </div>
  );
}

function Fact({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className={`truncate ${strong ? "text-lg font-bold leading-snug" : "font-medium"} ${muted ? "text-muted" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
