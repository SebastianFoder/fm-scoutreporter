"use client";

import { useMemo, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PlayerWithGroups } from "@scoutreporter/core/players";
import type { AttributeKey } from "@scoutreporter/core/types/weights";
import {
  developmentPlan,
  type AdviceItem,
  type AdviceTone,
  type DevelopmentPlan,
} from "@scoutreporter/core/fm27/development";
import { fm27PlayerScores, type Fm27PlayerScores } from "@scoutreporter/core/fm27/player-scores";
import type { CoachingGroupId } from "@scoutreporter/core/fm27/training";
import { useAttributeLabel, useFormatNumber, useIntlLocale } from "@scoutreporter/ui/i18n/hooks";

const TONE_ICON: Record<AdviceTone, ReactNode> = {
  positive: <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden />,
  info: <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />,
  warning: <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ink" aria-hidden />,
};

/** The coach attributes (keys in fm.staffAttributes) that decide how well each coaching group is coached. */
const COACH_ATTRIBUTES: Record<CoachingGroupId, string[]> = {
  fitness: ["fitness"],
  possessionTechnical: ["possession", "technical"],
  possessionTactical: ["possession", "tacticalCoaching"],
  attackingTactical: ["attacking", "tacticalCoaching"],
  defendingTactical: ["defending", "tacticalCoaching"],
  attackingTechnical: ["attacking", "technical"],
  defendingTechnical: ["defending", "technical"],
  setPieces: ["setPieces"],
  goalkeeping: ["goalkeeping"],
};

/** The keepers' combined individual focus, as FM names it from its attributes. */
const GK_FOCUS: AttributeKey[] = ["reflexes", "anticipation", "positioning", "agility"];

/** A horizontal bar on a 0–100% axis with its value printed beside it. */
function ShareBar({ value, label }: { value: number; label: string }) {
  const formatNumber = useFormatNumber();
  return (
    <span className="grid grid-cols-[1fr_2.75rem] items-center gap-2" aria-label={label}>
      <span className="relative h-2.5">
        <span className="absolute inset-y-[3px] left-0 right-0 rounded-full bg-line/70" />
        <span
          className="absolute inset-y-0 left-0 rounded-r-[3px] bg-series-1"
          style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
        />
      </span>
      <span className="text-right text-[13px]">{formatNumber(value, { style: "percent", maximumFractionDigits: 0 })}</span>
    </span>
  );
}

/**
 * Core builds the plan's text in English; this words it in the current language from the plan's
 * kinds and variants, its numbers and the player's attributes.
 */
