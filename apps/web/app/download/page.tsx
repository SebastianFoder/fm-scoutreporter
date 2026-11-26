import { Link } from "@scoutreporter/ui/i18n/navigation";
import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { intlTag } from "@scoutreporter/ui/i18n/locales";
import { Download, ExternalLink } from "lucide-react";
import { PageHeader } from "@scoutreporter/ui/components/PageHeader";
import { JsonLd, breadcrumbLd } from "@/components/JsonLd";
import { Screenshot } from "@/components/Screenshot";
import { screenshot } from "@/lib/screenshots";
import { pageMetadata } from "@/lib/site";
import { desktopAppLd } from "@/lib/structured-data";
import { DESKTOP_RELEASES_URL, REPO_URL, latestDesktopRelease } from "@/lib/desktop-release";

export const generateMetadata = pageMetadata({
  page: "download",
  path: "/download",
});

// The newest release is looked up on GitHub at most every 10 minutes (RELEASE_CHECK_SECONDS; a
// segment config has to be a literal).
export const revalidate = 600;

const kbd = "rounded border border-line bg-surface px-1.5 text-[13px] font-semibold";

/** Inline markup in the download messages. */
const TAGS = {
  b: (c: ReactNode) => <span className="font-semibold">{c}</span>,
  kbd: (c: ReactNode) => <kbd className={kbd}>{c}</kbd>,
};

export default async function DownloadPage() {
  const release = await latestDesktopRelease();
  const locale = await getLocale();
  const t = await getTranslations("download");
  const sizeMb = release && release.bytes > 0 ? Math.round(release.bytes / 1e6) : null;
  const date = release?.publishedAt
    ? new Date(release.publishedAt).toLocaleDateString(intlTag(locale), { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-8 text-ink md:py-10">
      <JsonLd data={[desktopAppLd(release), breadcrumbLd([{ name: "Desktop app", path: "/download" }])]} />
      <PageHeader title={t("title")}>
        {t.rich("intro", { b: (c) => <span className="font-semibold text-ink">{c}</span>, kbd: TAGS.kbd })}
      </PageHeader>

      <figure className="panel overflow-hidden">
        <Screenshot
          shot={screenshot("players")}
          alt={t("screenshotAlt")}
          sizes="(min-width: 768px) 720px, 100vw"
          priority
        />
      </figure>

      <section className="panel space-y-3 px-5 py-4" aria-labelledby="get-title">
        <h2 id="get-title" className="section-title">
          {t("get.title")}
        </h2>
        {release ? (
          <>
            <a
              href={release.downloadUrl}
              className="btn h-11 gap-2 rounded-md bg-accent px-4 text-[15px] font-semibold text-on-accent hover:opacity-90"
            >
              <Download className="h-4 w-4" aria-hidden />
              {t("get.button")}
            </a>
            <p className="text-[13px] text-muted">
              {date ? t("get.versionDate", { version: release.version, date }) : t("get.version", { version: release.version })}
              {sizeMb !== null && ` · ${t("get.file", { file: release.fileName, size: sizeMb })}`} ·{" "}
              <a href={release.pageUrl} className="link">
                {t("get.releaseNotes")}
              </a>{" "}
              ·{" "}
              <a href={DESKTOP_RELEASES_URL} className="link">
                {t("get.allVersions")}
              </a>
            </p>
          </>
        ) : (
          <p className="text-sm">
            {t.rich("get.fallback", {
              ...TAGS,
              file: "Scout-Reporter-Setup-<version>.exe",
              link: (c) => (
                <a href={DESKTOP_RELEASES_URL} className="link inline-flex items-center gap-1">
                  {c} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              ),
            })}
          </p>
        )}
        <p className="text-[13px] text-muted">{t("get.requirements")}</p>
      </section>

      <section className="space-y-2" aria-labelledby="install-title">
        <h2 id="install-title" className="section-title">
          {t("install.title")}
        </h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-[15px] marker:text-muted">
          <li>{t("install.run")}</li>
          <li>{t.rich("install.smartScreen", TAGS)}</li>
          <li>{t("install.location")}</li>
        </ol>
      </section>

      <section className="space-y-2" aria-labelledby="use-title">
        <h2 id="use-title" className="section-title">
          {t("use.title")}
        </h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-[15px] marker:text-muted">
          <li>{t("use.start")}</li>
          <li>{t.rich("use.search", TAGS)}</li>
          <li>{t.rich("use.scan", TAGS)}</li>
          <li>{t.rich("use.hidden", TAGS)}</li>
        </ol>
        <p className="text-sm text-muted">{t("use.admin")}</p>
      </section>

      <section className="space-y-2" aria-labelledby="safe-title">
        <h2 id="safe-title" className="section-title">
          {t("safe.title")}
        </h2>
        <p className="text-[15px]">
          {t.rich("safe.reader", {
            path: String.raw`%APPDATA%\Scout Reporter`,
            code: (c) => <code className="text-[13px]">{c}</code>,
            github: (c) => (
              <a href={REPO_URL} className="link">
                {c}
              </a>
            ),
            fmss: (c) => (
              <a href="https://github.com/mavarobli/FMSuperScout" className="link">
                {c}
              </a>
            ),
          })}
        </p>
        <p className="text-[15px]">{t.rich("safe.updates", TAGS)}</p>
      </section>

      <p className="text-sm text-muted">
        {t.rich("website", {
          link: (c) => (
            <Link href="/how-to-use" className="link">
              {c}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
