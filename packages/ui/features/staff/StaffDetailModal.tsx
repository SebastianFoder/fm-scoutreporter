"use client";

import { useTranslations } from "next-intl";
import { Modal } from "@scoutreporter/ui/components/Modal";
import { STAFF_ATTRIBUTES, STAFF_ATTRIBUTE_GROUPS } from "@scoutreporter/core/staff/staff-attributes";
import type { StaffMember } from "@scoutreporter/core/staff/staff-parser";
import type { StaffScores } from "@scoutreporter/core/staff/staff-roles";
import { RatingCell, ScoreCell, useDescribeRating, useFormatScore, useStaffRoleText, type ValueMode } from "./StaffCells";

/** Side panel for one staff member: every role ranked on a 0–20 axis, then all attributes by group. */
export function StaffDetailModal({
  member,
  scores,
  mode,
  open,
  onClose,
}: {
  member: StaffMember;
  scores: StaffScores;
  mode: ValueMode;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("staff");
  const tFm = useTranslations("fm");
  const roleText = useStaffRoleText();
  const formatScore = useFormatScore();
  const describeRating = useDescribeRating();
  const facts = [
    member.preferredJob && t("detail.preferredJob", { job: member.preferredJob }),
    member.club || t("freeAgent"),
    member.personality,
    member.age !== null && t("detail.age", { age: member.age }),
    member.nationality,
  ].filter(Boolean);

  return (
    <Modal open={open} onClose={onClose} placement="side" size="lg" title={member.name} description={facts.join(" · ")}>
      {scores.best && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-md border border-line bg-paper px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="text-[13px] text-muted">{t("bestRole")}</p>
            <p className="truncate font-semibold">{roleText.name(scores.best.role)}</p>
            {scores.preferred && scores.preferred.role.id !== scores.best.role.id && (
              <p className="text-[13px] text-muted">
                {t("detail.preferredScore", {
                  role: roleText.name(scores.preferred.role),
                  score: formatScore(scores.preferred.score),
                })}
              </p>
            )}
          </div>
          <ScoreCell score={scores.best} size="lg" />
        </div>
      )}

      <section aria-labelledby="staff-roles">
        <h3 id="staff-roles" className="section-title mb-2">
          {tFm("terms.roles")}
        </h3>
        <ol className="space-y-1.5">
          {scores.all.map((r) => {
            const preferred = scores.preferred?.role.id === r.role.id;
            return (
              <li
                key={r.role.id}
                className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3 text-sm"
                title={roleText.summary(r.role)}
              >
                <span className={`truncate ${preferred ? "font-semibold" : ""}`}>
                  {roleText.name(r.role)}
                  {preferred && <span className="text-muted"> {t("detail.preferred")}</span>}
                </span>
                <span className="relative h-2.5 rounded-sm bg-paper" aria-hidden>
                  <span
                    className="absolute inset-y-0 left-0 rounded-sm bg-series-1"
                    style={{ width: `${(r.score / 20) * 100}%` }}
                  />
                </span>
                <ScoreCell score={r} />
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-[12px] text-muted">
          {t("detail.barsNote")}
        </p>
      </section>

      {STAFF_ATTRIBUTE_GROUPS.map((g) => {
        const attrs = STAFF_ATTRIBUTES.filter((a) => a.group === g);
        return (
          <section key={g} aria-label={tFm(`staffAttributeGroups.${g}`)} className="mt-5">
            <h3 className="section-title mb-1.5">{tFm(`staffAttributeGroups.${g}`)}</h3>
            <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {attrs.map((a) => {
                const r = member.attributes[a.key];
                return (
                  <div
                    key={a.key}
                    className="flex items-center justify-between gap-3 border-b border-line py-1 text-sm"
                    title={r ? describeRating(r) : t("detail.notInExport")}
                  >
                    <dt>{tFm(`staffAttributes.${a.key}`)}</dt>
                    <dd>
                      <RatingCell rating={r} mode={mode} />
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        );
      })}
    </Modal>
  );
}
