"use client";

import { useState } from "react";
import { GradeStamp } from "@scoutreporter/ui/components/GradeStamp";
import type { PlayerWithGroups } from "@scoutreporter/ui/components/PlayersDataProvider";
import type { SlotSetting } from "@scoutreporter/core/best-xi/roles";
import type { MemberStatus, SquadAnalysis, SquadMember } from "@scoutreporter/core/squad/analysis";
import type { SquadColumns, SquadFields } from "@scoutreporter/core/squad/squad-fields";
import { Delta, Happiness, SpotBadge, Stars, Tag, formatDays } from "./SquadBits";

type GroupId = "prospect" | "young" | "surplus" | "no-fit" | "away";

const GROUPS: { id: GroupId; title: string; blurb: string; statuses: MemberStatus[] }[] = [
  { id: "prospect", title: "Prospects", blurb: "Will outgrow a starter. Give them minutes.", statuses: ["prospect"] },
  { id: "young", title: "Developing", blurb: "21 or younger. Loan out or keep for training.", statuses: ["young"] },
  { id: "surplus", title: "Surplus", blurb: "Past development age and in neither eleven. Sell or keep as depth.", statuses: ["surplus"] },
  { id: "no-fit", title: "No position here", blurb: "No natural position in this formation.", statuses: ["no-fit"] },
  { id: "away", title: "Unavailable", blurb: "Injured or out on loan.", statuses: ["injured", "loan"] },
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
  if (analysis.rest.length === 0) return null;

  const showStars = Boolean(columns?.stars);
  const colCount = 5 + Number(showPotential) + Number(showStars) + Number(Boolean(columns?.playingTime)) + Number(Boolean(columns?.happiness)) + Number(Boolean(columns?.timeMissed));
  const th = "px-3 py-2";
  const td = "px-3 py-1.5";

  return (
    <section aria-labelledby="squad-rest" className="panel">
      <div className="border-b border-line px-4 py-3">
        <h2 id="squad-rest" className="section-title">
          Rest of the squad
        </h2>
        <p className="mt-0.5 text-sm text-muted">
          {analysis.rest.length} players in neither eleven, at the position where they come closest to the starter.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className={`${th} text-left`}>Player</th>
              <th className={`${th} text-left`}>Best fit</th>
              <th className={`${th} text-left`}>Score</th>
              <th className={`${th} text-right`} title="Score minus the starter at that position">
                vs starter
              </th>
              {showPotential && (
                <th className={`${th} text-left`} title="Score at that position at full potential">
                  Potential
                </th>
              )}
              {showStars && (
                <th className={`${th} text-left`} title="Coach report: ability now and potential, relative to your squad">
                  Coach rating
                </th>
              )}
              {columns?.playingTime && <th className={`${th} text-left`}>Squad status</th>}
              {columns?.happiness && <th className={`${th} text-left`}>Happiness</th>}
              {columns?.timeMissed && (
                <th className={`${th} text-right`} title="Time missed through injury">
                  Missed
                </th>
              )}
              <th className={`${th} text-left`}>Contract</th>
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
                    <span className="section-title">{g.title}</span>{" "}
                    <span className="text-[13px] font-semibold text-muted">{members.length}</span>
                    <span className="ml-2 text-[12px] text-muted">{g.blurb}</span>
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
                        {folded ? `Show all ${members.length}` : "Show fewer"}
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
  return (
    <tr>
      <td className={td}>
        <span className="flex items-center gap-1.5">
          <span className="font-semibold">{raw?.player}</span>
          <span className="text-[12px] text-muted">{m.age}y</span>
          {m.status === "injured" && (
            <Tag tone="red" title={f?.injury ?? undefined}>
              Injured
            </Tag>
          )}
          {m.status === "loan" && <Tag tone="gold">On loan</Tag>}
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
            <GradeStamp score={m.score} label={spot ? `Score at ${spot}` : "Score"} />
            <span className="tabular-nums">{m.score.toFixed(1)}</span>
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
              <GradeStamp score={m.potential} label="At full potential" />
              <span className={`tabular-nums ${m.status === "prospect" ? "font-semibold text-positive" : ""}`}>
                {m.potential.toFixed(1)}
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
              <Stars value={f.abilityStars} label="Ability" />
              <Stars value={f.potentialStars} label="Potential" />
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
