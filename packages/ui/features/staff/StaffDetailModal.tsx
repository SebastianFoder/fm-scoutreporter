"use client";

import { Modal } from "@scoutreporter/ui/components/Modal";
import { STAFF_ATTRIBUTES, STAFF_ATTRIBUTE_GROUPS, describeRating } from "@scoutreporter/core/staff/staff-attributes";
import type { StaffMember } from "@scoutreporter/core/staff/staff-parser";
import type { StaffScores } from "@scoutreporter/core/staff/staff-roles";
import { RatingCell, ScoreCell, type ValueMode } from "./StaffCells";

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
  const facts = [
    member.preferredJob && `Preferred job: ${member.preferredJob}`,
    member.club || "Free agent",
    member.personality,
    member.age !== null && `Age ${member.age}`,
    member.nationality,
  ].filter(Boolean);

  return (
    <Modal open={open} onClose={onClose} placement="side" size="lg" title={member.name} description={facts.join(" · ")}>
      {scores.best && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-md border border-line bg-paper px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="text-[13px] text-muted">Best role</p>
            <p className="truncate font-semibold">{scores.best.role.name}</p>
            {scores.preferred && scores.preferred.role.id !== scores.best.role.id && (
              <p className="text-[13px] text-muted">
                Preferred job: {scores.preferred.role.name} {scores.preferred.score.toFixed(1)}
              </p>
            )}
          </div>
          <ScoreCell score={scores.best} size="lg" />
        </div>
      )}

      <section aria-labelledby="staff-roles">
        <h3 id="staff-roles" className="section-title mb-2">
          Roles
        </h3>
        <ol className="space-y-1.5">
          {scores.all.map((r) => {
            const preferred = scores.preferred?.role.id === r.role.id;
            return (
              <li
                key={r.role.id}
                className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3 text-sm"
                title={r.role.summary}
              >
                <span className={`truncate ${preferred ? "font-semibold" : ""}`}>
                  {r.role.name}
                  {preferred && <span className="text-muted"> (preferred)</span>}
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
          Bars run from 0 to 20. * means some of the role&apos;s attributes were missing from the export.
        </p>
      </section>

      {STAFF_ATTRIBUTE_GROUPS.map((g) => {
        const attrs = STAFF_ATTRIBUTES.filter((a) => a.group === g);
        return (
          <section key={g} aria-label={g} className="mt-5">
            <h3 className="section-title mb-1.5">{g}</h3>
            <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {attrs.map((a) => {
                const r = member.attributes[a.key];
                return (
                  <div
                    key={a.key}
                    className="flex items-center justify-between gap-3 border-b border-line py-1 text-sm"
                    title={r ? describeRating(r) : "Not in export"}
                  >
                    <dt>{a.label}</dt>
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
