/**
 * Writes packages/core/parser/export-terms.json: how Football Manager writes an export's headers
 * and values in each of its languages, so the CSV parsers can read an export from a German, French,
 * Korean... FM as well as an English one (packages/core/parser/export-locale.ts).
 *
 *   node scripts/fm-terms/build-export-terms.mjs
 *
 * FM has many strings with the same English text ("D" is a position, a grade, a letter...), so the
 * right one is pinned with real exports: exports of the same view from an English and a German (or
 * French...) FM have the same columns in the same order, and the FM string whose English and local
 * texts all match a column's headers is the one FM prints there. Its text in every other language
 * is then FM's header for that column in that language. Values (positions, ratings, money) are
 * pinned the same way, from the local exports' values. The more languages in fixtures/, the surer
 * the pick. Headers no local export has yet (the Squad views) fall back to every FM string with that
 * English text.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAllFmStrings } from "./fmf.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIXTURES = path.join(ROOT, "packages", "core", "fixtures");
const OUT = path.join(ROOT, "packages", "core", "parser", "export-terms.json");

const EN = "English";
/** Folders in fixtures/ with exports from FM in that language, by FM's name for the language. */
const LOCAL_FIXTURES = { de: "Deutsch", fr: "Français", it: "Italiano", da: "Dansk", sv: "Svenska", nb: "Norsk", ko: "한국어", es: "Español" };
/** Views exported in English (fixtures/) and in the languages above (fixtures/<folder>/). */
const ANCHORED_EXPORTS = ["attribute-fm27-hidden.csv", "staff.csv"];
/** English exports whose extra headers have no local export to pin them yet. */
const OTHER_EXPORTS = ["attribute.csv", "attribute-fm27.csv", "squad.csv", "squad-hidden.csv"];

/**
 * Value vocabularies, as the local exports write them. Only values the app calculates with are
 * translated; display-only ones (foot strength, dates) are shown as exported. Staff ratings go
 * lowest first: a word FM uses for two ratings (French "Exceptionnel" is Outstanding and Elite)
 * counts as the lower one.
 */
const RATINGS = {
  Unsuited: { Deutsch: "Ungeeignet", Français: "Inapte" },
  Reasonable: { Deutsch: "Angemessen", Français: "Raisonnable" },
  Competent: { Deutsch: "Kompetent", Français: "Convenable" },
  Average: { Deutsch: "Durchschnitt", Français: "Moyen" },
  Good: { Deutsch: "Gut", Français: "Bon" },
  "Very Good": { Deutsch: "Sehr gut", Français: "Très bon" },
  Outstanding: { Deutsch: "Herausragend", Français: "Exceptionnel" },
  Elite: { Deutsch: "Elite", Français: "Exceptionnel" },
};
const YES_NO = { Yes: { Deutsch: "Ja", Français: "Oui" }, No: { Deutsch: "Nein", Français: "Non" } };
/** Position letters ("V (Z)" and "D (C)" are both D (C)). */
const ROLES = {
  GK: { Deutsch: "TW", Français: "GB" },
  D: { Deutsch: "V", Français: "D" },
  WB: { Deutsch: "FV" },
  DM: { Deutsch: "DM", Français: "MD" },
  M: { Deutsch: "M", Français: "M" },
  AM: { Deutsch: "OM", Français: "MO" },
  ST: { Deutsch: "ST", Français: "BT" },
};
const SIDES = {
  R: { Deutsch: "R", Français: "D" },
  L: { Deutsch: "L", Français: "G" },
  C: { Deutsch: "Z", Français: "C" },
};
/** Number suffixes in money ("€1.4Mio."). */
const UNITS = { K: { Deutsch: "K", Français: "K" }, M: { Deutsch: "Mio.", Français: "M" }, B: { Deutsch: " Mrd." } };
/**
 * Korean, Chinese and Japanese count money in ten thousands ("€14만" is €140K) and hundred millions.
 * FM's English for these strings is "TT" and "HM"; they become a multiplier, not a K/M/B suffix.
 */
