/**
 * Fills packages/ui/i18n/messages/<locale>/fm.json with Football Manager's official translations of
 * the English terms in en/fm.json, read from your FM install. Run after adding a term to en/fm.json:
 *
 *   node scripts/fm-terms/build-fm-messages.mjs
 *
 * Each English value is looked up in FM's English strings (exact, then case-insensitive). Where our
 * wording differs from FM's, SOURCES gives the FM English to look up instead (candidates, first
 * found wins), or builds the value from several FM terms. Terms FM doesn't have are listed at the
 * end and keep any translation already in the file; translate those by hand. Keys listed for a
 * locale in manual.json (next to this script) are hand-translated and never overwritten.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FM_LANGUAGE, cleanFmText, loadFmStrings, translateTerm } from "./fmf.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MESSAGES = path.join(ROOT, "packages", "ui", "i18n", "messages");

/**
 * FM's English for terms we word differently. A string array lists candidates; `parts` + `format`
 * joins several FM terms ({0}, {1}, ...).
 */
const SOURCES = {
  "attributes.rushingOutTendency": ["Rushing Out (Tendency)"],
  "attributes.punching": ["Punching (Tendency)"],
  "attributes.teamWork": ["Teamwork"],
  "attributes.currentAbility": ["Current Ability", "CA"],
  "attributes.potentialAbility": ["Potential Ability", "PA"],
  "staffAttributes.setPieces": ["Set Pieces"],
  "staffAttributes.tacticalCoaching": ["Tactical"],
  "staffAttributes.workingWithYoungsters": ["Working With Youngsters"],
  "staffAttributes.authority": ["Discipline", "Authority"],
  "staffAttributes.manManagement": ["Man Management", "People Management"],
  "staffAttributes.judgingCurrentAbility": ["Judging Player Ability", "Judging Ability"],
  "staffAttributes.judgingPotentialAbility": ["Judging Player Potential", "Judging Potential"],
  "staffAttributes.judgingStaffAbility": ["Judging Staff Ability"],
  "staffAttributes.tacticalKnowledge": ["Tactical Knowledge"],
  "staffAttributes.analysingData": ["Analysing Data", "Data Analysis"],
  "staffAttributes.sportsScience": ["Sports Science"],
  "staffRoles.assistant-manager": ["Assistant Manager"],
  "staffRoles.director-of-football": ["Director of Football"],
  "staffRoles.head-of-youth": ["Head of Youth Development"],
  "staffRoles.coach-goalkeeping": ["Goalkeeping Coach"],
  "staffRoles.coach-fitness": ["Fitness Coach"],
  "staffRoles.coach-set-pieces": ["Set Piece Coach", "Set Pieces Coach"],
  "staffRoles.performance-analyst": ["Performance Analyst"],
  "staffRoles.sports-scientist": ["Sports Scientist"],
  "fm27Roles.fm27-cb": ["Centre-Back", "Centre Back"],
  "fm27Roles.fm27-wb": { parts: [["Full-Back", "Full Back"], ["Wing-Back", "Wing Back"]], format: "{0} / {1}" },
  "fm27Roles.fm27-dm": { parts: [["Defensive Midfielder"], ["Central Midfielder"]], format: "{0} / {1}" },
  "fm27Roles.fm27-10": { parts: [["Attacker"], ["Winger"]], format: "{0} / {1} (10)" },
  "fm27Roles.fm27-9": { parts: [["Striker"]], format: "{0} (9)" },
  "trainingSchedules.noTraining": ["No Training"],
  "trainingSchedules.defensiveX3": { parts: [["Defensive Ball Work"]], format: "{0} x3" },
  "trainingSchedules.attackingX3": { parts: [["Attacking Ball Work"]], format: "{0} x3" },
  "trainingSchedules.conditioningDefensive": {
    parts: [["Conditioning"], ["Defensive Ball Work"]],
    format: "{0} + {1}",
  },
  "trainingSchedules.conditioningAttacking": {
    parts: [["Conditioning"], ["Attacking Ball Work"]],
    format: "{0} + {1}",
  },
  "trainingSchedules.lightConditioningConditioningAttackingDefensive": {
    parts: [["Light Conditioning"], ["Conditioning"], ["Attacking Ball Work"], ["Defensive Ball Work"]],
    format: "{0} + {1} + {2} + {3}",
  },
  "coachingGroups.setPieces": ["Set Pieces"],
  "backroomSets.coaching": ["Coaching Staff"],
  "backroomSets.medical": ["Medical Team", "Medical"],
  "backroomSets.recruitment": ["Recruitment Team", "Recruitment"],
  "terms.transferValue": ["Transfer Value"],
  "terms.squadStatus": ["Squad Status"],
  "terms.firstTeam": ["First Team"],
  "terms.bestXi": ["Best XI"],
};

/** Staff column abbreviations: FM keeps an abbreviation next to its full name in the string table. */
const ABBREVIATIONS = { group: "staffAttributeAbbr", fullGroup: "staffAttributes" };

/** { [locale]: dotted keys translated by hand, which the generator keeps as they are }. */
const MANUAL_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "manual.json");

const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {});

function leaves(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? leaves(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]],
  );
}

function setPath(obj, dotted, value) {
  const keys = dotted.split(".");
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] ??= {};
  o[keys.at(-1)] = value;
}

const getPath = (obj, dotted) => dotted.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

function firstFound(fm, candidates) {
  for (const c of candidates) {
    const t = translateTerm(fm, c);
    if (t) return t;
  }
  return null;
}

