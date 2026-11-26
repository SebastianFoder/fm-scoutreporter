import type { Decorator, Preview } from "@storybook/nextjs-vite";
import { applyTheme, type ThemeKey } from "@scoutreporter/core/themes";
import { NextIntlClientProvider } from "next-intl";
import { DEFAULT_LOCALE, LOCALES, LOCALE_INFO, isLocale } from "../i18n/locales";
import { mergeMessages, type Messages } from "../i18n/messages";
import { installFixtureFetchMock, withAppProviders } from "./providers";
import "../styles/globals.css";

installFixtureFetchMock();

const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals.theme ?? "light") as ThemeKey;

  // Theme tokens live on <html>, so applying them before render is safe.
  applyTheme(theme);
  document.body.style.backgroundColor = "oklch(var(--background))";

  return <Story />;
};

/* Every locale's messages, one file per namespace (see i18n/namespaces.ts): messages/<locale>/<ns>.json. */
const messageFiles = import.meta.glob<{ default: Messages }>("../i18n/messages/*/*.json", { eager: true });
const rawMessages: Record<string, Messages> = {};
for (const [file, mod] of Object.entries(messageFiles)) {
  const [, locale, ns] = file.match(/messages\/([^/]+)\/([^/]+)\.json$/)!;
  (rawMessages[locale] ??= {})[ns] = mod.default;
}
/* Untranslated keys fall back to English, as in the app (i18n/messages.ts). */
const MESSAGES = Object.fromEntries(
  LOCALES.map((l) => [l, l === DEFAULT_LOCALE ? rawMessages[l] : mergeMessages(rawMessages[DEFAULT_LOCALE], rawMessages[l] ?? {})]),
);

/* Components read their text through next-intl, in the toolbar's language (default English). */
const withIntl: Decorator = (Story, context) => {
  const locale = isLocale(context.globals.locale) ? context.globals.locale : DEFAULT_LOCALE;
  document.documentElement.lang = locale;
  return (
    <NextIntlClientProvider key={locale} locale={locale} messages={MESSAGES[locale]}>
      <Story />
    </NextIntlClientProvider>
  );
};

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "App theme",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      description: "Language",
      toolbar: {
        title: "Language",
        icon: "globe",
        items: LOCALES.map((l) => ({ value: l, title: LOCALE_INFO[l].name })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "light",
    locale: DEFAULT_LOCALE,
  },
  // Theme is outermost so provider-wrapped stories render against the active tokens.
  decorators: [withAppProviders, withTheme, withIntl],
  parameters: {
    layout: "padded",
    nextjs: { appDirectory: true },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: { test: "todo" },
  },
  tags: ["autodocs"],
};

export default preview;