const MULTIPLIERS = { TT: ["10000", { 한국어: "만" }], HM: ["100000000", { 한국어: "억" }] };
/** Only these count that way; other languages' texts for "TT" ("MM" in Spanish) are not money units. */
const MULTIPLIER_LANGUAGES = new Set(["한국어", "简体中文", "日本語"]);
/** Wage periods, as FM's "[%cash#1] p/w" templates. */
const PERIODS = {
  "p/w": ["[%cash#1] p/w", { Deutsch: "[%cash#1]/W.", Français: "[%cash#1] p/s" }],
  "p/m": ["[%cash#1] p/m", { Deutsch: "[%cash#1]/M." }],
  "p/a": ["[%cash#1] p/a", {}],
};
const NA = ["N/A", { Deutsch: "n.a." }];
/**
 * The Squad view's headers and squad statuses as FM shows them in each language (screenshots of the
 * same squad in every language; cut-off ones left out). No Squad export pins them yet, so these do.
 */
const SQUAD_HEADERS = {
  Picked: { Dansk: "Valgt som", Deutsch: "Aufgestellt", Español: "Elegido", Italiano: "Selezionato", Norsk: "Valgt", Svenska: "Vald", 한국어: "선발됨" },
  Inf: { Dansk: "Info", Deutsch: "Info", Español: "Inf", Français: "Sta", Italiano: "Inf", Norsk: "Inf", Svenska: "Info", 한국어: "상태" },
  "Best Pos": { Dansk: "Bed pos", Deutsch: "Idealpos", Español: "Mejor pos.", Français: "M. poste", Italiano: "Pos Migl", Norsk: "Beste pos" },
  "Best Role": { Deutsch: "Beste Rolle", Español: "Mejor rol", Français: "M. rôle", Italiano: "Ruolo Migl", Norsk: "Beste rolle", Svenska: "Bästa roll", 한국어: "최적 역할" },
  Ability: { Dansk: "Evne", Deutsch: "Fähigkeit", Español: "Calidad", Français: "Niveau", Italiano: "Abilità", Norsk: "Ferdigheter", Svenska: "Förmåga", 한국어: "능력" },
  Potential: { Dansk: "Potentiale", Deutsch: "Potenzial", Español: "Potencial", Français: "Potentiel", Italiano: "Potenziale", Norsk: "Potensial", Svenska: "Potential", 한국어: "잠재력" },
  "Playing Time": { Dansk: "Spilletid", Deutsch: "Einsatzzeiten", Español: "Tiempo de juego", Français: "Temps de jeu", Italiano: "Minutaggio", Norsk: "Spilletid", Svenska: "Speltid", 한국어: "출전 시간" },
  Nation: { Español: "País", Italiano: "Nazione", Norsk: "Land", 한국어: "국가" },
};
/** Squad statuses (the Playing Time column) the squad analysis reads, pinned like SQUAD_HEADERS. */
const STATUSES = {
  "Important Player": { Dansk: "Vigtig spiller", Deutsch: "Schlüsselspieler", Español: "Jugador importante", Français: "Joueur important", Italiano: "Giocatore importante", Norsk: "Viktig spiller", Svenska: "Viktig spelare", 한국어: "중요 선수" },
  "Star Player": { Dansk: "Stjernespiller", Deutsch: "Starspieler", Español: "Jugador estrella", Français: "Joueur Vedette", Italiano: "Stella", Norsk: "Stjernespiller", Svenska: "Stjärnspelare", 한국어: "인기 선수" },
  "Fringe Player": { Dansk: "Udkantsspiller", Deutsch: "Ergänzungsspieler", Español: "Jugador secundario", Français: "Joueur secondaire", Italiano: "Giocatore marginale", Norsk: "Perifer spiller", Svenska: "Rotationsspelare", 한국어: "비주전 선수" },
  "Breakthrough Prospect": { Dansk: "Banebrydende talent", Deutsch: "Talent vor Durchbruch", Italiano: "Potenziale campione", Norsk: "Gjennombruddstalent", Svenska: "Genombrottslöfte", 한국어: "눈부신 유망주" },
  "Cup Goalkeeper": { Dansk: "Pokalmålmand", Deutsch: "Pokaltorhüter", Français: "Gardien en coupe", Italiano: "Portiere di coppa", Norsk: "Cupkeeper", Svenska: "Cupmålvakt", 한국어: "컵 골키퍼" },
  "Squad Player": { Dansk: "Trupspiller", Deutsch: "Rotationsspieler", Español: "Jugador de plantilla", Français: "Joueur de rotation", Italiano: "Elemento della rosa", Norsk: "Stallspiller", Svenska: "Truppmedlem", 한국어: "선수단 선수" },
  "Future Prospect": { Dansk: "Fremtidigt talent", Deutsch: "Perspektivspieler", Español: "Futura promesa", Français: "Joueur prometteur", Italiano: "Giovane promessa", Norsk: "Framtidstalent", Svenska: "Framtidslöfte", 한국어: "미래의 유망주" },
  "Out On Loan": { Deutsch: "Verliehen", Italiano: "Fuori in prestito", Norsk: "På utlån", Svenska: "Utlånad", 한국어: "임대 중" },
};
/** Statuses no screenshot showed: matched by English text only. */
const OTHER_STATUSES = [
  "Regular Starter",
  "First-Choice Goalkeeper",
  "Impact Sub",
  "Not Needed",
  "Domestic Cup Goalkeeper",
  "Hot Prospect",
  "Hot Prospect for the Future",
  "Decent Young Player",
  "Youngster",
];
/** The Info column's injury code ("Inj"; German "Ver"): FM has one string for it. */
const INFO_CODES = ["Inj"];

