import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import TERMS from "./export-terms.json";
import { parsePlayersCsv } from "./csv-parser";
import { csvLines, detectDelimiter, splitCsvLine } from "./csv-utils";
import { detectExportLanguage, englishExport, englishMoney, englishPicked, englishPosition, headerKey } from "./export-locale";
import { parseStaffCsv } from "../staff/staff-parser";
import { isPickedToStart, parseSquadFields, statusTier } from "../squad/squad-fields";
import { parsePositionSlots } from "../position-slots";
import { parseTransferValue, parseWeeklyWage } from "../best-xi/money";

const FIXTURES = join(import.meta.dirname, "..", "fixtures");
const fixture = (name: string) => readFileSync(join(FIXTURES, name), "utf8");
type Terms = {
  headers: Record<string, string | string[]>;
  ratings: Record<string, string>;
  statuses: Record<string, string>;
  roles: Record<string, string>;
  sides: Record<string, string>;
};
const LANGUAGES = (TERMS as unknown as { languages: Record<string, Terms> }).languages;

test("English exports come back unchanged", () => {
  for (const name of ["attribute.csv", "attribute-fm27.csv", "attribute-fm27-hidden.csv", "squad.csv", "squad-hidden.csv", "staff.csv"]) {
    const csv = fixture(name);
    assert.equal(detectExportLanguage(splitCsvLine(csvLines(csv)[0], detectDelimiter(csvLines(csv)[0]))), null, name);
    assert.equal(englishExport(csv), csv, name);
  }
});

/** Real exports of the same save from FM in German, French, Spanish, Italian, Danish, Swedish, Norwegian and Korean (fixtures/de, /fr, …, /ko). */
for (const folder of ["de", "fr", "es", "it", "da", "sv", "nb", "ko"]) {
  test(`a ${folder} player export (FM27, Hidden Attributes view) reads like an English one`, () => {
    const players = parsePlayersCsv(fixture(`${folder}/attribute-fm27-hidden.csv`));
    assert.equal(players.length, 58);
    for (const p of players) {
      assert.ok(p.player, "name");
      assert.ok(p.currentAbility && p.potentialAbility, `${p.player} CA/PA`);
      assert.ok(p.finishing > 0 && p.pace > 0 && p.decisions > 0 && p.handling > 0, `${p.player} attributes`);
      assert.ok(parsePositionSlots(p.position).length > 0, `${p.player} position "${p.position}"`);
    }
    const seth = players.find((p) => p.player === "Seth Beekink")!;
    assert.equal(seth.position, "M (C), AM (LC)");
    assert.equal(seth.currentAbility, 101);
    assert.equal(seth.professionalism, 15);
    assert.equal(seth.crossing, 9);
    assert.equal(seth.aerialReach, 2);
    assert.equal(seth.euNational, true);
    assert.equal(parseWeeklyWage(seth.wage), 675);
    assert.deepEqual(parseTransferValue(seth.transferValueRange), { kind: "range", low: 140_000, high: 1_400_000 });
  });

  test(`a ${folder} staff export reads its rating words and headers`, () => {
    const { staff, isStaffExport, columns } = parseStaffCsv(fixture(`${folder}/staff.csv`));
    assert.equal(isStaffExport, true);
    assert.equal(columns.length, 22);
    assert.equal(staff.length, 40);
    const edu = staff.find((s) => s.name === "Edu Antequera")!;
    assert.equal(edu.uniqueId, "2000583973");
    assert.equal(edu.euNational, true);
    assert.equal(edu.attributes.judgingStaffAbility?.band?.word, "Average");
    assert.equal(edu.attributes.judgingPotentialAbility?.band?.word, "Reasonable");
    assert.equal(edu.attributes.judgingCurrentAbility?.band?.word, "Competent");
    assert.equal(edu.attributes.manManagement?.band?.word, "Very Good");
    assert.equal(edu.attributes.goalkeeping?.band?.word, "Unsuited");
    for (const s of staff) {
      for (const key of columns) assert.notEqual(s.attributes[key], null, `${s.name} ${key}`);
    }
  });
}

