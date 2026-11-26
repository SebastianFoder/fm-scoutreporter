import { getTranslations } from "next-intl/server";
import { HowToShell } from "@scoutreporter/ui/features/how-to-use/HowToShell";
import { WonderkidGuide } from "@scoutreporter/ui/features/how-to-use/guides";
import { JsonLd, breadcrumbLd } from "@/components/JsonLd";
import { pageMetadata } from "@/lib/site";

export const generateMetadata = pageMetadata({
  page: "howToWonderkids",
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