const fm = loadAllFmStrings();
const en = fm[EN];
const languages = Object.keys(fm).filter((name) => name !== EN);

/** Same as packages/core/parser/export-locale.ts: letters and digits of any script, lower case. */
const norm = (h) => h.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
/** FM marks grammar on some strings ("~3~Prises de balle"); the game, and the exports, drop the marks. */
const clean = (s) => (typeof s === "string" ? s.replace(/~\d+~/g, "") : s);
const isPlain = (s) => typeof s === "string" && s.trim() !== "" && !/[[\]{}~]/.test(s);

/** Every FM string with this English text (exact, else ignoring case). */
function idsFor(english) {
  const exact = Object.keys(en).filter((id) => en[id] === english);
  return exact.length ? exact : Object.keys(en).filter((id) => en[id]?.toLowerCase() === english.toLowerCase());
}

/**
 * The FM strings with this English text whose texts in the local languages match the most of
 * `locals` ({ Deutsch: "Abschluss", Français: "Finition" }); [] when none matches any.
 */
function pinnedIds(english, locals) {
  const known = Object.entries(locals).filter(([, text]) => text !== undefined);
  let best = [];
  let bestScore = 0;
  for (const id of Object.keys(en).filter((i) => en[i] === english)) {
    const score = known.filter(([language, text]) => clean(fm[language][id]) === text).length;
    if (score > bestScore) [best, bestScore] = [[id], score];
    else if (score === bestScore && score > 0) best.push(id);
  }
  if (bestScore < known.length && known.length > 0) report.partial.push(`"${english}" matched ${bestScore} of ${known.length}`);
  return best;
}

/** Each language's distinct texts for these ids (first id first). */
const textsIn = (language, ids) => [...new Set(ids.map((id) => clean(fm[language][id])).filter(isPlain))];

function readHeader(file) {
  const full = path.join(FIXTURES, file);
  if (!fs.existsSync(full)) return null;
  const first = fs.readFileSync(full, "utf8").replace(/^﻿/, "").split(/\r?\n/)[0];
  const delimiter = [";", ",", "\t"].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  return first.split(delimiter).map((h) => h.replace(/^"|"$/g, "").trim());
}

const report = { unpinned: [], notFound: [], shared: [], partial: [] };

/**
 * A mapping per language, local text → English. `entries` is [english, ids, pinned], in order (a
 * view's column order, a rating scale from low to high). When one local text stands for several
 * English values, pinned ones beat unpinned ones; for headers all that remain are kept, in order (an
 * export with that header twice has the columns in that order); for values the first one wins.
 */
