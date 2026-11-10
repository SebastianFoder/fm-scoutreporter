import { PlayerAttributes } from "@/types/player-attributes";
import { csvLines, detectDelimiter, splitCsvLine } from "./csv-utils";

export function parsePlayersCsv(csv: string): PlayerAttributes[] {
  const lines = csvLines(csv);

  if (lines.length <= 1) return [];

  // We rely on the fixed column order from your export
  // L1: Player;Crossing;Handling;...;Transfer Value;Communication;Aerial Reach
  // FM26 exports are `;`-delimited, FM27 exports are `,`-delimited (and call "Wage" "Salary").
  const delimiter = detectDelimiter(lines[0]);
  const dataLines = lines.slice(1);

  return dataLines.map((line) => {
    const cols = splitCsvLine(line, delimiter);

    const get = (index: number) => (cols[index] ?? "").trim();
    const num = (index: number): number => {
      const v = get(index);
      const n = Number(v.replace(/[^\d.-]/g, "")); // strip non-numeric
      return Number.isFinite(n) ? n : 0;
    };
    const boolFromTrueFalse = (index: number): boolean => get(index) === "True";
    const strOrNull = (index: number): string | null => {
      const v = get(index);
      if (!v || v === "N/A" || v === "€0") return null;
      return v;
    };

    return {
      player: get(0),

      crossing: num(1),
      handling: num(2),
      concentration: num(3),
      aggression: num(4),
      leadership: num(5),
      positioning: num(6),
      teamWork: num(7),
      acceleration: num(8),
      penaltyTaking: num(9),

      expires: get(10),
      wage: strOrNull(11),

      rightFoot: get(12),
      leftFoot: get(13),
      age: num(14),
      euNational: boolFromTrueFalse(15),

      position: get(16),
      uniqueId: get(17),

      technique: num(18),
      tackling: num(19),
      heading: num(20),
      marking: num(21),
      longThrows: num(22),
      pace: num(23),
      corners: num(24),
      stamina: num(25),
      strength: num(26),
      reflexes: num(27),
      naturalFitness: num(28),
      balance: num(29),
      jumpingReach: num(30),
      agility: num(31),
      workRate: num(32),
      decisions: num(33),
      determination: num(34),
      rushingOutTendency: num(35),
      anticipation: num(36),
      composure: num(37),
      bravery: num(38),
      throwing: num(39),
      punching: num(40),
      oneOnOnes: num(41),
      kicking: num(42),
      eccentricity: num(43),
      dribbling: num(44),
      freeKickTaking: num(45),
      finishing: num(46),
      firstTouch: num(47),
      flair: num(48),
      longShots: num(49),
      offTheBall: num(50),
      passing: num(51),
      vision: num(52),
      commandOfArea: num(53),
      transferValueRange: strOrNull(54),

      communication: num(55),
      aerialReach: num(56),
    };
  });
}
