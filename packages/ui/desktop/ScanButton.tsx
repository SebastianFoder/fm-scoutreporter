"use client";

import { Radar } from "lucide-react";
import { useDesktop } from "./DesktopProvider";

const STYLES = {
  /** In the dark app bar. */
  bar: {
    group: "h-8 border-on-chrome/30 text-[13px] text-on-chrome",
    icon: "bg-on-chrome/10 px-2",
    button: "border-on-chrome/30 px-2.5 hover:bg-on-chrome/10",
  },
  /** On a page, as the main action. */
  page: {
    group: "h-10 border-line bg-surface text-sm text-ink",
    icon: "bg-paper px-3 text-accent",
    button: "border-line px-4 hover:bg-paper",
  },
} as const;

/**
 * Scan search and Scan save: one group with the radar icon in its own section and the two buttons
 * side by side, equal, so neither looks like the default. While a scan runs, the buttons give way
 * to its progress. Desktop app only.
 */
export function ScanButton({ variant = "bar" }: { variant?: keyof typeof STYLES }) {
  const desktop = useDesktop();
  if (!desktop) return null;
  const { scanning, progress, scan } = desktop;
  const pct = progress ? Math.round(progress.progress * 100) : 0;
  const s = STYLES[variant];
  const button = `btn h-full border-l font-semibold disabled:opacity-70 ${s.button}`;

  return (
    <div role="group" aria-label="Scan Football Manager" className={`flex shrink-0 overflow-hidden rounded-md border ${s.group}`}>
      <span className={`flex items-center ${s.icon}`} aria-hidden>
        <Radar className={`h-4 w-4 ${scanning ? "animate-spin motion-reduce:animate-none" : ""}`} />
      </span>
      {scanning ? (
        <span role="status" className={`${button} hover:bg-transparent`}>
          Scanning {pct}%
        </span>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void scan("search")}
            title="Keep the people in FM's Player Search or Staff Search, plus your club (F9)"
            className={button}
          >
            Scan search
          </button>
          <button type="button" onClick={() => void scan("full")} title="Keep every player and staff member in the save" className={button}>
            Scan save
          </button>
        </>
      )}
    </div>
  );
}
