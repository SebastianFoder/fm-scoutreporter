"use client";

import type { GroupedAttributes } from "@/types/grouped-attributes";
import {
  attributeBandColor,
  getBandForValue,
  useActiveAttributeProfile,
} from "@/components/AttributeColorConfig";
import type { AttributeKey } from "@/types/weights";
import { getGroupedAttributeValue } from "@/lib/grouped-attribute-value";

interface Props {
  grouped: GroupedAttributes;
  isGoalkeeper?: boolean;
  /** When set, values above the baseline show their gain (e.g. projected potential vs current). */
  baseline?: GroupedAttributes;
}

function Delta({ value, base }: { value: number; base: number | undefined }) {
  if (base === undefined || value <= base) return null;
  return (
    <span className="mr-1.5 font-mono text-[11px] font-bold text-[oklch(var(--primary))]">
      +{value - base}
    </span>
  );
}

const LABEL_OVERRIDES: Partial<Record<AttributeKey, string>> = {
  rushingOutTendency: "Rushing Out (Tendency)",
  oneOnOnes: "One On Ones",
  commandOfArea: "Command Of Area",
  offTheBall: "Off The Ball",
  freeKickTaking: "Free Kick Taking",
  penaltyTaking: "Penalty Taking",
  naturalFitness: "Natural Fitness",
  aerialReach: "Aerial Reach",
  firstTouch: "First Touch",
  longThrows: "Long Throws",
  longShots: "Long Shots",
  jumpingReach: "Jumping Reach",
  teamWork: "Teamwork",
  workRate: "Work Rate",
  // FM-style labels
  punching: "Punching (Tendency)",
};

const GK_PANEL_KEYS: AttributeKey[] = [
  "aerialReach",
  "commandOfArea",
  "communication",
  "eccentricity",
  "firstTouch",
  "handling",
  "kicking",
  "oneOnOnes",
  "passing",
  "punching",
  "reflexes",
  "rushingOutTendency",
  "throwing",
];

const GK_TECHNICAL_KEYS: AttributeKey[] = [
  "freeKickTaking",
  "penaltyTaking",
  "technique",
];

function getValueByKey(grouped: GroupedAttributes, key: AttributeKey): number {
  return getGroupedAttributeValue(grouped, key);
}

function prettyLabel(key: AttributeKey) {
  const override = LABEL_OVERRIDES[key];
  if (override) return override;
  const withSpaces = key.replace(/([a-z])([A-Z])/g, "$1 $2");
  return withSpaces
    .split(" ")
    .map((word) =>
      word.length > 0
        ? word[0].toUpperCase() + word.slice(1).toLowerCase()
        : "",
    )
    .join(" ");
}

export function PlayerAttributesClient({ grouped, isGoalkeeper, baseline }: Props) {
  const profile = useActiveAttributeProfile();

  const renderColumn = (
    title: string,
    attributes: Record<string, number>,
    compact?: boolean,
  ) => {
    const entries = Object.entries(attributes).sort(([a], [b]) =>
      a.localeCompare(b),
    );

    return (
      <div>
        <h2 className="mb-2 text-sm font-black uppercase tracking-wider text-[oklch(var(--text))/0.65]">
          {title}
        </h2>
        <dl
          className={`grid ${
            compact ? "gap-y-0.5 text-xs" : "gap-y-1 text-sm"
          }`}
        >
          {entries.map(([key, value]) => {
            const withSpaces = key.replace(/([a-z])([A-Z])/g, "$1 $2");
            const pretty = withSpaces
              .split(" ")
              .map((word) =>
                word.length > 0
                  ? word[0].toUpperCase() + word.slice(1).toLowerCase()
                  : "",
              )
              .join(" ");
            const band = getBandForValue(value, profile.thresholds);
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3 border-b border-[oklch(var(--border))]/15 py-0.5 last:border-0"
              >
                <dt className="text-[oklch(var(--text))/0.85]">{pretty}</dt>
                <dd className="flex items-baseline">
                  <Delta
                    value={value}
                    base={baseline ? getValueByKey(baseline, key as AttributeKey) : undefined}
                  />
                  <span
                    className="min-w-[1.75rem] text-right font-mono text-base font-bold"
                    style={{ color: attributeBandColor(band) }}
                  >
                    {value}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    );
  };

  const renderKeyColumn = (
    title: string,
    keys: AttributeKey[],
    compact?: boolean,
  ) => {
    const sorted = [...keys].sort((a, b) => a.localeCompare(b));
    return (
      <div>
        <h2 className="mb-2 text-sm font-black uppercase tracking-wider text-[oklch(var(--text))/0.65]">
          {title}
        </h2>
        <dl
          className={`grid ${compact ? "gap-y-0.5 text-xs" : "gap-y-1 text-sm"}`}
        >
          {sorted.map((key) => {
            const value = getValueByKey(grouped, key);
            const band = getBandForValue(value, profile.thresholds);
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3 border-b border-[oklch(var(--border))]/15 py-0.5 last:border-0"
              >
                <dt className="text-[oklch(var(--text))/0.85]">
                  {prettyLabel(key)}
                </dt>
                <dd className="flex items-baseline">
                  <Delta
                    value={value}
                    base={baseline ? getValueByKey(baseline, key) : undefined}
                  />
                  <span
                    className="min-w-[1.75rem] text-right font-mono text-base font-bold"
                    style={{ color: attributeBandColor(band) }}
                  >
                    {value}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    );
  };

  return (
    <div className="space-y-3 rounded-lg border-2 border-[oklch(var(--border))] bg-[oklch(var(--surface))] px-4 py-4 shadow-[4px_4px_0_oklch(var(--border))]">
      {isGoalkeeper ? (
        <div className="grid gap-4 md:grid-cols-3">
          {renderKeyColumn("Goalkeeping", GK_PANEL_KEYS)}
          {renderColumn("Mental", grouped.mental)}
          <div className="space-y-4">
            {renderColumn("Physical", grouped.physical)}
            {renderKeyColumn("Technical", GK_TECHNICAL_KEYS, true)}
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {renderColumn("Technical", grouped.technical)}
            {renderColumn("Mental", grouped.mental)}
            {renderColumn("Physical", grouped.physical)}
          </div>
          <div className="mt-3">
            {renderColumn("Goalkeeping", grouped.goalkeeping, true)}
          </div>
        </>
      )}
    </div>
  );
}
