/**
 * Reads Football Manager's own UI translations from its install (data/game_simulation/languages.fmf),
 * so the site can use FM's official wording for attributes, roles and other game terms.
 *
 * Format, as far as we need it: the file is a short header followed by back-to-back zstd frames.
 * Decompressed, it holds one table per language ("ctl." blocks). Each table has the language name,
 * the strings (a count byte, then that many length-prefixed UTF-8 variants, e.g. male/female
 * wording), and at the end an index of (string ID, offset) pairs. The same ID means the same string
 * in every language, which is how terms are matched across languages.
 *
 * The decoded tables are cached in the OS temp folder, keyed by the file's size and mtime.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

/** Our locale codes → the language names FM uses for its tables. */
export const FM_LANGUAGE = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  it: "Italiano",
  da: "Dansk",
  sv: "Svenska",
  nb: "Norsk",
  ko: "한국어",
};

const STEAM = "C:/Program Files (x86)/Steam/steamapps/common";
/** Newest first: FM27's wording wins when both are installed. */
const DEFAULT_INSTALLS = [`${STEAM}/Football Manager 27`, `${STEAM}/Football Manager 26`];

export function findLanguagesFile(fmDir = process.env.FM_DIR) {
  const dirs = fmDir ? [fmDir] : DEFAULT_INSTALLS;
  for (const dir of dirs) {
    const file = path.join(dir, "data", "game_simulation", "languages.fmf");
    if (fs.existsSync(file)) return file;
  }
  throw new Error(`languages.fmf not found in ${dirs.join(", ")}. Set FM_DIR to your Football Manager folder.`);
}

const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

function decompress(file) {
  const raw = fs.readFileSync(file);
  const frames = [];
  for (let p = raw.indexOf(ZSTD_MAGIC); p !== -1; p = raw.indexOf(ZSTD_MAGIC, p + 4)) frames.push(p);
  frames.push(raw.length);
  const parts = [];
  for (let i = 0; i < frames.length - 1; i++) {
    parts.push(zlib.zstdDecompressSync(raw.subarray(frames[i], frames[i + 1])));
  }
  return Buffer.concat(parts);
}

/** { [fmLanguageName]: { [stringId]: string } } for the wanted languages (first variant only). */
function decodeTables(buf, wanted) {
  const tables = {};
  const marker = Buffer.from("ctl.");
  for (let p = buf.indexOf(marker); p !== -1; p = buf.indexOf(marker, p + 4)) {
    if (buf[p - 2] !== 3 || buf[p - 1] !== 1) continue;
    const base = p + 6;
    const size = buf.readUInt32LE(base);
    let q = base + 8;
    const nameLength = buf.readUInt32LE(q);
    q += 4;
    const name = buf.toString("utf8", q, q + nameLength);
    q += nameLength;
    // Each language has a small table (id 0) and the UI string table (id 1001).
    if (buf.readUInt32LE(q) !== 1001 || (wanted && !wanted.has(name))) continue;

    const index = base + size;
    const count = buf.readUInt32LE(index);
    const strings = {};
    for (let i = 0; i < count; i++) {
      const id = buf.readUInt32LE(index + 4 + i * 8);
      // FM27 sets the top bit of some offsets as a flag; it is not part of the offset.
      let r = base + (buf.readUInt32LE(index + 8 + i * 8) & 0x7fffffff);
      if (buf[r++] === 0) continue;
      const length = buf.readUInt32LE(r);
      strings[id] = buf.toString("utf8", r + 4, r + 4 + length);
    }
    tables[name] = strings;
  }
  return tables;
}

/** FM's string tables for our locales: { [locale]: { [stringId]: string } }. */
export function loadFmStrings(fmDir) {
  const file = findLanguagesFile(fmDir);
  const stat = fs.statSync(file);
  const cache = path.join(os.tmpdir(), `scoutreporter-fm-strings-${stat.size}-${Math.floor(stat.mtimeMs)}.json`);
  if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, "utf8"));

  const byName = decodeTables(decompress(file), new Set(Object.values(FM_LANGUAGE)));
  const out = {};
  for (const [locale, name] of Object.entries(FM_LANGUAGE)) {
    if (!byName[name]) throw new Error(`No "${name}" table in ${file}`);
    out[locale] = byName[name];
  }
  fs.writeFileSync(cache, JSON.stringify(out));
  return out;
}

/**
 * Every language FM ships, by FM's own name for it ("Deutsch", "Português", ...): { [name]: { [id]: string } }.
 * For reading exports made in any of them (build-export-terms.mjs), not just the site's languages.
 */
export function loadAllFmStrings(fmDir) {
  const file = findLanguagesFile(fmDir);
  const stat = fs.statSync(file);
  // One cache file per language: all of them together are too big for one string.
  const dir = path.join(os.tmpdir(), `scoutreporter-fm-strings-all-${stat.size}-${Math.floor(stat.mtimeMs)}`);
  const index = path.join(dir, "languages.json");
  if (fs.existsSync(index)) {
    const names = JSON.parse(fs.readFileSync(index, "utf8"));
    return Object.fromEntries(names.map((name, i) => [name, JSON.parse(fs.readFileSync(path.join(dir, `${i}.json`), "utf8"))]));
  }
  const tables = decodeTables(decompress(file), null);
  fs.mkdirSync(dir, { recursive: true });
  Object.values(tables).forEach((strings, i) => fs.writeFileSync(path.join(dir, `${i}.json`), JSON.stringify(strings)));
  fs.writeFileSync(index, JSON.stringify(Object.keys(tables)));
  return tables;
}

/** FM marks grammar on some strings ("~3~Prises de balle"); the game drops the marks. */
export const cleanFmText = (s) => (typeof s === "string" ? s.replace(/~\d+~/g, "") : s);

/** Strings with FM markup ([%male#1], {de}) are sentence templates, not terms. */
const isPlain = (s) => typeof s === "string" && s.trim() !== "" && !/[[\]{}~]/.test(s);

/**
 * FM's translation of an English term in each locale. The same English text can have several IDs
 * (one per screen); the most common translation among them wins, ties going to the lowest ID.
 * Matching is exact first, then case-insensitive. Returns null when FM has no such string.
 */
export function translateTerm(fm, english) {
  const en = fm.en;
  let ids = Object.keys(en).filter((id) => en[id] === english);
  if (ids.length === 0) {
    const lower = english.toLowerCase();
    ids = Object.keys(en).filter((id) => typeof en[id] === "string" && en[id].toLowerCase() === lower);
  }
  if (ids.length === 0) return null;
  ids.sort((a, b) => Number(a) - Number(b));

  const result = {};
  for (const locale of Object.keys(FM_LANGUAGE)) {
    const votes = new Map();
    for (const id of ids) {
      const s = cleanFmText(fm[locale][id]);
      if (isPlain(s)) votes.set(s, (votes.get(s) ?? 0) + 1);
    }
    let best = null;
    let bestVotes = 0;
    for (const [s, n] of votes) if (n > bestVotes) [best, bestVotes] = [s, n];
    result[locale] = best;
  }
  return result;
}
