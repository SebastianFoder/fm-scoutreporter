"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, CircleAlert } from "lucide-react";
import { GradeStamp } from "@/components/GradeStamp";
import { SegmentedControl } from "@/components/SegmentedControl";
import { SLOT_LABEL } from "@/lib/best-xi/formations";
import type { SlotSetting } from "@/lib/best-xi/roles";
import { Pitch, spotStyle } from "@/features/best-xi/PitchLineup";
import type { Finding, SelectionComparison, Severity, SquadAnalysis } from "@/lib/squad/analysis";
import { isInjured, type SquadFields } from "@/lib/squad/squad-fields";
import { Delta, PlayerChip, SpotBadge, Stars, Tag, lastName, withArticle } from "./SquadBits";

type Group = { id: string; title: string; blurb: string; match: (f: Finding) => boolean };

const GROUPS: Group[] = [
  {
    id: "fix",
    title: "Fix",
    blurb: "Positions that cost you now: gaps, weak links and thin cover.",
    match: (f) =>
      f.kind === "empty" || f.kind === "weak" || f.kind === "no-cover" || f.kind === "drop-off" || (f.kind === "ageing" && !f.successor),
  },
  {
    id: "manage",
    title: "Manage",
    blurb: "Squad status that does not match the eleven. Sort it out at the next contract talk.",
    match: (f) => f.kind === "status-benched" || f.kind === "status-starting",
  },
  {
    id: "develop",
    title: "Develop",
    blurb: "Young players who will outgrow a starter, and successors ready to step in.",
    match: (f) => f.kind === "prospect" || (f.kind === "ageing" && Boolean(f.successor)),
  },
];

const SEVERITY_RANK: Record<Severity, number> = { high: 2, medium: 1, info: 0 };

