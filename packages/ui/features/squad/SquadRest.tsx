"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { GradeStamp } from "@scoutreporter/ui/components/GradeStamp";
import type { PlayerWithGroups } from "@scoutreporter/ui/components/PlayersDataProvider";
import type { SlotSetting } from "@scoutreporter/core/best-xi/roles";
import type { MemberStatus, SquadAnalysis, SquadMember } from "@scoutreporter/core/squad/analysis";
import type { SquadColumns, SquadFields } from "@scoutreporter/core/squad/squad-fields";
import { useFixed } from "@scoutreporter/ui/features/best-xi/PitchLineup";
import { Delta, Happiness, SpotBadge, Stars, Tag, useFormatDays } from "./SquadBits";

type GroupId = "prospect" | "young" | "surplus" | "no-fit" | "away";

/** Titles and blurbs are in squad.rest.groups.<id>. */
const GROUPS: { id: GroupId; statuses: MemberStatus[] }[] = [
  { id: "prospect", statuses: ["prospect"] },
  { id: "young", statuses: ["young"] },
  { id: "surplus", statuses: ["surplus"] },
  { id: "no-fit", statuses: ["no-fit"] },
  { id: "away", statuses: ["injured", "loan"] },
];

/** Rows shown before a long group folds. */
const FOLD_AT = 6;

