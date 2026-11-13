"use client";

import { Radar } from "lucide-react";
import { useDesktop } from "./DesktopProvider";

/** "Scan FM" in the app bar, with progress while a scan runs. Desktop app only. */
export function ScanButton() {
  const desktop = useDesktop();
  if (!desktop) return null;
  const { scanning, progress, scan } = desktop;
  const pct = progress ? Math.round(progress.progress * 100) : 0;

  return (
    <button
      type="button"
      onClick={() => void scan()}
      disabled={scanning}
      title="Read the database of the running Football Manager (F9)"
      className="btn h-8 gap-1.5 rounded-md border border-on-chrome/30 px-2.5 text-[13px] font-semibold text-on-chrome hover:bg-on-chrome/10 disabled:opacity-70"
    >
      <Radar className={`h-4 w-4 ${scanning ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden />
      <span aria-live="polite">{scanning ? `Scanning ${pct}%` : "Scan FM"}</span>
    </button>
  );
}
