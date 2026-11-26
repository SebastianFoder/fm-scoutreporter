"use client";

import type { GroupedAttributes } from "@scoutreporter/core/types/grouped-attributes";
import {
  getBandForValue,
  useActiveAttributeProfile,
  type AttributeBand,
} from "@scoutreporter/ui/components/AttributeColorConfig";
import type { AttributeKey } from "@scoutreporter/core/types/weights";
import { getGroupedAttributeValue } from "@scoutreporter/core/grouped-attribute-value";
import { useTranslations } from "next-intl";
import { useAttributeLabel, useIntlLocale } from "@scoutreporter/ui/i18n/hooks";

interface Props {
  grouped: GroupedAttributes;
  isGoalkeeper?: boolean;
  /** When set, values above the baseline show their gain (e.g. projected potential vs current). */
  baseline?: GroupedAttributes;
}

function Delta({ value, base }: { value: number; base: number | undefined }) {
  const t = useTranslations("players.attributes");
  if (base === undefined || value <= base) return null;
  return (
    <span className="mr-1.5 text-[12px] font-semibold text-positive" title={t("deltaTitle", { delta: value - base })}>
      +{value - base}
    </span>
  );
}

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
  const tGroup = useTranslations("fm.attributeGroups");
  const attributeLabel = useAttributeLabel();
  const locale = useIntlLocale();
  // FM lists attributes alphabetically by their name, which depends on the language.
  const byLabel = (a: string, b: string) => attributeLabel(a).localeCompare(attributeLabel(b), locale);

  const renderColumn = (
    title: string,
    attributes: Record<string, number>,
    compact?: boolean,
  ) => {
    const entries = Object.entries(attributes).sort(([a], [b]) => byLabel(a, b));

    return (
      <div>
        <h2 className="section-title mb-1.5">{title}</h2>
        <dl className={compact ? "text-[13px] @lg:grid @lg:grid-cols-3 @lg:gap-x-6" : "text-sm"}>
          {entries.map(([key, value]) => {
            return (
              <AttrRow
                key={key}
                label={attributeLabel(key)}
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
    const sorted = [...keys].sort(byLabel);
    return (
      <div>
        <h2 className="section-title mb-1.5">{title}</h2>
        <dl className={compact ? "text-[13px]" : "text-sm"}>
          {sorted.map((key) => {
            const value = getValueByKey(grouped, key);
            return (
              <AttrRow
                key={key}
                label={attributeLabel(key)}
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

  // Columns follow the width it gets (a page, or the narrower player side panel), not the window.
  return (
    <div className="panel @container space-y-5 px-4 py-4">
      {isGoalkeeper ? (
        <div className="grid gap-x-6 gap-y-5 @lg:grid-cols-3">
          {renderKeyColumn(tGroup("goalkeeping"), GK_PANEL_KEYS)}
          {renderColumn(tGroup("mental"), grouped.mental)}
          <div className="space-y-5">
            {renderColumn(tGroup("physical"), grouped.physical)}
            {renderKeyColumn(tGroup("technical"), GK_TECHNICAL_KEYS, true)}
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-x-6 gap-y-5 @lg:grid-cols-3">
            {renderColumn(tGroup("technical"), grouped.technical)}
            {renderColumn(tGroup("mental"), grouped.mental)}
            {renderColumn(tGroup("physical"), grouped.physical)}
          </div>
          <div className="border-t border-line pt-4">
            {renderColumn(tGroup("goalkeeping"), grouped.goalkeeping, true)}
          </div>
        </>
      )}
    </div>
  );
}
