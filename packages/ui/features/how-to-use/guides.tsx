"use client";

import { Link } from "../../i18n/navigation";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { LINK_BUTTON_CLASS } from "@scoutreporter/ui/components/Button";
import { SegmentedControl } from "@scoutreporter/ui/components/SegmentedControl";
import { VIEW_HIDDEN, VIEW_STANDARD } from "@scoutreporter/core/view-files";
import { GRADE_SCALE, PRIME_GRADE } from "@scoutreporter/core/grades";
import { GradeBadge } from "@scoutreporter/ui/components/GradeStamp";
import { useFormatNumber } from "@scoutreporter/ui/i18n/hooks";

/** Inline markup shared by the guides' messages: <b>, <sb> (semibold) and <code>. */
const TAGS = {
  b: (c: ReactNode) => <span className="font-bold">{c}</span>,
  sb: (c: ReactNode) => <span className="font-semibold">{c}</span>,
  code: (c: ReactNode) => <code className="font-semibold">{c}</code>,
};

/** A <link> tag for a page of this site. */
function internal(href: string) {
  return function internalLink(c: ReactNode) {
    return (
      <Link href={href} className="link">
        {c}
      </Link>
    );
  };
}

/** A tag for an external link, opened in a new tab. */
function external(href: string) {
  return function externalLink(c: ReactNode) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="link">
        {c}
      </a>
    );
  };
}

