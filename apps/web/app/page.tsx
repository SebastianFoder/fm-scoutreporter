import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { VIEW_HIDDEN, VIEW_SQUAD, VIEW_SQUAD_HIDDEN, VIEW_STAFF, VIEW_STANDARD } from "@scoutreporter/core/view-files";
import { AUTHOR_LD, JsonLd } from "@/components/JsonLd";
import { Screenshot } from "@/components/Screenshot";
import { SCREENSHOTS, type ScreenshotInfo } from "@/lib/screenshots";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

/** The sections of the main menu, with the screens inside each one. */
const MODES = [
  {
    href: "/players",
    name: "Players",
    blurb:
      "Score and rank players on your own attribute weights or the FM27 roles and compare them. Wonderkids estimates prospects at full potential (needs CA, PA and Professionalism); Best XI picks the strongest eleven for a formation within a budget.",
    needs: "Standard or Hidden Attributes view",
    cta: "Open Players",
    screens: [
      { href: "/players", label: "Players" },
      { href: "/players?view=wonderkids", label: "Wonderkids" },
      { href: "/players/best-xi", label: "Best XI" },
    ],
  },
  {
    href: "/squad",
    name: "Squad analysis",
    blurb:
      "Import your own squad and pick your formation to see your first and second eleven, thin or weak positions, ageing starters, youngsters ready to step up, squad-status problems and upgrades from your scouting import.",
    needs: "Squad or Squad Hidden Attributes view",
    cta: "Open Squad analysis",
    screens: [],
  },
  {
    href: "/staff",
    name: "Staff",
    blurb:
      "Rank coaches, scouts, analysts and directors on every staff role, with FM26's word ratings mapped back to 1–20. Best backroom picks the strongest set of staff for the roles you need, nobody used twice.",
    needs: "Staff view",
    cta: "Open Staff",
    screens: [
      { href: "/staff", label: "Staff" },
      { href: "/staff/backroom", label: "Best backroom" },
    ],
  },
] as const;

const SITE_LD = [
  {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
    inLanguage: "en-GB",
    author: AUTHOR_LD,
  },
  {
    "@type": "WebApplication",
    "@id": `${SITE_URL}/#app`,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
    applicationCategory: "GameApplication",
    applicationSubCategory: "Football Manager scouting tool",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires JavaScript",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: MODES.map((m) => `${m.name}: ${m.blurb}`),
    about: [
      { "@type": "VideoGame", name: "Football Manager 27" },
      { "@type": "VideoGame", name: "Football Manager 26" },
    ],
    author: AUTHOR_LD,
    isPartOf: { "@id": `${SITE_URL}/#website` },
  },
];

