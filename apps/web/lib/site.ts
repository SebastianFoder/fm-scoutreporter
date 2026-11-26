import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALES, LOCALE_INFO, isLocale, type Locale } from "@scoutreporter/ui/i18n/locales";
import { localizePath } from "@scoutreporter/ui/i18n/paths";
import enMeta from "@scoutreporter/ui/i18n/messages/en/meta.json";

/**
 * Site identity and SEO helpers, shared by the root layout, every route's metadata, the sitemap,
 * robots, the web manifest and the JSON-LD blocks.
 */

/** Production origin. Override with NEXT_PUBLIC_SITE_URL for previews or a different domain. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://fmscouting.sebastianfoder.com"
).replace(/\/+$/, "");

export const SITE_NAME = "Scout Reporter";

/**
 * The site's own title and description, in English: the source is the meta messages (meta.site),
 * which also has them in every language for the page metadata. English is used where there is no
 * language (structured data, the web manifest, llms.txt).
 */
export const SITE_TITLE = enMeta.site.title;

export const SITE_DESCRIPTION = enMeta.site.description;

export const SITE_KEYWORDS = [
  "Football Manager 27",
  "Football Manager 26",
  "FM27",
  "FM26",
  "FM27 scouting",
  "FM26 scouting",
  "FM27 wonderkids",
  "Football Manager player export",
  "FM CSV export",
  "FM player comparison",
  "FM attribute weights",
  "FM27 player roles",
  "current ability",
  "potential ability",
  "best XI",
];

export const AUTHOR = {
  name: "Sebastian Foder",
  url: "https://github.com/SebastianFoder",
  twitter: "@F1ngs",
} as const;

/** Absolute URL for a site path ("/faq" -> "https://.../faq"). */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path === "/" ? "" : path}`;
}

/** The generated share card (app/opengraph-image.tsx). */
export const SHARE_IMAGE_ALT =
  "Scout Reporter: score, grade and compare Football Manager 27 and 26 players";

const SHARE_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: SHARE_IMAGE_ALT };

/** Open Graph locale for a language: "da" -> "da_DK". */
export function ogLocale(locale: string): string {
  return (isLocale(locale) ? LOCALE_INFO[locale].intl : LOCALE_INFO[DEFAULT_LOCALE].intl).replace("-", "_");
}

/**
 * A page's canonical URL in `locale` and its hreflang alternates: every language's URL for the same
 * page, plus x-default (English, unprefixed). Paths are relative to metadataBase.
 */
export function localeAlternates(path: string, locale: string): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = Object.fromEntries(
    LOCALES.map((l) => [l, localizePath(path, l)]),
  );
  languages["x-default"] = path;
  return { canonical: localizePath(path, locale), languages };
}

/** The current request's language (from the URL, apps/web/proxy.ts). */
export async function currentLocale(): Promise<Locale> {
  const l = await getLocale();
  return isLocale(l) ? l : DEFAULT_LOCALE;
}

/** A page's key in the meta messages (meta.pages.<key>.title / .description). */
export type MetaPage =
  | "players"
  | "player"
  | "playersCompare"
  | "bestXi"
  | "squad"
  | "staff"
  | "backroom"
  | "howToUse"
  | "howToPlayers"
  | "howToWonderkids"
  | "faq"
  | "download"
  | "compare"
  | "compareGenie"
  | "compareFmrte";

/** A page's title and description in `locale` (English for structured data and llms.txt). */
export async function pageText(page: MetaPage, locale: string = DEFAULT_LOCALE) {
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t(`pages.${page}.title`), description: t(`pages.${page}.description`) };
}

/**
 * Route metadata in the page's language: its title and description (meta.pages.<page>), a
 * canonical URL for the language, hreflang alternates for the other languages, and matching
 * Open Graph / Twitter text. Use as `export const generateMetadata = pageMetadata({...})`: the
 * language is only known per request.
 *
 * The title is written out in full ("Title | Scout Reporter") rather than through the root template,
 * because a plain string title in a nested layout drops the template for every page below it. The share
 * image is listed explicitly because a segment's own `openGraph` replaces the one inherited from the root.
 */
export function pageMetadata({
  page,
  path,
  noindex = false,
}: {
  page: MetaPage;
  path: string;
  noindex?: boolean;
}): () => Promise<Metadata> {
  return async () => {
    const locale = await currentLocale();
    const { title, description } = await pageText(page, locale);
    const fullTitle = `${title} | ${SITE_NAME}`;
    const url = localizePath(path, locale);
    return {
      title: { absolute: fullTitle },
      description,
      alternates: noindex ? { canonical: url } : localeAlternates(path, locale),
      openGraph: {
        type: "website",
        siteName: SITE_NAME,
        locale: ogLocale(locale),
        url,
        title: fullTitle,
        description,
        images: [SHARE_IMAGE],
      },
      twitter: {
        card: "summary_large_image",
        title: fullTitle,
        description,
        creator: AUTHOR.twitter,
        images: [SHARE_IMAGE],
      },
      ...(noindex && { robots: { index: false, follow: true } }),
    };
  };
}
