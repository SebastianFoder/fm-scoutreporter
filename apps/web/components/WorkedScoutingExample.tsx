import { getLocale, getTranslations } from "next-intl/server";
import { formatMoney } from "@scoutreporter/core/best-xi/money";
import { DESKTOP_BUILD } from "@scoutreporter/ui/desktop/target";
import { intlTag } from "@scoutreporter/ui/i18n/locales";
import { Link } from "@scoutreporter/ui/i18n/navigation";

const GUIDES = {
  players: "/how-to-use/wonderkids",
  bestXi: "/how-to-use/players",
  squad: "/how-to-use",
} as const;

export async function WorkedScoutingExample({ page }: { page: keyof typeof GUIDES }) {
  if (DESKTOP_BUILD) return null;

  const [t, importer, fm, locale] = await Promise.all([
    getTranslations("examples"),
    getTranslations("importer.panel"),
    getTranslations("fm.fm27Roles"),
    getLocale(),
  ]);
  const testData = importer("loadTestData");
  const tag = intlTag(locale);
  const score = (value: number, digits = 2) => value.toLocaleString(tag, {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  });
  const money = (amount: number) => formatMoney(amount, "€", tag);

  // Results from the public test-data imports, using the built-in profiles and default formations.
  const examples = {
    players: () => t("players.body", {
      testData,
      role: `FM27 · ${fm("fm27-gk")}`,
      currentLeader: "Filipe Celento",
      currentScore: score(103.70),
      prospect: "Michael Ahme",
      prospectScore: score(96.01),
      prospectPotential: score(118.52),
      leaderPotential: score(114.53),
    }),
    bestXi: () => t("bestXi.body", {
      testData,
      budget: money(30_000_000),
      unlimitedCost: money(35_543_000),
      cappedCost: money(26_173_000),
      cappedScore: score(12.42),
      unlimitedScore: score(12.51),
      leftWinger: "Ahmad Badran",
      rightWinger: "Luke Brooke-Smith",
    }),
    squad: () => t("squad.body", {
      testData,
      starter: "Heidar Sjølie",
      starterScore: score(14.03, 1),
      backup: "Elias Warming",
      backupScore: score(12.47, 1),
    }),
  };

  return (
    <div className="mx-auto max-w-7xl px-5 pb-6 md:pb-8">
      <section aria-labelledby="worked-example" className="panel space-y-2 px-4 py-3.5 text-sm text-ink">
        <h2 id="worked-example" className="section-title">{t(`${page}.title`)}</h2>
        <p className="max-w-3xl leading-relaxed">{examples[page]()}</p>
        <Link href={GUIDES[page]} className="link">{t(`${page}.guide`)}</Link>
      </section>
    </div>
  );
}
