import { getTranslations } from "next-intl/server";
import { HowToShell } from "@scoutreporter/ui/features/how-to-use/HowToShell";
import { AttributeGuide } from "@scoutreporter/ui/features/how-to-use/guides";
import { JsonLd, breadcrumbLd } from "@/components/JsonLd";
import { pageMetadata } from "@/lib/site";

export const generateMetadata = pageMetadata({
  page: "howToPlayers",
  path: "/how-to-use/players",
});

export default async function AttributeGuidePage() {
  const t = await getTranslations("howToPages.players");
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Setup guide", path: "/how-to-use" },
          { name: "Players", path: "/how-to-use/players" },
        ])}
      />
      <HowToShell
        title={t("title")}
        description={t("description")}
        link={{ href: "/players", label: t("link") }}
      >
        <AttributeGuide />
      </HowToShell>
    </>
  );
}
