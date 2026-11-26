import { useCallback, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useFormatNumber } from "@scoutreporter/ui/i18n/hooks";
import { SLOT_LABEL, SPOT_SLOT, SPOT_XY, type FormationSpot } from "@scoutreporter/core/best-xi/formations";

/** The grass and lines of a vertical 68 × 100 pitch, with whatever sits on it positioned in percent. */
export function Pitch({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative mx-auto w-full max-w-[21.5rem] ${className}`} style={{ aspectRatio: "68 / 100" }}>
      <svg viewBox="0 0 68 100" className="absolute inset-0 h-full w-full" aria-hidden>
        <rect x="0.5" y="0.5" width="67" height="99" rx="2" fill="oklch(0.5 0.12 150)" />
        <g fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="0.5">
          <rect x="2.5" y="2.5" width="63" height="95" />
          <line x1="2.5" y1="50" x2="65.5" y2="50" />
          <circle cx="34" cy="50" r="8" />
          <rect x="16" y="2.5" width="36" height="14" />
          <rect x="16" y="83.5" width="36" height="14" />
        </g>
      </svg>
      {children}
    </div>
  );
}

/** Left/top style that centres an element on a spot. */
export function spotStyle(spot: FormationSpot) {
  const [x, y] = SPOT_XY[spot];
  return { left: `${(x / 68) * 100}%`, top: `${y}%` };
}

export type PitchEntry = {
  spot: FormationSpot;
  /** Full name, or null for a position nobody can fill. */
  name: string | null;
  score: number | null;
};

/** A score or average with a fixed number of decimals, in the current language ("14.3" / "14,3"). */
export function useFixed(): (value: number, digits?: number) => string {
  const formatNumber = useFormatNumber();
  return useCallback(
    (value, digits = 1) => formatNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits }),
    [formatNumber],
  );
}

/** A line-up drawn on a vertical pitch, one chip per position. */
export function PitchLineup({ entries, label }: { entries: PitchEntry[]; label: string }) {
  const t = useTranslations("bestXi.pitch");
  const fixed = useFixed();
  return (
    <figure aria-label={label}>
      <Pitch>
        <ul>
          {entries.map((e) => {
            const empty = e.name === null;
            const position = SLOT_LABEL[SPOT_SLOT[e.spot]];
            return (
              <li
                key={e.spot}
                title={
                  empty
                    ? t("nobodyTitle", { spot: e.spot, position })
                    : t("entryTitle", { name: e.name!, spot: e.spot, position, score: e.score === null ? "" : fixed(e.score) })
                }
                className={[
                  "absolute w-[19%] -translate-x-1/2 -translate-y-1/2 rounded-[3px] border px-1 py-0.5 text-center leading-tight",
                  empty ? "border-dashed border-gold bg-gold/90 text-on-gold" : "border-line bg-surface",
                ].join(" ")}
                style={spotStyle(e.spot)}
              >
                <span className="block truncate text-[12px] font-semibold">
                  {empty ? t("nobody") : e.name!.trim().split(/\s+/).pop()}
                </span>
                <span className={`block text-[11px] ${empty ? "" : "text-muted"}`}>
                  {e.spot}
                  {e.score !== null && ` ${fixed(e.score)}`}
                </span>
              </li>
            );
          })}
        </ul>
      </Pitch>
    </figure>
  );
}