/** A screenshot linking to its screen, with its title and caption. */
function ScreenshotFigure({
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
  return (
    <figure className={`panel overflow-hidden ${className}`}>
      <Link href={shot.href} className="block border-b border-line" aria-label={`Open ${shot.title}`}>
        <Screenshot shot={shot} alt={`${shot.title}: ${shot.caption}`} sizes={sizes} priority={priority} framed={framed} />
      </Link>
      <figcaption className="px-4 py-2.5 text-sm">
        <span className="font-semibold">{shot.title}</span>
        <span className="text-muted"> · {shot.caption}</span>
      </figcaption>
    </figure>
  );
}

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8 text-ink md:py-12">
      <JsonLd data={SITE_LD} />
      <h1 className="text-[1.75rem] font-bold leading-tight tracking-[-0.01em]">Scout Reporter</h1>
      <p className="mt-1.5 max-w-2xl text-[15px] text-muted">
        Score, rank and compare players from a Football Manager 27 or 26 player export. Everything
        runs in your browser; the CSV never leaves your machine.
      </p>

      <aside className="panel mt-5 flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">Desktop app for Windows</h2>
          <p className="mt-0.5 text-sm text-muted">
            Skip the export: it reads the players in your FM player search straight from the game, with real CA and PA.
          </p>
        </div>
        <Link href="/download" className="btn h-8 shrink-0 border border-line px-2.5 text-[13px] hover:bg-paper">
          Download <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </aside>

      <ScreenshotFigure shot={SCREENSHOTS[0]} sizes="(min-width: 1024px) 984px, 100vw" priority className="mt-5" />

      <section aria-labelledby="modes" className="mt-8">
        <h2 id="modes" className="section-title mb-2">
          Sections
        </h2>
        <div className="panel overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left">Section</th>
                <th className="hidden px-4 py-2 text-left md:table-cell">What it does</th>
                <th className="hidden px-4 py-2 text-left sm:table-cell">Needs</th>
                <th className="px-4 py-2">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {MODES.map((m) => (
                <tr key={m.href}>
                  <td className="px-4 py-3.5 align-top">
                    <Link href={m.href} className="whitespace-nowrap text-base font-semibold hover:underline">
                      {m.name}
                    </Link>
                    {m.screens.length > 0 && (
                      <p className="mt-0.5 flex flex-wrap gap-x-2 text-[13px]">
                        {m.screens.map((sc) => (
                          <Link key={sc.href} href={sc.href} className="link whitespace-nowrap">
                            {sc.label}
                          </Link>
                        ))}
                      </p>
                    )}
                    <p className="mt-0.5 text-sm text-muted md:hidden">{m.blurb}</p>
                  </td>
                  <td className="hidden px-4 py-3.5 align-top text-sm text-muted md:table-cell">
                    {m.blurb}
                  </td>
                  <td className="hidden px-4 py-3.5 align-top text-sm sm:table-cell">{m.needs}</td>
                  <td className="px-4 py-3.5 text-right align-top">
                    <Link
                      href={m.href}
                      aria-label={m.cta}
                      className="btn h-8 border border-line px-2.5 text-[13px] hover:bg-paper"
                    >
                      Open <ArrowRight className="h-3.5 w-3.5" aria-hidden />
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
          More screens
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {SCREENSHOTS.slice(1).map((s) => (
            <ScreenshotFigure key={s.name} shot={s} framed sizes="(min-width: 1024px) 484px, (min-width: 640px) 50vw, 100vw" />
          ))}
        </div>
      </section>

      <section aria-labelledby="start" className="mt-8 grid gap-6 md:grid-cols-[1fr_18rem]">
        <div>
          <h2 id="start" className="section-title mb-2">
            Getting players out of FM
          </h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-[15px] marker:text-muted">
            <li>
              Install an exporter: FM View Exporter for FM27, or BepInEx with the FM26 Player CSV
              Export plugin.
            </li>
            <li>
              Import the Scout Reporter view in FM&apos;s Player Database (right-click a column
              header, then Import View).
            </li>
            <li>
              Select players and press <kbd className="rounded border border-line bg-surface px-1.5 text-[13px] font-semibold">F9</kbd> to export a CSV.
            </li>
            <li>Import that CSV under Players.</li>
          </ol>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link href="/how-to-use" className="link">
              Full setup guide
            </Link>
            <Link href="/faq" className="link">
              Frequently asked questions
            </Link>
          </p>
        </div>
        <aside className="panel h-fit px-4 py-3.5">
          <h2 className="section-title">View files (.fmf)</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li>
              <a href={VIEW_HIDDEN.href} className="link">
                {VIEW_HIDDEN.name}
              </a>
              <span className="block text-muted">{VIEW_HIDDEN.summary} Recommended.</span>
            </li>
            <li>
              <a href={VIEW_STANDARD.href} className="link">
                {VIEW_STANDARD.name}
              </a>
              <span className="block text-muted">{VIEW_STANDARD.summary}</span>
            </li>
            <li>
              <a href={VIEW_SQUAD_HIDDEN.href} className="link">
                {VIEW_SQUAD_HIDDEN.name}
              </a>
              <span className="block text-muted">{VIEW_SQUAD_HIDDEN.summary}</span>
            </li>
            <li>
              <a href={VIEW_SQUAD.href} className="link">
                {VIEW_SQUAD.name}
              </a>
              <span className="block text-muted">{VIEW_SQUAD.summary}</span>
            </li>
            <li>
              <a href={VIEW_STAFF.href} className="link">
                {VIEW_STAFF.name}
              </a>
              <span className="block text-muted">{VIEW_STAFF.summary}</span>
            </li>
          </ul>
        </aside>
      </section>
    </div>
  );
}
