import { PRIME_BENCHMARK } from "@/lib/fm27/benchmarks";

/**
 * Letter grades for a weighted attribute score on FM's 1–20 scale (FM27 role scores, weight-profile scores).
 *
 * FM-style A+ to F, plus our own S, S+ and S++ above A+ for the truly elite. Grades step every 0.5 and are
 * anchored on fm-scoring's prime benchmark (13.8, a high-end Championship / low-end Premier League player in
 * their prime), which sits in B-. For reference: on-track 16-year-olds (10.9) are a D, 18-year-olds (12.2) a C-.
 */

export type GradeTier = "s" | "a" | "b" | "c" | "d" | "f";

export type Grade =
  | "S++"
  | "S+"
  | "S"
  | "A+"
  | "A"
  | "A-"
  | "B+"
  | "B"
  | "B-"
  | "C+"
  | "C"
  | "C-"
  | "D+"
  | "D"
  | "D-"
  | "F";

export interface GradeStep {
  grade: Grade;
  tier: GradeTier;
  /** Lowest score (1–20 scale) that earns this grade. */
  min: number;
}

/** Best grade first. */
export const GRADE_SCALE: GradeStep[] = [
  { grade: "S++", tier: "s", min: 17.5 },
  { grade: "S+", tier: "s", min: 17 },
  { grade: "S", tier: "s", min: 16.5 },
  { grade: "A+", tier: "a", min: 16 },
  { grade: "A", tier: "a", min: 15.5 },
  { grade: "A-", tier: "a", min: 15 },
  { grade: "B+", tier: "b", min: 14.5 },
  { grade: "B", tier: "b", min: 14 },
  { grade: "B-", tier: "b", min: 13.5 },
  { grade: "C+", tier: "c", min: 13 },
  { grade: "C", tier: "c", min: 12.5 },
  { grade: "C-", tier: "c", min: 12 },
  { grade: "D+", tier: "d", min: 11.5 },
  { grade: "D", tier: "d", min: 11 },
  { grade: "D-", tier: "d", min: 10.5 },
  { grade: "F", tier: "f", min: -Infinity },
];

/** Grade for a weighted attribute score on the 1–20 scale. */
export function gradeFor(score: number): GradeStep {
  return GRADE_SCALE.find((g) => score >= g.min) ?? GRADE_SCALE[GRADE_SCALE.length - 1];
}

/** The prime benchmark's grade, for copy that explains the scale. */
export const PRIME_GRADE = gradeFor(PRIME_BENCHMARK).grade;
