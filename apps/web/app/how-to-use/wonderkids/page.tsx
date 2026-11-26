import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HowToShell } from "@scoutreporter/ui/features/how-to-use/HowToShell";
import { WonderkidGuide } from "@scoutreporter/ui/features/how-to-use/guides";
import { JsonLd, breadcrumbLd } from "@/components/JsonLd";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "How Scout Reporter estimates wonderkids' potential",
  description:
    "How Scout Reporter projects an FM27 or FM26 player's attributes to their PA: the CA cost fit, position-based growth from FM27 training data, and how to read Now, Potential and vs Prime.",
  path: "/how-to-use/wonderkids",
});

export default async function WonderkidGuidePage() {
  const t = await getTranslations("howToPages.wonderkids");
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Setup guide", path: "/how-to-use" },
          { name: "Wonderkids", path: "/how-to-use/wonderkids" },
        ])}
      />
      <HowToShell
        title={t("title")}
        description={t("description")}
        link={{ href: "/players", label: t("link") }}
      >
        <WonderkidGuide />
      </HowToShell>
    </>
  );
}
