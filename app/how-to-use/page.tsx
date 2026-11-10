"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { LINK_BUTTON_CLASS } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";

type Tab = "setup" | "attribute" | "wonderkid";

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

function SetupGuideTab() {
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

        <MiniStep title="1.3 Linux only — Set launch options">
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
        <p className="mb-2">Download the view file:</p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/SCOUT%20REPORTER%20Attributes%20v2.fmf"
            className={LINK_BUTTON_CLASS}
          >
            Download Attribute View
          </a>
        </div>
        <p className="mt-3">Move it to:</p>
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
          <li>Import the correct view you downloaded in Step 3 for your mode</li>
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
            href="/attribute"
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
          You&apos;re done — enjoy your scouting data!
        </p>
      </Step>
    </div>
  );
}

function AttributeTab() {
  return (
    <div>
      <Step index="Use" title="How to use Attribute mode" defaultOpen>
        <p>
          Attribute mode lets you import a player export and instantly rank players by
          a weighted average of their FM26 attributes. No baseline required — just
          import and score.
        </p>

        <MiniStep title="1. Download and import the Attribute View">
          <p className="mb-2">
            Download the Attribute View and place it in your FM26 views folder:
          </p>
          <a
            href="/SCOUT%20REPORTER%20Attributes%20v2.fmf"
            className={LINK_BUTTON_CLASS}
          >
            Download Attribute View (v2)
          </a>
          <p className="mt-2 text-sm text-muted">
            v2 adds Professionalism, CA and PA columns, which enable full-potential estimates
            and Wonderkid mode. v1 exports still import fine.
          </p>
          <p className="mt-2 text-sm text-muted">
            See the Setup Guide tab for full BepInEx + plugin install instructions.
          </p>
        </MiniStep>

        <MiniStep title="2. Export players from FM26">
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Open your save and go to{" "}
              <span className="font-bold">Recruitment → Player Database</span>
            </li>
            <li>
              Right-click a column header → <span className="font-bold">Import View</span> and
              load the Attribute View
            </li>
            <li>Select the Attribute View from the Custom Views dropdown</li>
            <li>Select the players you want, then press <span className="font-semibold">F9</span></li>
          </ol>
        </MiniStep>

        <MiniStep title="3. Import the CSV">
          <p>
            Go to{" "}
            <Link
              href="/attribute"
              className="link"
            >
              Attribute Mode
            </Link>
            , click <span className="font-bold">Choose CSV file</span>, and navigate to:
          </p>
          <pre className="codeblock mt-2">
            {`Documents\\Sports Interactive\\Football Manager 26\\FM26PlayerExport by vinteset\\Exports CSV\\`}
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

      <Step index="Math" title="How Attribute mode scores players" defaultOpen>
        <p>
          Attribute mode scores players using a weighted average of their raw FM26
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
            With a v2 export a <span className="font-bold">Potential</span> column appears: the
            same score using attributes projected to PA. The Wonderkid tab explains the
            projection.
          </p>
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
            Attributes are grouped into four categories — Technical, Mental, Physical, and
            Goalkeeping — matching FM26&apos;s own groupings. You can weight attributes from any
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

function WonderkidTab() {
  return (
    <div>
      <Step index="Use" title="How to use Wonderkid mode" defaultOpen>
        <MiniStep title="1. Export with the v2 view">
          <p>
            Import the Attribute View (v2) in FM and export as usual. It adds{" "}
            <span className="font-bold">Professionalism</span>, <span className="font-bold">CA</span>{" "}
            and <span className="font-bold">PA</span>. Players without CA/PA are still scored on
            their current attributes.
          </p>
        </MiniStep>
        <MiniStep title="2. Import and filter">
          <p>
            Open{" "}
            <Link
              href="/wonderkid"
              className="link"
            >
              Wonderkid Mode
            </Link>{" "}
            (it shares the import with Attribute mode). Filter by max age, minimum
            professionalism and best role; sort by Potential, vs Prime or vs Age.
          </p>
        </MiniStep>
        <MiniStep title="3. Inspect a prospect">
          <p>
            Click a player and switch to <span className="font-bold">Full potential</span> to see
            the estimated attributes at PA, with the gain per attribute.
          </p>
        </MiniStep>
      </Step>

      <Step index="Math" title="How the full-potential estimate works" defaultOpen>
        <InfoBox label="CA is a cost-weighted attribute sum">
          <p>
            Each attribute point costs a position-specific amount of CA (fm-scoring&apos;s FM27 CA
            cost table, e.g. Decisions 10 and Agility 8 for a keeper). On a v2 export of 109
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
            The extra points are spread over attributes that can still grow, in proportion to
            their room below 20. Attributes that cost CA for the player&apos;s positions grow at
            full rate, others at half. Physicals slow down after 21 (¾ rate to 24, then 0.4).
            Determination, Flair, Aggression, Bravery, Leadership, Natural Fitness and the
            keeper tendencies stay put. Multi-position players use the average cost of their
            positions.
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

const TABS: { id: Tab; label: string }[] = [
  { id: "setup", label: "Setup Guide" },
  { id: "attribute", label: "Attribute" },
  { id: "wonderkid", label: "Wonderkid" },
];

export default function HowToUsePage() {
  const [activeTab, setActiveTab] = useState<Tab>("setup");

  const headerInfo: Record<Tab, { title: string; description: string; link?: { href: string; label: string } }> = {
    setup: {
      title: "Setup Guide",
      description: "Follow these steps to export a player list from Football Manager 26 and import it into this app.",
      link: { href: "/attribute", label: "Go to the importer" },
    },
    attribute: {
      title: "Attribute Mode",
      description: "Score and rank players by a weighted average of their FM26 attributes. No baseline needed: import and go.",
      link: { href: "/attribute", label: "Go to Attribute Mode" },
    },
    wonderkid: {
      title: "Wonderkid Mode",
      description: "Estimate full-potential attributes from a v2 export (CA, PA, Professionalism) and rank prospects on benchmarked FM27 roles.",
      link: { href: "/wonderkid", label: "Go to Wonderkid Mode" },
    },
  };

  const info = headerInfo[activeTab];

  return (
    <div className="text-ink">
      <main className="mx-auto flex max-w-4xl flex-col gap-5 px-5 py-6 md:py-8">
        <PageHeader title={info.title}>
          {info.description}{" "}
          {info.link && (
            <Link href={info.link.href} className="link">
              {info.link.label}
            </Link>
          )}
        </PageHeader>

        <nav className="flex overflow-x-auto border-b border-line" aria-label="Page sections">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={active ? "page" : undefined}
                className={[
                  "-mb-px shrink-0 cursor-pointer border-b-2 px-4 py-2 text-sm",
                  active
                    ? "border-accent font-semibold text-ink"
                    : "border-transparent text-muted hover:text-ink",
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="panel overflow-hidden">
          {activeTab === "setup" && <SetupGuideTab />}
          {activeTab === "attribute" && <AttributeTab />}
          {activeTab === "wonderkid" && <WonderkidTab />}
        </div>
      </main>
    </div>
  );
}