function build(kind, entries, { key = (s) => s, value = (s) => s, ordered = false } = {}) {
  const out = Object.fromEntries(languages.map((l) => [l, {}]));
  for (const language of languages) {
    const claims = new Map();
    for (const [english, ids, pinned] of entries) {
      for (const text of textsIn(language, ids)) {
        const k = key(text);
        if (!k) continue;
        const list = claims.get(k) ?? [];
        const v = value(english);
        if (!list.some((c) => c.value === v)) list.push({ value: v, pinned });
        claims.set(k, list);
      }
    }
    for (const [k, list] of claims) {
      const pinned = list.filter((c) => c.pinned);
      const kept = (pinned.length ? pinned : list).map((c) => c.value);
      if (kept.length > 1) report.shared.push(`${kind} ${language}: "${k}" is ${kept.join(" / ")}`);
      out[language][k] = ordered && kept.length > 1 ? kept : kept[0];
    }
  }
  return out;
}

// Headers: pinned from the English and local exports of the same views, then the other English headers.
const headerEntries = [];
const englishHeaders = new Set();
/**
 * Which views each English header is in. One local word can be two columns in different views
 * (Norwegian "Mot" is Bravery for players, Motivating for staff), so the parser picks by view.
 */
const views = {};
const view = (file) => (file.includes("staff") ? "staff" : file.includes("squad") ? "squad" : "players");
/**
 * Each view's columns in order. FM uses one word for two columns of a view sometimes (German
 * "Fähigkeit" is the Squad view's Ability stars and CA): the parser gives them out in this order.
 */
const COLUMN_FILES = { players: "attribute-fm27-hidden.csv", squad: "squad-hidden.csv", staff: "staff.csv" };
const columns = Object.fromEntries(Object.entries(COLUMN_FILES).map(([v, file]) => [v, [...new Set(readHeader(file).map(norm))]]));
const addView = (h, v) => {
  const list = (views[norm(h)] ??= []);
  if (!list.includes(v)) list.push(v);
};
for (const file of ANCHORED_EXPORTS) {
  const english = readHeader(file);
  const local = Object.fromEntries(
    Object.entries(LOCAL_FIXTURES)
      .map(([folder, language]) => [language, readHeader(`${folder}/${file}`)])
      .filter(([, heads]) => heads !== null),
  );
  for (const [language, heads] of Object.entries(local)) {
    if (heads.length !== english.length) throw new Error(`${language} ${file} has different columns from the English one`);
  }
  english.forEach((h, i) => {
    englishHeaders.add(norm(h));
    addView(h, view(file));
    const locals = Object.fromEntries(Object.entries(local).map(([language, heads]) => [language, heads[i]]));
    const ids = pinnedIds(h, locals);
    // A header FM has no string for is written in English by the exporter whatever the language ("Unique ID").
    if (ids.length > 0) headerEntries.push([h, ids, true]);
    else if (Object.values(locals).some((t) => t !== h)) report.notFound.push(`header "${h}" / ${JSON.stringify(locals)}`);
  });
}
for (const file of OTHER_EXPORTS) {
  for (const h of readHeader(file)) {
    addView(h, view(file));
    if (englishHeaders.has(norm(h))) continue;
    englishHeaders.add(norm(h));
    if (SQUAD_HEADERS[h]) {
      const ids = pinnedIds(h, SQUAD_HEADERS[h]);
      if (ids.length > 0) {
        headerEntries.push([h, ids, true]);
        continue;
      }
    }
    const ids = idsFor(h);
    if (ids.length === 0) report.notFound.push(`header "${h}"`);
    else {
      headerEntries.push([h, ids, false]);
      report.unpinned.push(h);
    }
  }
}
const headers = build("header", headerEntries, { key: norm, value: norm, ordered: true });

const pinnedWords = (kind, words) =>
  Object.entries(words).map(([english, locals]) => {
    const ids = pinnedIds(english, locals);
    if (ids.length === 0) report.notFound.push(`${kind} "${english}" / ${JSON.stringify(locals)}`);
    return [english, ids, true];
  });
const ratings = build("rating", pinnedWords("rating", RATINGS));
const yesNo = build("yes/no", pinnedWords("yes/no", YES_NO));
const upper = (s) => s.trim().toUpperCase();
const roles = build("role", pinnedWords("role", ROLES), { key: upper });
const sides = build("side", pinnedWords("side", SIDES), { key: upper });
const statuses = build(
  "status",
  [...pinnedWords("status", STATUSES), ...OTHER_STATUSES.map((s) => [s, idsFor(s), false])],
  { key: (s) => s.trim().toLowerCase() },
);
/**
 * What a local export or screenshot shows is FM's text for that language, whichever FM string it
 * matched: add it as it is, over FM's strings (statuses here; headers below).
 */
