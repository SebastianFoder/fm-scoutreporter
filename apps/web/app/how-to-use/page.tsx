import type { Metadata } from "next";
import { HowToShell } from "@scoutreporter/ui/features/how-to-use/HowToShell";
import { SetupGuide } from "@scoutreporter/ui/features/how-to-use/guides";
import { JsonLd, breadcrumbLd } from "@/components/JsonLd";
import { VIEW_HIDDEN } from "@scoutreporter/core/view-files";
import { absoluteUrl, pageMetadata } from "@/lib/site";

const TITLE = "How to export FM27 and FM26 players to CSV";
const DESCRIPTION =
  "Step-by-step guide to export a Football Manager 27 or 26 player list to CSV with FM View Exporter or BepInEx, install the Scout Reporter view, and import the file.";

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/how-to-use",
});

/* The FM27 route, as structured steps. Mirrors Fm27SetupGuide. */
const HOW_TO_LD = {
  "@type": "HowTo",
  name: "How to export Football Manager 27 players to CSV",
  description: DESCRIPTION,
  totalTime: "PT10M",
  tool: [{ "@type": "HowToTool", name: "Football Manager 27 on Steam (Windows 10 or 11)" }],
  supply: [
    { "@type": "HowToSupply", name: "FM View Exporter" },
    { "@type": "HowToSupply", name: VIEW_HIDDEN.name },
  ],
  step: [
    {
      name: "Install FM View Exporter",
      text: "Download the FM View Exporter setup program from its GitHub releases page and run it. It finds FM27 in your Steam libraries and installs BepInEx with the plugin.",
    },
    {
      name: "Install the view",
      text: "Download the Scout Reporter Hidden Attributes or Standard view (.fmf) and move it to Documents\Sports Interactive\Football Manager 27\views.",
    },
    {
      name: "Export players from FM27",
      text: "In Recruitment, Player Database, right-click a column header, choose Import View, select the Scout Reporter view, filter the list and press F9.",
    },
    {
      name: "Import the CSV",
      text: "Open Players on Scout Reporter, click Choose CSV file and pick the newest file in Documents\Sports Interactive\FM View Exporter.",
      url: absoluteUrl("/players"),
    },
  ].map((s, i) => ({ "@type": "HowToStep", position: i + 1, ...s })),
};

export default function HowToUsePage() {
  return (
    <>
      <JsonLd data={[HOW_TO_LD, breadcrumbLd([{ name: "Setup guide", path: "/how-to-use" }])]} />
      <HowToShell
        title="Setup guide"
        description="Follow these steps to export a player list from Football Manager 27 or 26 and import it into this app."
        link={{ href: "/players", label: "Go to the importer" }}
      >
        <SetupGuide />
      </HowToShell>
    </>
  );
}
