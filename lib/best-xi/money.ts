/**
 * Money strings as FM prints them: "€250K - €2.5M", "€140K", "€1.9K p/w", "Not for Sale".
 */
const UNIT: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9 };

const AMOUNT = /(\d[\d.,]*)\s*([KMB])?(?![a-z])/i;

function toNumber(digits: string, hasUnit: boolean): number {
  let s = digits.replace(/[.,]+$/, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // The last separator is the decimal one: "1,250.5" or "1.250,5".
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma) {
    s = hasUnit || !/^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if (hasDot && !hasUnit && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  return Number(s);
}

/** First amount in the text ("€2.5M" → 2500000), or null when there is none. */
export function parseMoney(text: string): number | null {
  const m = text.match(AMOUNT);
  if (!m) return null;
  const unit = m[2]?.toUpperCase();
  const n = toNumber(m[1], Boolean(unit));
  if (!Number.isFinite(n)) return null;
  return n * (unit ? UNIT[unit] : 1);
}

export type TransferValue =
  /** No value in the export ("€0" / blank): typically a free agent. */
  | { kind: "none" }
  /** A value FM will not put a number on, e.g. "Not for Sale". */
  | { kind: "unavailable" }
  | { kind: "range"; low: number; high: number };

export function parseTransferValue(text: string | null): TransferValue {
  if (text === null || text.trim() === "") return { kind: "none" };
  const amounts = text
    .split(/\s+[-\u2013]\s+/)
    .map(parseMoney)
    .filter((n): n is number => n !== null);
  if (amounts.length === 0) return { kind: "unavailable" };
  const low = Math.min(...amounts);
  const high = Math.max(...amounts);
  if (high === 0) return { kind: "none" };
  return { kind: "range", low, high };
}

export type Valuation = "low" | "mid" | "high";

/** The single figure a value range counts for under the chosen estimate. */
export function valueEstimate(v: { low: number; high: number }, valuation: Valuation): number {
  if (valuation === "low") return v.low;
  if (valuation === "high") return v.high;
  return (v.low + v.high) / 2;
}

/** Wage per week ("€1.9K p/w", "€8K p/m", "€100K p/a"); null when unknown. */
export function parseWeeklyWage(text: string | null): number | null {
  if (!text) return null;
  const amount = parseMoney(text);
  if (amount === null) return null;
  const period = text.match(/p\/([wma])/i)?.[1]?.toLowerCase();
  if (period === "m") return (amount * 12) / 52;
  if (period === "a") return amount / 52;
  return amount;
}

/** Currency marker in front of an amount ("€", "£", "$"), or null. */
export function currencyPrefix(text: string | null): string | null {
  const m = text?.match(/^\s*([^\d\s.,-]+)\s*\d/);
  return m ? m[1] : null;
}

export function formatMoney(amount: number, prefix = "€"): string {
  const abs = Math.abs(amount);
  const short = (n: number) => {
    const digits = n >= 100 ? 0 : n >= 10 ? 1 : 2;
    return String(Number(n.toFixed(digits)));
  };
  if (abs >= 1e9) return `${prefix}${short(amount / 1e9)}B`;
  if (abs >= 1e6) return `${prefix}${short(amount / 1e6)}M`;
  if (abs >= 1e3) return `${prefix}${short(amount / 1e3)}K`;
  return `${prefix}${Math.round(amount)}`;
}

/**
 * A budget typed by the user ("15M", "750k", "2,500,000"). Blank means no limit;
 * `valid` is false when there is text that is not an amount.
 */
export function parseBudgetInput(text: string): { value: number | null; valid: boolean } {
  const t = text.trim();
  if (t === "") return { value: null, valid: true };
  const value = parseMoney(t);
  if (value === null || !/^[^\d]*\d[\d.,]*\s*[KMB]?\s*$/i.test(t)) return { value: null, valid: false };
  return { value, valid: true };
}
