"use client";

import { useEffect } from "react";
import Script from "next/script";
import { useDesktop } from "./DesktopProvider";

/** The tracker checks this key before every send, so turning stats off stops them at once, without a restart. */
const DISABLED_KEY = "umami.disabled";

/**
 * Desktop app only: anonymous page views to the self-hosted Umami, on the same website as the web
 * build but tagged "desktop" (or filter by hostname "app"). Honours Settings, App, "Send anonymous
 * usage stats". The pages run at scoutreporter://app, so data-domains="app" also keeps next dev
 * (localhost) from sending.
 */
export function DesktopAnalytics() {
  const desktop = useDesktop();
  const enabled = desktop?.settings?.usageStats;

  useEffect(() => {
    if (enabled === undefined) return;
    try {
      if (enabled) localStorage.removeItem(DISABLED_KEY);
      else localStorage.setItem(DISABLED_KEY, "1");
    } catch {
      /* Storage unavailable: the script is simply not loaded while stats are off. */
    }
  }, [enabled]);

  if (!enabled) return null;
  return (
    <Script
      src="https://stats.sebastianfoder.com/assets/app.js"
      data-website-id="465aa84c-1243-4e51-9bc5-b7b3691f71ce"
      data-domains="app"
      data-tag="desktop"
      strategy="afterInteractive"
    />
  );
}
