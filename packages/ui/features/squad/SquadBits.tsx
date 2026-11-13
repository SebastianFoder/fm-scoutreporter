import type { ReactNode } from "react";
import { GradeStamp } from "@scoutreporter/ui/components/GradeStamp";
import { SLOT_LABEL, SPOT_SLOT, type FormationSpot } from "@scoutreporter/core/best-xi/formations";

/** FM position code for a spot on the tactics pitch (DCL, AMR…), with the export position as tooltip. */
export function SpotBadge({ spot, label }: { spot: FormationSpot; label?: string }) {
  return (
    <span
      title={label ?? SLOT_LABEL[SPOT_SLOT[spot]]}
      className="inline-flex h-6 min-w-[3rem] shrink-0 items-center justify-center rounded-[3px] bg-paper px-1.5 text-[12px] font-bold tracking-wide ring-1 ring-line"
    >
      {spot}
    </span>
  );
}

/** A player with their grade stamp and score: the squad page's unit of evidence. */
export function PlayerChip({
  name,
  score,
  age,
  label,
  muted = false,
  children,
}: {
  name: string;
  score: number | null;
  age?: number;
  /** What the score is, for the stamp's tooltip ("Score at DCR", "Projected at potential"). */
  label?: string;
  muted?: boolean;
  /** Tags after the name (injured, squad status…). */
  children?: ReactNode;
}) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${muted ? "opacity-75" : ""}`}>
      {score !== null && <GradeStamp score={score} label={label ?? name} />}
      <span className="min-w-0 truncate font-semibold">{name}</span>
      {score !== null && <span className="text-[13px] tabular-nums text-muted">{score.toFixed(1)}</span>}
      {age !== undefined && <span className="text-[12px] text-muted">{age}y</span>}
      {children}
    </span>
  );
}

/** A score difference. Red when it is a real drop (at or past `warnAt` below zero), green when positive. */
export function Delta({ value, warnAt = 1.5, className = "" }: { value: number; warnAt?: number; className?: string }) {
  const r = Math.round(value * 10) / 10;
  const text = r >= 0 ? `+${r.toFixed(1)}` : `−${(-r).toFixed(1)}`;
  const tone = r > 0 ? "text-positive" : r <= -warnAt ? "font-semibold text-red" : "text-muted";
  return <span className={`tabular-nums ${tone} ${className}`}>{text}</span>;
}

/** The coach's star rating (0–5 in halves), drawn like FM's report card, with the number for screen readers. */
export function Stars({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  const row = (cls: string) => (
    <span className={`flex ${cls}`} aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0" fill="currentColor">
          <path d="M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6L10 15l-5.4 3 1.2-6L1.3 7.8l6.1-.7z" />
        </svg>
      ))}
    </span>
  );
  return (
    <span
      role="img"
      aria-label={`${label ? `${label}: ` : ""}${value.toFixed(1)} of 5 stars`}
      title={`${label ? `${label}: ` : ""}${value.toFixed(1)} stars`}
      className="relative inline-flex align-middle"
    >
      {row("text-line")}
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
        {row("text-gold")}
      </span>
    </span>
  );
}

/** A small label on a light tint, after a name. */
export function Tag({
  tone = "neutral",
  title,
  children,
}: {
  tone?: "neutral" | "red" | "gold" | "positive";
  title?: string;
  children: ReactNode;
}) {
  const tint = {
    neutral: "bg-paper text-muted ring-1 ring-line",
    red: "bg-red/12 text-ink",
    gold: "bg-gold/15 text-ink",
    positive: "bg-positive/12 text-ink",
  }[tone];
  return (
    <span title={title} className={`inline-flex shrink-0 items-center rounded-[3px] px-1.5 py-px text-[11px] font-semibold ${tint}`}>
      {children}
    </span>
  );
}

/** FM happiness words, coloured by how settled the player is (the word is always printed). */
export function Happiness({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted">–</span>;
  const v = value.toLowerCase();
  const tone = /unhappy|angry|frustrated|disappointed/.test(v)
    ? "text-red font-semibold"
    : /delighted|very happy/.test(v)
      ? "text-positive"
      : "text-muted";
  return <span className={tone}>{value}</span>;
}

/** Days as FM writes them back: "3 wk", "9 d". */
export function formatDays(days: number): string {
  if (days >= 14 && days % 7 === 0) return `${days / 7} wk`;
  return `${days} d`;
}

export const lastName = (name: string) => name.trim().split(/\s+/).pop() ?? name;

/** "an Important Player", "a Star Player". */
export const withArticle = (status: string) => `${/^[aeiou]/i.test(status) ? "an" : "a"} ${status}`;
