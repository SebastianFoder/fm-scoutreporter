"use client";

import { useMemo, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { PlayerWithGroups } from "@/data/players-store";
import { attributeLabel, developmentPlan, type AdviceTone } from "@/lib/fm27/development";

const pct = (v: number) => `${Math.round(v * 100)}%`;

const TONE_ICON: Record<AdviceTone, ReactNode> = {
  positive: <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden />,
  info: <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />,
  warning: <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ink" aria-hidden />,
};

/** A horizontal bar on a 0–100% axis with its value printed beside it. */
function ShareBar({ value, label }: { value: number; label: string }) {
  return (
    <span className="grid grid-cols-[1fr_2.75rem] items-center gap-2" aria-label={label}>
      <span className="relative h-2.5">
        <span className="absolute inset-y-[3px] left-0 right-0 rounded-full bg-line/70" />
        <span
          className="absolute inset-y-0 left-0 rounded-r-[3px] bg-series-1"
          style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
        />
      </span>
      <span className="text-right text-[13px]">{pct(value)}</span>
    </span>
  );
}

export function DevelopmentPlanPanel({ player }: { player: PlayerWithGroups }) {
  const plan = useMemo(() => developmentPlan(player), [player]);
  const { raw } = player;

  return (
    <section aria-labelledby="dev-plan" className="panel px-4 py-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="dev-plan" className="section-title">
          Development plan
        </h2>
        <p className="text-[12px] text-muted">
          Built for the best role{player.potential ? " at PA" : ""}: {plan.role.role} ({plan.role.score.toFixed(1)})
        </p>
      </div>

      <div className="mt-3 grid gap-x-8 gap-y-5 md:grid-cols-2">
        <div className="space-y-4">
          <dl className="space-y-3">
            <div>
              <dt className="text-[12px] text-muted">Individual training focus</dt>
              <dd className="font-semibold">{plan.focus.name}</dd>
              <dd className="mt-0.5 text-[13px] leading-snug text-muted">{plan.focus.reason}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted">Training role</dt>
              <dd className="font-semibold">{plan.trainingRole.name}</dd>
              <dd className="mt-0.5 text-[13px] leading-snug text-muted">{plan.trainingRole.reason}</dd>
            </div>
          </dl>

          <div>
            <h3 className="text-[13px] font-semibold">Development sessions for the {plan.role.role} score</h3>
            {plan.sessions ? (
              <>
                <ul className="mt-2 space-y-2">
                  {plan.sessions.map((s) => (
                    <li key={s.id}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{s.label}</span>
                        <span className="truncate text-[12px] text-muted">
                          {s.builds.length > 0 ? `more ${s.builds.map(attributeLabel).join(", ")}` : "nothing extra"}
                        </span>
                      </div>
                      <ShareBar value={s.relative} label={`${s.label}: ${pct(s.relative)} of the best session`} />
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[12px] leading-snug text-muted">
                  Role-score growth from each session in harvestgreen22&apos;s FM27 test, applied to this player&apos;s attributes,
                  as a share of the best one. &quot;More&quot; lists what a session builds beyond the average
                  development session.
                </p>
              </>
            ) : (
              <p className="mt-1 text-[13px] leading-snug text-muted">
                Keepers weren&apos;t in the session test. The goalkeeping coach trains most of what a keeper needs,
                so assign your best one.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {plan.coaching.length > 0 && (
            <div>
              <h3 className="text-[13px] font-semibold">Coaching that matters most</h3>
              <p className="mt-0.5 text-[12px] text-muted">
                Share of the remaining {plan.role.role} growth each coaching group trains
              </p>
              <ul className="mt-2 space-y-2">
                {plan.coaching.map((c) => (
                  <li key={c.group.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{c.group.label}</span>
                      <span className="text-[12px] text-muted">coach: {c.group.coachAttributes}</span>
                    </div>
                    <ShareBar value={c.share} label={`${c.group.label}: ${pct(c.share)}`} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="space-y-3" aria-label="Notes">
            {plan.items.map((item) => (
              <li key={item.id} className="flex gap-2.5">
                {TONE_ICON[item.tone]}
                <div>
                  <p className={`font-semibold ${item.tone === "positive" ? "text-positive" : ""}`}>{item.title}</p>
                  <p className="text-[13px] leading-snug text-muted">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-4 border-t border-line pt-3 text-[12px] leading-snug text-muted">
        From the FM27 training research collected in{" "}
        <a href="https://github.com/jamiebolden/fm-scoring" target="_blank" rel="noreferrer" className="link">
          fm-scoring
        </a>
        : harvestgreen22&apos;s training test, the fm-scoring author&apos;s own schedule tests, and a tester who went
        through FM27&apos;s training code. {raw.age > plan.endAge ? "Most of it applies to younger players. " : ""}
        Growth is random month to month, so treat this as the odds, not a promise.
      </p>
    </section>
  );
}
