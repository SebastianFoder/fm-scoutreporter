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
 * Defines window.umamiBeforeSend. Must run before the tracker sends its first page view, so the
 * layout puts it in an inline script that runs before the page hydrates.
 */
export const UMAMI_BEFORE_SEND_SCRIPT =
  `window.${UMAMI_BEFORE_SEND}=function(t,p){var r=${ID_SEGMENT.toString()};` +
  `if(p&&p.url)p.url=p.url.replace(r,"/[id]");` +
  `if(p&&p.referrer)p.referrer=p.referrer.replace(r,"/[id]");return p};`;
