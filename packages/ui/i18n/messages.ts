import { CLIENT_NAMESPACES, NAMESPACES, type Namespace } from "./namespaces";
import { DEFAULT_LOCALE, type Locale } from "./locales";

export type Messages = Record<string, unknown>;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** `base` overlaid with `over`, recursively: keys missing from `over` keep `base`'s value. */
export function mergeMessages(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = isObject(v) && isObject(base[k]) ? mergeMessages(base[k] as Messages, v) : v;
  }
  return out;
}

async function loadNamespace(locale: Locale, ns: Namespace): Promise<Messages> {
  try {
    return (await import(`./messages/${locale}/${ns}.json`)).default as Messages;
  } catch {
    return {};
  }
}

async function loadRaw(locale: Locale): Promise<Messages> {
  const entries = await Promise.all(NAMESPACES.map(async (ns) => [ns, await loadNamespace(locale, ns)] as const));
  return Object.fromEntries(entries);
}

/**
 * Every namespace for `locale`. A message not translated yet falls back to English, so a missing
 * key never shows up as a raw key on the page.
 */
export async function loadMessages(locale: Locale): Promise<Messages> {
  const english = await loadRaw(DEFAULT_LOCALE);
  return locale === DEFAULT_LOCALE ? english : mergeMessages(english, await loadRaw(locale));
}

/** The namespaces client components use: what NextIntlClientProvider sends to the browser. */
export function clientMessages(messages: Messages): Messages {
  return Object.fromEntries(CLIENT_NAMESPACES.map((ns) => [ns, messages[ns] ?? {}]));
}
