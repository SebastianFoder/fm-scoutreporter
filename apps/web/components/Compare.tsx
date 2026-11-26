import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@scoutreporter/ui/i18n/navigation";
import { intlTag } from "@scoutreporter/ui/i18n/locales";
import { PageHeader } from "@scoutreporter/ui/components/PageHeader";
import { COMPARE_PAGES, LAST_CHECKED, TOOLS, TOOL_FIELDS, type ComparePath, type ToolKey } from "@/lib/compare";

/** Layout of the comparison pages: title, tabs, a short answer first (what an assistant quotes), then the rest. */
export async function CompareShell({
  path,
  title,
  intro,
  answer,
  children,
}: {
  path: ComparePath;
  title: string;
  intro: string;
  answer: string;
  children: ReactNode;
}) {
  const t = await getTranslations("compare");
  const locale = await getLocale();
  const checked = new Date(`${LAST_CHECKED}T12:00:00Z`).toLocaleDateString(intlTag(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <div className="text-ink">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-6 md:py-8">
        <PageHeader title={title}>{intro}</PageHeader>
        <nav className="flex overflow-x-auto border-b border-line" aria-label={t("nav.hub")}>
          {COMPARE_PAGES.map((page) => {
            const active = page.href === path;
            return (
              <Link
                key={page.href}
                href={page.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "-mb-px shrink-0 border-b-2 px-4 py-2 text-sm",
                  active ? "border-accent font-semibold text-ink" : "border-transparent text-muted hover:text-ink",
                ].join(" ")}
              >
                {t(`nav.${page.label}`)}
              </Link>
            );
          })}
        </nav>
        <section aria-labelledby="in-short" className="panel px-5 py-4">
          <h2 id="in-short" className="section-title">
            {t("inShort")}
          </h2>
          <p className="mt-1.5 text-[15px] leading-relaxed">{answer}</p>
        </section>
        {children}
        <footer className="space-y-1 border-t border-line pt-3 text-[13px] text-muted">
          <p>
            <time dateTime={LAST_CHECKED}>{t("checked", { date: checked })}</time>
          </p>
          <p>{t("disclosure")}</p>
        </footer>
      </div>
    </div>
  );
}

/** One column per tool, one row per fact. Scrolls sideways on narrow screens. */
export async function CompareTable({ tools }: { tools: ToolKey[] }) {
  const t = await getTranslations("compare");
  return (
    <section aria-labelledby="side-by-side">
      <h2 id="side-by-side" className="section-title mb-2">
        {t("tableTitle")}
      </h2>
      <div className="panel overflow-x-auto">
        <table className="data-table w-full min-w-[40rem] text-sm">
          <thead>
            <tr>
              <th scope="col" className="w-36 px-4 py-2 text-left">
                <span className="sr-only">{t("fields.tool")}</span>
              </th>
              {tools.map((key) => (
                <th key={key} scope="col" className="min-w-44 px-4 py-2 text-left align-bottom">
                  <ToolName tool={key} name={t(`tools.${key}.name`)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TOOL_FIELDS.map((field) => (
              <tr key={field}>
                <th scope="row" className="px-4 py-3 text-left align-top font-semibold">
                  {t(`fields.${field}`)}
                </th>
                {tools.map((key) => (
                  <td key={key} className="px-4 py-3 align-top text-ink/85">
                    {t(`tools.${key}.${field}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ToolName({ tool, name }: { tool: ToolKey; name: string }) {
  const url = TOOLS[tool].url;
  if (!url) return <>{name}</>;
  return url.startsWith("/") ? (
    <Link href={url} className="link">
      {name}
    </Link>
  ) : (
    <a href={url} className="link" rel="noreferrer" target="_blank">
      {name}
    </a>
  );
}

/** A titled list of points: "Where X is stronger", "What Scout Reporter adds". */
export function PointList({ id, title, items }: { id: string; title: string; items: string[] }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="section-title mb-2">
        {title}
      </h2>
      <ul className="list-disc space-y-1.5 pl-5 text-[15px] marker:text-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

/** Questions and answers, shown and (by the page) given to search engines as FAQPage data. */
export async function CompareFaq({ items }: { items: { q: string; a: string }[] }) {
  const t = await getTranslations("compare");
  return (
    <section aria-labelledby="compare-faq">
      <h2 id="compare-faq" className="section-title mb-2">
        {t("faqTitle")}
      </h2>
      <div className="panel">
        {items.map((item) => (
          <div key={item.q} className="border-b border-line px-4 py-3.5 last:border-0">
            <h3 className="text-base font-semibold">{item.q}</h3>
            <p className="mt-1 text-[15px] leading-relaxed text-ink/85">{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Links to the pages the facts about other tools come from. */
export async function CompareSources({ tools }: { tools: ToolKey[] }) {
  const t = await getTranslations("compare");
  const sources = tools.flatMap((k) => TOOLS[k].sources ?? []);
  if (sources.length === 0) return null;
  return (
    <p className="text-sm text-muted">
      {t("sources")} ·{" "}
      {sources.map(({ label, url }, i) => (
        <span key={url}>
          {i > 0 && " · "}
          <a href={url} className="link" rel="noreferrer" target="_blank">
            {label}
          </a>
        </span>
      ))}
    </p>
  );
}
