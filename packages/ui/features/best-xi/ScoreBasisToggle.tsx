"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { SegmentedControl } from "@scoutreporter/ui/components/SegmentedControl";

export type ScoreBasis = "current" | "potential";

/**
 * Score on current attributes or at full potential; potential needs CA/PA (a Hidden Attributes export).
 * `hiddenViewName` is the FM view's name without the word "view" (not translated: it is the file's name).
 */
export function ScoreBasisToggle({
  value,
  onChange,
  potentialAvailable,
  hiddenViewName = "Hidden Attributes",
}: {
  value: ScoreBasis;
  onChange: (value: ScoreBasis) => void;
  potentialAvailable: boolean;
  hiddenViewName?: string;
}) {
  const id = useId();
  const t = useTranslations("bestXi.basis");
  const tAttr = useTranslations("fm.attributes");
  return (
    <div className="flex flex-col gap-1 text-[13px] text-muted">
      <span id={id}>{t("label")}</span>
      <SegmentedControl
        labelledBy={id}
        value={value}
        onChange={onChange}
        className="w-full"
        options={[
          { value: "current", label: tAttr("currentAbility") },
          {
            value: "potential",
            label: t("potential"),
            disabled: !potentialAvailable,
            title: potentialAvailable ? t("potentialTitle") : t("needsTitle", { view: hiddenViewName }),
          },
        ]}
      />
      {!potentialAvailable && <span className="text-[12px]">{t("needs", { view: hiddenViewName })}</span>}
    </div>
  );
}
