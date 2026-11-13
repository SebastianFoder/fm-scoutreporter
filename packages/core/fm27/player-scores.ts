import type { PlayerWithGroups } from "@scoutreporter/core/players";
import type { AttributeKey } from "@scoutreporter/core/types/weights";
import {
  ageBenchmark,
  fm27RoleScores,
  isGoalkeeperPosition,
  PRIME_BENCHMARK,
  type Fm27Role,
  type RoleScore,
} from "./benchmarks";

export interface Fm27PlayerScores {
  roles: { role: Fm27Role; name: string; current: number; potential: number | null }[];
  best: RoleScore;
  /** Best role score ÷ age benchmark. */
  vsAge: number;
  bestPotential: RoleScore | null;
  /** Best potential role score ÷ the prime (24+) benchmark. */
  potentialVsPrime: number | null;
}

/** Score a player on every FM27 benchmark role that fits them, now and at projected full potential. */
export function fm27PlayerScores(p: PlayerWithGroups): Fm27PlayerScores {
  const gk = isGoalkeeperPosition(p.raw.position);
  const current = fm27RoleScores((k: AttributeKey) => p.raw[k], gk);
  const potentialAttrs = p.potential?.attributes;
  const potential = potentialAttrs
    ? fm27RoleScores((k: AttributeKey) => potentialAttrs[k], gk)
    : null;

  const best = current.reduce((a, b) => (b.score > a.score ? b : a), current[0]);
  const bestPotential = potential
    ? potential.reduce((a, b) => (b.score > a.score ? b : a), potential[0])
    : null;

  return {
    roles: current.map((c, i) => ({
      role: c.role,
      name: c.name,
      current: c.score,
      potential: potential ? potential[i].score : null,
    })),
    best,
    vsAge: best.score / ageBenchmark(p.raw.age),
    bestPotential,
    potentialVsPrime: bestPotential ? bestPotential.score / PRIME_BENCHMARK : null,
  };
}
