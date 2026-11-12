import type { GroupedAttributes } from "@scoutreporter/core/types/grouped-attributes";
import type { AttributeKey } from "@scoutreporter/core/types/weights";

export function getGroupedAttributeValue(
  grouped: GroupedAttributes,
  key: AttributeKey,
): number {
  if (key in grouped.goalkeeping)
    return (grouped.goalkeeping as Record<string, number>)[key];
  if (key in grouped.technical)
    return (grouped.technical as Record<string, number>)[key];
  if (key in grouped.mental)
    return (grouped.mental as Record<string, number>)[key];
  if (key in grouped.physical)
    return (grouped.physical as Record<string, number>)[key];
  return 0;
}