for (const [english, locals] of Object.entries(STATUSES)) {
  for (const [language, text] of Object.entries(locals)) statuses[language][text.trim().toLowerCase()] = english;
}
for (const [english, locals] of Object.entries(SQUAD_HEADERS)) {
  for (const [language, text] of Object.entries(locals)) {
    const target = headers[language][norm(text)];
    const value = norm(english);
    // A word that is already another column too stays a list (German "Fähigkeit" is CA and Ability).
    if (target === undefined) headers[language][norm(text)] = value;
    else if (Array.isArray(target)) { if (!target.includes(value)) target.push(value); }
    else if (target !== value) headers[language][norm(text)] = [target, value];
  }
}

const info = build(
  "info",
  INFO_CODES.map((code) => [code, idsFor(code), true]),
  { key: (s) => s.trim() },
);
const naIds = pinnedIds(...NA);
const na = Object.fromEntries(languages.map((l) => [l, textsIn(l, naIds).filter((t) => t !== "N/A")]));

/** Money: the unit suffixes and the wage-period wording, per language. */
const unitIds = [
  ...Object.entries(UNITS).map(([unit, locals]) => [unit, pinnedIds(unit, locals)]),
  ...Object.entries(MULTIPLIERS).map(([english, [factor, locals]]) => [factor, pinnedIds(english, locals), english]),
];
const periodIds = Object.entries(PERIODS).map(([period, [english, locals]]) => [
  period,
  Object.keys(locals).length ? pinnedIds(english, locals) : idsFor(english),
]);
const money = {};
for (const language of languages) {
  const units = [];
  for (const [unit, ids, english] of unitIds) {
    for (const text of textsIn(language, ids)) {
      const t = text.trim();
      if (english && !MULTIPLIER_LANGUAGES.has(language)) continue;
      if (t && t !== unit) units.push([t, unit]);
    }
  }
  const periods = [];
  for (const [period, ids] of periodIds) {
    // Templates ("[%cash#1]/W."), so not filtered like plain terms.
    for (const text of new Set(ids.map((id) => fm[language][id]).filter((t) => t?.includes("[%cash#1]")))) {
      const [before, after] = text.split("[%cash#1]");
      if (before.trim()) periods.push({ text: before.trim(), period, prefix: true });
      if (after.trim() && after.trim() !== period) periods.push({ text: after.trim(), period, prefix: false });
    }
  }
  if (units.length || periods.length) money[language] = { units, periods };
}

const terms = {};
for (const language of languages) {
  const entry = {
    headers: headers[language],
    ratings: ratings[language],
    yesNo: yesNo[language],
    na: na[language],
    roles: roles[language],
    sides: sides[language],
    statuses: statuses[language],
    info: info[language],
    money: money[language] ?? { units: [], periods: [] },
  };
  // Only what differs from English is useful.
  for (const k of ["headers", "ratings", "yesNo", "roles", "sides", "statuses", "info"]) {
    entry[k] = Object.fromEntries(Object.entries(entry[k]).filter(([local, english]) => local !== english));
  }
  terms[language] = entry;
}

const out = {
  _comment: "Generated by scripts/fm-terms/build-export-terms.mjs from Football Manager's language files. Do not edit.",
  englishHeaders: [...englishHeaders].sort(),
  views,
  columns,
  languages: terms,
};
fs.writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);

console.log(`Wrote ${path.relative(ROOT, OUT)} (${languages.length} languages).`);
if (report.notFound.length) console.log(`Not in FM's strings:\n  ${report.notFound.join("\n  ")}`);
if (report.partial.length) console.log(`Pinned by some local exports only:\n  ${report.partial.join("\n  ")}`);
if (report.unpinned.length) console.log(`Headers without a local export to pin them: ${report.unpinned.join(", ")}`);
if (report.shared.length) {
  console.log(`One word for several things (headers go by column order, values take the first):\n  ${report.shared.join("\n  ")}`);
}
