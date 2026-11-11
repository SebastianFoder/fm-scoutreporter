import type { Metadata } from "next";

/**
 * Site identity and SEO helpers, shared by the root layout, every route's metadata, the sitemap,
 * robots, the web manifest and the JSON-LD blocks.
 */

/** Production origin. Override with NEXT_PUBLIC_SITE_URL for previews or a different domain. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://fmscouting.sebastianfoder.com"
).replace(/\/+$/, "");

export const SITE_NAME = "Scout Reporter";

/** Default document title, used on the home page. */
export const SITE_TITLE = "Scout Reporter: FM27 and FM26 player scouting tool";

export const SITE_DESCRIPTION =
  "Free Football Manager 27 and 26 scouting tool. Import a player CSV export to score, grade and compare players, find wonderkids from CA and PA, and pick a Best XI within budget. Runs in your browser.";

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

/**
 * Route metadata with a canonical URL and matching Open Graph / Twitter text.
 *
 * The title is written out in full ("Title | Scout Reporter") rather than through the root template,
 * because a plain string title in a nested layout drops the template for every page below it. The share
 * image is listed explicitly because a segment's own `openGraph` replaces the one inherited from the root.
 */
export function pageMetadata({
  title,
  description,
  path,
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}): Metadata {
  const fullTitle = `${title} | ${SITE_NAME}`;
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_GB",
      url: path,
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
}
