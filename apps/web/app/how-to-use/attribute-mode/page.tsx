import type { Metadata } from "next";
import { HowToShell } from "@scoutreporter/ui/features/how-to-use/HowToShell";
import { AttributeGuide } from "@scoutreporter/ui/features/how-to-use/guides";
import { JsonLd, breadcrumbLd } from "@/components/JsonLd";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "How Attribute mode scores FM players",
  description:
    "How Scout Reporter scores Football Manager players: weighted attribute averages, the FM27 benchmark role profiles, vs Age, Potential, and the S++ to F grade scale.",
  path: "/how-to-use/attribute-mode",
});

export default function AttributeGuidePage() {
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Setup guide", path: "/how-to-use" },
          { name: "Attribute mode", path: "/how-to-use/attribute-mode" },
        ])}
      />
      <HowToShell
        title="Attribute mode"
        description="Score and rank players by a weighted average of their attributes. No baseline needed: import and go."
        link={{ href: "/attribute", label: "Go to Attribute mode" }}
      >
        <AttributeGuide />
      </HowToShell>
    </>
  );
}
