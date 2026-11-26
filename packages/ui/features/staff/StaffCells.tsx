"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { getBandForValue, useActiveAttributeProfile } from "@scoutreporter/ui/components/AttributeColorConfig";
import { GradeStamp } from "@scoutreporter/ui/components/GradeStamp";
import { useFormatNumber } from "@scoutreporter/ui/i18n/hooks";
import { bandForValue, type StaffRating } from "@scoutreporter/core/staff/staff-attributes";
import type { StaffRole, StaffRoleGroup, StaffRoleScore } from "@scoutreporter/core/staff/staff-roles";

export type ValueMode = "words" | "numbers";

/** A role score with one decimal, in the current language ("12.5" / "12,5"). */
export function useFormatScore(): (score: number) => string {
  const formatNumber = useFormatNumber();
  return useCallback(
    (score: number) => formatNumber(score, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [formatNumber],
  );
}

/** "coach-set-pieces" → "setPieces": the coaching role's key in fm.coachingGroups. */
const coachingGroupKey = (roleId: string) =>
  roleId.replace(/^coach-/, "").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/**
 * Names, summaries and group labels of the staff roles in the current language. Core keeps them in
 * English; FM's own role names come from fm.staffRoles, the coaching-group coaches from staff.roles.names.
 */
export function useStaffRoleText() {
  const t = useTranslations("staff.roles");
  const tFm = useTranslations("fm");
  /** Full name: "Coach: set pieces". */
  const name = useCallback(
    (role: StaffRole) =>
      tFm.has(`staffRoles.${role.id}`)
        ? tFm(`staffRoles.${role.id}`)
        : t.has(`names.${role.id}`)
          ? t(`names.${role.id}`)
          : role.name,
    [t, tFm],
  );
  /** Coaching roles without "Coach:" ("Set pieces"), for lists already grouped under Coaching. */
  const shortName = useCallback(
    (role: StaffRole) => {
      const key = `coachingGroups.${coachingGroupKey(role.id)}`;
      return role.group === "Coaching" && tFm.has(key) ? tFm(key) : name(role);
    },
    [tFm, name],
  );
  const summary = useCallback(
    (role: StaffRole) => (t.has(`summaries.${role.id}`) ? t(`summaries.${role.id}`) : role.summary),
    [t],
  );
  const group = useCallback(
    (g: StaffRoleGroup) => {
      switch (g) {
        case "Management":
          return t("groups.management");
        case "Recruitment and analysis":
          return t("groups.recruitmentAndAnalysis");
        default:
          return tFm(`staffAttributeGroups.${g}`);
      }
    },
    [t, tFm],
  );
  return { name, shortName, summary, group };
}

/** "Good (12–14)" / "15 (Very Good)" for tooltips. The band word is FM's own rating word, as exported. */
export function useDescribeRating(): (r: StaffRating) => string {
  const t = useTranslations("staff.rating");
  return useCallback(
    (r: StaffRating) =>
      r.exact
        ? t("exact", { value: r.value, word: r.band.word })
        : t("word", { word: r.band.word, range: r.band.min === r.band.max ? `${r.band.min}` : `${r.band.min}–${r.band.max}` }),
    [t],
  );
}

/** Text for an attribute cell: the short word, or the 1–20 range (exact number when known). */
export function ratingText(r: StaffRating, mode: ValueMode): string {
  if (mode === "words") return r.band.short;
  if (r.exact) return String(r.value);
  return r.band.min === r.band.max ? String(r.band.min) : `${r.band.min}–${r.band.max}`;
}

export function RatingCell({ rating, mode }: { rating: StaffRating | null; mode: ValueMode }) {
  const { thresholds } = useActiveAttributeProfile();
  const describe = useDescribeRating();
  if (!rating) return <span className="text-muted">–</span>;
  return (
    <span
      className="attr whitespace-nowrap text-[13px]"
      data-band={getBandForValue(rating.value, thresholds)}
      title={describe(rating)}
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
  const t = useTranslations("staff.score");
  const roleText = useStaffRoleText();
  const formatScore = useFormatScore();
  if (!score) return <span className="text-muted">–</span>;
  const partial = score.coverage < 1;
  const role = roleText.name(score.role);
  const values = { role, score: formatScore(score.score), word: bandForValue(score.score).word };
  const title = partial ? t("partial", { ...values, percent: score.coverage }) : t("title", values);
  return (
    <span className="inline-flex items-center justify-end gap-2" title={title}>
      <span className="font-semibold tabular-nums">
        {formatScore(score.score)}
        {partial && <span className="text-muted">*</span>}
      </span>
      <GradeStamp score={score.score} size={size} label={role} />
    </span>
  );
}
