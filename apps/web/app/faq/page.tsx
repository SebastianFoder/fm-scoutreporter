import { Link } from "@scoutreporter/ui/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@scoutreporter/ui/components/PageHeader";
import { JsonLd, breadcrumbLd } from "@/components/JsonLd";
import { pageMetadata } from "@/lib/site";
import { FAQ_GROUPS as GROUPS, faqAnswer as answer } from "@/lib/faq";

export const generateMetadata = pageMetadata({
  page: "faq",
  path: "/faq",
});

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
