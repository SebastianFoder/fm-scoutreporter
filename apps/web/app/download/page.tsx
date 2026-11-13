import type { Metadata } from "next";
import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import { PageHeader } from "@scoutreporter/ui/components/PageHeader";
import { JsonLd, breadcrumbLd } from "@/components/JsonLd";
import { pageMetadata } from "@/lib/site";
import { DESKTOP_RELEASES_URL, REPO_URL, latestDesktopRelease } from "@/lib/desktop-release";

export const metadata: Metadata = pageMetadata({
  title: "Desktop app for Windows",
  description:
    "Download Scout Reporter for Windows: it reads the players in your Football Manager 27 or 26 player search straight from the game, with real CA, PA and hidden attributes, and scores them in every Scout Reporter screen. No view files, no CSV export.",
  path: "/download",
});

// The newest release is looked up on GitHub at most once an hour.
export const revalidate = 3600;

const kbd = "rounded border border-line bg-surface px-1.5 text-[13px] font-semibold";

export default async function DownloadPage() {
  const release = await latestDesktopRelease();
  const sizeMb = release && release.bytes > 0 ? Math.round(release.bytes / 1e6) : null;
  const date = release?.publishedAt
    ? new Date(release.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-8 text-ink md:py-10">
      <JsonLd data={breadcrumbLd([{ name: "Desktop app", path: "/download" }])} />
      <PageHeader title="Scout Reporter for Windows">
        Every screen of this website, plus <span className="font-semibold text-ink">Scan FM</span>: set up a Player
        Search in Football Manager, press <kbd className={kbd}>F9</kbd>, and the players FM found, with your own
        squad, are in Attribute, Wonderkid, Best XI, Squad and Staff a few seconds later. No view files and no CSV
        export.
      </PageHeader>

      <section className="panel space-y-3 px-5 py-4" aria-labelledby="get-title">
        <h2 id="get-title" className="section-title">
          Download
        </h2>
        {release ? (
          <>
            <a
              href={release.downloadUrl}
              className="btn h-11 gap-2 rounded-md bg-accent px-4 text-[15px] font-semibold text-on-accent hover:opacity-90"
            >
              <Download className="h-4 w-4" aria-hidden />
              Download for Windows
            </a>
            <p className="text-[13px] text-muted">
              Version {release.version}
              {date && `, ${date}`}
              {sizeMb !== null && ` · ${release.fileName}, ${sizeMb} MB`} ·{" "}
              <a href={release.pageUrl} className="link">
                Release notes and checksum
              </a>{" "}
              ·{" "}
              <a href={DESKTOP_RELEASES_URL} className="link">
                All versions
              </a>
            </p>
          </>
        ) : (
          <p className="text-sm">
            The installer is published on GitHub:{" "}
            <a href={DESKTOP_RELEASES_URL} className="link inline-flex items-center gap-1">
              Scout Reporter desktop releases <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
            . Download <span className="font-semibold">Scout-Reporter-Setup-&lt;version&gt;.exe</span> from the newest
            one.
          </p>
        )}
        <p className="text-[13px] text-muted">
          Windows 10 or 11, 64-bit. Football Manager 27 (27.0) or 26 (26.3), from Steam, Epic or Game Pass. A Mac
          version is planned.
        </p>
      </section>

      <section className="space-y-2" aria-labelledby="install-title">
        <h2 id="install-title" className="section-title">
          Install
        </h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-[15px] marker:text-muted">
          <li>Run the installer you downloaded.</li>
          <li>
            The installer is not code-signed yet, so Windows SmartScreen says it is from an unknown publisher. Click{" "}
            <span className="font-semibold">More info</span>, then <span className="font-semibold">Run anyway</span>.
          </li>
          <li>Choose where to install it. It adds a Start menu entry and a desktop shortcut.</li>
        </ol>
      </section>

      <section className="space-y-2" aria-labelledby="use-title">
        <h2 id="use-title" className="section-title">
          Use
        </h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-[15px] marker:text-muted">
          <li>Start Football Manager and load your save. Keep Scout Reporter open next to it.</li>
          <li>
            In FM, open <span className="font-semibold">Player Search</span> (or Staff Search) and set your filters,
            for example Player&apos;s interest: Interested, to see only players who would join you.
          </li>
          <li>
            Press <kbd className={kbd}>F9</kbd> (it works inside FM) or <span className="font-semibold">Scan FM</span>{" "}
            in the app. The players from the search and your own club appear in every screen.
          </li>
          <li>
            Switch <span className="font-semibold">Use CA, PA and hidden attributes</span> off if you would rather not
            see them. Scan again every few in-game months to follow growth on the Growth page.
          </li>
        </ol>
        <p className="text-sm text-muted">
          If Football Manager runs as administrator, run Scout Reporter as administrator too.
        </p>
      </section>

      <section className="space-y-2" aria-labelledby="safe-title">
        <h2 id="safe-title" className="section-title">
          Is it safe?
        </h2>
        <p className="text-[15px]">
          The app only reads Football Manager&apos;s memory; it never changes your game or your save, and nothing is
          sent anywhere. Scans stay on your PC, under <code className="text-[13px]">%APPDATA%\Scout Reporter</code>.
          The code is open on{" "}
          <a href={REPO_URL} className="link">
            GitHub
          </a>
          , and every release is built there by GitHub Actions. The memory reader is adapted from{" "}
          <a href="https://github.com/mavarobli/FMSuperScout" className="link">
            FMSuperScout
          </a>{" "}
          (MIT licence).
        </p>
        <p className="text-[15px]">
          After a big Football Manager patch the reader may need an update. The app warns when your game version
          differs from the one it was made for.
        </p>
      </section>

      <p className="text-sm text-muted">
        Rather not install anything?{" "}
        <Link href="/how-to-use" className="link">
          Use the website with a CSV export
        </Link>
        .
      </p>
    </div>
  );
}
