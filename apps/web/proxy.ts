import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, negotiateLocale } from "@scoutreporter/ui/i18n/locales";
import { localizePath, splitLocale } from "@scoutreporter/ui/i18n/paths";
import { LOCALE_HEADER } from "@/i18n/header";

/** A year, like the language picker's cookie. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** The desktop app's pages never carry the language in the URL: the app sends the cookie. */
const DESKTOP = process.env.SCOUTREPORTER_TARGET === "desktop";

/**
 * The language in the website's URL (packages/ui/i18n/paths.ts): English has no prefix, the others
 * do (/da/players). Every page exists once, unprefixed; a prefixed URL is rewritten to it with the
 * language in a request header that i18n/request.ts reads.
 *
 * - /da/players: served in Danish, and Danish is remembered (the cookie) for unprefixed links.
 * - /en/players: redirected to /players, English's only URL.
 * - /players: English for crawlers and first-time visitors with an English browser. A visitor who
 *   chose another language (the cookie), or whose browser asks for one and has not chosen, is
 *   redirected to that language's URL. Crawlers send neither, so they always get English here.
 */
export function proxy(request: NextRequest) {
  if (DESKTOP) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const { locale, path } = splitLocale(pathname);

  if (locale === DEFAULT_LOCALE) {
    const url = request.nextUrl.clone();
    url.pathname = path;
    const res = NextResponse.redirect(url, 308);
    res.cookies.set(LOCALE_COOKIE, DEFAULT_LOCALE, { path: "/", maxAge: COOKIE_MAX_AGE, sameSite: "lax" });
    return res;
  }

  if (locale) {
    const headers = new Headers(request.headers);
    headers.set(LOCALE_HEADER, locale);
    const url = request.nextUrl.clone();
    url.pathname = path;
    const res = NextResponse.rewrite(url, { request: { headers } });
    if (request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
      res.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: COOKIE_MAX_AGE, sameSite: "lax" });
    }
    return res;
  }

  // Unprefixed: English, unless the visitor's language is another one.
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  const wanted = isLocale(cookie) ? cookie : negotiateLocale(request.headers.get("accept-language"));
  if (wanted !== DEFAULT_LOCALE) {
    const url = request.nextUrl.clone();
    url.pathname = localizePath(pathname, wanted);
    url.search = search;
    const res = NextResponse.redirect(url, 307);
    // Caches must keep the English page and the redirect apart.
    res.headers.set("Vary", "Cookie, Accept-Language");
    return res;
  }
  const headers = new Headers(request.headers);
  headers.set(LOCALE_HEADER, DEFAULT_LOCALE);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  /*
   * Pages only: not the API, Next's own files, the metadata routes (sitemap, robots, icons, share
   * image, llms.txt) or anything with a file extension (screenshots, .fmf views).
   */
  matcher: [
    "/((?!api|_next|_vercel|sitemap.xml|robots.txt|llms.txt|llms-full.txt|manifest.webmanifest|opengraph-image|apple-icon|icon|.*\\.[^/]+$).*)",
  ],
};
