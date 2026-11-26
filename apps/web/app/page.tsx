import { Link } from "@scoutreporter/ui/i18n/navigation";
import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { VIEW_HIDDEN, VIEW_SQUAD, VIEW_SQUAD_HIDDEN, VIEW_STAFF, VIEW_STANDARD } from "@scoutreporter/core/view-files";
import { JsonLd } from "@/components/JsonLd";
import { AUTHOR_LD, WEBSITE_LD, desktopAppLd, webAppLd } from "@/lib/structured-data";
import { Screenshot } from "@/components/Screenshot";
import { SCREENSHOTS, type ScreenshotInfo } from "@/lib/screenshots";

/** The sections of the main menu, with the screens inside each one. Copy is in home.modes.<key>. */
const MODES = [
  {
    key: "players",
    href: "/players",
    screens: [
      { href: "/players", label: "players" },
      { href: "/players/best-xi", label: "bestXi" },
    ],
  },
  { key: "squad", href: "/squad", screens: [] },
  {
    key: "staff",
    href: "/staff",
    screens: [
      { href: "/staff", label: "staff" },
      { href: "/staff/backroom", label: "backroom" },
    ],
  },
] as const;

/** The view files in the sidebar; names and summaries are in home.views.<key>. */
const VIEWS = [
  { view: VIEW_HIDDEN, key: "hidden" },
  { view: VIEW_STANDARD, key: "standard" },
  { view: VIEW_SQUAD_HIDDEN, key: "squadHidden" },
  { view: VIEW_SQUAD, key: "squad" },
  { view: VIEW_STAFF, key: "staff" },
] as const;

/**
 * Structured data, in English (search engines get English): the site, the website as an app (its
 * `featureList` from the English copy), the Windows app and the author.
 */
const siteLd = (featureList: string[]) => [WEBSITE_LD, webAppLd(featureList), desktopAppLd(), AUTHOR_LD];

/** A screenshot linking to its screen, with its title and caption. */
async function ScreenshotFigure({
  shot,
  sizes,
  priority,
  framed,
  className = "",
}: {
  shot: ScreenshotInfo;
  sizes: string;
  priority?: boolean;
  framed?: boolean;
  className?: string;
}) {
  const t = await getTranslations("home.screenshots");
  const title = t(`${shot.key}.title`);
  const caption = t(`${shot.key}.caption`);
  return (
    <figure className={`panel overflow-hidden ${className}`}>
      <Link href={shot.href} className="block border-b border-line" aria-label={t("open", { title })}>
        <Screenshot shot={shot} alt={t("alt", { title, caption })} sizes={sizes} priority={priority} framed={framed} />
      </Link>
      <figcaption className="px-4 py-2.5 text-sm">
        <span className="font-semibold">{title}</span>
        <span className="text-muted"> · {caption}</span>
      </figcaption>
    </figure>
  );
}

export default async function Home() {
  const t = await getTranslations("home");
  const en = await getTranslations({ locale: "en", namespace: "home" });
  const featureList = MODES.map((m) => `${en(`modes.${m.key}.name`)}: ${en(`modes.${m.key}.blurb`)}`);
  return (
    <div className="mx-auto max-w-5xl px-5 py-8 text-ink md:py-12">
      <JsonLd data={siteLd(featureList)} />
      <h1 className="text-[1.75rem] font-bold leading-tight tracking-[-0.01em]">Scout Reporter</h1>
      <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{t("intro")}</p>

      <aside className="panel mt-5 flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">{t("desktop.title")}</h2>
          <p className="mt-0.5 text-sm text-muted">{t("desktop.body")}</p>
        </div>
        <Link href="/download" className="btn h-8 shrink-0 border border-line px-2.5 text-[13px] hover:bg-paper">
          {t("desktop.cta")} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </aside>

      <ScreenshotFigure shot={SCREENSHOTS[0]} sizes="(min-width: 1024px) 984px, 100vw" priority className="mt-5" />

      <section aria-labelledby="modes" className="mt-8">
        <h2 id="modes" className="section-title mb-2">
          {t("sections.title")}
        </h2>
        <div className="panel overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left">{t("sections.section")}</th>
                <th className="hidden px-4 py-2 text-left md:table-cell">{t("sections.whatItDoes")}</th>
                <th className="hidden px-4 py-2 text-left sm:table-cell">{t("sections.needs")}</th>
                <th className="px-4 py-2">
                  <span className="sr-only">{t("sections.open")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {MODES.map((m) => (
                <tr key={m.href}>
                  <td className="px-4 py-3.5 align-top">
                    <Link href={m.href} className="whitespace-nowrap text-base font-semibold hover:underline">
                      {t(`modes.${m.key}.name`)}
                    </Link>
                    {m.screens.length > 0 && (
                      <p className="mt-0.5 flex flex-wrap gap-x-2 text-[13px]">
                        {m.screens.map((sc) => (
                          <Link key={sc.href} href={sc.href} className="link whitespace-nowrap">
                            {t(`screens.${sc.label}`)}
                          </Link>
                        ))}
                      </p>
                    )}
                    <p className="mt-0.5 text-sm text-muted md:hidden">{t(`modes.${m.key}.blurb`)}</p>
                  </td>
                  <td className="hidden px-4 py-3.5 align-top text-sm text-muted md:table-cell">
                    {t(`modes.${m.key}.blurb`)}
                  </td>
                  <td className="hidden px-4 py-3.5 align-top text-sm sm:table-cell">{t(`modes.${m.key}.needs`)}</td>
                  <td className="px-4 py-3.5 text-right align-top">
                    <Link
                      href={m.href}
                      aria-label={t(`modes.${m.key}.cta`)}
                      className="btn h-8 border border-line px-2.5 text-[13px] hover:bg-paper"
                    >
                      {t("sections.open")} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="screens" className="mt-8">
        <h2 id="screens" className="section-title mb-2">
          {t("moreScreens")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* The first one spans both columns, so the rest fill whole rows. */}
          {SCREENSHOTS.slice(1).map((s, i) => (
            <ScreenshotFigure
              key={s.name}
              shot={s}
              framed
              className={i === 0 ? "sm:col-span-2" : ""}
              sizes={i === 0 ? "(min-width: 1024px) 984px, 100vw" : "(min-width: 1024px) 484px, (min-width: 640px) 50vw, 100vw"}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="start" className="mt-8 grid gap-6 md:grid-cols-[1fr_18rem]">
        <div>
          <h2 id="start" className="section-title mb-2">
            {t("start.title")}
          </h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-[15px] marker:text-muted">
            <li>{t("start.exporter")}</li>
            <li>{t("start.view")}</li>
            <li>
              {t.rich("start.export", {
                kbd: (c) => (
                  <kbd className="rounded border border-line bg-surface px-1.5 text-[13px] font-semibold">{c}</kbd>
                ),
              })}
            </li>
            <li>{t("start.import")}</li>
          </ol>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link href="/how-to-use" className="link">
              {t("start.guide")}
            </Link>
            <Link href="/faq" className="link">
              {t("start.faq")}
            </Link>
          </p>
        </div>
        <aside className="panel h-fit px-4 py-3.5">
          <h2 className="section-title">{t("views.title")}</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {VIEWS.map(({ view, key }) => (
              <li key={key}>
                <a href={view.href} className="link">
                  {t(`views.${key}.name`)}
                </a>
                <span className="block text-muted">{t(`views.${key}.summary`)}</span>
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </div>
  );
}
