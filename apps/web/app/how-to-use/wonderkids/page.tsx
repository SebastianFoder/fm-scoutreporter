import type { Metadata } from "next";
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

export default function WonderkidGuidePage() {
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Setup guide", path: "/how-to-use" },
          { name: "Wonderkids", path: "/how-to-use/wonderkids" },
        ])}
      />
      <HowToShell
        title="Wonderkids"
        description="Estimate full-potential attributes from a Hidden Attributes view export (CA, PA, Professionalism) and rank prospects on benchmarked FM27 roles."
        link={{ href: "/players", label: "Go to Players" }}
      >
        <WonderkidGuide />
      </HowToShell>
    </>
  );
}
