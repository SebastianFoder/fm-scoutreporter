import type { MetadataRoute } from "next";
import { LOCALES } from "@scoutreporter/ui/i18n/locales";
import { localizedPaths } from "@scoutreporter/ui/i18n/paths";
import { INDEXABLE_ROUTES } from "@/lib/routes";
import { absoluteUrl } from "@/lib/site";

/**
 * Every indexable route in every language (/faq, /da/faq, ...), each entry listing all its
 * languages as hreflang alternates, with x-default on English.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return INDEXABLE_ROUTES.flatMap(({ path, priority, changeFrequency }) => {
    const paths = localizedPaths(path);
    const languages = {
      ...Object.fromEntries(LOCALES.map((l) => [l, absoluteUrl(paths[l])])),
      "x-default": absoluteUrl(path),
    };
    return LOCALES.map((l) => ({
      url: absoluteUrl(paths[l]),
      lastModified,
      changeFrequency,
      priority: l === "en" ? priority : Math.round(priority * 0.9 * 10) / 10,
      alternates: { languages },
    }));
  });
}
