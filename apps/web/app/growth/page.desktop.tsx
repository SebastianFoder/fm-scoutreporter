import type { Metadata } from "next";
import { GrowthClient } from "@scoutreporter/ui/desktop/GrowthClient";

/* Desktop app only (built from page.desktop.tsx with SCOUTREPORTER_TARGET=desktop). */
export const metadata: Metadata = { title: { absolute: "Growth | Scout Reporter" }, robots: { index: false } };

export default function GrowthPage() {
  return <GrowthClient />;
}
