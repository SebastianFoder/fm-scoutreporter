import { parsePositionSlots, SLOT_XY, type PositionSlot } from "@scoutreporter/core/position-slots";

/** FM-style pitch with the player's positions marked. Purely derived from the position string. */
export function PositionMap({
  position,
  className = "h-[150px] w-[102px]",
}: {
  position: string;
  className?: string;
}) {
  const slots = new Set(parsePositionSlots(position));

  return (
    <figure className="shrink-0">
      <svg
        viewBox="0 0 68 100"
        className={className}
        role="img"
        aria-label={`Positions: ${position}`}
      >
        <rect x="0.5" y="0.5" width="67" height="99" rx="2" fill="oklch(0.5 0.12 150)" />
        <g fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="0.7">
          <rect x="2.5" y="2.5" width="63" height="95" />
          <line x1="2.5" y1="50" x2="65.5" y2="50" />
          <circle cx="34" cy="50" r="8" />
          <rect x="16" y="2.5" width="36" height="14" />
          <rect x="16" y="83.5" width="36" height="14" />
        </g>
        {(Object.keys(SLOT_XY) as PositionSlot[]).map((slot) => {
          const [x, y] = SLOT_XY[slot];
          const on = slots.has(slot);
          return (
            <circle
              key={slot}
              cx={x}
              cy={y}
              r={on ? 4.4 : 2}
              fill={on ? "white" : "white"}
              fillOpacity={on ? 1 : 0.28}
              stroke={on ? "oklch(0.25 0.035 255)" : "none"}
              strokeWidth={on ? 1.2 : 0}
            >
              <title>{slot}</title>
            </circle>
          );
        })}
      </svg>
      <figcaption className="mt-1 text-center text-[12px] text-muted">{position}</figcaption>
    </figure>
  );
}
