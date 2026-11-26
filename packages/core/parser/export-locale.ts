/**
 * Exports from a Football Manager running in another language: FM writes the column headers and
 * some values in the game's language ("Abschluss", "V (Z)", "€1.4Mio.", "Kompetent"). The parsers
 * read English, so englishExport() turns such an export into the English one FM would have written:
 * same columns, same rows, headers and the values the app calculates with translated back. An
 * English export comes back unchanged.
 *
 * The words come from FM's own language files (export-terms.json, made by
 * scripts/fm-terms/build-export-terms.mjs). Display-only values (foot strength, dates, personality,
 * club names) are left as exported.
 */
import TERMS from "./export-terms.json";
import { csvLines, detectDelimiter, splitCsvLine, type CsvDelimiter } from "./csv-utils";

interface MoneyTerms {
  /**
   * Number suffix → K, M or B ("Mio." → "M"), or a multiplier ("만" → "10000": Korean counts in ten
   * thousands). Case matters: Spanish "m" is thousands.
   */
  units: [string, string][];
  /** Wage-period wording → "p/w", "p/m" or "p/a"; `prefix` when it comes before the amount. */
  periods: { text: string; period: string; prefix: boolean }[];
}

interface LanguageTerms {
  /** Normalised local header → normalised English header, or several when FM uses one word for several columns. */
  headers: Record<string, string | string[]>;
  /** Staff rating words ("Kompetent" → "Competent"). */
  ratings: Record<string, string>;
  yesNo: Record<string, string>;
  /** FM's "N/A" ("n.a."). */
  na: string[];
  /** Position letters, upper case: roles ("OM" → "AM") and sides ("Z" → "C"). */
  roles: Record<string, string>;
  sides: Record<string, string>;
  /** Squad statuses, lower case ("stammspieler" → "Regular Starter"). */
  statuses: Record<string, string>;
  /** Info column codes ("Ver" → "Inj"). */
  info: Record<string, string>;
  money: MoneyTerms;
}

const LANGUAGES = (TERMS as unknown as { languages: Record<string, LanguageTerms> }).languages;
const ENGLISH_HEADERS = new Set((TERMS as unknown as { englishHeaders: string[] }).englishHeaders);
/** The views (players, squad, staff) each English header key is in. */
const VIEWS = (TERMS as unknown as { views: Record<string, string[]> }).views;
/** Each view's English header keys in column order. */
const COLUMNS = (TERMS as unknown as { columns: Record<string, string[]> }).columns;

