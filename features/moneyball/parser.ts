import { csvLines, detectDelimiter, splitCsvLine } from "@/lib/parser/csv-utils";
import {
  MONEYBALL_REQUIRED_HEADERS,
  NON_STAT_HEADERS,
  isGoalkeeper,
} from "./schema";
import { isMoneyballStat, MoneyballStat } from "./moneyball-stat";
import type { MoneyballImportResult, MoneyballRow } from "./types";

const OFF_HEADER = "Off";

function toNumber(value: string): number {
  const normalized = value.replace(/[,%€\s]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function parseMoneyballCsv(csv: string): MoneyballImportResult {
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

  for (const h of MONEYBALL_REQUIRED_HEADERS) {
    if (!headerSet.has(h)) {
      errors.push({ line: 1, message: `Missing required column: ${h}` });
    }
  }

  if (errors.length > 0) {
    return { rows: [], errors, statKeys: [] };
  }

  const col = (name: string) => headers.indexOf(name);
  const statKeyCandidates = headers.filter((h) => !NON_STAT_HEADERS.has(h));
  const unknown = statKeyCandidates.filter((h) => !isMoneyballStat(h));
  if (unknown.length > 0) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          message: `Unknown stat column(s): ${unknown.join(", ")}`,
        },
      ],
      statKeys: [],
    };
  }

  const statKeys = statKeyCandidates as MoneyballStat[];
  const statKeysWithDerived = [...statKeys];
  if (!statKeysWithDerived.includes(MoneyballStat.HeadersAttemptedPer90)) {
    statKeysWithDerived.push(MoneyballStat.HeadersAttemptedPer90);
  }
  if (!statKeysWithDerived.includes(MoneyballStat.OffsidesPer90)) {
    statKeysWithDerived.push(MoneyballStat.OffsidesPer90);
  }
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
    for (const key of statKeys) {
      stats[key] = toNumber(cols[col(key)] ?? "0");
    }

    const minutes = toNumber(cols[col("Minutes")] ?? "0");
    const headersAttempted = toNumber(cols[col(MoneyballStat.HeadersAttempted)] ?? "0");
    const offsidesTotal = toNumber(cols[col(OFF_HEADER)] ?? "0");
    stats[MoneyballStat.HeadersAttemptedPer90] = minutes > 0 ? (headersAttempted / minutes) * 90 : 0;
    stats[MoneyballStat.OffsidesPer90] = minutes > 0 ? (offsidesTotal / minutes) * 90 : 0;

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

  return { rows, errors, statKeys: statKeysWithDerived };
}
