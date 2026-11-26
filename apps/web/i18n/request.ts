import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, isLocale, resolveLocale } from "@scoutreporter/ui/i18n/locales";
import { loadMessages } from "@scoutreporter/ui/i18n/messages";
import { LOCALE_HEADER } from "./header";

/**
 * The language for this request. On the website it is the URL's (/da/players is Danish, /players
 * English): proxy.ts reads the prefix and passes it in LOCALE_HEADER. The desktop app's URLs carry
 * no language, so there it is the NEXT_LOCALE cookie the app sends (the language picker's choice),
 * else Windows' languages (Accept-Language), else English.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const h = await headers();
  const fromUrl = h.get(LOCALE_HEADER) ?? (await requestLocale);
  const locale = isLocale(fromUrl)
    ? fromUrl
    : resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value, h.get("accept-language"));
  return { locale, messages: await loadMessages(locale) };
});
