export type CsvDelimiter = ";" | "," | "\t";

const CANDIDATES: CsvDelimiter[] = [";", ",", "\t"];

/** Strip a leading UTF-8 BOM, which FM exports include. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Pick the delimiter from the header line. FM26 exports use `;`; FM27 exports use `,`.
 * The header never contains the delimiter as data, so the most frequent candidate wins.
 */
export function detectDelimiter(headerLine: string): CsvDelimiter {
  let best: CsvDelimiter = ";";
  let bestCount = 0;
  for (const d of CANDIDATES) {
    const count = headerLine.split(d).length - 1;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Split one CSV line, honouring double-quoted fields (needed for comma-delimited
 * exports, where values like "AM (R), ST (C)" or "1,234" get quoted).
 */
export function splitCsvLine(line: string, delimiter: CsvDelimiter): string[] {
  if (!line.includes('"')) return line.split(delimiter).map((x) => x.trim());

  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

/** Non-empty, trimmed lines of a CSV document with the BOM removed. */
export function csvLines(csv: string): string[] {
  return stripBom(csv)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}
