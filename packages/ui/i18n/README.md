# Translations

The website and the desktop app are translated into English (the source), French, German, Spanish,
Italian, Danish, Swedish, Norwegian (Bokmål) and Korean, with [next-intl](https://next-intl.dev).

On the website the language is in the URL: English has no prefix (`/players`), every other language
does (`/da/players`, `/ko/faq`). `apps/web/proxy.ts` rewrites a prefixed URL to the one page that
exists and passes the language to `apps/web/i18n/request.ts`; `/en/...` redirects to the unprefixed
URL. On an unprefixed URL, a visitor who chose another language (the `NEXT_LOCALE` cookie) or whose
browser asks for one (`Accept-Language`, when there is no cookie) is redirected to that language's
URL; crawlers send neither, so they get English. Every page lists its other languages as hreflang
alternates, and the sitemap lists every language.

The desktop app's URLs carry no language: there it is the `NEXT_LOCALE` cookie the app sends (the
language picker's choice), else Windows' languages, else English.

- Links between pages: `Link`, `usePathname` and `useRouter` from `i18n/navigation.tsx`, not from
  `next/link` / `next/navigation`. Write hrefs without the language (`/players`); the current one
  is added (and left off in the desktop app). `usePathname()` returns the path without it.
- Analytics: Umami counts `/da/players` as `/players` (the prefix is dropped before sending, in
  `packages/core/analytics/umami.ts`); the language is the session's `locale` property, and
  switching language sends a `language` event (`components/LocaleAnalytics.tsx`).

## Files

- `locales.ts`: the languages, their flags and Intl tags, and how a visitor's language is negotiated.
- `paths.ts`: the language in URLs (`/da/players`). `navigation.tsx`: language-aware `Link` and hooks.
- `namespaces.ts`: the message namespaces. Client namespaces are sent to the browser; server ones
  (page copy) are only rendered on the server.
- `messages/<locale>/<namespace>.json`: the messages. `en` is the source; every other locale has
  exactly the same keys (`messages.test.ts` checks keys, ICU syntax and that placeholders match).
  A key missing from a translation falls back to English at runtime.
- `hooks.ts`: `useFormatNumber()`, `useIntlLocale()` and `useAttributeLabel()`.

## Writing a component

```tsx
import { useTranslations } from "next-intl";

const t = useTranslations("players");
t("list.title");                                      // "Players"
t("list.count", { count: n });                        // "{count, plural, one {# player} other {# players}}"
t.rich("list.hint", { b: (c) => <b>{c}</b> });        // "Press <b>Import</b> to start"
```

- Client components and plain (non-async) server components: `useTranslations`. Async server
  components: `const t = await getTranslations("home")` from `next-intl/server`.
- Write whole sentences with placeholders, never sentences glued together from pieces: word order
  differs between languages. Use ICU `plural` for anything counted and `select` for variants.
- Keys are camelCase, grouped by screen or component: `players.list.empty.title`.
- Numbers: `useFormatNumber()` (or `useIntlLocale()` for `toLocaleString`), never a hard-coded
  `"en-GB"`. Grouping and decimal separators differ by language.
- Keep the copy's tone. No em dashes anywhere (the lint bans them): use a comma, colon or new sentence.

## Football Manager terms

Players know FM's own wording, so game terms use FM's official translations, read from the FM
install by `scripts/fm-terms`. They live in the `fm` namespace: attributes (`useAttributeLabel()`),
attribute groups, staff attributes and their abbreviations, staff roles, FM27 roles, training
schedules, coaching groups and common terms (`fm.terms.wage`, `fm.terms.bestXi`, ...).

- To add a term: add the English to `messages/en/fm.json`, run
  `node scripts/fm-terms/build-fm-messages.mjs`, and translate by hand only what it reports missing
  (list those keys under the locale in `scripts/fm-terms/manual.json` so a re-run keeps them).
- To check FM's wording for anything else: `node scripts/fm-terms/lookup.mjs "Squad Status"`.

## Not translated

- The product name (Scout Reporter), FM version names (FM26, FM27).
- FM view and file names the user imports into FM (`SCOUT REPORTER Standard`), position codes
  (GK, DC, AMR, ST), grades (S++ to F): they match what FM and the files show.
- Names the user typed (their own weight profiles, saved formations). Built-in names are translated.
- Structured data (JSON-LD) and `llms.txt`: English in every language. Page titles and descriptions
  are translated (`meta` namespace, read by `pageMetadata` in apps/web/lib/site.ts), and canonical
  URLs, hreflang and `og:locale` follow the page's language.
- Data in `packages/core`: it stays English; components translate at display time, by ID.
- Analytics event names, storage keys, console messages.

## Exports from FM in other languages

Separate from the site's own language: FM writes CSV exports in the game's language (German
headers like "Abschluss", positions like "OM (LZ)", money like "€1.4Mio.", staff ratings like
"Kompetent"). `packages/core/parser/export-locale.ts` detects the export's language from its
headers and turns it into the English export the parsers read, for all of FM's languages.

- The words are in `packages/core/parser/export-terms.json`, made by
  `node scripts/fm-terms/build-export-terms.mjs` from FM's language files. FM has many strings with
  the same English text, so the right ones are pinned by real exports: English, German, French, Spanish, Italian, Danish, Swedish, Norwegian and Korean
  exports of the same view (`packages/core/fixtures/`, `fixtures/de/`, `/fr/`, `/it/`, `/da/`, `/sv/`, `/nb/`, `/ko/`, `/es/`) have the same
  columns in order. Another language's exports in `fixtures/<code>/` (listed in the script's
  `LOCAL_FIXTURES`) pin them further.
- FM's French uses "Exceptionnel" for both Outstanding and Elite staff ratings, so a French staff
  export reads Elite as Outstanding (18.5 instead of 20); nothing in the export tells them apart.
- Only values the app calculates with are translated (positions, money, staff ratings, yes/no,
  squad status). Foot strength, dates, personality and club names are shown as exported.
- The Squad views have no local exports yet. Their headers, squad statuses and positions are pinned
  from screenshots of FM's Squad screen in each language (`SQUAD_HEADERS` and `STATUSES` in the
  script), and bench spots in any language ("S1", "E1", "R1", Danish "U") read as the bench. Not
  confirmed by a real export yet: the injury code in the Info column (from FM's one "Inj" string)
  and the Time Missed wording ("9 days"), which other languages may write differently.
