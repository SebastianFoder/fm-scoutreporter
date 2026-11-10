"use client";

import Link from "next/link";
import { useState } from "react";

type Tab = "setup" | "attribute";

function Step({
  title,
  children,
  defaultOpen,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));

  return (
    <div className="rounded-lg border-2 border-[oklch(var(--border))] bg-[oklch(var(--surface))] px-5 py-4 shadow-[4px_4px_0_oklch(var(--border))]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between cursor-pointer gap-4 text-left"
        aria-expanded={open}
      >
        <h2 className="text-base font-black uppercase tracking-wide">{title}</h2>
        <span className="rounded-lg border-2 border-[oklch(var(--border))] px-2 py-0.5 text-xs font-bold">
          {open ? "Collapse" : "Expand"}
        </span>
      </button>

      <div
        className={[
          "mt-3 grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        ].join(" ")}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 text-sm text-[oklch(var(--text))/0.9]">
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
    <div className="rounded-lg border-2 border-[oklch(var(--border))]/50 bg-[oklch(var(--background))] p-4">
      <h3 className="text-sm font-bold">{title}</h3>
      <div className="mt-2 text-sm text-[oklch(var(--text))/0.85]">
        {children}
      </div>
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
    <div className="rounded-lg border-2 border-[oklch(var(--border))]/50 bg-[oklch(var(--background))] p-4">
      <p className="text-xs font-black uppercase tracking-wider text-[oklch(var(--text))]/60 mb-1">
        {label}
      </p>
      <div className="text-sm text-[oklch(var(--text))/0.85]">{children}</div>
    </div>
  );
}

function SetupGuideTab() {
  return (
    <div className="space-y-4">
      <Step title="Step 1: Install BepInEx" defaultOpen>
        <MiniStep title="1.1 Download BepInEx">
          <p>
            Go to{" "}
            <a
              href="https://new.thunderstore.io/c/football-manager-26/p/BepInEx/BepInExPack_FootballManager26/"
              target="_blank"
              rel="noreferrer"
              className="font-bold text-[oklch(var(--primary))] underline decoration-2 underline-offset-2 hover:decoration-[oklch(var(--alt))]"
            >
              BepInExPack_FootballManager26
            </a>
            , click Download, and unzip the file.
          </p>
        </MiniStep>

        <MiniStep title="1.2 Copy files to your FM26 folder">
          <p className="mb-2">Open your FM26 installation folder.</p>
          <div className="rounded-lg border-2 border-[oklch(var(--border))]/40 bg-[oklch(var(--background))] p-3 font-mono text-xs">
            <div className="text-[oklch(var(--text))/0.8]">
              Steam: Right-click FM26 → Properties → Installed Files →
              Browse
            </div>
          </div>
          <p className="mt-3">
            Paste the unzipped files there. Your folder should look like:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg border-2 border-[oklch(var(--border))]/40 bg-[oklch(var(--background))] p-3 font-mono text-xs">
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
          <pre className="overflow-x-auto rounded-lg border-2 border-[oklch(var(--border))]/40 bg-[oklch(var(--background))] p-3 font-mono text-xs">
            {`WINEDLLOVERRIDES="winhttp=n,b" %command%`}
          </pre>
        </MiniStep>

        <MiniStep title="1.4 First launch">
          <p>
            Launch FM26 once so BepInEx can initialize. Confirm that the{" "}
            <code className="font-mono font-bold">BepInEx/plugins/</code> folder now
            exists before continuing.
          </p>
        </MiniStep>
      </Step>

      <Step title="Step 2: Install the Plugin">
        <p>
          Download the plugin from{" "}
          <a
            href="https://www.fmscout.com/a-fm26-player-csv-export.html"
            target="_blank"
            rel="noreferrer"
            className="font-bold text-[oklch(var(--primary))] underline decoration-2 underline-offset-2 hover:decoration-[oklch(var(--alt))]"
          >
            FM26 Player CSV Export
          </a>
          .
        </p>
        <p className="mt-2">
          Copy <code className="font-mono font-bold">FMDataExport.dll</code> from the
          ZIP into:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg border-2 border-[oklch(var(--border))]/40 bg-[oklch(var(--background))] p-3 font-mono text-xs">
          {`.../Steam/steamapps/common/Football Manager 26/BepInEx/plugins/`}
        </pre>
      </Step>

      <Step title="Step 3: Install the View">
        <p className="mb-2">Download the view file:</p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/SCOUT%20REPORTER%20Attributes%20v1.fmf"
            className="inline-flex items-center rounded-lg border-2 border-[oklch(var(--border))] bg-[oklch(var(--primary))] px-4 py-2 text-sm font-bold text-[oklch(var(--background))] shadow-[2px_2px_0_oklch(var(--border))] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_oklch(var(--border))]"
          >
            Download Attribute View
          </a>
        </div>
        <p className="mt-3">Move it to:</p>
        <pre className="mt-2 overflow-x-auto rounded-lg border-2 border-[oklch(var(--border))]/40 bg-[oklch(var(--background))] p-3 font-mono text-xs">
          {`Documents\\Sports Interactive\\Football Manager 26\\views\\`}
        </pre>
      </Step>

      <Step title="Step 4: Export Players from FM26">
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
            Press <span className="font-mono font-bold">F9</span> to export
          </li>
        </ol>
      </Step>

      <Step title="Step 5: Import the CSV">
        <p>
          Go to{" "}
          <Link
            href="/attribute"
            className="font-bold text-[oklch(var(--primary))] underline decoration-2 underline-offset-2 hover:decoration-[oklch(var(--alt))]"
          >
            this site&apos;s importer
          </Link>{" "}
          and click <span className="font-bold">Choose CSV file</span>.
        </p>
        <p className="mt-2">Navigate to:</p>
        <pre className="mt-2 overflow-x-auto rounded-lg border-2 border-[oklch(var(--border))]/40 bg-[oklch(var(--background))] p-3 font-mono text-xs">
          {`Documents\\Sports Interactive\\Football Manager 26\\FM26PlayerExport by vinteset\\Exports CSV\\`}
        </pre>
        <p className="mt-2">Select your exported file and import.</p>
        <p className="mt-3 font-bold text-[oklch(var(--text))/0.85]">
          You&apos;re done — enjoy your scouting data!
        </p>
      </Step>
    </div>
  );
}

function AttributeTab() {
  return (
    <div className="space-y-6">
      <Step title="How to Use — Attribute Mode" defaultOpen>
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
            href="/SCOUT%20REPORTER%20Attributes%20v1.fmf"
            className="inline-flex items-center rounded-lg border-2 border-[oklch(var(--border))] bg-[oklch(var(--primary))] px-4 py-2 text-sm font-bold text-[oklch(var(--background))] shadow-[2px_2px_0_oklch(var(--border))] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_oklch(var(--border))]"
          >
            Download Attribute View
          </a>
          <p className="mt-2 text-xs text-[oklch(var(--text))]/65">
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
            <li>Select the players you want, then press <span className="font-mono font-bold">F9</span></li>
          </ol>
        </MiniStep>

        <MiniStep title="3. Import the CSV">
          <p>
            Go to{" "}
            <Link
              href="/attribute"
              className="font-bold text-[oklch(var(--primary))] underline decoration-2 underline-offset-2 hover:decoration-[oklch(var(--alt))]"
            >
              Attribute Mode
            </Link>
            , click <span className="font-bold">Choose CSV file</span>, and navigate to:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg border-2 border-[oklch(var(--border))]/40 bg-[oklch(var(--background))] p-3 font-mono text-xs">
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

      <Step title="How it Works — Attribute Mode" defaultOpen>
        <p>
          Attribute mode scores players using a weighted average of their raw FM26
          attribute values (1–20 scale), then normalises that average to a 100-point scale.
        </p>

        <InfoBox label="Weighted attribute average">
          <p>
            For each attribute you assign a weight (0 = ignore, higher = more important).
            The score is the weighted mean of all attribute values across every attribute
            with a non-zero weight:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg border-2 border-[oklch(var(--border))]/40 bg-[oklch(var(--background))] p-3 font-mono text-xs">
            {`weighted_avg = Σ(attr_value × weight²) / Σ(weight²)`}
          </pre>
          <p className="mt-2">
            Weights are squared before use — this is the <span className="font-bold">weight emphasis</span> mechanic.
            It means doubling a weight more than doubles that attribute&apos;s influence, sharpening
            the separation between high-priority and low-priority attributes.
          </p>
        </InfoBox>

        <InfoBox label="100-point normalisation">
          <p>
            The weighted average sits on the FM 1–20 attribute scale. It is normalised so
            that a weighted average of <span className="font-mono font-bold">13</span> (considered
            a solid professional) maps to exactly <span className="font-mono font-bold">100</span>.
            Scores above 100 indicate above-average players for your weight profile; below 100
            means below average.
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg border-2 border-[oklch(var(--border))]/40 bg-[oklch(var(--background))] p-3 font-mono text-xs">
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

const TABS: { id: Tab; label: string }[] = [
  { id: "setup", label: "Setup Guide" },
  { id: "attribute", label: "Attribute" },
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
      description: "Score and rank players by a weighted average of their FM26 attributes — no baseline needed, just import and go.",
      link: { href: "/attribute", label: "Go to Attribute Mode" },
    },
  };

  const info = headerInfo[activeTab];

  return (
    <div className="min-h-screen bg-[oklch(var(--background))] text-[oklch(var(--text))]">
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
        <header className="space-y-3">
          <h1 className="text-4xl font-black uppercase tracking-tight">
            {info.title}
          </h1>
          <p className="text-sm text-[oklch(var(--text))/0.75]">
            {info.description}
          </p>
          {info.link && (
            <div className="text-sm">
              <Link
                href={info.link.href}
                className="font-bold text-[oklch(var(--primary))] underline decoration-2 underline-offset-2 hover:decoration-[oklch(var(--alt))]"
              >
                {info.link.label}
              </Link>
            </div>
          )}
        </header>

        {/* Tab bar */}
        <nav
          className="flex gap-1 rounded-lg border-2 border-[oklch(var(--border))] bg-[oklch(var(--surface))] p-1 shadow-[4px_4px_0_oklch(var(--border))]"
          aria-label="Page sections"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex-1 rounded-lg border-2 px-4 py-2 text-xs font-black uppercase tracking-wide transition-all",
                activeTab === tab.id
                  ? "border-[oklch(var(--border))] bg-[oklch(var(--primary))] text-[oklch(var(--background))] shadow-[2px_2px_0_oklch(var(--border))]"
                  : "border-transparent text-[oklch(var(--text))]/65 hover:border-[oklch(var(--border))]/50 hover:text-[oklch(var(--text))]",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        {activeTab === "setup" && <SetupGuideTab />}
        {activeTab === "attribute" && <AttributeTab />}
      </main>
    </div>
  );
}
