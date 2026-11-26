import { intlTag } from "@scoutreporter/ui/i18n/locales";
import { FORMATIONS } from "@scoutreporter/core/best-xi/formations";
import { AGE_BENCHMARK, PRIME_BENCHMARK } from "@scoutreporter/core/fm27/benchmarks";
import { GRADE_SCALE, PRIME_GRADE } from "@scoutreporter/core/grades";
import type { getTranslations } from "next-intl/server";

/**
 * The FAQ's questions, shared by the /faq page and llms-full.txt. The copy is in the faq messages
 * (faq.items.<key>); the numbers the answers quote come from the scoring code.
 */

/** One question: its q, a and (with `more`) its link label are in faq.items.<key>. */
export interface Faq {
  key: string;
  more?: string;
}

const youngest = Math.min(...Object.keys(AGE_BENCHMARK).map(Number));
const lowestGraded = GRADE_SCALE[GRADE_SCALE.length - 2];
const formationCount = FORMATIONS.length;

/** `id` keeps the section anchors stable in every language. */
export const FAQ_GROUPS: { id: string; key: string; items: Faq[] }[] = [
  {
    id: "faq-getting-started",
    key: "start",
    items: [
      { key: "what" },
      { key: "versions", more: "/how-to-use" },
      { key: "export", more: "/how-to-use" },
      { key: "view" },
      { key: "platforms" },
      { key: "free" },
    ],
  },
  { id: "faq-privacy", key: "privacy", items: [{ key: "upload" }, { key: "analytics" }] },
  {
    id: "faq-scores-and-grades",
    key: "scores",
    items: [{ key: "scoring", more: "/how-to-use/players" }, { key: "benchmarks" }, { key: "grades" }, { key: "vsAge" }],
  },
  {
    id: "faq-wonderkids-best-xi-and-squads",
    key: "wonderkids",
    items: [
      { key: "wonderkids", more: "/how-to-use/wonderkids" },
      { key: "potential" },
      { key: "bestXi", more: "/players/best-xi" },
      { key: "squad", more: "/squad" },
    ],
  },
  {
    id: "faq-staff",
    key: "staff",
    items: [
      { key: "staffScouting", more: "/staff" },
      { key: "staffWords" },
      { key: "staffRoles" },
      { key: "backroom", more: "/staff/backroom" },
    ],
  },
];

export type FaqT = Awaited<ReturnType<typeof getTranslations>>;

/** The numbers the answers quote, formatted for `locale`. */
function answerValues(locale: string) {
  const oneDecimal = (n: number) =>
    n.toLocaleString(intlTag(locale), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return {
    top: oneDecimal(GRADE_SCALE[0].min),
    lowestGrade: lowestGraded.grade,
    lowest: oneDecimal(lowestGraded.min),
    prime: oneDecimal(PRIME_BENCHMARK),
    primeGrade: PRIME_GRADE,
    youngestBenchmark: oneDecimal(AGE_BENCHMARK[youngest]),
    youngestAge: youngest,
    formationCount,
  };
}

/** Plain text, so the same words go into the page and the FAQPage structured data. */
export function faqAnswer(t: FaqT, locale: string, key: string): string {
  return t(`items.${key}.a`, answerValues(locale));
}

