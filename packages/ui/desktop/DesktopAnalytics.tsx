"use client";

import { useEffect } from "react";
import Script from "next/script";
import { UMAMI_BEFORE_SEND, UMAMI_SRC, UMAMI_WEBSITE_ID } from "@scoutreporter/core/analytics/umami";
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
      src={UMAMI_SRC}
      data-website-id={UMAMI_WEBSITE_ID}
      data-domains="app"
      data-tag="desktop"
      data-before-send={UMAMI_BEFORE_SEND}
      strategy="afterInteractive"
    />
  );
}
