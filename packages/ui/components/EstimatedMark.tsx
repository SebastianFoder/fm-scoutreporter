import { useTranslations } from "next-intl";
import type { PlayerAttributes } from "@scoutreporter/core/types/player-attributes";

/**
 * "~" in front of a score built on attributes FM did not show exactly (a partly scouted player):
 * ranges count as their midpoint, unknown cells as 0. Renders nothing for exact players.
 */
export function EstimatedMark({ player }: { player: PlayerAttributes }) {
  const t = useTranslations("common.estimated");
  const keys = player.estimatedAttributes;
  if (!keys || keys.length === 0) return null;
  const unknown = keys.filter((k) => player[k] === 0).length;
  const ranged = keys.length - unknown;
  const title =
    ranged > 0 && unknown > 0
      ? t("both", { ranged, unknown })
      : ranged > 0
        ? t("ranged", { ranged })
        : t("unknown", { unknown });
  return (
    <abbr title={title} aria-label={title} className="cursor-help font-normal text-muted no-underline">
      ~
    </abbr>
  );
}