/** Same capitalisation style as our English: FM capitalises Every Word, we often don't. */
function matchCase(english, fmEnglish, translated, locale) {
  // German capitalises nouns; Korean has no case. Leave both as FM wrote them.
  if (locale === "de" || locale === "ko" || !translated) return translated;
  const sentenceCase = english.split(" ").slice(1).some((w) => /^[a-z]/.test(w));
  const fmTitleCase = fmEnglish.split(" ").slice(1).every((w) => !/^[a-z]/.test(w));
  if (sentenceCase && fmTitleCase) {
    return translated
      .split(" ")
      .map((w, i) => (i === 0 ? w : w.toLowerCase()))
      .join(" ");
  }
  return translated;
}

/**
 * The staff view's real column abbreviations: exports of the view from an English and a German (and
 * French...) FM have the same columns, so the FM string whose English and local texts all match a
 * column's headers is the one FM prints there. { English abbreviation: { de: ..., fr: ... } }.
 */
const LOCAL_FIXTURES = { de: "de", fr: "fr", it: "it", da: "da", sv: "sv", nb: "nb", ko: "ko", es: "es" };
function staffViewAbbreviations() {
  const header = (file) => {
    const full = path.join(ROOT, "packages", "core", "fixtures", file);
    if (!fs.existsSync(full)) return null;
    const first = fs.readFileSync(full, "utf8").replace(/^﻿/, "").split(/\r?\n/)[0];
    return first.split(first.includes(";") ? ";" : ",").map((h) => h.trim());
  };
  const en = header("staff.csv");
  const locals = Object.entries(LOCAL_FIXTURES)
    .map(([locale, folder]) => [locale, header(`${folder}/staff.csv`)])
    .filter(([, heads]) => heads !== null);
  return Object.fromEntries(en.map((h, i) => [h, Object.fromEntries(locals.map(([locale, heads]) => [locale, heads[i]]))]));
}
const STAFF_VIEW = staffViewAbbreviations();

/** FM's abbreviation as the staff view prints it, pinned by the English and local exports. */
function translateStaffViewAbbreviation(fm, abbr) {
  const locals = Object.entries(STAFF_VIEW[abbr] ?? {});
  if (locals.length === 0) return null;
  let best = null;
  let bestScore = 0;
  for (const id of Object.keys(fm.en).filter((i) => fm.en[i] === abbr)) {
    const score = locals.filter(([locale, text]) => cleanFmText(fm[locale][id]) === text).length;
    if (score > bestScore) [best, bestScore] = [id, score];
  }
  return best === null ? null : Object.fromEntries(Object.keys(FM_LANGUAGE).map((l) => [l, cleanFmText(fm[l][best]) ?? null]));
}

/** Find FM's abbreviation for a full term: the neighbouring string ID that holds `abbr` in English. */
function translateAbbreviation(fm, abbr, fullCandidates) {
  const en = fm.en;
  const lowered = fullCandidates.map((c) => c.toLowerCase());
  for (const id of Object.keys(en)) {
    if (typeof en[id] !== "string" || !lowered.includes(en[id].toLowerCase())) continue;
    for (const delta of [-1, 1]) {
      const near = Number(id) + delta;
      if (en[near] !== abbr) continue;
      return Object.fromEntries(Object.keys(FM_LANGUAGE).map((l) => [l, fm[l][near] ?? null]));
    }
  }
  return null;
}

const fm = loadFmStrings();
const manualKeys = readJson(MANUAL_FILE);
const english = readJson(path.join(MESSAGES, "en", "fm.json"));
const missing = new Map();

for (const locale of Object.keys(FM_LANGUAGE)) {
  if (locale === "en") continue;
  const file = path.join(MESSAGES, locale, "fm.json");
  const existing = readJson(file);
  const manual = new Set(manualKeys[locale] ?? []);
  const out = {};

  for (const [key, value] of leaves(english)) {
    const keep = getPath(existing, key);
    if (manual.has(key)) {
      setPath(out, key, keep);
      continue;
    }

    let translated = null;
    const group = key.split(".")[0];
    if (group === ABBREVIATIONS.group) {
      const fullKey = `${ABBREVIATIONS.fullGroup}.${key.split(".").slice(1).join(".")}`;
      const source = SOURCES[fullKey];
      const candidates = [...(Array.isArray(source) ? source : []), getPath(english, fullKey)];
      translated =
        translateStaffViewAbbreviation(fm, value)?.[locale] ?? translateAbbreviation(fm, value, candidates)?.[locale] ?? null;
    } else {
      const source = SOURCES[key] ?? [value];
      if (Array.isArray(source)) {
        const found = firstFound(fm, [...source, value]);
        const fmEnglish = found?.en ?? value;
        translated = found ? matchCase(value, fmEnglish, found[locale], locale) : null;
      } else {
        const parts = source.parts.map((candidates) => firstFound(fm, candidates)?.[locale] ?? null);
        if (parts.every(Boolean)) translated = source.format.replace(/\{(\d)\}/g, (_, i) => parts[Number(i)]);
      }
    }

    // FM sometimes stores a term in lower case for use mid-sentence ("jeune prodige"); our values
    // are labels, so they start with a capital when the English does.
    if (translated && locale !== "ko" && /^\p{Lu}/u.test(value)) {
      translated = translated.charAt(0).toLocaleUpperCase(locale) + translated.slice(1);
    }
    if (translated) setPath(out, key, translated);
    else {
      if (keep !== undefined) setPath(out, key, keep);
      missing.set(key, [...(missing.get(key) ?? []), locale]);
    }
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
}

if (missing.size) {
  console.log("Not in FM's strings (translate by hand, then list the key under its locale in manual.json):");
  for (const [key, locales] of missing) console.log(`  ${key}: ${locales.join(", ")}`);
} else {
  console.log("All terms found in FM's strings.");
}
