import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@scoutreporter/ui/i18n/navigation";
import { JsonLd, breadcrumbLd } from "@/components/JsonLd";
import { CompareShell, CompareSources, CompareTable } from "@/components/Compare";
import { absoluteUrl, pageMetadata } from "@/lib/site";
import { TOOLS, type ToolKey } from "@/lib/compare";
import { DESKTOP_APP_ID, WEB_APP_ID } from "@/lib/structured-data";

export const generateMetadata = pageMetadata({
  page: "compare",
  path: "/compare",
});

const TABLE: ToolKey[] = ["srWeb", "srDesktop", "genie", "fmrte", "inGame", "databases"];

/** The "which one to use" points; `link` is where the point's <link> goes, if it has one. */
const CHOOSE: { key: string; link?: string }[] = [
  { key: "noInstall", link: "/players" },
  { key: "live", link: "/download" },
  { key: "edit" },
  { key: "mac" },
  { key: "pure" },
];

export default async function ComparePage() {
  const t = await getTranslations("compare");
  /* Structured data stays English. The tools in the order of the table; ours point at their entities. */
  const en = await getTranslations({ locale: "en", namespace: "compare" });
  const listLd = {
    "@type": "ItemList",
    name: en("hub.title"),
    itemListElement: TABLE.map((key, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: en(`tools.${key}.name`),
      ...(key === "srWeb" && { item: { "@id": WEB_APP_ID } }),
      ...(key === "srDesktop" && { item: { "@id": DESKTOP_APP_ID } }),
      ...(TOOLS[key].url?.startsWith("http") && { url: TOOLS[key].url }),
    })),
  };
  const pageLd = {
    "@type": "WebPage",
    "@id": `${absoluteUrl("/compare")}#page`,
    name: en("hub.title"),
    description: en("hub.answer"),
    about: [{ "@id": WEB_APP_ID }, { "@id": DESKTOP_APP_ID }],
    mainEntity: listLd,
  };
  return (
    <CompareShell path="/compare" title={t("hub.title")} intro={t("hub.intro")} answer={t("hub.answer")}>
      <JsonLd data={[pageLd, breadcrumbLd([{ name: "Scouting tools compared", path: "/compare" }])]} />
      <CompareTable tools={TABLE} />
      <section aria-labelledby="choose">
        <h2 id="choose" className="section-title mb-2">
          {t("hub.chooseTitle")}
        </h2>
        <ul className="list-disc space-y-1.5 pl-5 text-[15px] marker:text-muted">
          {CHOOSE.map(({ key, link }) => (
            <li key={key}>
              {link
                ? t.rich(`hub.choose.${key}`, {
                    link: (c: ReactNode) => (
                      <Link href={link} className="link">
                        {c}
                      </Link>
                    ),
                  })
                : t(`hub.choose.${key}`)}
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="more">
        <h2 id="more" className="section-title mb-2">
          {t("hub.moreTitle")}
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-[15px] marker:text-muted">
          <li>
            <Link href="/compare/genie-scout" className="link">
              {t("hub.more.genie")}
            </Link>
          </li>
          <li>
            <Link href="/compare/fmrte" className="link">
              {t("hub.more.fmrte")}
            </Link>
          </li>
        </ul>
      </section>
      <CompareSources tools={TABLE} />
    </CompareShell>
  );
}
