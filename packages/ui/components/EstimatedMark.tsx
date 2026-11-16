import type { PlayerAttributes } from "@scoutreporter/core/types/player-attributes";

/**
 * "~" in front of a score built on attributes FM did not show exactly (a partly scouted player):
 * ranges count as their midpoint, unknown cells as 0. Renders nothing for exact players.
 */
export function EstimatedMark({ player }: { player: PlayerAttributes }) {
  const keys = player.estimatedAttributes;
  if (!keys || keys.length === 0) return null;
  const unknown = keys.filter((k) => player[k] === 0).length;
  const ranged = keys.length - unknown;
  const parts = [
    ranged > 0 && `${ranged} from a scouting range (midpoint used)`,
    unknown > 0 && `${unknown} unknown (counted as 0)`,
  ].filter(Boolean);
  const title = `Estimated score: ${parts.join(", ")}`;
  return (
    <abbr title={title} aria-label={title} className="cursor-help font-normal text-muted no-underline">
      ~
    </abbr>
  );
}
