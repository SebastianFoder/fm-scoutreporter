import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { VIEW_HIDDEN, VIEW_STANDARD } from "@/lib/view-files";

const MODES = [
  {
    href: "/attribute",
    name: "Attribute mode",
    blurb: "Import CSV exports, tune weights, and compare players by attributes.",
    needs: "Standard or Hidden Attributes view",
    cta: "Open Attribute Mode",
  },
  {
    href: "/wonderkid",
    name: "Wonderkid mode",
    blurb:
      "Import a Hidden Attributes view export (CA, PA, Professionalism) to estimate full-potential attributes and rank prospects on FM27 roles.",
    needs: "Hidden Attributes view (CA, PA, Professionalism)",
    cta: "Open Wonderkid Mode",
  },
  {
    href: "/best-xi",
    name: "Best XI",
    blurb:
      "Pick the highest-scoring eleven for a formation from your import, within a minimum and maximum total budget.",
    needs: "Standard or Hidden Attributes view",
    cta: "Open Best XI",
  },
] as const;

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8 text-ink md:py-12">
      <h1 className="text-[1.75rem] font-bold leading-tight tracking-[-0.01em]">Scout Reporter</h1>
      <p className="mt-1.5 max-w-2xl text-[15px] text-muted">
        Score, rank and compare players from a Football Manager player export. Everything runs
        in your browser; the CSV never leaves your machine.
      </p>

      <section aria-labelledby="modes" className="mt-8">
        <h2 id="modes" className="section-title mb-2">
          Modes
        </h2>
        <div className="panel overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left">Mode</th>
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

      <section aria-labelledby="start" className="mt-8 grid gap-6 md:grid-cols-[1fr_18rem]">
        <div>
          <h2 id="start" className="section-title mb-2">
            Getting players out of FM
          </h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-[15px] marker:text-muted">
            <li>Install BepInEx and the FM26 Player CSV Export plugin.</li>
            <li>
              Import the Scout Reporter view in FM&apos;s Player Database (right-click a column
              header, then Import View).
            </li>
            <li>
              Select players and press <kbd className="rounded border border-line bg-surface px-1.5 text-[13px] font-semibold">F9</kbd> to export a CSV.
            </li>
            <li>Import that CSV in Attribute or Wonderkid mode.</li>
          </ol>
          <p className="mt-3 text-sm">
            <Link href="/how-to-use" className="link">
              Full setup guide
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
          </ul>
        </aside>
      </section>
    </div>
  );
}
