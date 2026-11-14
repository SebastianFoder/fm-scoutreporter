"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { LINK_BUTTON_CLASS } from "@scoutreporter/ui/components/Button";
import { SegmentedControl } from "@scoutreporter/ui/components/SegmentedControl";
import { VIEW_HIDDEN, VIEW_STANDARD } from "@scoutreporter/core/view-files";
import { GRADE_SCALE, PRIME_GRADE } from "@scoutreporter/core/grades";
import { GradeBadge } from "@scoutreporter/ui/components/GradeStamp";

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
        <span className="sr-only">{open ? "Collapse" : "Expand"}</span>
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

const VIEW_OPTIONS = [
  {
    view: VIEW_HIDDEN,
    label: "Recommended",
    detail:
      "Every attribute plus the hidden Professionalism, CA and PA. Unlocks Potential scores, for finding wonderkids.",
  },
  {
    view: VIEW_STANDARD,
    label: "Attributes only",
    detail: "Every visible attribute. Enough for the player list and Best XI.",
  },
] as const;

/** Download cards for both view files, with what each one unlocks. */
function ViewDownloads() {
  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {VIEW_OPTIONS.map(({ view, label, detail }) => (
          <div key={view.href} className="rounded-md px-3 py-3 ring-1 ring-line">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-semibold">{view.name}</h3>
              <span className="text-xs text-muted">{label}</span>
            </div>
            <p className="mt-1 text-sm text-ink/85">{detail}</p>
            <a href={view.href} className={`${LINK_BUTTON_CLASS} mt-3`}>
              Download {view.name}
            </a>
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">
        Both views export the same attributes, so imports from either work everywhere. You can
        install both and switch between them in FM.
      </p>
    </div>
  );
}

type GameVersion = "fm27" | "fm26";

const EXPORTER_URL = "https://github.com/ElectroHugin/FM-View-Exporter";
const EXPORTER_RELEASES_URL = `${EXPORTER_URL}/releases`;

/** Exporter setup for FM27 and FM26. Both guides stay in the page; the toggle only hides one. */
export function SetupGuide() {
  const [version, setVersion] = useState<GameVersion>("fm27");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <span className="text-sm text-muted">Game version</span>
        <SegmentedControl
          label="Game version"
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

function Fm27SetupGuide() {
  return (
    <div>
      <Step index="01" title="Install FM View Exporter" defaultOpen>
        <p>
          We recommend{" "}
          <a href={EXPORTER_URL} target="_blank" rel="noreferrer" className="link">
            FM View Exporter
          </a>
          . It exports any player list in FM27 (squad, player database or shortlist) to CSV
          with one key press, and it ships with BepInEx, so there is nothing else to install.
          It needs FM27 on Steam and Windows 10 or 11.
        </p>

        <MiniStep title="1.1 Option A: Setup program (recommended)">
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Download <code className="font-semibold">FMViewExporter-…-setup.exe</code> from
              the{" "}
              <a href={EXPORTER_RELEASES_URL} target="_blank" rel="noreferrer" className="link">
                Releases page
              </a>{" "}
              and run it.
            </li>
            <li>
              It finds FM27 in your Steam libraries. If it doesn&apos;t, pick the folder that
              contains <code className="font-semibold">fm.exe</code>.
            </li>
            <li>
              Keep the output format on CSV and the CSV style on the default comma separator,
              then click <span className="font-bold">Install</span>.
            </li>
          </ol>
          <p className="mt-2 text-sm text-muted">
            To update later, run the new setup and click Update. Your settings are kept.
          </p>
        </MiniStep>

        <MiniStep title="1.2 Option B: Manual install">
          <p className="mb-2">
            Download <code className="font-semibold">FMViewExporter-…-komplettpaket.zip</code>{" "}
            from the{" "}
            <a href={EXPORTER_RELEASES_URL} target="_blank" rel="noreferrer" className="link">
              Releases page
            </a>{" "}
            and open your FM27 installation folder:
          </p>
          <div className="codeblock">
            <div className="text-ink/80">
              Steam: Right-click FM27 → Manage → Browse local files
            </div>
          </div>
          <p className="mt-3">
            Extract the contents of the ZIP (not the ZIP itself) into that folder. It should
            look like:
          </p>
          <pre className="codeblock mt-2">
            {`.../Steam/steamapps/common/Football Manager 27/
├── BepInEx/
├── doorstop_config.ini
├── fm.exe
├── fm_data/
└── winhttp.dll`}
          </pre>
        </MiniStep>

        <MiniStep title="1.3 First launch">
          <p>
            Start FM27. The first launch takes a few minutes while BepInEx sets itself up;
            later starts are normal speed. To check the plugin loaded, open this file in the
            game folder and look for a line mentioning{" "}
            <span className="font-semibold">FM View Exporter</span>:
          </p>
          <pre className="codeblock mt-2">{`BepInEx\\LogOutput.log`}</pre>
        </MiniStep>
      </Step>

      <Step index="02" title="Install the View">
        <p className="mb-2">Download one or both view files:</p>
        <ViewDownloads />
        <p className="mt-3">Move them to:</p>
        <pre className="codeblock mt-2">
          {`Documents\\Sports Interactive\\Football Manager 27\\views\\`}
        </pre>
      </Step>

      <Step index="03" title="Export Players from FM27">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Open your FM27 save and go to{" "}
            <span className="font-bold">Recruitment → Player Database</span> (a squad or
            shortlist works too)
          </li>
          <li>
            Right-click any column header and select{" "}
            <span className="font-bold">Import View</span>
          </li>
          <li>Import the view you downloaded in Step 2 (Hidden Attributes or Standard)</li>
          <li>
            Select that view from the{" "}
            <span className="font-bold">Custom Views</span> dropdown
            (top-right of the player list)
          </li>
          <li>
            Filter the list down to the players you want. The exporter takes every row in the
            list, not just the ones on screen.
          </li>
          <li>
            Press <span className="font-semibold">F9</span> and don&apos;t click anything until
            it finishes. The plugin scrolls the list itself; large searches can take a few
            minutes.
          </li>
        </ol>
      </Step>

      <Step index="04" title="Import the CSV">
        <p>
          Go to{" "}
          <Link
            href="/players"
            className="link"
          >
            this site&apos;s importer
          </Link>{" "}
          and click <span className="font-bold">Choose CSV file</span>.
        </p>
        <p className="mt-2">Navigate to:</p>
        <pre className="codeblock mt-2">
          {`Documents\\Sports Interactive\\FM View Exporter\\`}
        </pre>
        <p className="mt-2">
          Pick the newest file, e.g.{" "}
          <code className="font-semibold">player-database_20261030_192739.csv</code>, and
          import.
        </p>
        <p className="mt-3 font-semibold text-ink">
          You&apos;re done. Enjoy your scouting data!
        </p>
      </Step>

      <Step index="Help" title="Troubleshooting">
        <InfoBox label="F9 does nothing">
          <p>
            Check <code className="font-semibold">BepInEx\LogOutput.log</code> in the game
            folder. &ldquo;No player list found&rdquo; means no player table was open when you
            pressed F9.
          </p>
        </InfoBox>
        <InfoBox label="The game won't start">
          <p>
            Rename or delete <code className="font-semibold">winhttp.dll</code> in the game
            folder to start without mods, or uninstall with the setup program. Your saves are
            not affected.
          </p>
        </InfoBox>
        <InfoBox label="Antivirus warning">
          <p>
            Some virus scanners flag the setup because it isn&apos;t code-signed yet and
            installs BepInEx. Use the manual ZIP install if you prefer.
          </p>
        </InfoBox>
      </Step>
    </div>
  );
}

function Fm26SetupGuide() {
  return (
    <div>
      <Step index="01" title="Install BepInEx" defaultOpen>
        <MiniStep title="1.1 Download BepInEx">
          <p>
            Go to{" "}
            <a
              href="https://new.thunderstore.io/c/football-manager-26/p/BepInEx/BepInExPack_FootballManager26/"
              target="_blank"
              rel="noreferrer"
              className="link"
            >
              BepInExPack_FootballManager26
            </a>
            , click Download, and unzip the file.
          </p>
        </MiniStep>

        <MiniStep title="1.2 Copy files to your FM26 folder">
          <p className="mb-2">Open your FM26 installation folder.</p>
          <div className="codeblock">
            <div className="text-ink/80">
              Steam: Right-click FM26 → Properties → Installed Files →
              Browse
            </div>
          </div>
          <p className="mt-3">
            Paste the unzipped files there. Your folder should look like:
          </p>
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

        <MiniStep title="1.3 Linux only: set launch options">
          <p className="mb-2">
            Right-click FM26 in Steam → Properties → Launch Options, and
            paste:
          </p>
          <pre className="codeblock">
            {`WINEDLLOVERRIDES="winhttp=n,b" %command%`}
          </pre>
        </MiniStep>

        <MiniStep title="1.4 First launch">
          <p>
            Launch FM26 once so BepInEx can initialize. Confirm that the{" "}
            <code className="font-semibold">BepInEx/plugins/</code> folder now
            exists before continuing.
          </p>
        </MiniStep>
      </Step>

      <Step index="02" title="Install the Plugin">
        <p>
          Download the plugin from{" "}
          <a
            href="https://www.fmscout.com/a-fm26-player-csv-export.html"
            target="_blank"
            rel="noreferrer"
            className="link"
          >
            FM26 Player CSV Export
          </a>
          .
        </p>
        <p className="mt-2">
          Copy <code className="font-semibold">FMDataExport.dll</code> from the
          ZIP into:
        </p>
        <pre className="codeblock mt-2">
          {`.../Steam/steamapps/common/Football Manager 26/BepInEx/plugins/`}
        </pre>
      </Step>

      <Step index="03" title="Install the View">
        <p className="mb-2">Download one or both view files:</p>
        <ViewDownloads />
        <p className="mt-3">Move them to:</p>
        <pre className="codeblock mt-2">
          {`Documents\\Sports Interactive\\Football Manager 26\\views\\`}
        </pre>
      </Step>

      <Step index="04" title="Export Players from FM26">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Open your FM26 save and go to{" "}
            <span className="font-bold">
              Recruitment → Player Database
            </span>
          </li>
          <li>
            Right-click any column header and select{" "}
            <span className="font-bold">Import View</span>
          </li>
          <li>Import the view you downloaded in Step 3 (Hidden Attributes or Standard)</li>
          <li>
            Select that view from the{" "}
            <span className="font-bold">Custom Views</span> dropdown
            (top-right of the player list)
          </li>
          <li>Select the players you want to export</li>
          <li>
            Press <span className="font-semibold">F9</span> to export
          </li>
        </ol>
      </Step>

      <Step index="05" title="Import the CSV">
        <p>
          Go to{" "}
          <Link
            href="/players"
            className="link"
          >
            this site&apos;s importer
          </Link>{" "}
          and click <span className="font-bold">Choose CSV file</span>.
        </p>
        <p className="mt-2">Navigate to:</p>
        <pre className="codeblock mt-2">
          {`Documents\\Sports Interactive\\Football Manager 26\\FM26PlayerExport by vinteset\\Exports CSV\\`}
        </pre>
        <p className="mt-2">Select your exported file and import.</p>
        <p className="mt-3 font-semibold text-ink">
          You&apos;re done. Enjoy your scouting data!
        </p>
      </Step>
    </div>
  );
}

export function AttributeGuide() {
  return (
    <div>
      <Step index="Use" title="How to use the player list" defaultOpen>
        <p>
          Players lets you import a player export and instantly rank players by
          a weighted average of their FM26 attributes. No baseline required: just
          import and score.
        </p>

        <MiniStep title="1. Download a view">
          <p className="mb-2">
            Download a view and place it in your FM26 or FM27 views folder:
          </p>
          <ViewDownloads />
          <p className="mt-2 text-sm text-muted">
            See the{" "}
            <Link href="/how-to-use" className="link">
              setup guide
            </Link>{" "}
            for full exporter install instructions for each game version.
          </p>
        </MiniStep>

        <MiniStep title="2. Export players from FM">
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Open your save and go to{" "}
              <span className="font-bold">Recruitment → Player Database</span>
            </li>
            <li>
              Right-click a column header → <span className="font-bold">Import View</span> and
              load the view
            </li>
            <li>Select the view from the Custom Views dropdown</li>
            <li>Select the players you want, then press <span className="font-semibold">F9</span></li>
          </ol>
        </MiniStep>

        <MiniStep title="3. Import the CSV">
          <p>
            Go to{" "}
            <Link
              href="/players"
              className="link"
            >
              Players
            </Link>
            , click <span className="font-bold">Choose CSV file</span>, and navigate to your
            exporter&apos;s output folder:
          </p>
          <pre className="codeblock mt-2">
            {`FM27: Documents\\Sports Interactive\\FM View Exporter\\
FM26: Documents\\Sports Interactive\\Football Manager 26\\FM26PlayerExport by vinteset\\Exports CSV\\`}
          </pre>
          <p className="mt-2">
            Players are scored and sorted immediately after import.
          </p>
        </MiniStep>

        <MiniStep title="4. Tune weights and columns">
          <p>
            Click <span className="font-bold">Weights</span> to open the weight panel and drag
            each attribute importance slider. The player list re-ranks live. Click{" "}
            <span className="font-bold">Columns</span> to choose which attributes are highlighted
            in the table.
          </p>
        </MiniStep>

        <MiniStep title="5. Compare players">
          <p>
            Tick two or more players in the list and click{" "}
            <span className="font-bold">Compare selected</span> to open a side-by-side attribute
            breakdown view.
          </p>
        </MiniStep>
      </Step>

      <Step index="Math" title="How players are scored" defaultOpen>
        <p>
          Scout Reporter scores players using a weighted average of their raw FM26
          attribute values (1–20 scale), then normalises that average to a 100-point scale.
        </p>

        <InfoBox label="Weighted attribute average">
          <p>
            For each attribute you assign a weight (0 = ignore, higher = more important).
            The score is the weighted mean of all attribute values across every attribute
            with a non-zero weight. Each profile picks a weighting:
          </p>
          <pre className="codeblock mt-2">
            {`Linear:      weighted_avg = Σ(attr × weight)  / Σ(weight)
Emphasized:  weighted_avg = Σ(attr × weight²) / Σ(weight²)`}
          </pre>
          <p className="mt-2">
            <span className="font-bold">Linear</span> is how the FM27 benchmarks were calibrated
            and is the default for new profiles. <span className="font-bold">Emphasized</span>{" "}
            squares weights so doubling a weight more than doubles its influence; profiles made
            before this option keep it.
          </p>
        </InfoBox>

        <InfoBox label="FM27 benchmark profiles">
          <p>
            The Weights panel ships with five role profiles (Centre-back, Wing-back / DM (6),
            Attacker / Winger (10), Striker (9) and Goalkeeper) taken from{" "}
            <a
              href="https://github.com/jamiebolden/fm-scoring"
              target="_blank"
              rel="noreferrer"
              className="link"
            >
              fm-scoring
            </a>
            &apos;s FM27 weights, which are tuned toward harvestgreen22&apos;s FM27 match-engine
            attribute test (pace, acceleration and jumping reach matter most). Edit them freely;
            &ldquo;Reset to benchmark&rdquo; restores the originals.
          </p>
        </InfoBox>

        <InfoBox label="vs Age and Potential">
          <p>
            <span className="font-bold">vs Age</span> divides the weighted average by the FM27
            benchmark for the player&apos;s age (10.3 at 15 up to 13.8 at 24+). 100% means on track
            to be a high-end Championship / low-end Premier League player in their prime.
          </p>
          <p className="mt-2">
            With a Hidden Attributes export a <span className="font-bold">Potential</span> column appears: the
            same score using attributes projected to PA.{" "}
            <Link href="/how-to-use/wonderkids" className="link">
              How the potential estimate works
            </Link>{" "}
            explains the projection.
          </p>
        </InfoBox>

        <InfoBox label="Grades">
          <p>
            Every score gets a letter stamp, FM-style from A+ down to F, plus S, S+ and S++ above A+ for
            the truly elite. Grades read the weighted average on the 1–20 scale and step every 0.5.
            The prime benchmark (13.8, a high-end Championship / low-end Premier League player in their
            prime) is a {PRIME_GRADE}. Young players grade low on Now and high on Potential, so compare
            them with the Potential stamp or vs Age.
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-2" aria-label="Grade scale">
            {GRADE_SCALE.map((g, i) => {
              const above = GRADE_SCALE[i - 1];
              return (
                <li key={g.grade} className="inline-flex items-center gap-1.5 text-[13px]">
                  <GradeBadge grade={g.grade} tier={g.tier} delay={i * 0.25} />
                  <span className="text-muted">
                    {Number.isFinite(g.min)
                      ? above
                        ? `${g.min.toFixed(1)}–${above.min.toFixed(1)}`
                        : `${g.min.toFixed(1)}+`
                      : `under ${GRADE_SCALE[i - 1].min.toFixed(1)}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </InfoBox>

        <InfoBox label="100-point normalisation">
          <p>
            The weighted average sits on the FM 1–20 attribute scale. It is normalised so
            that a weighted average of <span className="font-semibold">13</span> (considered
            a solid professional) maps to exactly <span className="font-semibold">100</span>.
            Scores above 100 indicate above-average players for your weight profile; below 100
            means below average.
          </p>
          <pre className="codeblock mt-2">
            {`score = (weighted_avg / 13) × 100`}
          </pre>
        </InfoBox>

        <InfoBox label="Attribute categories">
          <p>
            Attributes are grouped into four categories (Technical, Mental, Physical and
            Goalkeeping), matching FM26&apos;s own groupings. You can weight attributes from any
            category in the same profile, so a goalkeeper weight set can include physical
            and mental attributes alongside GK-specific ones.
          </p>
        </InfoBox>

        <InfoBox label="Player detail & comparison">
          <p>
            Clicking a player opens their full attribute sheet with colour-coded values
            (excellent / good / average / low) based on your theme settings. The compare view
            places two or more players side-by-side with differences highlighted, making it
            easy to spot where one player outperforms another for your specific role needs.
          </p>
        </InfoBox>
      </Step>
    </div>
  );
}

export function WonderkidGuide() {
  return (
    <div>
      <Step index="Use" title="How to find wonderkids" defaultOpen>
        <MiniStep title="1. Export with the Hidden Attributes view">
          <p>
            Import the Hidden Attributes view in FM and export as usual. It adds the hidden{" "}
            <span className="font-bold">Professionalism</span>, <span className="font-bold">CA</span>{" "}
            and <span className="font-bold">PA</span>. Standard view exports, or players without CA/PA, are
            still scored on their current attributes.
          </p>
        </MiniStep>
        <MiniStep title="2. Import and sort">
          <p>
            Import it on{" "}
            <Link
              href="/players"
              className="link"
            >
              Players
            </Link>{" "}
            and sort by <span className="font-bold">Potential</span> (the score at full potential on
            the weight profile you picked) or <span className="font-bold">vs Age</span> (how far ahead of
            their age they are now).
          </p>
        </MiniStep>
        <MiniStep title="3. Inspect a prospect">
          <p>
            Click a player and switch to <span className="font-bold">Full potential</span> to see
            the estimated attributes at PA, with the gain per attribute. The{" "}
            <span className="font-bold">Development plan</span> below suggests the individual focus,
            training role, development sessions and coaches that get the most out of them.
          </p>
        </MiniStep>
      </Step>

      <Step index="Math" title="How the full-potential estimate works" defaultOpen>
        <InfoBox label="CA is a cost-weighted attribute sum">
          <p>
            Each attribute point costs a position-specific amount of CA (fm-scoring&apos;s FM27 CA
            cost table, e.g. Decisions 10 and Agility 8 for a keeper). On a Hidden Attributes export of 109
            keepers, CA fits the cost-weighted sum almost exactly (r = 0.99, error ≈ 2.5 CA). The
            fit is recalibrated on every import that has CA.
          </p>
          <pre className="codeblock mt-2">
            {`A       = Σ(cost × attr) / Σ(cost)
CA      ≈ slope × A + intercept
A at PA = A + (PA − CA) / slope`}
          </pre>
        </InfoBox>
        <InfoBox label="Spreading the growth">
          <p>
            The extra points are spread over attributes that can still grow, each in proportion
            to its room below 20 and to how fast it grew in harvestgreen22&apos;s FM27 training test
            (an 18-year-old training for a season, collected in fm-scoring). Defenders, wing-backs
            and DMs grow like the defensive ball work schedules, central midfielders like a mix,
            and wide players, AMs and strikers like the attacking ball work schedules. Keepers
            weren&apos;t tested: their goalkeeping-coached attributes grow at the outfield coached rate.
            Physicals slow down after 21 (¾ rate to 24, then 0.4), three years later for keepers.
            Determination, Aggression, Bravery and the keeper tendencies stay put, and outfielders
            never grow goalkeeping attributes. Multi-position players use the average cost and
            growth of their positions.
          </p>
        </InfoBox>
        <InfoBox label="Reading the numbers">
          <p>
            <span className="font-bold">Now</span> and <span className="font-bold">Potential</span>{" "}
            are the best FM27 benchmark role score (1–20). <span className="font-bold">vs Prime</span>{" "}
            compares the potential score to 13.8, the fully developed benchmark. It is an estimate
            of the ceiling: professionalism, minutes and training decide how much of PA a player
            reaches.
          </p>
        </InfoBox>
      </Step>
    </div>
  );
}
