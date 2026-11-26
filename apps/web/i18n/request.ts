import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, resolveLocale } from "@scoutreporter/ui/i18n/locales";
import { loadMessages } from "@scoutreporter/ui/i18n/messages";

/**
 * The language for this request: the language picker's cookie, else the browser's Accept-Language
 * (the OS language in the desktop app), else English. The URL never carries the language.
 */
export default getRequestConfig(async () => {
  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value, (await headers()).get("accept-language"));
  return { locale, messages: await loadMessages(locale) };
});
