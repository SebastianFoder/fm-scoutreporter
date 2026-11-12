/**
 * Case- and accent-insensitive name comparison for sorting. One shared collator: calling
 * `localeCompare` with options builds a new collator per call, which is slow on large imports.
 */
const nameCollator = new Intl.Collator(undefined, { sensitivity: "base" });

export function compareNames(a: string, b: string): number {
  return nameCollator.compare(a, b);
}
