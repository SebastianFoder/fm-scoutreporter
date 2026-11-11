"use client";

import { useId } from "react";
import { SegmentedControl } from "@/components/SegmentedControl";

export type ScoreBasis = "current" | "potential";

/** Score on current attributes or at full potential; potential needs CA/PA (a Hidden Attributes export). */
export function ScoreBasisToggle({
  value,
  onChange,
  potentialAvailable,
  hiddenViewName = "Hidden Attributes view",
}: {
  value: ScoreBasis;
  onChange: (value: ScoreBasis) => void;
  potentialAvailable: boolean;
  hiddenViewName?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1 text-[13px] text-muted">
      <span id={id}>Score players on</span>
      <SegmentedControl
        labelledBy={id}
        value={value}
        onChange={onChange}
        className="w-full"
        options={[
          { value: "current", label: "Current ability" },
          {
            value: "potential",
            label: "Full potential",
            disabled: !potentialAvailable,
            title: potentialAvailable ? "Attributes projected at PA" : `Needs CA and PA: export with the ${hiddenViewName}`,
          },
        ]}
      />
      {!potentialAvailable && <span className="text-[12px]">Full potential needs the {hiddenViewName}.</span>}
    </div>
  );
}
