import type { AttributeKey } from "@scoutreporter/core/types/weights";

const OVERRIDES: Partial<Record<AttributeKey, string>> = {
  teamWork: "Teamwork",
  rushingOutTendency: "Rushing Out",
};

/** Human label for an attribute key, e.g. "offTheBall" → "Off The Ball". */
export function attributeLabel(key: AttributeKey | string): string {
  const override = OVERRIDES[key as AttributeKey];
  if (override) return override;
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}
