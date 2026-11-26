import { getTranslations } from "next-intl/server";
import { JsonLd, breadcrumbLd } from "@/components/JsonLd";
import { CompareFaq, CompareShell, CompareSources, CompareTable, PointList } from "@/components/Compare";
import { absoluteUrl } from "@/lib/site";
import { TOOLS, type ComparePath, type ToolKey } from "@/lib/compare";
import { DESKTOP_APP_ID, WEB_APP_ID } from "@/lib/structured-data";

/**
 * A "Scout Reporter vs X" page. Its copy is compare.<page>: title, intro, answer, stronger.*,
 * different.*, both and faq.*.q / .a. The keys of each list are passed in, in display order.
 */
export async function CompareVs({
  path,
  page,
  rival,
  crumb,
  stronger,
  different,
  faq,
}: {
  path: ComparePath;
  page: "genie" | "fmrte";
  rival: ToolKey;
  /** English breadcrumb name. */
  crumb: string;
  stronger: string[];
  different: string[];
  faq: string[];
}) {
  const t = await getTranslations("compare");
  /* Structured data stays English. */
  const en = await getTranslations({ locale: "en", namespace: "compare" });
  const tools: ToolKey[] = ["srWeb", "srDesktop", rival];
  const ld = [
    {
      "@type": "WebPage",
      "@id": `${absoluteUrl(path)}#page`,
      name: en(`${page}.title`),
      description: en(`${page}.answer`),
      about: [
        { "@id": WEB_APP_ID },
        { "@id": DESKTOP_APP_ID },
        { "@type": "SoftwareApplication", name: en(`tools.${rival}.name`), url: TOOLS[rival].url },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: faq.map((k) => ({
        "@type": "Question",
        name: en(`${page}.faq.${k}.q`),
        acceptedAnswer: { "@type": "Answer", text: en(`${page}.faq.${k}.a`) },
      })),
    },
    breadcrumbLd([
      { name: "Scouting tools compared", path: "/compare" },
      { name: crumb, path },
    ]),
  ];
  return (
    <CompareShell path={path} title={t(`${page}.title`)} intro={t(`${page}.intro`)} answer={t(`${page}.answer`)}>
      <JsonLd data={ld} />
      <CompareTable tools={tools} />
      <div className="grid gap-6 md:grid-cols-2">
        <PointList
          id="stronger"
          title={t(`${page}.strongerTitle`)}
          items={stronger.map((k) => t(`${page}.stronger.${k}`))}
        />
        <PointList
          id="different"
          title={t(`${page}.differentTitle`)}
          items={different.map((k) => t(`${page}.different.${k}`))}
        />
      </div>
      <p className="text-[15px]">{t(`${page}.both`)}</p>
      <CompareFaq items={faq.map((k) => ({ q: t(`${page}.faq.${k}.q`), a: t(`${page}.faq.${k}.a`) }))} />
      <CompareSources tools={tools} />
    </CompareShell>
  );
}
