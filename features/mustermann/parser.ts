import { csvLines, detectDelimiter, splitCsvLine } from "@/lib/parser/csv-utils";
import { isGoalkeeper } from "@/features/moneyball/schema";
import { isMoneyballStat, MoneyballStat } from "@/features/moneyball/moneyball-stat";
import type { MoneyballImportResult, MoneyballRow } from "@/features/moneyball/types";
import {
  MUSTERMANN_HDRS_A_HEADER,
  MUSTERMANN_NON_STAT_HEADERS,
  MUSTERMANN_OFF_HEADER,
  MUSTERMANN_REQUIRED_HEADERS,
} from "./mustermann-schema";

function toNumber(value: string): number {
  const normalized = value.replace(/[,%€\s]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function parseMustermannMoneyballCsv(csv: string): MoneyballImportResult {
  const lines = csvLines(csv);

  if (lines.length < 2) {
    return {
      rows: [],
      errors: [{ line: 1, message: "CSV must include header and at least one row." }],
      statKeys: [],
    };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter);
  const headerSet = new Set(headers);
  const errors: MoneyballImportResult["errors"] = [];

  for (const h of MUSTERMANN_REQUIRED_HEADERS) {
    if (!headerSet.has(h)) errors.push({ line: 1, message: `Missing required column: ${h}` });
  }
  if (!headerSet.has(MUSTERMANN_HDRS_A_HEADER)) {
    errors.push({ line: 1, message: `Missing required column: ${MUSTERMANN_HDRS_A_HEADER}` });
  }
  if (!headerSet.has(MUSTERMANN_OFF_HEADER)) {
    errors.push({ line: 1, message: `Missing required column: ${MUSTERMANN_OFF_HEADER}` });
  }
  if (errors.length > 0) return { rows: [], errors, statKeys: [] };

  const col = (name: string) => headers.indexOf(name);
  const statKeysOrdered: MoneyballStat[] = [];
  for (const h of headers) {
    if (MUSTERMANN_NON_STAT_HEADERS.has(h)) continue;
    if (h === MUSTERMANN_OFF_HEADER) continue;
    if (!isMoneyballStat(h)) {
      errors.push({ line: 1, message: `Unknown stat column: ${h}` });
      break;
    }
    statKeysOrdered.push(h);
  }
  if (errors.length > 0) return { rows: [], errors, statKeys: [] };

  const statKeys = [...statKeysOrdered, MoneyballStat.HeadersAttemptedPer90, MoneyballStat.OffsidesPer90];
  const rows: MoneyballRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i], delimiter);
    if (cols.length !== headers.length) {
      errors.push({
        line: i + 1,
        message: `Column count mismatch: expected ${headers.length}, got ${cols.length}.`,
      });
      continue;
    }

    const stats: Partial<Record<MoneyballStat, number>> = {};
    for (const key of statKeysOrdered) stats[key] = toNumber(cols[col(key)] ?? "0");

    const minutes = toNumber(cols[col("Minutes")] ?? "0");
    const hdrsA = toNumber(cols[col(MUSTERMANN_HDRS_A_HEADER)] ?? "0");
    const off = toNumber(cols[col(MUSTERMANN_OFF_HEADER)] ?? "0");
    stats[MoneyballStat.HeadersAttempted] = hdrsA;
    stats[MoneyballStat.HeadersAttemptedPer90] = minutes > 0 ? (hdrsA / minutes) * 90 : 0;
    stats[MoneyballStat.OffsidesPer90] = minutes > 0 ? (off / minutes) * 90 : 0;

    const position = cols[col("Position")] ?? "";
    rows.push({
      inf: cols[col("Inf")] ?? "",
      player: cols[col("Player")] ?? "",
      uniqueId: cols[col("Unique ID")] ?? "",
      basedIn: cols[col("Based In")] ?? "",
      division: cols[col("Division")] ?? "",
      nation: cols[col("Nation")] ?? "",
      club: cols[col("Club")] ?? "",
      position,
      role: isGoalkeeper(position),
      age: toNumber(cols[col("Age")] ?? "0"),
      potential: cols[col("Potential")] ?? "",
      wage: cols[col("Wage")] ?? "",
      minutes,
      minsPerGame: toNumber(cols[col("Mins/Gm")] ?? "0"),
      appearancesRaw: cols[col("Appearances")] ?? "",
      stats,
      bestPos: cols[col("Best Pos")] ?? "",
      askingPrice: cols[col("Asking Price")] ?? "",
    });
  }

  return { rows, errors, statKeys };
}
