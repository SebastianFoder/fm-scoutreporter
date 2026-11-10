"use client";

import { useMemo } from "react";
import type { PlayerWithGroups } from "@/data/players-store";
import { ageBenchmark, PRIME_BENCHMARK } from "@/lib/fm27/benchmarks";
import { fm27PlayerScores } from "@/lib/fm27/player-scores";

/** Role scores live on the FM 1–20 scale; bars start at 0 so lengths stay honest. */
const SCALE_MAX = 20;
const pctOf = (v: number) => `${Math.max(0, Math.min(100, (v / SCALE_MAX) * 100))}%`;

export function Fm27RolePanel({ player }: { player: PlayerWithGroups }) {
  const scores = useMemo(() => fm27PlayerScores(player), [player]);
  const hasPotential = scores.bestPotential !== null;
  const bench = ageBenchmark(player.raw.age);

  return (
    <section className="panel px-4 py-3.5 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="section-title">FM27 roles</h2>
        <p className="text-[12px] text-muted">score 0–20</p>
      </div>

      <ul className="mt-3 space-y-2.5">
        {scores.roles.map((r) => {
          const best = r.role === scores.best.role;
          const pot = r.potential ?? null;
          return (
            <li
              key={r.role}
              className="grid grid-cols-[2.75rem_1fr_auto] items-center gap-2"
              title={`${r.role}: now ${r.current.toFixed(1)}${pot !== null ? `, potential ${pot.toFixed(1)}` : ""}`}
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
                <span className={best ? "font-bold" : ""}>{r.current.toFixed(1)}</span>
                {hasPotential && pot !== null && (
                  <span
                    className={pot >= PRIME_BENCHMARK ? "font-semibold text-positive" : "text-muted"}
                  >
                    {" "}
                    → {pot.toFixed(1)}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted" aria-label="Legend">
        <li className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 rounded-r-[3px] bg-series-1" aria-hidden /> Now
        </li>
        {hasPotential && (
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-r-[3px] border-[1.5px] border-series-1" aria-hidden /> Potential
          </li>
        )}
        <li className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0 border-l border-dashed border-ink/70" aria-hidden /> Age {player.raw.age} benchmark {bench.toFixed(1)}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0 border-l-2 border-ink" aria-hidden /> Prime {PRIME_BENCHMARK.toFixed(1)}
        </li>
      </ul>

      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line">
        <div className="bg-surface px-3 py-2">
          <dt className="text-[12px] text-muted">vs Age</dt>
          <dd className={`text-lg font-bold ${scores.vsAge >= 1 ? "text-positive" : ""}`}>
            {Math.round(scores.vsAge * 100)}%
          </dd>
        </div>
        {scores.potentialVsPrime !== null && (
          <div className="bg-surface px-3 py-2">
            <dt className="text-[12px] text-muted">Potential vs prime</dt>
            <dd className={`text-lg font-bold ${scores.potentialVsPrime >= 1 ? "text-positive" : ""}`}>
              {Math.round(scores.potentialVsPrime * 100)}%
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