for (const folder of ["fr", "es", "it", "da", "sv", "nb", "ko"]) {
  test(`the German and the ${folder} export of the same save read the same`, () => {
    // Shown as exported (foot words, an unknown expiry is "?" in German, "N/A" in French), and FM
    // gave one transfer value range differently between the exports. Wages are compared as amounts,
    // within 1%: Norwegian writes "€1.300 p/w" where German writes "€1.3K p/w", and Korean rounds
    // "€14.75K" to "€1.47만" (€14,700).
    const display = (p: ReturnType<typeof parsePlayersCsv>[number]) => ({
      ...p,
      rightFoot: "",
      leftFoot: "",
      expires: "",
      transferValueRange: null,
      wage: null,
    });
    const de = new Map(parsePlayersCsv(fixture("de/attribute-fm27-hidden.csv")).map((p) => [p.uniqueId, p]));
    let compared = 0;
    for (const p of parsePlayersCsv(fixture(`${folder}/attribute-fm27-hidden.csv`))) {
      const other = de.get(p.uniqueId);
      if (!other) continue;
      compared++;
      assert.deepEqual(display(p), display(other), p.player);
      const [wage, germanWage] = [parseWeeklyWage(p.wage), parseWeeklyWage(other.wage)];
      if (wage === null || germanWage === null) assert.equal(wage, germanWage, `${p.player} wage`);
      else assert.ok(Math.abs(wage - germanWage) <= germanWage * 0.01, `${p.player} wage ${p.wage} / ${other.wage}`);
    }
    assert.equal(compared, 57);

    const deStaff = new Map(parseStaffCsv(fixture("de/staff.csv")).staff.map((s) => [s.uniqueId, s]));
    for (const s of parseStaffCsv(fixture(`${folder}/staff.csv`)).staff) {
      for (const [key, rating] of Object.entries(s.attributes)) {
        const german = deStaff.get(s.uniqueId)!.attributes[key as keyof typeof s.attributes];
        // French FM writes Outstanding and Elite both as "Exceptionnel": read as Outstanding.
        const word = folder === "fr" && german?.band?.word === "Elite" ? "Outstanding" : german?.band?.word;
        assert.equal(rating?.band?.word, word, `${s.name} ${key}`);
      }
    }
  });
}

for (const folder of ["es", "ko"]) {
  test(`transfer values read the same in the ${folder} money format`, () => {
    // The French, Spanish and Korean exports were made minutes apart, so FM gave the same ranges:
    // "€12M - €14.5M", "€140m - €1.4M" (Spanish m is thousands) and "€1.200만 - €1.450만" (ten
    // thousands, with a thousands dot) must be the same amounts.
    const french = new Map(parsePlayersCsv(fixture("fr/attribute-fm27-hidden.csv")).map((p) => [p.uniqueId, p]));
    const players = parsePlayersCsv(fixture(`${folder}/attribute-fm27-hidden.csv`));
    assert.equal(players.length, 58);
    for (const p of players) {
      assert.deepEqual(
        parseTransferValue(p.transferValueRange),
        parseTransferValue(french.get(p.uniqueId)!.transferValueRange),
        `${p.player}: ${p.transferValueRange}`,
      );
    }
  });
}