/** Collapsible documentation section. Numbered only where the steps are a sequence. */
function Step({
  index,
  title,
  children,
  defaultOpen,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const numbered = /^\d+$/.test(index);
  const t = useTranslations("howTo.step");

  return (
    <div className="border-b border-line last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left hover:bg-paper"
        aria-expanded={open}
      >
        {numbered && (
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
              open ? "bg-accent text-on-accent" : "bg-paper text-muted ring-1 ring-line"
            }`}
          >
            {Number(index)}
          </span>
        )}
        <h2 className="flex-1 text-base font-semibold">{title}</h2>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
        <span className="sr-only">{open ? t("collapse") : t("expand")}</span>
      </button>

      <div
        className={[
          "grid transition-[grid-template-rows] duration-150 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        ].join(" ")}
      >
        <div className="overflow-hidden">
          <div className={`space-y-3 px-4 pb-5 text-[15px] leading-relaxed ${numbered ? "sm:pl-13" : ""}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStep({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-1">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-1 text-ink/85">{children}</div>
    </div>
  );
}

function InfoBox({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-1">
      <h3 className="font-semibold">{label}</h3>
      <div className="mt-1 text-ink/85">{children}</div>
    </div>
  );
}

/** The view files, by their key in howTo.views. */
const VIEW_OPTIONS = [
  { view: VIEW_HIDDEN, key: "hidden" },
  { view: VIEW_STANDARD, key: "standard" },
] as const;

/** Download cards for both view files, with what each one unlocks. */
function ViewDownloads() {
  const t = useTranslations("howTo.views");
  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {VIEW_OPTIONS.map(({ view, key }) => (
          <div key={view.href} className="rounded-md px-3 py-3 ring-1 ring-line">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-semibold">{t(`${key}.name`)}</h3>
              <span className="text-xs text-muted">{t(`${key}.label`)}</span>
            </div>
            <p className="mt-1 text-sm text-ink/85">{t(`${key}.detail`)}</p>
            <a href={view.href} className={`${LINK_BUTTON_CLASS} mt-3`}>
              {t("download", { name: t(`${key}.name`) })}
            </a>
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">{t("both")}</p>
    </div>
  );
}

type GameVersion = "fm27" | "fm26";

const EXPORTER_URL = "https://github.com/ElectroHugin/FM-View-Exporter";
const EXPORTER_RELEASES_URL = `${EXPORTER_URL}/releases`;

/** Exporter setup for FM27 and FM26. Both guides stay in the page; the toggle only hides one. */
export function SetupGuide() {
  const [version, setVersion] = useState<GameVersion>("fm27");
  const t = useTranslations("howTo.setup");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <span className="text-sm text-muted">{t("gameVersion")}</span>
        <SegmentedControl
          label={t("gameVersion")}
          size="sm"
          value={version}
          onChange={setVersion}
          options={(["fm27", "fm26"] as const).map((v) => ({ value: v, label: v.toUpperCase() }))}
        />
      </div>
      <div hidden={version !== "fm27"}>
        <Fm27SetupGuide />
      </div>
      <div hidden={version !== "fm26"}>
        <Fm26SetupGuide />
      </div>
    </div>
  );
}

/** "Install the View": the view downloads and the game's views folder. */
function InstallViewStep({ index, viewsFolder }: { index: string; viewsFolder: string }) {
  const t = useTranslations("howTo.setup.installView");
  return (
    <Step index={index} title={t("title")}>
      <p className="mb-2">{t("download")}</p>
      <ViewDownloads />
      <p className="mt-3">{t("moveTo")}</p>
      <pre className="codeblock mt-2">{viewsFolder}</pre>
    </Step>
  );
}

/** The CSV import step: this site's importer, then the exporter's output folder. */
function ImportCsvStep({ index, folder, pick }: { index: string; folder: string; pick: ReactNode }) {
  const t = useTranslations("howTo.setup.importCsv");
  return (
    <Step index={index} title={t("title")}>
      <p>{t.rich("goTo", { ...TAGS, link: internal("/players") })}</p>
      <p className="mt-2">{t("navigateTo")}</p>
      <pre className="codeblock mt-2">{folder}</pre>
      <p className="mt-2">{pick}</p>
      <p className="mt-3 font-semibold text-ink">{t("done")}</p>
    </Step>
  );
}

function Fm27SetupGuide() {
  const t = useTranslations("howTo.setup");
  const releases = external(EXPORTER_RELEASES_URL);

  return (
    <div>
      <Step index="01" title={t("fm27.install.title")} defaultOpen>
        <p>{t.rich("fm27.install.intro", { link: external(EXPORTER_URL) })}</p>

        <MiniStep title={t("fm27.install.setupTitle")}>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              {t.rich("fm27.install.setupDownload", {
                ...TAGS,
                file: "FMViewExporter-…-setup.exe",
                link: releases,
              })}
            </li>
            <li>{t.rich("fm27.install.setupFind", { ...TAGS, file: "fm.exe" })}</li>
            <li>{t.rich("fm27.install.setupInstall", TAGS)}</li>
          </ol>
          <p className="mt-2 text-sm text-muted">{t("fm27.install.setupUpdate")}</p>
        </MiniStep>

        <MiniStep title={t("fm27.install.manualTitle")}>
          <p className="mb-2">
            {t.rich("fm27.install.manualDownload", {
              ...TAGS,
              file: "FMViewExporter-…-komplettpaket.zip",
              link: releases,
            })}
          </p>
          <div className="codeblock">
            <div className="text-ink/80">{t("fm27.install.manualSteam")}</div>
          </div>
          <p className="mt-3">{t("fm27.install.manualExtract")}</p>
          <pre className="codeblock mt-2">
            {`.../Steam/steamapps/common/Football Manager 27/
├── BepInEx/
├── doorstop_config.ini
├── fm.exe
├── fm_data/
└── winhttp.dll`}
          </pre>
        </MiniStep>

        <MiniStep title={t("fm27.install.firstLaunchTitle")}>
          <p>{t.rich("fm27.install.firstLaunch", TAGS)}</p>
          <pre className="codeblock mt-2">{`BepInEx\\LogOutput.log`}</pre>
        </MiniStep>
      </Step>

      <InstallViewStep index="02" viewsFolder={`Documents\\Sports Interactive\\Football Manager 27\\views\\`} />

      <Step index="03" title={t("export.title", { game: "FM27" })}>
        <ol className="list-decimal space-y-2 pl-5">
          <li>{t.rich("fm27.export.open", TAGS)}</li>
          <li>{t.rich("export.importView", TAGS)}</li>
          <li>{t("export.importDownloaded", { step: 2 })}</li>
          <li>{t.rich("export.selectView", TAGS)}</li>
          <li>{t("fm27.export.filter")}</li>
          <li>{t.rich("fm27.export.press", TAGS)}</li>
        </ol>
      </Step>

      <ImportCsvStep
        index="04"
        folder={`Documents\\Sports Interactive\\FM View Exporter\\`}
        pick={t.rich("fm27.pickFile", { ...TAGS, file: "player-database_20261030_192739.csv" })}
      />

      <Step index="Help" title={t("fm27.help.title")}>
        <InfoBox label={t("fm27.help.f9Title")}>
          <p>{t.rich("fm27.help.f9", { ...TAGS, file: "BepInEx\\LogOutput.log" })}</p>
        </InfoBox>
        <InfoBox label={t("fm27.help.startTitle")}>
          <p>{t.rich("fm27.help.start", { ...TAGS, file: "winhttp.dll" })}</p>
        </InfoBox>
        <InfoBox label={t("fm27.help.antivirusTitle")}>
          <p>{t("fm27.help.antivirus")}</p>
        </InfoBox>
      </Step>
    </div>
  );
}

function Fm26SetupGuide() {
  const t = useTranslations("howTo.setup");

  return (
    <div>
      <Step index="01" title={t("fm26.bepinex.title")} defaultOpen>
        <MiniStep title={t("fm26.bepinex.downloadTitle")}>
          <p>
            {t.rich("fm26.bepinex.download", {
              link: external(
                "https://new.thunderstore.io/c/football-manager-26/p/BepInEx/BepInExPack_FootballManager26/",
              ),
            })}
          </p>
        </MiniStep>

        <MiniStep title={t("fm26.bepinex.copyTitle")}>
          <p className="mb-2">{t("fm26.bepinex.openFolder")}</p>
          <div className="codeblock">
            <div className="text-ink/80">{t("fm26.bepinex.steam")}</div>
          </div>
          <p className="mt-3">{t("fm26.bepinex.paste")}</p>
          <pre className="codeblock mt-2">
            {`.../Steam/steamapps/common/Football Manager 26/
├── BepInEx/
├── changelog.txt
├── fm.exe
├── fm_data/
├── dotnet/
├── libdoorstop.so
└── run_bepinex.sh`}
          </pre>
        </MiniStep>

        <MiniStep title={t("fm26.bepinex.linuxTitle")}>
          <p className="mb-2">{t("fm26.bepinex.linux")}</p>
          <pre className="codeblock">
            {`WINEDLLOVERRIDES="winhttp=n,b" %command%`}
          </pre>
        </MiniStep>

        <MiniStep title={t("fm26.bepinex.firstLaunchTitle")}>
          <p>{t.rich("fm26.bepinex.firstLaunch", { ...TAGS, folder: "BepInEx/plugins/" })}</p>
        </MiniStep>
      </Step>

      <Step index="02" title={t("fm26.plugin.title")}>
        <p>
          {t.rich("fm26.plugin.download", {
            link: external("https://www.fmscout.com/a-fm26-player-csv-export.html"),
          })}
        </p>
        <p className="mt-2">{t.rich("fm26.plugin.copy", { ...TAGS, file: "FMDataExport.dll" })}</p>
        <pre className="codeblock mt-2">
          {`.../Steam/steamapps/common/Football Manager 26/BepInEx/plugins/`}
        </pre>
      </Step>

      <InstallViewStep index="03" viewsFolder={`Documents\\Sports Interactive\\Football Manager 26\\views\\`} />

      <Step index="04" title={t("export.title", { game: "FM26" })}>
        <ol className="list-decimal space-y-2 pl-5">
          <li>{t.rich("fm26.export.open", TAGS)}</li>
          <li>{t.rich("export.importView", TAGS)}</li>
          <li>{t("export.importDownloaded", { step: 3 })}</li>
          <li>{t.rich("export.selectView", TAGS)}</li>
          <li>{t("fm26.export.select")}</li>
          <li>{t.rich("fm26.export.press", TAGS)}</li>
        </ol>
      </Step>

      <ImportCsvStep
        index="05"
        folder={`Documents\\Sports Interactive\\Football Manager 26\\FM26PlayerExport by vinteset\\Exports CSV\\`}
        pick={t("fm26.selectFile")}
      />
    </div>
  );
}

export function AttributeGuide() {
  const t = useTranslations("howTo.players");
  const formatNumber = useFormatNumber();
  const oneDecimal = (n: number) => formatNumber(n, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <div>
      <Step index="Use" title={t("use.title")} defaultOpen>
        <p>{t("use.intro")}</p>

        <MiniStep title={t("use.download.title")}>
          <p className="mb-2">{t("use.download.intro")}</p>
          <ViewDownloads />
          <p className="mt-2 text-sm text-muted">
            {t.rich("use.download.more", { link: internal("/how-to-use") })}
          </p>
        </MiniStep>

        <MiniStep title={t("use.export.title")}>
          <ol className="list-decimal space-y-1 pl-5">
            <li>{t.rich("use.export.open", TAGS)}</li>
            <li>{t.rich("use.export.importView", TAGS)}</li>
            <li>{t("use.export.selectView")}</li>
            <li>{t.rich("use.export.press", TAGS)}</li>
          </ol>
        </MiniStep>

        <MiniStep title={t("use.import.title")}>
          <p>{t.rich("use.import.goTo", { ...TAGS, link: internal("/players") })}</p>
          <pre className="codeblock mt-2">
            {`FM27: Documents\\Sports Interactive\\FM View Exporter\\
FM26: Documents\\Sports Interactive\\Football Manager 26\\FM26PlayerExport by vinteset\\Exports CSV\\`}
          </pre>
          <p className="mt-2">{t("use.import.after")}</p>
        </MiniStep>

        <MiniStep title={t("use.tune.title")}>
          <p>{t.rich("use.tune.body", TAGS)}</p>
        </MiniStep>

        <MiniStep title={t("use.compare.title")}>
          <p>{t.rich("use.compare.body", TAGS)}</p>
        </MiniStep>
      </Step>

      <Step index="Math" title={t("math.title")} defaultOpen>
        <p>{t("math.intro")}</p>

        <InfoBox label={t("math.weighted.title")}>
          <p>{t("math.weighted.body")}</p>
          <pre className="codeblock mt-2">
            {`Linear:      weighted_avg = Σ(attr × weight)  / Σ(weight)
Emphasized:  weighted_avg = Σ(attr × weight²) / Σ(weight²)`}
          </pre>
          <p className="mt-2">{t.rich("math.weighted.modes", TAGS)}</p>
        </InfoBox>

        <InfoBox label={t("math.benchmarks.title")}>
          <p>
            {t.rich("math.benchmarks.body", {
              study: external(
                "https://github.com/caiograco289/Fm-Match-Lab/blob/main/docs/studies/13b-value-by-position-random.md",
              ),
              arena: external(
                "https://fm-arena.com/threads/attribute-importance-by-position-in-fm27-a-test-on-my-own-tactic.125/",
              ),
              tactics: external(
                "https://fm-arena.com/threads/attribute-test-of-meta-tactic-chatgpt-2-1-4-3-sseulitob-25-11-2026.456/",
              ),
              update: external(
                "https://github.com/caiograco289/Fm-Match-Lab/blob/main/docs/studies/30-game-update-27-1.md",
              ),
              scoring: external("https://github.com/jamiebolden/fm-scoring"),
            })}
          </p>
        </InfoBox>

        <InfoBox label={t("math.vsAge.title")}>
          <p>{t.rich("math.vsAge.vsAge", TAGS)}</p>
          <p className="mt-2">
            {t.rich("math.vsAge.potential", { ...TAGS, link: internal("/how-to-use/wonderkids") })}
          </p>
        </InfoBox>

        <InfoBox label={t("math.grades.title")}>
          <p>{t("math.grades.body", { grade: PRIME_GRADE })}</p>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-2" aria-label={t("math.grades.scale")}>
            {GRADE_SCALE.map((g, i) => {
              const above = GRADE_SCALE[i - 1];
              return (
                <li key={g.grade} className="inline-flex items-center gap-1.5 text-[13px]">
                  <GradeBadge grade={g.grade} tier={g.tier} delay={i * 0.25} />
                  <span className="text-muted">
                    {Number.isFinite(g.min)
                      ? above
                        ? `${oneDecimal(g.min)}–${oneDecimal(above.min)}`
                        : `${oneDecimal(g.min)}+`
                      : t("math.grades.under", { value: oneDecimal(GRADE_SCALE[i - 1].min) })}
                  </span>
                </li>
              );
            })}
          </ul>
        </InfoBox>

        <InfoBox label={t("math.normalisation.title")}>
          <p>{t.rich("math.normalisation.body", TAGS)}</p>
          <pre className="codeblock mt-2">
            {`score = (weighted_avg / 13) × 100`}
          </pre>
        </InfoBox>

        <InfoBox label={t("math.categories.title")}>
          <p>{t("math.categories.body")}</p>
        </InfoBox>

        <InfoBox label={t("math.detail.title")}>
          <p>{t("math.detail.body")}</p>
        </InfoBox>
      </Step>
    </div>
  );
}

export function WonderkidGuide() {
  const t = useTranslations("howTo.wonderkids");

  return (
    <div>
      <Step index="Use" title={t("use.title")} defaultOpen>
        <MiniStep title={t("use.export.title")}>
          <p>{t.rich("use.export.body", TAGS)}</p>
        </MiniStep>
        <MiniStep title={t("use.import.title")}>
          <p>{t.rich("use.import.body", { ...TAGS, link: internal("/players") })}</p>
        </MiniStep>
        <MiniStep title={t("use.inspect.title")}>
          <p>{t.rich("use.inspect.body", TAGS)}</p>
        </MiniStep>
      </Step>

      <Step index="Math" title={t("math.title")} defaultOpen>
        <InfoBox label={t("math.ca.title")}>
          <p>{t("math.ca.body")}</p>
          <pre className="codeblock mt-2">
            {`A       = Σ(cost × attr) / Σ(cost)
CA      ≈ slope × A + intercept
A at PA = A + (PA − CA) / slope`}
          </pre>
        </InfoBox>
        <InfoBox label={t("math.growth.title")}>
          <p>{t("math.growth.body")}</p>
        </InfoBox>
        <InfoBox label={t("math.reading.title")}>
          <p>{t.rich("math.reading.body", TAGS)}</p>
        </InfoBox>
      </Step>
    </div>
  );
}
