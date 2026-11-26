import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { intlTag } from "@scoutreporter/ui/i18n/locales";
import { PageHeader } from "@scoutreporter/ui/components/PageHeader";
import { JsonLd, breadcrumbLd } from "@/components/JsonLd";
import { FORMATIONS } from "@scoutreporter/core/best-xi/formations";
import { AGE_BENCHMARK, PRIME_BENCHMARK } from "@scoutreporter/core/fm27/benchmarks";
import { GRADE_SCALE, PRIME_GRADE } from "@scoutreporter/core/grades";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "FAQ: FM27 and FM26 scouting, exports and scores",
  description:
    "Answers about Scout Reporter: exporting Football Manager 27 and 26 players to CSV, which view to use, privacy, how scores, grades and vs Age work, finding wonderkids from CA and PA, Best XI and scouting staff.",
  path: "/faq",
});

/** One question: its q, a and (with `more`) its link label are in faq.items.<key>. */
interface Faq {
  key: string;
  more?: string;
}

const youngest = Math.min(...Object.keys(AGE_BENCHMARK).map(Number));
const lowestGraded = GRADE_SCALE[GRADE_SCALE.length - 2];
const formationCount = FORMATIONS.length;

/** `id` keeps the section anchors stable in every language. */
const GROUPS: { id: string; key: string; items: Faq[] }[] = [
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

type FaqT = Awaited<ReturnType<typeof getTranslations>>;

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
function answer(t: FaqT, locale: string, key: string): string {
  return t(`items.${key}.a`, answerValues(locale));
}

export default async function FaqPage() {
  const locale = await getLocale();
  const t = await getTranslations("faq");
  /* Structured data stays English: search engines get English. */
  const en = await getTranslations({ locale: "en", namespace: "faq" });
  const faqLd = {
    "@type": "FAQPage",
    mainEntity: GROUPS.flatMap((g) => g.items).map((item) => ({
      "@type": "Question",
      name: en(`items.${item.key}.q`),
      acceptedAnswer: { "@type": "Answer", text: answer(en, "en", item.key) },
    })),
  };

  return (
    <div className="text-ink">
      <JsonLd data={[faqLd, breadcrumbLd([{ name: "FAQ", path: "/faq" }])]} />
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-6 md:py-8">
        <PageHeader title={t("title")}>
          {t.rich("intro", {
            link: (c) => (
              <Link href="/how-to-use" className="link">
                {c}
              </Link>
            ),
          })}
        </PageHeader>

        {GROUPS.map((group) => (
          <section key={group.id} aria-labelledby={group.id}>
            <h2 id={group.id} className="section-title mb-2">
              {t(`groups.${group.key}`)}
            </h2>
            <div className="panel">
              {group.items.map((item) => (
                <div key={item.key} className="border-b border-line px-4 py-3.5 last:border-0">
                  <h3 className="text-base font-semibold">{t(`items.${item.key}.q`)}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink/85">{answer(t, locale, item.key)}</p>
                  {item.more && (
                    <p className="mt-1.5 text-sm">
                      <Link href={item.more} className="link">
                        {t(`items.${item.key}.more`)}
                      </Link>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
