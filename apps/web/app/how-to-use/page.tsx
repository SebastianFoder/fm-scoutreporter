import { getTranslations } from "next-intl/server";
import { HowToShell } from "@scoutreporter/ui/features/how-to-use/HowToShell";
import { SetupGuide } from "@scoutreporter/ui/features/how-to-use/guides";
import { JsonLd, breadcrumbLd } from "@/components/JsonLd";
import { VIEW_HIDDEN } from "@scoutreporter/core/view-files";
import { absoluteUrl, pageMetadata } from "@/lib/site";
import enMeta from "@scoutreporter/ui/i18n/messages/en/meta.json";

/** English, like all structured data. */
const DESCRIPTION = enMeta.pages.howToUse.description;

export const generateMetadata = pageMetadata({
  page: "howToUse",
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
      text: "Download the Scout Reporter Hidden Attributes or Standard view (.fmf) and move it to Documents\\Sports Interactive\\Football Manager 27\\views.",
    },
    {
      name: "Export players from FM27",
      text: "In Recruitment, Player Database, right-click a column header, choose Import View, select the Scout Reporter view, filter the list and press F9.",
    },
    {
      name: "Import the CSV",
      text: "Open Players on Scout Reporter, click Choose CSV file and pick the newest file in Documents\\Sports Interactive\\FM View Exporter.",
      url: absoluteUrl("/players"),
    },
  ].map((s, i) => ({ "@type": "HowToStep", position: i + 1, ...s })),
};

export default async function HowToUsePage() {
  const t = await getTranslations("howToPages.setup");
  return (
    <>
      <JsonLd data={[HOW_TO_LD, breadcrumbLd([{ name: "Setup guide", path: "/how-to-use" }])]} />
      <HowToShell
        title={t("title")}
        description={t("description")}
        link={{ href: "/players", label: t("link") }}
      >
        <SetupGuide />
      </HowToShell>
    </>
  );
}
