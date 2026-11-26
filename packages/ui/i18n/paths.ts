import { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from "./locales";

/**
 * Language in the website's URLs: English (the default) has no prefix, every other language does
 * (/players, /da/players, /ko/players). apps/web/proxy.ts reads the prefix and serves the same page
 * in that language. The desktop app's URLs never carry the language (see DESKTOP_BUILD callers).
 */

/** The URL prefix for `locale`: "" for English, "/da" for Danish. */
export function localePrefix(locale: string): string {
  return isLocale(locale) && locale !== DEFAULT_LOCALE ? `/${locale}` : "";
}

/**
 * A site path in `locale`: "/players" -> "/da/players", "/" -> "/da". Anything that is not a
 * site path (external URLs, "#anchors", "?query", protocol-relative "//host") is returned as is.
 */
export function localizePath(path: string, locale: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  const prefix = localePrefix(locale);
  if (!prefix) return path;
  // "/" alone, or "/?q" / "/#a": the prefix replaces the root slash.
  if (path === "/" || path.startsWith("/?") || path.startsWith("/#")) return `${prefix}${path.slice(1)}`;
  return `${prefix}${path}`;
}

/**
 * A URL path split into its language prefix and the path without it:
 * "/da/players" -> { locale: "da", path: "/players" }, "/players" -> { locale: null, path: "/players" }.
 * "/en/..." is reported as "en" so the proxy can send it to the unprefixed URL.
 */
export function splitLocale(pathname: string): { locale: Locale | null; path: string } {
  const match = /^\/([^/?#]+)(.*)$/.exec(pathname);
  if (match && isLocale(match[1])) {
    const rest = match[2];
    return { locale: match[1], path: rest === "" ? "/" : rest.startsWith("/") ? rest : `/${rest}` };
  }
  return { locale: null, path: pathname };
}

/** The path without its language prefix: "/da/players" -> "/players". */
export function stripLocale(pathname: string): string {
  return splitLocale(pathname).path;
}

/** Every language's URL for one page, for hreflang alternates: { en: "/faq", da: "/da/faq", ... }. */
export function localizedPaths(path: string): Record<Locale, string> {
  return Object.fromEntries(LOCALES.map((l) => [l, localizePath(path, l)])) as Record<Locale, string>;
}