test("positions and money in other languages", () => {
  const fr = { roles: { GB: "GK", MO: "AM", BT: "ST", MD: "DM" }, sides: { D: "R", G: "L" } };
  assert.equal(englishPosition("MO (DG), BT (C)", fr), "AM (RL), ST (C)");
  assert.equal(englishPosition("D/MD (C)", fr), "D/DM (C)");
  assert.equal(englishPosition("GB", fr), "GK");

  const es = { units: [["m", "K"], ["Mil.M", "B"]] as [string, string][], periods: [{ text: "p/s", period: "p/w", prefix: false }] };
  assert.equal(englishMoney("€140m - €1,4M", es), "€140K - €1,4M");
  assert.equal(englishMoney("€3,5m p/s", es), "€3,5K p/w");
  const ko = { units: [["천", "K"]] as [string, string][], periods: [{ text: "주급", period: "p/w", prefix: true }] };
  assert.equal(englishMoney("주급 €3천", ko), "€3K p/w");
  const koMyriad = {
    units: [["천", "K"], ["백만", "M"], ["만", "10000"], ["억", "100000000"]] as [string, string][],
    periods: [{ text: "주급", period: "p/w", prefix: true }],
  };
  assert.equal(englishMoney("€14만 - €140만", koMyriad), "€140K - €1.4M");
  assert.equal(englishMoney("주급 €1.47만", koMyriad), "€14.7K p/w");
  assert.equal(englishMoney("€3백만", koMyriad), "€3M");
  assert.equal(englishMoney("€1.2억", koMyriad), "€120M");
  // A dot before exactly three digits groups thousands: 1,200 × 10,000.
  assert.equal(englishMoney("€1.200만 - €1.450만", koMyriad), "€12M - €14.5M");
  assert.equal(englishMoney("€5000 - €5.5만", koMyriad), "€5000 - €55K");
  const de = { units: [["Mio.", "M"]] as [string, string][], periods: [{ text: "/W.", period: "p/w", prefix: false }] };
  assert.equal(englishMoney("€1.5Mio. – €3Mio.", de), "€1.5M - €3M");
  assert.equal(parseWeeklyWage(englishMoney("€3K/W.", de)), 3000);
});

/**
 * Every FM language: the English fixtures with their headers (and staff ratings) written the way FM
 * writes them in that language must parse to exactly what the English ones do.
 */
function localise(csv: string, language: string, ratings: boolean): string {
  const terms = LANGUAGES[language];
  const local = new Map<string, string[]>();
  for (const [word, english] of Object.entries(terms.headers)) {
    for (const e of [english].flat()) local.set(e, [...(local.get(e) ?? []), word]);
  }
  const rating = new Map(ratings ? Object.entries(terms.ratings).map(([word, english]) => [english, word]) : []);
  const lines = csvLines(csv);
  const delimiter = detectDelimiter(lines[0]);
  const header = splitCsvLine(lines[0], delimiter).map((h) => local.get(headerKey(h))?.[0] ?? h);
  const rows = lines.slice(1).map((l) => splitCsvLine(l, delimiter).map((c) => rating.get(c) ?? c));
  const quote = (c: string) => (c.includes(delimiter) ? `"${c}"` : c);
  return [header, ...rows].map((r) => r.map(quote).join(delimiter)).join("\n");
}

for (const language of Object.keys(LANGUAGES)) {
  test(`${language}: an export with FM's ${language} headers reads like the English one`, () => {
    const players = fixture("attribute-fm27-hidden.csv");
    const localPlayers = localise(players, language, false);
    if (localPlayers.split("\n")[0] !== players.split(/\r?\n/)[0].replace(/^﻿/, "")) {
      // Money is left out: the English amounts ("€1.8M") are not how another language writes them
      // (in Indonesian "M" is billions); englishMoney is tested above.
      const withoutMoney = (csv: string) =>
        parsePlayersCsv(csv).map((p) => ({ ...p, wage: null, transferValueRange: null }));
      assert.deepEqual(withoutMoney(localPlayers), withoutMoney(players));
    }
    const staff = fixture("staff.csv");
    assert.deepEqual(parseStaffCsv(localise(staff, language, true)).staff, parseStaffCsv(staff).staff);
  });
}

/**
 * FM's Squad screen in each language (screenshots of the same squad): positions, the Picked column's
 * bench spots and the squad statuses as FM shows them, and what they are in English.
 */
