/**
 * The languages the site and the desktop app are translated into. The language is not in the URL:
 * it comes from the LOCALE_COOKIE (set by the language picker in the header), else the browser's
 * Accept-Language (the OS language in the desktop app), else English.
 */
export const LOCALES = ["en", "fr", "de", "es", "it", "da", "sv", "nb", "ko"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** next-intl's default cookie name. Holds a Locale. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Flags drawn by components/Flag.tsx. A language is not a country: these are the usual picks. */
export type FlagCode = "gb" | "fr" | "de" | "es" | "it" | "dk" | "se" | "no" | "kr";

export const LOCALE_INFO: Record<Locale, { name: string; flag: FlagCode; intl: string }> = {
  en: { name: "English", flag: "gb", intl: "en-GB" },
  fr: { name: "Français", flag: "fr", intl: "fr-FR" },
  de: { name: "Deutsch", flag: "de", intl: "de-DE" },
  es: { name: "Español", flag: "es", intl: "es-ES" },
  it: { name: "Italiano", flag: "it", intl: "it-IT" },
  da: { name: "Dansk", flag: "dk", intl: "da-DK" },
  sv: { name: "Svenska", flag: "se", intl: "sv-SE" },
  nb: { name: "Norsk", flag: "no", intl: "nb-NO" },
  ko: { name: "한국어", flag: "kr", intl: "ko-KR" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** BCP 47 tag for Intl / toLocaleString, e.g. "en" → "en-GB" (dates and numbers as before). */
export function intlTag(locale: string): string {
  return isLocale(locale) ? LOCALE_INFO[locale].intl : LOCALE_INFO[DEFAULT_LOCALE].intl;
}

/** Language subtags that mean one of our locales. Norwegian: "no" and Nynorsk read Bokmål fine. */
const ALIASES: Record<string, Locale> = { no: "nb", nn: "nb" };

/** The best of our locales for an Accept-Language header, else English. */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.slice(2)) || 0 : 1, i };
    })
    .filter((r) => r.tag && r.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { tag } of ranked) {
    const language = tag.split("-")[0];
    const locale = ALIASES[language] ?? language;
    if (isLocale(locale)) return locale;
  }
  return DEFAULT_LOCALE;
}

/** The cookie wins; a missing or unknown value falls back to the browser's languages. */
export function resolveLocale(cookie: string | null | undefined, acceptLanguage: string | null | undefined): Locale {
  return isLocale(cookie) ? cookie : negotiateLocale(acceptLanguage);
}
