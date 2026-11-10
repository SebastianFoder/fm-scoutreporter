"use client";

import { useMemo } from "react";
import type { PlayerWithGroups } from "@/data/players-store";
import { ageBenchmark, PRIME_BENCHMARK } from "@/lib/fm27/benchmarks";
import { fm27PlayerScores } from "@/lib/fm27/player-scores";

export function Fm27RolePanel({ player }: { player: PlayerWithGroups }) {
  const scores = useMemo(() => fm27PlayerScores(player), [player]);
  const hasPotential = scores.bestPotential !== null;
  const bench = ageBenchmark(player.raw.age);

  return (
    <section className="rounded-lg border-2 border-[oklch(var(--border))] bg-[oklch(var(--surface))] px-4 py-3 text-xs shadow-[2px_2px_0_oklch(var(--border))]">
      <h2 className="mb-1 text-sm font-black uppercase tracking-wide">FM27 roles</h2>
      <p className="mb-2 text-[11px] text-[oklch(var(--text))]/60">
        Benchmarked role weights (1–20). Age {player.raw.age} benchmark {bench.toFixed(1)}, prime{" "}
        {PRIME_BENCHMARK.toFixed(1)}.
      </p>
      <table className="w-full font-mono">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-[oklch(var(--text))]/55">
            <th className="py-0.5 text-left font-black">Role</th>
            <th className="py-0.5 text-right font-black">Now</th>
            {hasPotential && <th className="py-0.5 text-right font-black">Pot.</th>}
          </tr>
        </thead>
        <tbody>
          {scores.roles.map((r) => (
            <tr key={r.role} className={r.role === scores.best.role ? "font-black" : ""}>
              <td className="py-0.5">{r.role}</td>
              <td className="py-0.5 text-right">{r.current.toFixed(1)}</td>
              {hasPotential && (
                <td
                  className={`py-0.5 text-right ${
                    (r.potential ?? 0) >= PRIME_BENCHMARK ? "text-[oklch(var(--primary))]" : ""
                  }`}
                >
                  {r.potential?.toFixed(1)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-2 space-y-1 border-t border-[oklch(var(--border))]/30 pt-2">
        <div className="flex justify-between">
          <dt className="font-bold text-[oklch(var(--text))]/75">vs Age</dt>
          <dd className="font-mono font-bold">{Math.round(scores.vsAge * 100)}%</dd>
        </div>
        {scores.potentialVsPrime !== null && (
          <div className="flex justify-between">
            <dt className="font-bold text-[oklch(var(--text))]/75">Potential vs prime</dt>
            <dd className="font-mono font-bold">{Math.round(scores.potentialVsPrime * 100)}%</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
