import { getTranslations } from "next-intl/server";
import { LOCALES, LOCALE_INFO } from "@scoutreporter/ui/i18n/locales";
import { VIEW_HIDDEN, VIEW_SQUAD, VIEW_SQUAD_HIDDEN, VIEW_STAFF, VIEW_STANDARD } from "@scoutreporter/core/view-files";
import { FAQ_GROUPS, faqAnswer } from "@/lib/faq";
import { LAST_CHECKED, TOOLS, TOOL_FIELDS, type ToolKey } from "@/lib/compare";
import { REPO_URL } from "@/lib/desktop-release";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

/**
 * /llms.txt and /llms-full.txt (https://llmstxt.org): a plain Markdown map of the site for AI
 * assistants. Built from the same English copy as the pages, so it cannot drift from them.
 */

const SUMMARY =
  "Scout Reporter is a free scouting tool for Football Manager 27 (FM27) and Football Manager 26 (FM26). The website scores, grades and compares players from a CSV export, entirely in the browser; the free Windows app reads the same data straight from the running game. Neither changes the game or the save.";

const FACTS = [
  "Price: free, no account, no ads, no paid edition. Source code: " + REPO_URL,
  "The website opens an existing Scout Reporter CSV in any modern browser, including on macOS and Linux. The documented FM27 export uses FM View Exporter with Steam on Windows 10 or 11. FM26 uses BepInEx and the FM26 Player CSV Export plugin.",
  "Privacy: the CSV is read in the browser and never uploaded. The site counts anonymous page views (self-hosted Umami, no cookies).",
  "The desktop live scanner runs on 64-bit Windows 10 or 11. It reads the player search or the whole save from the game's memory on FM27 (27.0) or FM26 (26.3) from Steam, Epic or Game Pass.",
  "Scoring: weighted attribute averages on FM's 1 to 20 scale, with six FM27 benchmark role profiles measured over 50,000 FM27 matches (FM Match Lab Study 13b), or your own weights. Grades S++ to F; vs Age compares young players with the FM27 benchmark for their age.",
  "Wonderkids: with CA and PA (Hidden Attributes view or the Windows app) it projects every attribute at full potential and ranks prospects on the FM27 roles. It is a ceiling, not a guarantee.",
  "Also: Best XI within a transfer budget for any formation, Squad analysis of your own team, staff scoring on 17 roles and Best backroom.",
  `Languages: ${LOCALES.map((l) => LOCALE_INFO[l].name).join(", ")}. English URLs have no prefix; other languages are under /fr, /de, /es, /it, /da, /sv, /nb, /ko.`,
];

const PAGES: { section: string; links: { path: string; name: string; about: string }[] }[] = [
  {
    section: "Start",
    links: [
      { path: "/", name: "Home", about: "What Scout Reporter does, its screens and the view files." },
      { path: "/how-to-use", name: "Setup guide", about: "Export FM27 or FM26 players to CSV and import them, step by step." },
      { path: "/faq", name: "FAQ", about: "Versions, platforms, privacy, how scores, grades, vs Age and the potential estimate work." },
      { path: "/download", name: "Windows app", about: "Download, requirements, and how it reads the game without changing it." },
    ],
  },
  {
    section: "Tools in the app",
    links: [
      { path: "/players", name: "Players", about: "Score, rank, filter and compare imported players; wonderkid potential." },
      { path: "/players/best-xi", name: "Best XI", about: "The strongest eleven for a formation, within a transfer-value budget." },
      { path: "/squad", name: "Squad analysis", about: "Your first and second eleven, weak or thin positions, ageing starters, upgrades." },
      { path: "/staff", name: "Staff", about: "Coaches, scouts, analysts and more, scored on every staff role." },
      { path: "/staff/backroom", name: "Best backroom", about: "The strongest set of staff for the roles you need." },
      { path: "/how-to-use/players", name: "How players are scored", about: "Weights, benchmark roles, grades and vs Age." },
      { path: "/how-to-use/wonderkids", name: "How the potential estimate works", about: "Finding wonderkids from CA and PA." },
    ],
  },
  {
    section: "Comparisons",
    links: [
      { path: "/compare", name: "FM27 and FM26 scouting tools compared", about: "Scout Reporter, Genie Scout, FMRTE, FM's own scouting and online databases." },
      { path: "/compare/genie-scout", name: "Scout Reporter vs Genie Scout", about: "FM26 and FM27 edition pricing, platform requirements, and how the tools let you scout and rank players." },
      { path: "/compare/fmrte", name: "Scout Reporter vs FMRTE", about: "A read-only scouting tool next to a real-time editor." },
    ],
  },
];

const VIEWS = [VIEW_HIDDEN, VIEW_STANDARD, VIEW_SQUAD_HIDDEN, VIEW_SQUAD, VIEW_STAFF];

function linkList(links: { path: string; name: string; about: string }[]): string {
  return links.map((l) => `- [${l.name}](${absoluteUrl(l.path)}): ${l.about}`).join("\n");
}

/** /llms.txt: the summary, key facts and a link map. */
export function llmsTxt(): string {
  return [
    `# ${SITE_NAME}`,
    "",
    `> ${SUMMARY}`,
    "",
    ...FACTS.map((f) => `- ${f}`),
    "",
    ...PAGES.flatMap((p) => [`## ${p.section}`, "", linkList(p.links), ""]),
    "## View files for Football Manager",
    "",
    VIEWS.map((v) => `- [${v.name}](${absoluteUrl(v.href)})`).join("\n"),
    "",
    "## Optional",
    "",
    `- [Full text for AI assistants](${absoluteUrl("/llms-full.txt")}): every FAQ answer and the comparison tables in one file.`,
    `- [Source code and releases](${REPO_URL})`,
    "",
  ].join("\n");
}

/** /llms-full.txt: llms.txt plus every FAQ answer and the comparison table, in English. */
export async function llmsFullTxt(): Promise<string> {
  const faq = await getTranslations({ locale: "en", namespace: "faq" });
  const compare = await getTranslations({ locale: "en", namespace: "compare" });
  const faqText = FAQ_GROUPS.flatMap((g) => [
    `### ${faq(`groups.${g.key}`)}`,
    "",
    ...g.items.flatMap((item) => [`**${faq(`items.${item.key}.q`)}**`, "", faqAnswer(faq, "en", item.key), ""]),
  ]);
  const tools: ToolKey[] = ["srWeb", "srDesktop", "genie", "fmrte", "inGame", "databases"];
  const toolText = tools.flatMap((k) => [
    `### ${compare(`tools.${k}.name`)}`,
    "",
    ...TOOL_FIELDS.map((f) => `- ${compare(`fields.${f}`)}: ${compare(`tools.${k}.${f}`)}`),
    ...(TOOLS[k].sources ?? []).map(({ label, url }) => `- [${label}](${url})`),
    "",
  ]);
  return [
    llmsTxt(),
    `## FAQ (${absoluteUrl("/faq")})`,
    "",
    ...faqText,
    `## Scouting tools compared (${absoluteUrl("/compare")}, checked ${LAST_CHECKED})`,
    "",
    compare("hub.answer"),
    "",
    ...toolText,
    `### ${compare("genie.title")}`,
    "",
    compare("genie.answer"),
    "",
    `### ${compare("fmrte.title")}`,
    "",
    compare("fmrte.answer"),
    "",
  ].join("\n");
}