const SQUAD_SCREEN: Record<string, { positions: [string, string][]; bench: string[]; statuses: [string, string][] }> = {
  Dansk: {
    positions: [["Mm", "GK"], ["F/WB (H)", "D/WB (R)"], ["F (VC)", "D (LC)"], ["F/WB/M (V)", "D/WB/M (L)"], ["OM (H)", "AM (R)"], ["An (C)", "ST (C)"], ["M/OM (HV)", "M/AM (RL)"]],
    bench: ["U"],
    statuses: [["Vigtig spiller", "Important Player"], ["Stjernespiller", "Star Player"], ["Udkantsspiller", "Fringe Player"], ["Banebrydende talent", "Breakthrough Prospect"], ["Pokalmålmand", "Cup Goalkeeper"], ["Trupspiller", "Squad Player"], ["Fremtidigt talent", "Future Prospect"]],
  },
  Deutsch: {
    positions: [["TW", "GK"], ["V/FV (R)", "D/WB (R)"], ["V (LZ)", "D (LC)"], ["V/FV/M (L)", "D/WB/M (L)"], ["OM (R)", "AM (R)"], ["ST (Z)", "ST (C)"], ["M/OM (RL)", "M/AM (RL)"]],
    bench: ["E1", "E15"],
    statuses: [["Schlüsselspieler", "Important Player"], ["Starspieler", "Star Player"], ["Ergänzungsspieler", "Fringe Player"], ["Talent vor Durchbruch", "Breakthrough Prospect"], ["Pokaltorhüter", "Cup Goalkeeper"], ["Rotationsspieler", "Squad Player"], ["Perspektivspieler", "Future Prospect"], ["Verliehen", "Out On Loan"]],
  },
  Español: {
    positions: [["POR", "GK"], ["DF/CR (D)", "D/WB (R)"], ["DF (IC)", "D (LC)"], ["MC", "DM"], ["MP (D)", "AM (R)"], ["DL (C)", "ST (C)"], ["ME/MP (DI)", "M/AM (RL)"]],
    bench: ["S1"],
    statuses: [["Jugador importante", "Important Player"], ["Jugador estrella", "Star Player"], ["Jugador secundario", "Fringe Player"], ["Jugador de plantilla", "Squad Player"], ["Futura promesa", "Future Prospect"]],
  },
  Français: {
    positions: [["GB", "GK"], ["D/AL (D)", "D/WB (R)"], ["D (GC)", "D (LC)"], ["MD", "DM"], ["MO (D)", "AM (R)"], ["BT (C)", "ST (C)"], ["M/MO (DG)", "M/AM (RL)"]],
    bench: ["R1", "R7"],
    statuses: [["Joueur important", "Important Player"], ["Joueur Vedette", "Star Player"], ["Joueur secondaire", "Fringe Player"], ["Gardien en coupe", "Cup Goalkeeper"], ["Joueur de rotation", "Squad Player"], ["Joueur prometteur", "Future Prospect"]],
  },
  Italiano: {
    positions: [["Por", "GK"], ["D/Est (D)", "D/WB (R)"], ["D (SC)", "D (LC)"], ["M", "DM"], ["T (D)", "AM (R)"], ["P (C)", "ST (C)"], ["M, C (C)", "DM, M (C)"], ["C/T (DS)", "M/AM (RL)"]],
    bench: ["S1"],
    statuses: [["Giocatore importante", "Important Player"], ["Stella", "Star Player"], ["Giocatore marginale", "Fringe Player"], ["Potenziale campione", "Breakthrough Prospect"], ["Portiere di coppa", "Cup Goalkeeper"], ["Elemento della rosa", "Squad Player"], ["Giovane promessa", "Future Prospect"], ["Fuori in prestito", "Out On Loan"]],
  },
  Norsk: {
    positions: [["KEE", "GK"], ["F/VB (H)", "D/WB (R)"], ["F (VS)", "D (LC)"], ["OM (H)", "AM (R)"], ["SP (S)", "ST (C)"], ["DM, M (S)", "DM, M (C)"], ["M/OM (HV)", "M/AM (RL)"]],
    bench: ["R1"],
    statuses: [["Viktig spiller", "Important Player"], ["Stjernespiller", "Star Player"], ["Perifer spiller", "Fringe Player"], ["Gjennombruddstalent", "Breakthrough Prospect"], ["Cupkeeper", "Cup Goalkeeper"], ["Stallspiller", "Squad Player"], ["Framtidstalent", "Future Prospect"], ["På utlån", "Out On Loan"]],
  },
  Svenska: {
    positions: [["Mål", "GK"], ["B/YB (H)", "D/WB (R)"], ["B (VC)", "D (LC)"], ["OM (H)", "AM (R)"], ["A (C)", "ST (C)"], ["M/OM (HV)", "M/AM (RL)"]],
    bench: ["A1"],
    statuses: [["Viktig spelare", "Important Player"], ["Stjärnspelare", "Star Player"], ["Rotationsspelare", "Fringe Player"], ["Genombrottslöfte", "Breakthrough Prospect"], ["Cupmålvakt", "Cup Goalkeeper"], ["Truppmedlem", "Squad Player"], ["Framtidslöfte", "Future Prospect"], ["Utlånad", "Out On Loan"]],
  },
  한국어: {
    positions: [["GK", "GK"], ["D/WB (R)", "D/WB (R)"], ["AM (LC)", "AM (LC)"], ["ST (C)", "ST (C)"]],
    bench: ["S1"],
    statuses: [["중요 선수", "Important Player"], ["인기 선수", "Star Player"], ["비주전 선수", "Fringe Player"], ["눈부신 유망주", "Breakthrough Prospect"], ["컵 골키퍼", "Cup Goalkeeper"], ["선수단 선수", "Squad Player"], ["미래의 유망주", "Future Prospect"], ["임대 중", "Out On Loan"]],
  },
};

