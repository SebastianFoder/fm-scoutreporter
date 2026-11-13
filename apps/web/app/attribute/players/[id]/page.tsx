"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PlayerAttributesClient } from "@scoutreporter/ui/features/attribute/players/PlayerAttributesClient";
import { Fm27RolePanel } from "@scoutreporter/ui/features/fm27/Fm27RolePanel";
import { DevelopmentPlanPanel } from "@scoutreporter/ui/features/fm27/DevelopmentPlanPanel";
import { usePlayersData } from "@scoutreporter/ui/components/PlayersDataProvider";
import { PositionMap } from "@scoutreporter/ui/components/PositionMap";
import { groupPlayerAttributes } from "@scoutreporter/core/parser/attribute-grouper";
import { isGoalkeeperPosition } from "@scoutreporter/core/fm27/benchmarks";
import { fm27PlayerScores } from "@scoutreporter/core/fm27/player-scores";
import { GradeStamp } from "@scoutreporter/ui/components/GradeStamp";

export default function AttributePlayerPage() {
  const { state } = usePlayersData();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const player = useMemo(
    () => state.players.find((p) => p.raw.uniqueId === id),
    [state.players, id],
  );
  const [view, setView] = useState<"current" | "potential">("current");

  const scores = useMemo(() => (player ? fm27PlayerScores(player) : null), [player]);

  const potentialGrouped = useMemo(
    () =>
      player?.potential
        ? groupPlayerAttributes({ ...player.raw, ...player.potential.attributes })
        : null,
    [player],
  );

  if (!player) {
    return (
      <div className="mx-auto max-w-3xl space-y-2 px-5 py-10 text-ink">
        <h1 className="text-[1.6rem] font-bold">Player not found</h1>
        <p className="text-sm text-muted">
          This player isn&apos;t in the currently imported dataset. Import a CSV on{" "}
          <Link href="/attribute" className="link">
            attribute mode
          </Link>{" "}
          and try again.
        </p>
      </div>
    );
  }

  const { raw, grouped, potential } = player;
  const isGoalkeeper = isGoalkeeperPosition(raw.position);
  const showPotential = view === "potential" && potentialGrouped !== null;

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-5 py-5 text-ink md:py-6">
      <Link href="/attribute" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Players
      </Link>

      <header className="panel flex flex-col gap-5 px-5 py-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-[-0.01em]">{raw.player}</h1>
          <p className="mt-0.5 text-[15px] text-muted">
            {raw.position} · {raw.age} years old · {raw.euNational ? "EU national" : "Non-EU"}
          </p>

          {scores && (
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2" aria-label="Grades">
              <GradeLine label="Now" role={scores.best.role} score={scores.best.score} />
              {scores.bestPotential && (
                <GradeLine label="Potential" role={scores.bestPotential.role} score={scores.bestPotential.score} />
              )}
            </div>
          )}

          <dl className="mt-4 grid max-w-2xl grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            {raw.currentAbility !== null && <Fact label="Current ability" value={String(raw.currentAbility)} strong />}
            {raw.potentialAbility !== null && <Fact label="Potential ability" value={String(raw.potentialAbility)} strong />}
            {raw.professionalism !== null && <Fact label="Professionalism" value={String(raw.professionalism)} />}
            <Fact label="Value" value={raw.transferValueRange ?? "No valuation"} />
            <Fact label="Wage" value={raw.wage ?? "No wage data"} />
            <Fact label="Contract expires" value={raw.expires} />
            <Fact label="Right foot" value={raw.rightFoot} />
            <Fact label="Left foot" value={raw.leftFoot} />
            <Fact label="ID" value={raw.uniqueId} muted />
          </dl>
        </div>
        <PositionMap position={raw.position} />
      </header>

      {potentialGrouped && (
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="tablist"
            aria-label="Attribute view"
            className="inline-flex rounded-md border border-line bg-surface p-0.5"
          >
            {(["current", "potential"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`btn h-8 px-3 text-[13px] ${
                  view === v ? "bg-accent text-on-accent" : "text-muted hover:text-ink"
                }`}
              >
                {v === "current" ? "Current" : "Full potential"}
              </button>
            ))}
          </div>
          {showPotential && potential && (
            <p className="text-[13px] text-muted">
              Estimated attributes at PA {potential.pa} (from CA {potential.ca}), using FM27 CA costs.
              {potential.capped && " Every trainable attribute maxes out before reaching PA."}
            </p>
          )}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
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

function GradeLine({ label, role, score }: { label: string; role: string; score: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <GradeStamp score={score} size="lg" label={label} />
      <div className="leading-tight">
        <p className="text-[12px] text-muted">{label}</p>
        <p className="text-sm font-semibold">
          {role} <span className="font-normal text-muted">{score.toFixed(1)}</span>
        </p>
      </div>
    </div>
  );
}

function Fact({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd
        className={`truncate ${strong ? "text-lg font-bold leading-snug" : "font-medium"} ${muted ? "text-muted" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