function usePlanText(player: PlayerWithGroups, plan: DevelopmentPlan, scores: Fm27PlayerScores) {
  const t = useTranslations("fm27.plan");
  const attr = useAttributeLabel();
  const formatNumber = useFormatNumber();
  const one = (v: number) => formatNumber(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const { raw } = player;

  const focus = (() => {
    switch (plan.focus.kind) {
      case "goalkeeper":
        return { name: GK_FOCUS.map(attr).join(" / "), reason: t("focus.goalkeeperReason") };
      case "quickness":
        return {
          name: t("focus.quickness"),
          reason: t("focus.quicknessReason", { pace: raw.pace, acceleration: raw.acceleration }),
        };
      case "attribute":
        if (plan.focus.attribute) {
          const attribute = attr(plan.focus.attribute);
          return {
            name: attribute,
            reason: t("focus.attributeReason", {
              pace: raw.pace,
              acceleration: raw.acceleration,
              attribute,
              role: plan.role.role,
            }),
          };
        }
        return plan.focus;
      case "quicknessFallback":
        return { name: t("focus.quickness"), reason: t("focus.quicknessFallbackReason") };
    }
  })();

  const trainingRole =
    plan.trainingRole.kind === "none"
      ? { name: t("trainingRole.goalkeeper"), reason: t("trainingRole.goalkeeperReason") }
      : { name: t("trainingRole.outfield", { role: plan.trainingRole.kind }), reason: t("trainingRole.outfieldReason") };

  const item = (it: AdviceItem): { title: string; detail: string } => {
    const gap = plan.caGap ?? 0;
    const ca = raw.currentAbility ?? 0;
    const pa = raw.potentialAbility ?? 0;
    const value = raw.professionalism ?? 0;
    switch (it.variant) {
      case "role":
        return scores.bestPotential
          ? {
              title: t("items.role.title", { role: scores.bestPotential.role }),
              detail: t("items.role.detail", {
                bestRole: scores.best.role,
                bestScore: one(scores.best.score),
                potentialRole: scores.bestPotential.role,
                potentialScore: one(scores.bestPotential.score),
              }),
            }
          : it;
      case "gapClose":
        return { title: t("items.gapClose.title"), detail: t("items.gapClose.detail", { gap, ca, pa }) };
      case "gapUnlikely":
        return {
          title: t("items.gapUnlikely.title"),
          detail: t("items.gapUnlikely.detail", { gap, age: raw.age, endAge: plan.endAge }),
        };
      case "gapLeft":
        return {
          title: t("items.gapLeft.title", { gap }),
          detail: t("items.gapLeft.detail", {
            ca,
            pa,
            seasons: plan.seasonsLeft,
            endAge: plan.endAge,
            goalkeeper: plan.isGoalkeeper ? "yes" : "no",
          }),
        };
      case "minutesPeak":
        return { title: t("items.minutesPeak.title"), detail: t("items.minutesPeak.detail") };
      case "minutesSenior":
        return { title: t("items.minutesSenior.title"), detail: t("items.minutesSenior.detail") };
      case "minutesPast":
        return { title: t("items.minutesPast.title"), detail: t("items.minutesPast.detail", { endAge: plan.endAge }) };
      case "profHigh":
        return {
          title: t("items.profHigh.title", { attribute: attr("professionalism"), value }),
          detail: t("items.profHigh.detail"),
        };
      case "profLow":
        return {
          title: t("items.profLow.title", {
            attribute: attr("professionalism"),
            value,
            level: value < 10 ? "low" : "average",
          }),
          detail: t("items.profLow.detail"),
        };
      case "det":
        return {
          title: t("items.det.title", { attribute: attr("determination"), value: raw.determination }),
          detail: t("items.det.detail"),
        };
      case "schedule":
        return { title: t("items.schedule.title"), detail: t("items.schedule.detail") };
      default:
        // A note core added later and nothing here translates yet: show its English.
        return it;
    }
  };

  return { focus, trainingRole, item, one };
}

export function DevelopmentPlanPanel({ player }: { player: PlayerWithGroups }) {
  const plan = useMemo(() => developmentPlan(player), [player]);
  const scores = useMemo(() => fm27PlayerScores(player), [player]);
  const { raw } = player;
  const t = useTranslations("fm27.plan");
  const tFm = useTranslations("fm");
  const attr = useAttributeLabel();
  const formatNumber = useFormatNumber();
  const locale = useIntlLocale();
  const pct = (v: number) => formatNumber(v, { style: "percent", maximumFractionDigits: 0 });
  const { focus, trainingRole, item, one } = usePlanText(player, plan, scores);
  const list = useMemo(() => new Intl.ListFormat(locale, { type: "conjunction" }), [locale]);
  const role = plan.role.role;

  return (
    <section aria-labelledby="dev-plan" className="panel px-4 py-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="dev-plan" className="section-title">
          {t("title")}
        </h2>
        <p className="text-[12px] text-muted">
          {t("builtFor", { atPa: player.potential ? "yes" : "no", role, score: one(plan.role.score) })}
        </p>
      </div>

      <div className="mt-3 grid gap-x-8 gap-y-5 md:grid-cols-2">
        <div className="space-y-4">
          <dl className="space-y-3">
            <div>
              <dt className="text-[12px] text-muted">{t("focusLabel")}</dt>
              <dd className="font-semibold">{focus.name}</dd>
              <dd className="mt-0.5 text-[13px] leading-snug text-muted">{focus.reason}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted">{t("trainingRoleLabel")}</dt>
              <dd className="font-semibold">{trainingRole.name}</dd>
              <dd className="mt-0.5 text-[13px] leading-snug text-muted">{trainingRole.reason}</dd>
            </div>
          </dl>

          <div>
            <h3 className="text-[13px] font-semibold">{t("sessions.title", { role })}</h3>
            {plan.sessions ? (
              <>
                <ul className="mt-2 space-y-2">
                  {plan.sessions.map((s) => {
                    const label = tFm(`trainingSchedules.${s.id}`);
                    return (
                      <li key={s.id}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-medium">{label}</span>
                          <span className="truncate text-[12px] text-muted">
                            {s.builds.length > 0
                              ? t("sessions.more", { attributes: s.builds.map(attr).join(", ") })
                              : t("sessions.nothingExtra")}
                          </span>
                        </div>
                        <ShareBar value={s.relative} label={t("sessions.barLabel", { session: label, percent: pct(s.relative) })} />
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-[12px] leading-snug text-muted">{t("sessions.note")}</p>
              </>
            ) : (
              <p className="mt-1 text-[13px] leading-snug text-muted">{t("sessions.goalkeeper")}</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {plan.coaching.length > 0 && (
            <div>
              <h3 className="text-[13px] font-semibold">{t("coaching.title")}</h3>
              <p className="mt-0.5 text-[12px] text-muted">{t("coaching.subtitle", { role })}</p>
              <ul className="mt-2 space-y-2">
                {plan.coaching.map((c) => {
                  const label = tFm(`coachingGroups.${c.group.id}`);
                  const coach = list.format(COACH_ATTRIBUTES[c.group.id].map((k) => tFm(`staffAttributes.${k}`)));
                  return (
                    <li key={c.group.id}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{label}</span>
                        <span className="text-[12px] text-muted">{t("coaching.coach", { attributes: coach })}</span>
                      </div>
                      <ShareBar value={c.share} label={t("coaching.barLabel", { group: label, percent: pct(c.share) })} />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <ul className="space-y-3" aria-label={t("notes")}>
            {plan.items.map((it) => {
              const { title, detail } = item(it);
              return (
                <li key={it.id} className="flex gap-2.5">
                  {TONE_ICON[it.tone]}
                  <div>
                    <p className={`font-semibold ${it.tone === "positive" ? "text-positive" : ""}`}>{title}</p>
                    <p className="text-[13px] leading-snug text-muted">{detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <p className="mt-4 border-t border-line pt-3 text-[12px] leading-snug text-muted">
        {t.rich("source", {
          link: (chunks) => (
            <a href="https://github.com/jamiebolden/fm-scoring" target="_blank" rel="noreferrer" className="link">
              {chunks}
            </a>
          ),
        })}{" "}
        {raw.age > plan.endAge && `${t("younger")} `}
        {t("odds")}
      </p>
    </section>
  );
}
