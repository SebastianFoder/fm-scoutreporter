import type { Metadata } from "next";
import { HowToShell } from "@/features/how-to-use/HowToShell";
import { WonderkidGuide } from "@/features/how-to-use/guides";
import { JsonLd, breadcrumbLd } from "@/components/JsonLd";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "How Wonderkid mode estimates potential",
  description:
    "How Scout Reporter projects an FM27 or FM26 player's attributes to their PA: the CA cost fit, position-based growth from FM27 training data, and how to read Now, Potential and vs Prime.",
  path: "/how-to-use/wonderkid-mode",
});

export default function WonderkidGuidePage() {
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Setup guide", path: "/how-to-use" },
          { name: "Wonderkid mode", path: "/how-to-use/wonderkid-mode" },
        ])}
      />
      <HowToShell
        title="Wonderkid mode"
        description="Estimate full-potential attributes from a Hidden Attributes view export (CA, PA, Professionalism) and rank prospects on benchmarked FM27 roles."
        link={{ href: "/wonderkid", label: "Go to Wonderkid mode" }}
      >
        <WonderkidGuide />
      </HowToShell>
    </>
  );
}