export function SquadOverview({
  analysis,
  slots,
  name,
  age,
  fields,
  potentialBasis,
  squadSize,
  averageAge,
  unavailableCount,
}: {
  analysis: SquadAnalysis;
  slots: SlotSetting[];
  name: (id: string) => string;
  age: (id: string) => number;
  fields: Map<string, SquadFields>;
  potentialBasis: boolean;
  squadSize: number;
  averageAge: number;
  unavailableCount: number;
}) {
  const [shown, setShown] = useState<"first" | "second">("first");
  const [focus, setFocus] = useState<number | null>(null);
  const { firstXi, secondXi, findings, selection } = analysis;

  // Worst problem at each position (notes don't mark the pitch).
  const issues = new Map<number, Severity>();
  const mark = (i: number, s: Severity) => {
    if (s === "info") return;
    if (!issues.has(i) || SEVERITY_RANK[s] > SEVERITY_RANK[issues.get(i)!]) issues.set(i, s);
  };
  analysis.slots.forEach((r, i) => !r.starter && mark(i, "high"));
  for (const f of findings) if (f.index !== null && f.kind !== "empty") mark(f.index, f.severity);

  const atFocus = (f: Finding) =>
    focus === null ||
    f.index === focus ||
    (f.kind === "empty" && f.index !== null && analysis.slots[f.index].key === analysis.slots[focus].key);
  const visible = findings.filter(atFocus);

  return (
    <section aria-labelledby="squad-overview" className="panel">
      <div className="border-b border-line px-4 py-3">
        <h2 id="squad-overview" className="section-title">
          Squad overview
        </h2>
        <dl className="mt-2 flex flex-wrap gap-x-7 gap-y-2.5 text-[15px]">
          <Stat label={potentialBasis ? "First eleven at potential" : "First eleven"}>
            {firstXi.average !== null && <GradeStamp score={firstXi.average} label="First eleven average" />}
            <span className="font-bold tabular-nums">{firstXi.average?.toFixed(2) ?? "–"}</span>
            {firstXi.averageAge !== null && <span className="text-[13px] text-muted">age {firstXi.averageAge.toFixed(1)}</span>}
          </Stat>
          <Stat label="Second eleven">
            {secondXi.average !== null && <GradeStamp score={secondXi.average} label="Second eleven average" />}
            <span className="font-bold tabular-nums">{secondXi.average?.toFixed(2) ?? "–"}</span>
            {firstXi.average !== null && secondXi.average !== null && (
              <Delta value={secondXi.average - firstXi.average} warnAt={1} className="text-[13px]" />
            )}
            {secondXi.filled < slots.length && (
              <span className="text-[13px] text-muted">{slots.length - secondXi.filled} unfilled</span>
            )}
          </Stat>
          <Stat label="Squad">
            <span className="font-bold tabular-nums">{squadSize}</span>
            <span className="text-[13px] text-muted">
              players, age {averageAge.toFixed(1)}
              {unavailableCount > 0 && `, ${unavailableCount} unavailable`}
            </span>
          </Stat>
          {selection && (
            <Stat label="FM team sheet">
              <span className="font-bold tabular-nums">{selection.matching}</span>
              <span className="text-[13px] text-muted">of {firstXi.filled} match this eleven</span>
            </Stat>
          )}
        </dl>
      </div>

      {selection && (selection.changes.length > 0 || selection.moves.length > 0) && (
        <TeamSheetChanges selection={selection} slots={slots} name={name} age={age} fields={fields} />
      )}

      <div className="grid xl:grid-cols-[23rem_minmax(0,1fr)]">
        <div className="border-b border-line p-4 xl:border-b-0 xl:border-r">
          <SegmentedControl
            label="Eleven on the pitch"
            size="sm"
            className="mb-3 w-full"
            value={shown}
            onChange={setShown}
            options={[
              { value: "first", label: "First eleven" },
              { value: "second", label: "Second eleven" },
            ]}
          />
          <HealthPitch
            analysis={analysis}
            slots={slots}
            shown={shown}
            replaces={
              new Map(
                (selection?.changes ?? []).flatMap((ch) =>
                  ch.index !== null && ch.out ? [[ch.index, name(ch.out.id)] as const] : [],
                ),
              )
            }
            issues={issues}
            focus={focus}
            onFocus={(i) => setFocus(focus === i ? null : i)}
            name={name}
            fields={fields}
          />
          <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
            <span className="inline-flex items-center gap-1">
              <CircleAlert className="h-3.5 w-3.5 text-red" aria-hidden /> Needs fixing
            </span>
            <span className="inline-flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-gold" aria-hidden /> Worth watching
            </span>
            <span>Click a position to see its notes.</span>
          </p>
        </div>

        <div className="min-w-0">
          {focus !== null && (
            <div className="flex items-center justify-between gap-2 border-b border-line bg-paper px-4 py-2 text-[13px]">
              <span className="flex items-center gap-2">
                <SpotBadge spot={slots[focus].spot} />
                {visible.length === 0 ? "Nothing to note at this position." : `${visible.length} note${visible.length === 1 ? "" : "s"} at this position`}
              </span>
              <button type="button" className="link" onClick={() => setFocus(null)}>
                Show all
              </button>
            </div>
          )}
          {findings.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">
              Nothing to fix: every starter is close to the eleven&apos;s average and has cover less than
              1.5 behind them.
            </p>
          ) : (
            GROUPS.map((g) => {
              const items = visible.filter(g.match);
              if (items.length === 0) return null;
              return (
                <section key={g.id} aria-labelledby={`grp-${g.id}`} className="border-b border-line last:border-b-0">
                  <header className="flex items-baseline gap-2 px-4 pb-1 pt-3">
                    <h3 id={`grp-${g.id}`} className="section-title">
                      {g.title}
                    </h3>
                    <span className="text-[13px] font-semibold text-muted">{items.length}</span>
                    <span className="hidden truncate text-[12px] text-muted sm:inline">{g.blurb}</span>
                  </header>
                  <ul>
                    {items.map((f, i) => (
                      <FindingRow key={i} finding={f} slots={slots} name={name} age={age} fields={fields} />
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-1.5">{children}</dd>
    </div>
  );
}

function HealthPitch({
  analysis,
  slots,
  shown,
  replaces,
  issues,
  focus,
  onFocus,
  name,
  fields,
}: {
  analysis: SquadAnalysis;
  slots: SlotSetting[];
  shown: "first" | "second";
  /** First-eleven slots whose player is not in the FM starting eleven, with who they replace. */
  replaces: Map<number, string>;
  issues: Map<number, Severity>;
  focus: number | null;
  onFocus: (index: number) => void;
  name: (id: string) => string;
  fields: Map<string, SquadFields>;
}) {
  return (
    <Pitch>
      <ul aria-label={shown === "first" ? "First eleven" : "Second eleven"}>
        {analysis.slots.map((r, i) => {
          const p = shown === "first" ? r.starter : r.backup;
          const spot = slots[i].spot;
          const issue = issues.get(i);
          const injured = p && isInjured(fields.get(p.id));
          const replacing = shown === "first" ? replaces.get(i) : undefined;
          const label = [
            `${spot}:`,
            p ? `${name(p.id)}, ${p.score.toFixed(1)}` : "nobody",
            replacing ? `in for ${replacing}` : "",
            issue === "high" ? "needs fixing" : issue === "medium" ? "worth watching" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <li key={i} className="absolute w-[17.5%] -translate-x-1/2 -translate-y-1/2" style={spotStyle(spot)}>
              <button
                type="button"
                onClick={() => onFocus(i)}
                aria-pressed={focus === i}
                aria-label={label}
                title={label}
                className={[
                  "relative block w-full cursor-pointer rounded-[4px] border bg-surface px-1 pb-1 pt-0.5 text-center leading-tight",
                  issue === "high" ? "border-red border-2" : issue === "medium" ? "border-gold border-2" : "border-line",
                  focus === i ? "outline-2 outline-offset-2 outline-white" : "hover:outline-1 hover:outline-white/70",
                  p ? "" : "border-dashed",
                ].join(" ")}
              >
                <span className="block truncate text-[11px] font-semibold">{p ? lastName(name(p.id)) : "Nobody"}</span>
                <span className="mt-0.5 flex items-center justify-center gap-1">
                  {p ? (
                    <>
                      <GradeStamp score={p.score} label={`${name(p.id)} at ${spot}`} />
                    </>
                  ) : (
                    <span className="text-[11px] font-semibold text-muted">{spot}</span>
                  )}
                </span>
                {issue && (
                  <span
                    aria-hidden
                    className={`absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full ${
                      issue === "high" ? "bg-red text-on-red" : "bg-gold text-on-gold"
                    }`}
                  >
                    {issue === "high" ? <CircleAlert className="h-3 w-3" /> : <AlertTriangle className="h-2.5 w-2.5" />}
                  </span>
                )}
                {injured && (
                  <span aria-hidden className="absolute -left-1.5 -top-1.5 rounded-[3px] bg-red px-0.5 text-[9px] font-bold text-on-red">
                    INJ
                  </span>
                )}
                {replacing && (
                  <span
                    aria-hidden
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-[3px] bg-accent px-1 text-[9px] font-bold leading-[1.35] text-on-accent"
                  >
                    IN
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Pitch>
  );
}

const HEADLINE: Record<Finding["kind"], string> = {
  empty: "Nobody plays here",
  weak: "Weak link",
  "no-cover": "No cover",
  "drop-off": "Thin cover",
  ageing: "Ageing starter",
  prospect: "Prospect",
  "status-benched": "Promised a starting place",
  "status-starting": "Starting on a low status",
};

function FindingRow({
  finding: f,
  slots,
  name,
  age,
  fields,
}: {
  finding: Finding;
  slots: SlotSetting[];
  name: (id: string) => string;
  age: (id: string) => number;
  fields: Map<string, SquadFields>;
}) {
  const spot = f.index !== null ? slots[f.index].spot : null;
  const headline = f.kind === "ageing" && f.successor ? "Successor ready" : HEADLINE[f.kind];
  const chip = (id: string, score: number, label?: string) => (
    <PlayerChip name={name(id)} score={score} age={age(id)} label={label}>
      {isInjured(fields.get(id)) && <Tag tone="red">Injured</Tag>}
    </PlayerChip>
  );
  const arrow = <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />;

  let evidence: ReactNode = null;
  let advice: ReactNode = null;
  switch (f.kind) {
    case "empty":
      evidence = (
        <span className="text-muted">
          No natural {SLOT_LABEL[slots[f.index].slot]} in the squad
          {f.count > 1 && `, ${f.count} places to fill`}.
        </span>
      );
      advice = "Sign one, or retrain a player for the position.";
      break;
    case "weak":
      evidence = (
        <>
          {chip(f.starter.id, f.starter.score)}
          <span className="text-[13px] text-muted">
            <Delta value={-f.gap} warnAt={1} /> on the eleven&apos;s average
          </span>
        </>
      );
      advice = "The first place to upgrade.";
      break;
    case "no-cover":
      evidence = (
        <>
          {chip(f.starter.id, f.starter.score)}
          {arrow}
          <span className="text-[13px] font-semibold text-red">no natural backup</span>
        </>
      );
      advice = "An injury or ban means playing someone out of position.";
      break;
    case "drop-off":
      evidence = (
        <>
          {chip(f.starter.id, f.starter.score)}
          {arrow}
          {chip(f.backup.id, f.backup.score)}
          <Delta value={-f.gap} className="text-[13px]" />
        </>
      );
      advice = "Cover a level below. Worth a squad-depth signing.";
      break;
    case "ageing":
      evidence = (
        <>
          {chip(f.starter.id, f.starter.score)}
          {f.successor ? (
            <>
              {arrow}
              {chip(f.successor.id, f.successor.score)}
              {f.successor.potential !== null && (
                <span className="text-[13px] text-muted">{f.successor.potential.toFixed(1)} at potential</span>
              )}
            </>
          ) : null}
        </>
      );
      advice = f.successor
        ? `${name(f.starter.id)} is ${f.age}; the successor is already close.`
        : `${name(f.starter.id)} is ${f.age} and nobody 23 or younger is close. Plan a successor.`;
      break;
    case "prospect":
      if (f.by === "stars") {
        evidence = (
          <>
            <PlayerChip name={name(f.prospect.id)} score={null} age={f.prospect.age} />
            <Stars value={f.potentialStars} label="Potential" />
            <span className="text-[13px] text-muted">vs</span>
            <PlayerChip name={name(f.starter.id)} score={null} />
            <Stars value={f.starterAbility} label="Ability" />
          </>
        );
        advice = `Coach rates their potential above ${lastName(name(f.starter.id))}'s ability (${f.starterAbility.toFixed(1)}★) and potential (${f.starterPotential.toFixed(1)}★). Give them minutes.`;
      } else {
        evidence = (
          <>
            {chip(f.prospect.id, f.projected, "Projected at full potential")}
            <span className="text-[13px] text-muted">at potential, vs</span>
            {chip(f.starter.id, f.against, f.starterAtPotential ? "Starter at their potential" : "Starter today")}
          </>
        );
        advice = `Projected ${(f.projected - f.against).toFixed(1)} above ${lastName(name(f.starter.id))}${
          f.starterAtPotential ? " at their own potential" : ""
        }. Give them minutes.`;
      }
      break;
    case "status-benched":
      evidence = (
        <>
          <PlayerChip name={name(f.id)} score={null} age={age(f.id)} />
          <Tag tone="gold">{f.playingTime}</Tag>
          <span className="text-[13px] text-muted">{f.xi === 2 ? "second eleven only" : "in neither eleven"}</span>
        </>
      );
      advice = `${withArticle(f.playingTime)} expects to start. Play them more, or lower their status.`;
      break;
    case "status-starting":
      evidence = (
        <>
          {chip(f.starter.id, f.starter.score)}
          <Tag>{f.playingTime}</Tag>
        </>
      );
      advice = "Starts here on a low status. Raise it when you next talk contracts.";
      break;
  }

  const severity = f.severity === "info" ? null : f.severity;
  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      {spot ? <SpotBadge spot={spot} /> : <SpotBadgeSquad />}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold">
          {headline}
          {severity && (
            <Tag tone={severity === "high" ? "red" : "gold"}>{severity === "high" ? "High" : "Medium"}</Tag>
          )}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">{evidence}</div>
        {advice && <p className="mt-0.5 text-[12px] text-muted">{advice}</p>}
      </div>
    </li>
  );
}

function SpotBadgeSquad() {
  return (
    <span className="inline-flex h-6 min-w-[3rem] shrink-0 items-center justify-center rounded-[3px] bg-paper px-1.5 text-[11px] font-semibold text-muted ring-1 ring-line">
      Squad
    </span>
  );
}

/** Who replaces whom: the FM team sheet's starter on the left, this eleven's pick on the right. */
function TeamSheetChanges({
  selection,
  slots,
  name,
  age,
  fields,
}: {
  selection: SelectionComparison;
  slots: SlotSetting[];
  name: (id: string) => string;
  age: (id: string) => number;
  fields: Map<string, SquadFields>;
}) {
  const injured = (id: string) => isInjured(fields.get(id));
  return (
    <div className="border-b border-line">
      <div className="flex flex-wrap items-baseline gap-x-2 px-4 pb-1 pt-3">
        <h3 className="section-title">Changes to your FM team sheet</h3>
        <span className="text-[13px] font-semibold text-muted">{selection.changes.length}</span>
        <span className="text-[12px] text-muted">
          {selection.matching} of your FM starters keep their place
          {selection.moves.length > 0 && `, ${selection.moves.length} at another position`}.
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sr-only">
            <tr>
              <th>Position</th>
              <th>Out: starts in FM now</th>
              <th>In: this eleven</th>
              <th>Gain at this position</th>
            </tr>
          </thead>
          <tbody>
            {selection.changes.map((ch, k) => {
              const spot = ch.index !== null ? slots[ch.index].spot : null;
              const gain = ch.in && ch.out?.score != null ? ch.in.score - ch.out.score : null;
              return (
                <tr key={k} className="border-t border-line first:border-t-0">
                  <td className="w-0 py-2 pl-4 pr-2 align-middle">{spot ? <SpotBadge spot={spot} /> : <SpotBadgeSquad />}</td>
                  <td className="py-2 pr-2 align-middle">
                    {ch.out ? (
                      <span className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5">
                          <Tag tone="red">Out</Tag>
                          <PlayerChip name={name(ch.out.id)} score={ch.out.score} age={age(ch.out.id)} muted>
                            {injured(ch.out.id) && <Tag tone="red">Injured</Tag>}
                          </PlayerChip>
                        </span>
                        {(!ch.samePosition || ch.out.score === null) && (
                          <span className="pl-[2.6rem] text-[12px] text-muted">
                            {ch.out.pickedAt ? `${SLOT_LABEL[ch.out.pickedAt]} in FM` : "Starts in FM"}
                            {ch.out.score === null && spot && `, not a natural ${SLOT_LABEL[slots[ch.index!].slot]}`}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[13px] text-muted">Nobody: an extra starter</span>
                    )}
                  </td>
                  <td className="w-0 px-1 py-2 align-middle">
                    <ArrowRight className="h-4 w-4 text-muted" aria-label="replaced by" />
                  </td>
                  <td className="py-2 pr-2 align-middle">
                    {ch.in ? (
                      <span className="flex items-center gap-1.5">
                        <Tag tone="positive">In</Tag>
                        <PlayerChip name={name(ch.in.id)} score={ch.in.score} age={age(ch.in.id)} />
                      </span>
                    ) : (
                      <span className="text-[13px] text-muted">Nobody in this eleven plays there</span>
                    )}
                  </td>
                  <td className="w-0 whitespace-nowrap py-2 pl-2 pr-4 text-right align-middle">
                    {gain !== null ? (
                      <Delta value={gain} warnAt={99} className="font-semibold" />
                    ) : (
                      <span className="text-[12px] text-muted">{ch.out && ch.in ? "new position" : ""}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selection.moves.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-4 py-2 text-[13px] text-muted">
          <span className="font-semibold text-ink">Also moves:</span>
          {selection.moves.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1.5">
              <span className="font-semibold text-ink">{name(m.id)}</span>
              {m.from && SLOT_LABEL[m.from]}
              <ArrowRight className="h-3.5 w-3.5" aria-label="to" />
              <SpotBadge spot={slots[m.index].spot} />
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
