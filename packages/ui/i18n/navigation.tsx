"use client";

import NextLink from "next/link";
import { usePathname as useNextPathname, useRouter as useNextRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useCallback, useMemo, type ComponentProps } from "react";
import { DESKTOP_BUILD } from "../desktop/target";
import { localizePath, stripLocale } from "./paths";

/**
 * Language-aware navigation for the website's /da/... URLs (i18n/paths.ts). Use these instead of
 * next/link and next/navigation's usePathname/useRouter for links between pages: hrefs are written
 * without the language ("/players") and get the current one added. The desktop app's URLs carry no
 * language, so there they are next's own.
 */

/** "/players" -> "/da/players" in Danish. Leaves the href alone in the desktop app. */
export function useLocalizeHref(): (href: string) => string {
  const locale = useLocale();
  return useCallback((href: string) => (DESKTOP_BUILD ? href : localizePath(href, locale)), [locale]);
}

/** next/link with the current language added to string hrefs. */
export function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const localize = useLocalizeHref();
  return <NextLink href={typeof href === "string" ? localize(href) : href} {...props} />;
}

/** The current path without its language prefix ("/da/players" -> "/players"), to compare with hrefs. */
export function usePathname(): string {
  const pathname = useNextPathname() ?? "/";
  return DESKTOP_BUILD ? pathname : stripLocale(pathname);
}

/** next/navigation's router, with the current language added to push/replace/prefetch hrefs. */
export function useRouter(): ReturnType<typeof useNextRouter> {
  const router = useNextRouter();
  const localize = useLocalizeHref();
  return useMemo(
    () => ({
      ...router,
      push: (href, options) => router.push(localize(href), options),
      replace: (href, options) => router.replace(localize(href), options),
      prefetch: (href, options) => router.prefetch(localize(href), options),
    }),
    [router, localize],
  );
}