export function SquadRest({
  analysis,
  slots,
  byId,
  fields,
  columns,
  showPotential,
}: {
  analysis: SquadAnalysis;
  slots: SlotSetting[];
  byId: Map<string, PlayerWithGroups>;
  fields: Map<string, SquadFields>;
  columns: SquadColumns | null;
  showPotential: boolean;
}) {
  const [open, setOpen] = useState<Set<GroupId>>(new Set());
  const t = useTranslations("squad.rest");
  const tTerms = useTranslations("fm.terms");
  if (analysis.rest.length === 0) return null;

  const showStars = Boolean(columns?.stars);
  const colCount = 5 + Number(showPotential) + Number(showStars) + Number(Boolean(columns?.playingTime)) + Number(Boolean(columns?.happiness)) + Number(Boolean(columns?.timeMissed));
  const th = "px-3 py-2";
  const td = "px-3 py-1.5";

  return (
    <section aria-labelledby="squad-rest" className="panel">
      <div className="border-b border-line px-4 py-3">
        <h2 id="squad-rest" className="section-title">
          {t("title")}
        </h2>
        <p className="mt-0.5 text-sm text-muted">{t("intro", { count: analysis.rest.length })}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className={`${th} text-left`}>{tTerms("player")}</th>
              <th className={`${th} text-left`}>{t("columns.bestFit")}</th>
              <th className={`${th} text-left`}>{t("columns.score")}</th>
              <th className={`${th} text-right`} title={t("columns.vsStarterTitle")}>
                {t("columns.vsStarter")}
              </th>
              {showPotential && (
                <th className={`${th} text-left`} title={t("columns.potentialTitle")}>
                  {tTerms("potential")}
                </th>
              )}
              {showStars && (
                <th className={`${th} text-left`} title={t("columns.coachRatingTitle")}>
                  {t("columns.coachRating")}
                </th>
              )}
              {columns?.playingTime && <th className={`${th} text-left`}>{tTerms("squadStatus")}</th>}
              {columns?.happiness && <th className={`${th} text-left`}>{t("columns.happiness")}</th>}
              {columns?.timeMissed && (
                <th className={`${th} text-right`} title={t("columns.missedTitle")}>
                  {t("columns.missed")}
                </th>
              )}
              <th className={`${th} text-left`}>{tTerms("contract")}</th>
            </tr>
          </thead>
          {GROUPS.map((g) => {
            const members = analysis.rest.filter((m) => g.statuses.includes(m.status));
            if (members.length === 0) return null;
            const folded = members.length > FOLD_AT + 2 && !open.has(g.id);
            const rows = folded ? members.slice(0, FOLD_AT) : members;
            return (
              <tbody key={g.id}>
                <tr>
                  <th colSpan={colCount} scope="rowgroup" className="bg-paper px-3 py-1.5 text-left font-normal">
                    <span className="section-title">{t(`groups.${g.id}.title`)}</span>{" "}
                    <span className="text-[13px] font-semibold text-muted">{members.length}</span>
                    <span className="ml-2 text-[12px] text-muted">{t(`groups.${g.id}.blurb`)}</span>
                  </th>
                </tr>
                {rows.map((m) => (
                  <MemberRow
                    key={m.id}
                    m={m}
                    slots={slots}
                    raw={byId.get(m.id)?.raw}
                    f={fields.get(m.id)}
                    columns={columns}
                    showPotential={showPotential}
                    showStars={showStars}
                    td={td}
                  />
                ))}
                {members.length > FOLD_AT + 2 && (
                  <tr>
                    <td colSpan={colCount} className="px-3 py-1.5">
                      <button
                        type="button"
                        className="link text-[13px]"
                        aria-expanded={!folded}
                        onClick={() =>
                          setOpen((s) => {
                            const next = new Set(s);
                            if (next.has(g.id)) next.delete(g.id);
                            else next.add(g.id);
                            return next;
                          })
                        }
                      >
                        {folded ? t("showAll", { count: members.length }) : t("showFewer")}
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
        </table>
      </div>
    </section>
  );
}

function MemberRow({
  m,
  slots,
  raw,
  f,
  columns,
  showPotential,
  showStars,
  td,
}: {
  m: SquadMember;
  slots: SlotSetting[];
  raw: PlayerWithGroups["raw"] | undefined;
  f: SquadFields | undefined;
  columns: SquadColumns | null;
  showPotential: boolean;
  showStars: boolean;
  td: string;
}) {
  const spot = m.index !== null ? slots[m.index].spot : null;
  const t = useTranslations("squad");
  const tTerms = useTranslations("fm.terms");
  const fixed = useFixed();
  const formatDays = useFormatDays();
  return (
    <tr>
      <td className={td}>
        <span className="flex items-center gap-1.5">
          <span className="font-semibold">{raw?.player}</span>
          <span className="text-[12px] text-muted">{t("ageShort", { age: m.age })}</span>
          {m.status === "injured" && (
            <Tag tone="red" title={f?.injury ?? undefined}>
              {t("injured")}
            </Tag>
          )}
          {m.status === "loan" && <Tag tone="gold">{t("rest.onLoan")}</Tag>}
        </span>
        <span className="block text-[12px] text-muted">
          {raw?.position}
          {f?.personality && ` · ${f.personality}`}
        </span>
      </td>
      <td className={td}>{spot ? <SpotBadge spot={spot} /> : <span className="text-muted">–</span>}</td>
      <td className={td}>
        {m.score !== null ? (
          <span className="inline-flex items-center gap-1.5">
            <GradeStamp score={m.score} label={spot ? t("rest.scoreAt", { spot }) : t("rest.score")} />
            <span className="tabular-nums">{fixed(m.score)}</span>
          </span>
        ) : (
          <span className="text-muted">–</span>
        )}
      </td>
      <td className={`${td} text-right text-sm`}>{m.gap !== null ? <Delta value={m.gap} warnAt={99} /> : "–"}</td>
      {showPotential && (
        <td className={td}>
          {m.potential !== null ? (
            <span className="inline-flex items-center gap-1.5">
              <GradeStamp score={m.potential} label={t("rest.atFullPotential")} />
              <span className={`tabular-nums ${m.status === "prospect" ? "font-semibold text-positive" : ""}`}>
                {fixed(m.potential)}
              </span>
            </span>
          ) : (
            <span className="text-muted">–</span>
          )}
        </td>
      )}
      {showStars && (
        <td className={`whitespace-nowrap ${td}`}>
          {f?.abilityStars != null && f.potentialStars != null ? (
            <span className="flex flex-col gap-0.5">
              <Stars value={f.abilityStars} label={t("ability")} />
              <Stars value={f.potentialStars} label={tTerms("potential")} />
            </span>
          ) : (
            <span className="text-muted">–</span>
          )}
        </td>
      )}
      {columns?.playingTime && (
        <td className={`whitespace-nowrap ${td} text-[13px] text-muted`}>{f?.playingTime ?? "–"}</td>
      )}
      {columns?.happiness && (
        <td className={`whitespace-nowrap ${td} text-[13px]`}>
          <Happiness value={f?.happiness ?? null} />
        </td>
      )}
      {columns?.timeMissed && (
        <td className={`whitespace-nowrap ${td} text-right text-[13px] text-muted`}>
          {f?.timeMissedDays ? formatDays(f.timeMissedDays) : "–"}
        </td>
      )}
      <td className={`whitespace-nowrap ${td} text-[13px] text-muted`}>
        {raw?.expires && raw.expires !== "N/A" ? raw.expires : "–"}
      </td>
    </tr>
  );
}
