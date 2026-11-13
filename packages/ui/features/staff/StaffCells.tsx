"use client";

import { getBandForValue, useActiveAttributeProfile } from "@scoutreporter/ui/components/AttributeColorConfig";
import { GradeStamp } from "@scoutreporter/ui/components/GradeStamp";
import { bandForValue, describeRating, type StaffRating } from "@scoutreporter/core/staff/staff-attributes";
import type { StaffRoleScore } from "@scoutreporter/core/staff/staff-roles";

export type ValueMode = "words" | "numbers";

/** Text for an attribute cell: the short word, or the 1–20 range (exact number when known). */
export function ratingText(r: StaffRating, mode: ValueMode): string {
  if (mode === "words") return r.band.short;
  if (r.exact) return String(r.value);
  return r.band.min === r.band.max ? String(r.band.min) : `${r.band.min}–${r.band.max}`;
}

export function RatingCell({ rating, mode }: { rating: StaffRating | null; mode: ValueMode }) {
  const { thresholds } = useActiveAttributeProfile();
  if (!rating) return <span className="text-muted">–</span>;
  return (
    <span
      className="attr whitespace-nowrap text-[13px]"
      data-band={getBandForValue(rating.value, thresholds)}
      title={describeRating(rating)}
    >
      {ratingText(rating, mode)}
    </span>
  );
}

/** Role score: 1–20 value plus its grade stamp (the same S++ to F scale as player scores). */
export function ScoreCell({
  score,
  size = "sm",
}: {
  score: StaffRoleScore | null;
  size?: "sm" | "lg";
}) {
  if (!score) return <span className="text-muted">–</span>;
  const partial = score.coverage < 1;
  const title = [
    `${score.role.name}: ${score.score.toFixed(1)} (${bandForValue(score.score).word})`,
    partial && `${Math.round(score.coverage * 100)}% of this role's weight was in the export`,
  ]
    .filter(Boolean)
    .join(". ");
  return (
    <span className="inline-flex items-center justify-end gap-2" title={title}>
      <span className="font-semibold tabular-nums">
        {score.score.toFixed(1)}
        {partial && <span className="text-muted">*</span>}
      </span>
      <GradeStamp score={score.score} size={size} label={score.role.name} />
    </span>
  );
}
