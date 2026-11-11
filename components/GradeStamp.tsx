import { gradeFor } from "@/lib/grades";

/**
 * Letter grade stamp (S++ to F) for a weighted attribute score on FM's 1–20 scale.
 * The letter is always printed, so the colour is never the only cue.
 */
export function GradeStamp({
  score,
  size = "sm",
  label,
}: {
  /** Score on the 1–20 scale. */
  score: number;
  size?: "sm" | "lg";
  /** What the score is, for the tooltip and screen readers (e.g. "Potential"). */
  label?: string;
}) {
  const { grade, tier } = gradeFor(score);
  const text = `${label ? `${label}: ` : ""}grade ${grade} (${score.toFixed(1)} on the 1–20 scale)`;
  return (
    <span className="grade" data-tier={tier} data-size={size} title={text} aria-label={text} role="img">
      {grade}
    </span>
  );
}