/** A header as a lookup key: letters and digits of any script, lower case. */
export function headerKey(h: string): string {
  return h.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** Columns whose values get translated, by English header key. */
const POSITION_COLUMNS = new Set(["position", "bestpos", "picked"]);
const MONEY_COLUMNS = new Set(["wage", "salary", "transfervalue"]);
const YES_NO_COLUMNS = new Set(["eunational"]);
const STATUS_COLUMNS = new Set(["playingtime"]);
const INFO_COLUMNS = new Set(["inf"]);
/** FM's position letters in English: a "Picked" value without one is a bench spot. */
const ENGLISH_ROLES = new Set(["GK", "D", "WB", "DM", "M", "AM", "ST"]);
/** Staff view rating columns: abbreviations and full names (staff/staff-attributes.ts headers). */
const RATING_COLUMNS = new Set([
  "att", "attacking", "def", "defending", "fit", "fitness", "gk", "goalkeeping", "pos", "possession",
  "set", "setpieces", "tco", "tactical", "tec", "technical", "yng", "workingwithyoungsters", "ada",
  "adaptability", "det", "determination", "auth", "authority", "discipline", "mgm", "manmanagement",
  "peoplemanagement", "mot", "motivating", "jca", "judgingplayerability", "judgingability", "jpa",
  "judgingplayerpotential", "judgingpotential", "judsa", "judgingstaffability", "neg", "negotiating",
  "tct", "tacticalknowledge", "anad", "analysingdata", "phy", "physiotherapy", "sps", "sportsscience",
]);

/**
 * The FM languages an export's header is in, or [] for English (or one we can't tell). The language
 * with the most headers that are not English headers wins; it needs a few, so an English export with
 * an odd column never counts as German. Languages with the same headers all match (European and
 * Latin American Spanish): their words are read together.
 */
export function detectExportLanguages(headers: string[]): string[] {
  const keys = headers.map(headerKey).filter((k) => k && !ENGLISH_HEADERS.has(k));
  let best: string[] = [];
  let bestCount = 2;
  for (const [language, terms] of Object.entries(LANGUAGES)) {
    const count = keys.filter((k) => k in terms.headers).length;
    if (count > bestCount) {
      best = [language];
      bestCount = count;
    } else if (count === bestCount && best.length > 0) {
      best.push(language);
    }
  }
  return best;
}

/** The first of detectExportLanguages, or null for English. */
export function detectExportLanguage(headers: string[]): string | null {
  return detectExportLanguages(headers)[0] ?? null;
}

/** Several languages' words as one (the first language's word wins). */
function mergeTerms(languages: string[]): LanguageTerms {
  const all = languages.map((l) => LANGUAGES[l]);
  const merge = <K extends keyof LanguageTerms>(k: K) =>
    Object.assign({}, ...[...all].reverse().map((t) => t[k])) as LanguageTerms[K];
  return {
    headers: merge("headers"),
    ratings: merge("ratings"),
    yesNo: merge("yesNo"),
    na: [...new Set(all.flatMap((t) => t.na))],
    roles: merge("roles"),
    sides: merge("sides"),
    statuses: merge("statuses"),
    info: merge("info"),
    money: {
      units: all.flatMap((t) => t.money.units),
      periods: all.flatMap((t) => t.money.periods),
    },
  };
}

/** "OM (LZ), ST (Z)" → "AM (LC), ST (C)". A token that isn't a position is kept as it is. */
export function englishPosition(value: string, terms: Pick<LanguageTerms, "roles" | "sides">): string {
  return value
    .split(",")
    .map((raw) => {
      const token = raw.trim();
      const m = token.match(/^([^\s()]+)\s*(?:\(([^)]*)\))?$/u);
      if (!m) return token;
      const roles = m[1].split("/").map((r) => terms.roles[r.toUpperCase()] ?? r);
      const sides = m[2] === undefined ? undefined : [...m[2].trim()].map((c) => terms.sides[c.toUpperCase()] ?? c).join("");
      return sides === undefined ? roles.join("/") : `${roles.join("/")} (${sides})`;
    })
    .join(", ");
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** An amount the way FM writes it in English: 14700 → "14.7K", 1400000 → "1.4M". */
function shortAmount(n: number): string {
  const round = (x: number) => String(Math.round(x * 1000) / 1000);
  if (n >= 1e9) return `${round(n / 1e9)}B`;
  if (n >= 1e6) return `${round(n / 1e6)}M`;
  if (n >= 1e3) return `${round(n / 1e3)}K`;
  return round(n);
}

/**
 * "€1.4Mio." → "€1.4M", "€675/W." → "€675 p/w", "주급 €3K" → "€3K p/w", "€140m" (Spanish) → "€140K",
 * "€14만" (Korean, ten thousands) → "€140K".
 */
export function englishMoney(value: string, money: MoneyTerms): string {
  let s = value.trim();
  let period: string | null = null;
  for (const p of [...money.periods].sort((a, b) => b.text.length - a.text.length)) {
    if (p.prefix && s.startsWith(p.text)) {
      s = s.slice(p.text.length).trim();
      period = p.period;
      break;
    }
    if (!p.prefix && s.endsWith(p.text)) {
      s = s.slice(0, -p.text.length).trim();
      period = p.period;
      break;
    }
  }
  // Longest first, so "Mio." is replaced before "M", and "백만" (million) before "만", could match part of it.
  for (const [local, unit] of [...money.units].sort((a, b) => b[0].length - a[0].length)) {
    if (/^\d/.test(unit)) {
      // A multiplier: "1.47만" is 1.47 × 10,000, "1.200만" is 1,200 × 10,000 (FM writes about three
      // significant digits, so a separator before exactly three digits groups thousands).
      s = s.replace(new RegExp(`(\\d[\\d.,]*)\\s*${escape(local)}(?![\\p{L}])`, "gu"), (_, n: string) => {
        const number = /^\d{1,3}([.,]\d{3})+$/.test(n) ? n.replace(/[.,]/g, "") : n.replace(",", ".");
        return shortAmount(Number(number) * Number(unit));
      });
    } else {
      s = s.replace(new RegExp(`(\\d)\\s*${escape(local)}(?![\\p{L}])`, "gu"), `$1${unit}`);
    }
  }
  s = s.replace(/\s*–\s*/g, " - ");
  return period ? `${s} ${period}` : s;
}

/**
 * The English header for each column. FM uses some words for two columns: Italian "Posizione" is
 * Positioning and Position, Norwegian "Mot" is Bravery for players and Motivating for staff. Such a
 * header becomes the first of its columns no other header has claimed, preferring the ones in the
 * view the export is (the view most of its other headers belong to), in that view's column order:
 * FM keeps a view's columns in order, so a word used twice in one view (German "Fähigkeit" is the
 * Squad view's Ability and CA) is its columns in order.
 */
function englishHeaders(headers: string[], terms: LanguageTerms): string[] {
  const targets = headers.map((h) => terms.headers[headerKey(h)]);
  const out: (string | null)[] = targets.map((t, i) =>
    t === undefined ? headers[i] : typeof t === "string" ? t : null,
  );
  const used = new Set(out.filter((h): h is string => h !== null).map(headerKey));
  const tally = new Map<string, number>();
  for (const h of used) for (const v of VIEWS[h] ?? []) tally.set(v, (tally.get(v) ?? 0) + 1);
  const view = [...tally].sort((a, b) => b[1] - a[1])[0]?.[0];
  const order = view ? COLUMNS[view] ?? [] : [];
  const rank = (h: string) => {
    const i = order.indexOf(h);
    return i === -1 ? order.length + (VIEWS[h]?.includes(view ?? "") ? 0 : 1000) : i;
  };

  targets.forEach((t, i) => {
    if (!Array.isArray(t)) return;
    const free = t.filter((h) => !used.has(h));
    const pick = [...(free.length ? free : t)].sort((a, b) => rank(a) - rank(b))[0];
    used.add(pick);
    out[i] = pick;
  });
  return out as string[];
}

/**
 * The team sheet column: a position the player is picked at ("V (R)" → "D (R)"), or a bench spot,
 * which every language writes as a short code and a number ("S1", "E1", "R1", "A1"; Danish just "U").
 * Bench spots become "S1", "S2"... as in English ("S" alone when there is no number).
 */
export function englishPicked(value: string, terms: Pick<LanguageTerms, "roles" | "sides">): string {
  const v = value.trim();
  const bench = v.match(/^(\p{L}{1,3})(\d{0,2})$/u);
  if (bench) {
    const role = terms.roles[bench[1].toUpperCase()] ?? bench[1].toUpperCase();
    if (bench[2] !== "" || !ENGLISH_ROLES.has(role)) return `S${bench[2]}`;
  }
  return englishPosition(v, terms);
}

function quote(cell: string, delimiter: CsvDelimiter): string {
  return cell.includes(delimiter) || cell.includes('"') ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/**
 * The export as the English FM would have written it. Headers become their English (normalised)
 * names, which the parsers match by anyway; position, money, yes/no, rating and status values are
 * translated. An English export, or one in a language we can't tell, comes back as it was.
 */
export function englishExport(csv: string): string {
  const lines = csvLines(csv);
  if (lines.length === 0) return csv;
  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter);
  const languages = detectExportLanguages(headers);
  if (languages.length === 0) return csv;
  const terms = languages.length === 1 ? LANGUAGES[languages[0]] : mergeTerms(languages);

  const english = englishHeaders(headers, terms);
  const kinds = english.map((h) => {
    const key = headerKey(h);
    if (POSITION_COLUMNS.has(key)) return "position";
    if (MONEY_COLUMNS.has(key)) return "money";
    if (YES_NO_COLUMNS.has(key)) return "yesNo";
    if (STATUS_COLUMNS.has(key)) return "status";
    if (RATING_COLUMNS.has(key)) return "rating";
    if (INFO_COLUMNS.has(key)) return "info";
    if (key === "picked") return "picked";
    return null;
  });
  const na = new Set(terms.na);

  const rows = lines.slice(1).map((line) =>
    splitCsvLine(line, delimiter).map((cell, i) => {
      if (na.has(cell)) return "N/A";
      switch (kinds[i]) {
        case "position":
          return englishPosition(cell, terms);
        case "money":
          return englishMoney(cell, terms.money);
        case "yesNo":
          return terms.yesNo[cell] ?? cell;
        case "rating":
          return terms.ratings[cell] ?? cell;
        case "status":
          return terms.statuses[cell.toLowerCase()] ?? cell;
        case "info":
          return cell
            .split(/\s*,\s*/)
            .map((code) => terms.info[code] ?? code)
            .join(", ");
        case "picked":
          return englishPicked(cell, terms);
        default:
          return cell;
      }
    }),
  );
  return [english, ...rows].map((cells) => cells.map((c) => quote(c, delimiter)).join(delimiter)).join("\n");
}
