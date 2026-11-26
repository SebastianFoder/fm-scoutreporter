/**
 * Self-hosted Umami (stats.sebastianfoder.com): shared by the website's and the desktop app's tracker
 * tags in apps/web/app/layout.tsx and packages/ui/desktop/DesktopAnalytics.tsx.
 */

/** One Umami website for both builds; the desktop app's views are tagged "desktop" (hostname "app"). */
export const UMAMI_SRC = "https://stats.sebastianfoder.com/app.js";
export const UMAMI_WEBSITE_ID = "465aa84c-1243-4e51-9bc5-b7b3691f71ce";

/** The global the tracker calls before every send (data-before-send). */
export const UMAMI_BEFORE_SEND = "umamiBeforeSend";

/** A path segment that is an ID (players are 2002083882 and the like). Page names never are numbers. */
const ID_SEGMENT = /\/\d{4,}(?=[/?#]|$)/g;

/**
 * Replace ID segments with [id], so every player page counts as one page, /players/[id], instead
 * of one row per player. Applied to the page and the referrer, absolute or not.
 */
export function anonymiseIds(url: string): string {
  return url.replace(ID_SEGMENT, "/[id]");
}

/**
 * A URL's language prefix (/da, /ko): the website puts the language in the URL, but the stats should
 * count /da/players and /players as one page. Matches at the start of a path, or after an origin.
 */
function localePrefixPattern(locales: readonly string[]): RegExp {
  return new RegExp(`^((?:[a-z][a-z0-9+.-]*://[^/?#]*)?)/(?:${locales.join("|")})(?:/|(?=[?#])|$)`, "i");
}

/** Drop the language prefix: "/da/players" -> "/players", "https://x/da?q" -> "https://x/?q". */
export function stripLocalePrefix(url: string, locales: readonly string[]): string {
  return locales.length ? url.replace(localePrefixPattern(locales), "$1/") : url;
}

/**
 * Defines window.umamiBeforeSend. Player IDs become [id] in the page and the referrer, and the
 * language prefix (`locales`: the languages that have one) is dropped from the page and from
 * same-site referrers (the tracker makes those relative; another site's /de/ path is left alone).
 * Must run before the tracker sends its first page view, so the layout puts it in an inline script
 * that runs before the page hydrates. The language itself is recorded as the session's "locale"
 * (packages/ui/components/LocaleAnalytics.tsx).
 */
export function umamiBeforeSendScript(locales: readonly string[] = []): string {
  const strip = locales.length
    ? `var l=${localePrefixPattern(locales).toString()};`
    : "";
  const page = locales.length ? `p.url.replace(r,"/[id]").replace(l,"$1/")` : `p.url.replace(r,"/[id]")`;
  const referrer = locales.length
    ? `(function(u){u=u.replace(r,"/[id]");return u.charAt(0)==="/"?u.replace(l,"$1/"):u})(p.referrer)`
    : `p.referrer.replace(r,"/[id]")`;
  return (
    `window.${UMAMI_BEFORE_SEND}=function(t,p){var r=${ID_SEGMENT.toString()};${strip}` +
    `if(p&&p.url)p.url=${page};` +
    `if(p&&p.referrer)p.referrer=${referrer};return p};`
  );
}
