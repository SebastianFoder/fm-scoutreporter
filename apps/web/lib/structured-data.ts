import { LOCALES, LOCALE_INFO } from "@scoutreporter/ui/i18n/locales";
import { REPO_URL, DESKTOP_RELEASES_URL, type DesktopRelease } from "@/lib/desktop-release";
import { AUTHOR, SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

/**
 * Schema.org entities for Scout Reporter, shared by the pages' JSON-LD: one WebApplication (the
 * website) and one SoftwareApplication (the Windows app), each with a stable @id so other pages can
 * point at them. In English, like all structured data (packages/ui/i18n/README.md).
 */

type Thing = Record<string, unknown>;

export const WEBSITE_ID = `${SITE_URL}/#website`;
export const WEB_APP_ID = `${SITE_URL}/#app`;
export const DESKTOP_APP_ID = `${SITE_URL}/download#app`;

export const AUTHOR_LD: Thing = {
  "@type": "Person",
  "@id": `${SITE_URL}/#author`,
  name: AUTHOR.name,
  url: AUTHOR.url,
  sameAs: [AUTHOR.url, `https://x.com/${AUTHOR.twitter.replace(/^@/, "")}`],
};

const FREE: Thing = { "@type": "Offer", price: "0", priceCurrency: "USD", availability: "https://schema.org/InStock" };

/** The games it works with. */
const GAMES: Thing[] = [
  { "@type": "VideoGame", name: "Football Manager 27", publisher: { "@type": "Organization", name: "SEGA" } },
  { "@type": "VideoGame", name: "Football Manager 26", publisher: { "@type": "Organization", name: "SEGA" } },
];

/** Every language the app is translated into, as BCP 47 tags. */
const LANGUAGES = LOCALES.map((l) => LOCALE_INFO[l].intl);

export const SCREENSHOT_URLS = ["players", "player", "best-xi", "squad", "staff", "backroom"].map((n) =>
  absoluteUrl(`/screenshots/${n}-light.png`),
);

export const WEBSITE_LD: Thing = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: SITE_NAME,
  url: absoluteUrl("/"),
  description: SITE_DESCRIPTION,
  inLanguage: LANGUAGES,
  author: { "@id": AUTHOR_LD["@id"] },
};

/** The website. `featureList` comes from the English home page copy. */
export function webAppLd(featureList: string[]): Thing {
  return {
    "@type": ["WebApplication", "SoftwareApplication"],
    "@id": WEB_APP_ID,
    name: SITE_NAME,
    alternateName: ["Scout Reporter for Football Manager", "FM Scout Reporter"],
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
    applicationCategory: "GameApplication",
    applicationSubCategory: "Football Manager scouting tool",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires JavaScript and a modern browser",
    isAccessibleForFree: true,
    offers: FREE,
    featureList,
    inLanguage: LANGUAGES,
    screenshot: SCREENSHOT_URLS,
    softwareHelp: { "@type": "CreativeWork", url: absoluteUrl("/how-to-use") },
    about: GAMES,
    author: { "@id": AUTHOR_LD["@id"] },
    sameAs: [REPO_URL],
    isPartOf: { "@id": WEBSITE_ID },
    isRelatedTo: { "@id": DESKTOP_APP_ID },
  };
}

/** The Windows app. With `release` (from GitHub) it carries the version, file and date. */
export function desktopAppLd(release?: DesktopRelease | null): Thing {
  return {
    "@type": "SoftwareApplication",
    "@id": DESKTOP_APP_ID,
    name: `${SITE_NAME} for Windows`,
    url: absoluteUrl("/download"),
    description:
      "Free Windows app that reads the players in your Football Manager 27 or 26 player search, or the whole save, straight from the running game, with real CA, PA and hidden attributes, and scores them in every Scout Reporter screen. It only reads the game; it never changes your game or save.",
    applicationCategory: "GameApplication",
    applicationSubCategory: "Football Manager scouting tool",
    operatingSystem: "Windows 10, Windows 11 (64-bit)",
    processorRequirements: "x64",
    isAccessibleForFree: true,
    offers: FREE,
    inLanguage: LANGUAGES,
    screenshot: SCREENSHOT_URLS,
    about: GAMES,
    author: { "@id": AUTHOR_LD["@id"] },
    codeRepository: REPO_URL,
    downloadUrl: release?.downloadUrl ?? DESKTOP_RELEASES_URL,
    installUrl: absoluteUrl("/download"),
    ...(release && {
      softwareVersion: release.version,
      releaseNotes: release.pageUrl,
      ...(release.bytes > 0 && { fileSize: `${Math.round(release.bytes / 1e6)}MB` }),
      ...(release.publishedAt && { datePublished: release.publishedAt.slice(0, 10) }),
    }),
    isRelatedTo: { "@id": WEB_APP_ID },
  };
}
