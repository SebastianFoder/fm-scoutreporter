import type { CSSProperties } from "react";
import { gradeFor, type Grade, type GradeTier } from "@scoutreporter/core/grades";

type Size = "sm" | "lg";

/**
 * The stamp itself, for a known grade (e.g. a legend). Effects live in `app/globals.css` (`.grade`) and
 * scale with rarity: every stamp has gloss, an inner glow and a slowly moving fill; S shines on a loop,
 * S+ breathes, and S++ adds a holographic border with a sparkle. Nothing reacts to hover.
 */
export function GradeBadge({
  grade,
  tier,
  size = "sm",
  title,
  delay = 0,
}: {
  grade: Grade;
  tier: GradeTier;
  size?: Size;
  /** Tooltip and accessible name; omit for a purely visual stamp next to its own text. */
  title?: string;
  /** Seconds to offset looping effects, so stamps in a table don't all move in step. */
  delay?: number;
}) {
  const letter = grade.charAt(0);
  // Show the minus as a true minus sign; the accessible name keeps the plain grade.
  const mod = grade.slice(1).replace("-", "−");
  return (
    <span
      className="grade"
      data-tier={tier}
      data-grade={grade}
      data-size={size}
      style={{ "--grade-delay": `${delay.toFixed(2)}s` } as CSSProperties}
      title={title}
      aria-label={title ?? `Grade ${grade}`}
      role="img"
    >
      <span aria-hidden>
        {letter}
        {mod && <span className="grade-mod">{mod}</span>}
      </span>
    </span>
  );
}

/** Letter grade stamp (S++ to F) for a weighted attribute score on FM's 1–20 scale. */
export function GradeStamp({
  score,
  size = "sm",
  label,
}: {
  /** Score on the 1–20 scale. */
  score: number;
  size?: Size;
  /** What the score is, for the tooltip and screen readers (e.g. "Potential"). */
  label?: string;
}) {
  const { grade, tier } = gradeFor(score);
  const title = `${label ? `${label}: ` : ""}grade ${grade} (${score.toFixed(1)} on the 1–20 scale)`;
  // Spread looping effects over a few seconds, stable per score.
  const delay = ((score * 1000) % 3600) / 1000;
  return <GradeBadge grade={grade} tier={tier} size={size} title={title} delay={delay} />;
}
