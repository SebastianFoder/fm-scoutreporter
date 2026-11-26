"use client";

import { useMemo } from "react";
import type { PlayerWithGroups } from "@scoutreporter/core/players";
import { ageBenchmark, PRIME_BENCHMARK } from "@scoutreporter/core/fm27/benchmarks";
import { fm27PlayerScores } from "@scoutreporter/core/fm27/player-scores";
import { useTranslations } from "next-intl";
import { useFormatNumber } from "@scoutreporter/ui/i18n/hooks";

/** Role scores live on the FM 1–20 scale; bars start at 0 so lengths stay honest. */
const SCALE_MAX = 20;
const pctOf = (v: number) => `${Math.max(0, Math.min(100, (v / SCALE_MAX) * 100))}%`;

export function Fm27RolePanel({ player }: { player: PlayerWithGroups }) {
  const scores = useMemo(() => fm27PlayerScores(player), [player]);
  const hasPotential = scores.bestPotential !== null;
  const bench = ageBenchmark(player.raw.age);
  const t = useTranslations("fm27.roles");
  const tFm = useTranslations("fm.terms");
  const formatNumber = useFormatNumber();
  const one = (v: number) => formatNumber(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const percent = (v: number) => formatNumber(v, { style: "percent", maximumFractionDigits: 0 });

  return (
    <section className="panel px-4 py-3.5 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="section-title">{t("title")}</h2>
        <p className="text-[12px] text-muted">{t("scale")}</p>
      </div>

      <ul className="mt-3 space-y-2.5">
        {scores.roles.map((r) => {
          const best = r.role === scores.best.role;
          const pot = r.potential ?? null;
          return (
            <li
              key={r.role}
              className="grid grid-cols-[2.75rem_1fr_auto] items-center gap-2"
              title={t("barTitle", {
                role: r.role,
                current: one(r.current),
                potential: pot !== null ? one(pot) : "",
                hasPotential: pot !== null ? "yes" : "no",
              })}
            >
              <span className={best ? "font-bold" : "text-muted"}>{r.role}</span>
              <span className="relative h-3.5">
                {/* track */}
                <span className="absolute inset-y-[5px] left-0 right-0 rounded-full bg-line/70" />
                {/* potential (outline) */}
                {hasPotential && pot !== null && pot > r.current && (
                  <span
                    className="absolute inset-y-0 left-0 rounded-r-[4px] border-[1.5px] border-series-1 bg-surface"
                    style={{ width: pctOf(pot) }}
                  />
                )}
                {/* now (solid) */}
                <span
                  className="absolute inset-y-0 left-0 rounded-r-[4px] bg-series-1"
                  style={{ width: pctOf(r.current) }}
                />
                {/* benchmarks */}
                <span
                  className="absolute -inset-y-1 w-0 border-l border-dashed border-ink/70"
                  style={{ left: pctOf(bench) }}
                />
                <span
                  className="absolute -inset-y-1 w-0 border-l-2 border-ink"
                  style={{ left: pctOf(PRIME_BENCHMARK) }}
                />
              </span>
              <span className="w-[4.75rem] text-right text-[13px]">
                <span className={best ? "font-bold" : ""}>{one(r.current)}</span>
                {hasPotential && pot !== null && (
                  <span
                    className={pot >= PRIME_BENCHMARK ? "font-semibold text-positive" : "text-muted"}
                  >
                    {" "}
                    → {one(pot)}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted" aria-label={t("legend")}>
        <li className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 rounded-r-[3px] bg-series-1" aria-hidden /> {t("now")}
        </li>
        {hasPotential && (
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-r-[3px] border-[1.5px] border-series-1" aria-hidden /> {tFm("potential")}
          </li>
        )}
        <li className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0 border-l border-dashed border-ink/70" aria-hidden /> {t("ageBenchmark", { age: player.raw.age, value: one(bench) })}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0 border-l-2 border-ink" aria-hidden /> {t("prime", { value: one(PRIME_BENCHMARK) })}
        </li>
      </ul>

      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line">
        <div className="bg-surface px-3 py-2">
          <dt className="text-[12px] text-muted">{t("vsAge")}</dt>
          <dd className={`text-lg font-bold ${scores.vsAge >= 1 ? "text-positive" : ""}`}>
            {percent(scores.vsAge)}
          </dd>
        </div>
        {scores.potentialVsPrime !== null && (
          <div className="bg-surface px-3 py-2">
            <dt className="text-[12px] text-muted">{t("potentialVsPrime")}</dt>
            <dd className={`text-lg font-bold ${scores.potentialVsPrime >= 1 ? "text-positive" : ""}`}>
              {percent(scores.potentialVsPrime)}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
