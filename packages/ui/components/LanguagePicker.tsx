"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronDown } from "lucide-react";
import { Flag } from "./Flag";
import { LOCALES, LOCALE_COOKIE, LOCALE_INFO, isLocale, type Locale } from "../i18n/locales";
import { localizePath, stripLocale } from "../i18n/paths";
import { useDesktop } from "../desktop/DesktopProvider";
import { DESKTOP_BUILD } from "../desktop/target";
import { trackEvent } from "./LocaleAnalytics";

/**
 * The menu's id, for aria-controls. One picker per page (the header), so a fixed id: unlike
 * useId(), it can't differ between the server render and hydration.
 */
const MENU_ID = "language-menu";

/** A year: the choice should outlast the session. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function saveLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * The language menu in the site header: the current language's flag, opening a list of the
 * languages by their own names. On the website the language is in the URL (/da/players), so
 * choosing one loads the same page's URL in that language; the cookie remembers it for
 * unprefixed links (apps/web/proxy.ts). The desktop app's URLs carry no language and its
 * scoutreporter:// pages can't hold cookies, so there the choice is saved in the app's settings,
 * the app sends the cookie (apps/desktop/src/app-origin.ts) and the page re-renders in place.
 */
export function LanguagePicker() {
  const t = useTranslations("chrome.language");
  const current = useLocale();
  const active: Locale = isLocale(current) ? current : "en";
  const router = useRouter();
  const desktop = useDesktop();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (locale: Locale) => {
    setOpen(false);
    if (locale === active) return;
    saveLocale(locale);
    trackEvent("language", { from: active, to: locale });
    if (desktop) {
      void desktop.updateSettings({ language: locale }).then(() => startTransition(() => router.refresh()));
    } else if (DESKTOP_BUILD) {
      startTransition(() => router.refresh());
    } else {
      // A full load, not router.push: every page's layout (html lang, messages) is shared between
      // /players and /da/players, so a client navigation would keep the old language's layout.
      const { pathname, search, hash } = window.location;
      window.location.assign(`${localizePath(stripLocale(pathname), locale)}${search}${hash}`);
    }
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={MENU_ID}
        aria-label={t("label", { language: LOCALE_INFO[active].name })}
        title={t("title")}
        className={[
          "btn h-8 gap-1 px-2 text-[13px] font-medium text-on-chrome/80 hover:bg-on-chrome/10 hover:text-on-chrome",
          pending ? "opacity-60" : "",
        ].join(" ")}
      >
        <Flag code={LOCALE_INFO[active].flag} />
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && (
        <ul
          id={MENU_ID}
          role="menu"
          aria-label={t("title")}
          className="absolute right-0 top-full z-50 mt-1 min-w-44 overflow-hidden rounded-md border border-line bg-surface py-1 text-sm text-ink shadow-lg"
        >
          {LOCALES.map((locale) => {
            const selected = locale === active;
            return (
              <li key={locale} role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  lang={locale}
                  onClick={() => choose(locale)}
                  className={[
                    "flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-ink/5",
                    selected ? "font-semibold" : "",
                  ].join(" ")}
                >
                  <Flag code={LOCALE_INFO[locale].flag} />
                  <span className="flex-1">{LOCALE_INFO[locale].name}</span>
                  {selected && <Check className="h-4 w-4 text-accent" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