for (const [language, screen] of Object.entries(SQUAD_SCREEN)) {
  test(`${language}: positions, bench spots and squad statuses as FM's Squad screen shows them`, () => {
    const terms = LANGUAGES[language];
    for (const [shown, english] of screen.positions) {
      assert.equal(englishPosition(shown, terms), english, shown);
      // Picked at a position: a position, and a starter.
      const picked = englishPicked(shown.split(",")[0].trim(), terms);
      assert.ok(isPickedToStart({ picked } as never), `${shown} is a starter`);
    }
    for (const spot of screen.bench) {
      const picked = englishPicked(spot, terms);
      assert.match(picked, /^S\d*$/, spot);
      assert.ok(!isPickedToStart({ picked } as never), `${spot} is the bench`);
    }
    for (const [shown, english] of screen.statuses) {
      assert.equal(terms.statuses[shown.toLowerCase()], english, shown);
      assert.equal(statusTier(terms.statuses[shown.toLowerCase()]), statusTier(english), shown);
    }
  });
}

/** The English Squad export with FM's headers and squad statuses in `language`. */
function localiseSquad(csv: string, language: string): string {
  const terms = LANGUAGES[language];
  const invert = (map: Record<string, string | string[]>) => {
    const out = new Map<string, string>();
    for (const [word, english] of Object.entries(map)) for (const e of [english].flat()) if (!out.has(e)) out.set(e, word);
    return out;
  };
  const header = invert(terms.headers);
  const status = invert(terms.statuses);
  const lines = csvLines(csv);
  const delimiter = detectDelimiter(lines[0]);
  const heads = splitCsvLine(lines[0], delimiter);
  const playingTime = heads.findIndex((h) => headerKey(h) === "playingtime");
  const rows = lines.slice(1).map((l) =>
    splitCsvLine(l, delimiter).map((c, i) => (i === playingTime ? (status.get(c.toLowerCase()) ?? c) : c)),
  );
  const quote = (c: string) => (c.includes(delimiter) ? `"${c}"` : c);
  return [heads.map((h) => header.get(headerKey(h)) ?? h), ...rows].map((r) => r.map(quote).join(delimiter)).join("\n");
}

for (const language of Object.keys(LANGUAGES)) {
  test(`${language}: a Squad export with FM's ${language} headers and statuses reads like the English one`, () => {
    for (const name of ["squad.csv", "squad-hidden.csv"]) {
      const english = fixture(name);
      const local = localiseSquad(english, language);
      const squad = (csv: string) => {
        const { byId, columns } = parseSquadFields(csv);
        return { columns, tiers: [...byId].map(([id, f]) => [id, statusTier(f.playingTime), f.abilityStars, f.potentialStars]) };
      };
      assert.deepEqual(squad(local), squad(english), `${name} squad fields`);
      // Money and positions are written differently in each language (tested above): the English
      // "M (C)" here is "DM (C)" to an Italian reader, whose FM writes it "C (C)".
      const players = (csv: string) =>
        parsePlayersCsv(csv).map((p) => ({ ...p, wage: null, transferValueRange: null, position: "" }));
      assert.deepEqual(players(local), players(english), `${name} players`);
    }
  });
}
