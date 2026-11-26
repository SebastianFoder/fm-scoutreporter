/**
 * Message namespaces: one JSON file per namespace per locale, in i18n/messages/<locale>/<ns>.json.
 * en is the source; the other locales have the same keys (messages.test.ts checks).
 */

/** Used by client components, so sent to the browser. */
export const CLIENT_NAMESPACES = [
  /** Shared words and small shared components (buttons, modal, pagination, grades). */
  "common",
  /** The header (nav, language picker, theme), footer. */
  "chrome",
  /** Football Manager's own terms, generated from FM's translations (scripts/fm-terms). */
  "fm",
  /** Settings modal: weights, highlighted attributes, attribute colours, look. */
  "settings",
  /** CSV import panels and the data providers' messages. */
  "importer",
  /** Players screens: list, profile, side panel, compare. */
  "players",
  "bestXi",
  "squad",
  "staff",
  /** FM27 role and development panels. */
  "fm27",
  /** Desktop app only screens. */
  "desktop",
  /** The how-to guides (packages/ui/features/how-to-use). */
  "howTo",
] as const;

/** Only rendered on the server (apps/web pages), so never sent to the browser. */
export const SERVER_NAMESPACES = ["home", "faq", "download", "howToPages", "compare", "meta"] as const;

export const NAMESPACES = [...CLIENT_NAMESPACES, ...SERVER_NAMESPACES] as const;
export type Namespace = (typeof NAMESPACES)[number];
