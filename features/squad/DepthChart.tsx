import type { ReactNode } from "react";
import type { Role, SlotSetting } from "@/lib/best-xi/roles";
import { shortRole } from "@/lib/best-xi/roles";
import type { Pick, SquadAnalysis } from "@/lib/squad/analysis";
import { isInjured, type SquadFields } from "@/lib/squad/squad-fields";
import { DROP_OFF_GAP } from "@/lib/squad/analysis";
import { Delta, PlayerChip, SpotBadge, Tag, lastName } from "./SquadBits";

/** Every position: starter, cover from the second eleven, the drop between them, and who else can play there. */
export function DepthChart({
  analysis,
  slots,
  roles,
  name,
  age,
  fields,
  potentialBasis,
}: {
  analysis: SquadAnalysis;
  slots: SlotSetting[];
  roles: Role[];
  name: (id: string) => string;
  age: (id: string) => number;
  fields: Map<string, SquadFields>;
  potentialBasis: boolean;
}) {
  const cell = (p: Pick | null, label: string): ReactNode => {
    if (!p) return <span className="text-[13px] font-semibold text-red">Nobody</span>;
    const f = fields.get(p.id);
    return (
      <span className="flex flex-col gap-0.5">
        <PlayerChip name={name(p.id)} score={p.score} age={age(p.id)} label={label}>
          {isInjured(f) && (
            <Tag tone="red" title={f?.injury ?? undefined}>
              Injured
            </Tag>
          )}
        </PlayerChip>
        {f?.playingTime && <span className="pl-[2.6rem] text-[12px] text-muted">{f.playingTime}</span>}
      </span>
    );
  };

  return (
    <section aria-labelledby="squad-depth" className="panel">
      <div className="border-b border-line px-4 py-3">
        <h2 id="squad-depth" className="section-title">
          Depth chart
        </h2>
        <p className="mt-0.5 text-sm text-muted">
          Starter and cover at every position{potentialBasis && ", at full potential"}. Cover comes from
          the second eleven, so nobody covers two places.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left">Pos</th>
              <th className="px-3 py-2 text-left">Starter</th>
              <th className="px-3 py-2 text-left">Cover</th>
              <th className="px-3 py-2 text-right" title="Cover's score minus the starter's">
                Drop
              </th>
              <th
                className="px-3 py-2 text-left"
                title="Other natural players, best first. XI: starts elsewhere. 2nd: covers elsewhere."
              >
                Also plays here
              </th>
            </tr>
          </thead>
          <tbody>
            {analysis.slots.map((r, i) => (
              <tr key={i}>
                <td className="whitespace-nowrap px-3 py-2 align-top">
                  <SpotBadge spot={slots[i].spot} />
                  <span className="mt-1 block text-[12px] text-muted">{shortRole(roles[i].name)}</span>
                </td>
                <td className="px-3 py-2 align-top">{cell(r.starter, `Starter at ${slots[i].spot}`)}</td>
                <td className="px-3 py-2 align-top">{cell(r.backup, `Cover at ${slots[i].spot}`)}</td>
                <td className="px-3 py-2 text-right align-top text-sm">
                  {r.starter && r.backup ? (
                    <Delta value={r.backup.score - r.starter.score} warnAt={DROP_OFF_GAP} />
                  ) : (
                    <span className="text-muted">–</span>
                  )}
                </td>
                <td className="px-3 py-2 align-top">
                  {r.others.length === 0 ? (
                    <span className="text-[13px] text-muted">Nobody</span>
                  ) : (
                    <ul className="flex flex-wrap gap-1">
                      {r.others.slice(0, 4).map((o) => (
                        <li
                          key={o.id}
                          title={`${name(o.id)}, ${o.score.toFixed(1)}${o.xi === 1 ? ", starts elsewhere" : o.xi === 2 ? ", covers elsewhere" : ""}`}
                          className={`inline-flex items-center gap-1 rounded-[3px] px-1.5 py-0.5 text-[12px] ring-1 ring-line ${
                            o.xi ? "text-muted" : "bg-surface"
                          }`}
                        >
                          <span className="font-semibold">{lastName(name(o.id))}</span>
                          <span className="tabular-nums">{o.score.toFixed(1)}</span>
                          {o.xi === 1 && <span className="text-[10px] font-bold">XI</span>}
                          {o.xi === 2 && <span className="text-[10px] font-bold">2nd</span>}
                        </li>
                      ))}
                      {r.others.length > 4 && (
                        <li className="px-1 py-0.5 text-[12px] text-muted">+{r.others.length - 4}</li>
                      )}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
