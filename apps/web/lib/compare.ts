/**
 * The tools on the comparison pages (/compare). Their words are in the compare messages
 * (compare.tools.<key>); the facts about other tools come from their own sites (`sources`), checked
 * on LAST_CHECKED. Re-check those pages and bump the date when you change a fact.
 */

/** When the facts about other tools were last checked against their sites (ISO date). */
export const LAST_CHECKED = "2026-11-26";

export type ToolKey = "srWeb" | "srDesktop" | "genie" | "fmrte" | "inGame" | "databases";

export const TOOL_FIELDS = ["platform", "price", "data", "edits", "versions", "bestFor"] as const;

const GENIE_26 = "https://www.fmscout.com/a-fm-genie-scout-26.html";
const GENIE_27 = "https://www.fmscout.com/a-genie-scout-27g-edition.html";
const FMRTE = "https://www.fmrte.com/";

export const TOOLS: Record<ToolKey, { url?: string; sources?: { label: string; url: string }[] }> = {
  srWeb: { url: "/players" },
  srDesktop: { url: "/download" },
  genie: {
    url: GENIE_27,
    sources: [
      { label: "FM Genie Scout 26", url: GENIE_26 },
      { label: "FM Genie Scout 27g", url: GENIE_27 },
    ],
  },
  fmrte: { url: FMRTE, sources: [{ label: "FMRTE", url: FMRTE }] },
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
