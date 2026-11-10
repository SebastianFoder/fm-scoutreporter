"use client";

import type { GroupedAttributes } from "@/types/grouped-attributes";
import {
  getBandForValue,
  useActiveAttributeProfile,
  type AttributeBand,
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
    <span className="mr-1.5 text-[12px] font-semibold text-positive" title={`+${value - base} from current`}>
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

/** One FM-style attribute line: label left, banded value cell right. */
function AttrRow({
  label,
  value,
  band,
  base,
}: {
  label: string;
  value: number;
  band: AttributeBand;
  base: number | undefined;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/60 py-[3px] last:border-0">
      <dt className="truncate">{label}</dt>
      <dd className="flex shrink-0 items-center">
        <Delta value={value} base={base} />
        <span className="attr" data-band={band}>
          {value}
        </span>
      </dd>
    </div>
  );
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
        <h2 className="section-title mb-1.5">{title}</h2>
        <dl className={compact ? "text-[13px] md:grid md:grid-cols-3 md:gap-x-6" : "text-sm"}>
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
            return (
              <AttrRow
                key={key}
                label={pretty}
                value={value}
                band={getBandForValue(value, profile.thresholds)}
                base={baseline ? getValueByKey(baseline, key as AttributeKey) : undefined}
              />
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
        <h2 className="section-title mb-1.5">{title}</h2>
        <dl className={compact ? "text-[13px]" : "text-sm"}>
          {sorted.map((key) => {
            const value = getValueByKey(grouped, key);
            return (
              <AttrRow
                key={key}
                label={prettyLabel(key)}
                value={value}
                band={getBandForValue(value, profile.thresholds)}
                base={baseline ? getValueByKey(baseline, key) : undefined}
              />
            );
          })}
        </dl>
      </div>
    );
  };

  return (
    <div className="panel space-y-5 px-4 py-4">
      {isGoalkeeper ? (
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-3">
          {renderKeyColumn("Goalkeeping", GK_PANEL_KEYS)}
          {renderColumn("Mental", grouped.mental)}
          <div className="space-y-5">
            {renderColumn("Physical", grouped.physical)}
            {renderKeyColumn("Technical", GK_TECHNICAL_KEYS, true)}
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-x-6 gap-y-5 md:grid-cols-3">
            {renderColumn("Technical", grouped.technical)}
            {renderColumn("Mental", grouped.mental)}
            {renderColumn("Physical", grouped.physical)}
          </div>
          <div className="border-t border-line pt-4">
            {renderColumn("Goalkeeping", grouped.goalkeeping, true)}
          </div>
        </>
      )}
    </div>
  );
}
