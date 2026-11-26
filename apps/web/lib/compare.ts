/**
 * The tools on the comparison pages (/compare). Their words are in the compare messages
 * (compare.tools.<key>); the facts about other tools come from their own sites (`source`), checked
 * on LAST_CHECKED. Re-check those pages and bump the date when you change a fact.
 */

/** When the facts about other tools were last checked against their sites (ISO date). */
export const LAST_CHECKED = "2026-11-26";

export type ToolKey = "srWeb" | "srDesktop" | "genie" | "fmrte" | "inGame" | "databases";

export const TOOL_FIELDS = ["platform", "price", "data", "edits", "versions", "bestFor"] as const;

export const TOOLS: Record<ToolKey, { url?: string; source?: string }> = {
  srWeb: { url: "/players" },
  srDesktop: { url: "/download" },
  genie: { url: "https://www.fmscout.com/a-fm-genie-scout-26.html", source: "https://www.fmscout.com/a-fm-genie-scout-26.html" },
  fmrte: { url: "https://www.fmrte.com/", source: "https://www.fmrte.com/" },
  inGame: {},
  databases: {},
};

/** The comparison pages, in the order of their tabs. `label` is compare.nav.<label>. */
export const COMPARE_PAGES = [
  { href: "/compare", label: "hub" },
  { href: "/compare/genie-scout", label: "genie" },
  { href: "/compare/fmrte", label: "fmrte" },
] as const;

export type ComparePath = (typeof COMPARE_PAGES)[number]["href"];
