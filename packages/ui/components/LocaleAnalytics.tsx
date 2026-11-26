"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";

/** The parts of Umami's tracker (window.umami) used here. */
interface Umami {
  track: (name: string, data?: Record<string, string>) => void;
  identify: (data: Record<string, string>) => void;
}

function umami(): Umami | undefined {
  return typeof window === "undefined" ? undefined : (window as unknown as { umami?: Umami }).umami;
}

/** Calls `fn` with the tracker once it has loaded (it loads after the page): gives up after ~10 s. */
function whenTracker(fn: (u: Umami) => void): () => void {
  let tries = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const attempt = () => {
    const u = umami();
    if (u) return fn(u);
    if (++tries < 40) timer = setTimeout(attempt, 250);
  };
  attempt();
  return () => clearTimeout(timer);
}

/** A custom Umami event, if the tracker is there (not in dev, Storybook or with stats off). */
export function trackEvent(name: string, data?: Record<string, string>) {
  try {
    umami()?.track(name, data);
  } catch {
    /* Analytics never breaks the page. */
  }
}

/**
 * Records the page language as the Umami session's "locale" property (Sessions, Properties), so
 * the language is counted per visitor while page views count /da/players as /players
 * (packages/core/analytics/umami.ts strips the prefix). Changing language also sends a "language"
 * event (LanguagePicker).
 */
export function LocaleAnalytics() {
  const locale = useLocale();
  useEffect(
    () =>
      whenTracker((u) => {
        try {
          u.identify({ locale });
        } catch {
          /* Analytics never breaks the page. */
        }
      }),
    [locale],
  );
  return null;
}
