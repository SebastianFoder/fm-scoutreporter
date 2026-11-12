import type { Metadata } from "next";
import { DesktopHomeClient } from "@scoutreporter/ui/desktop/DesktopHomeClient";

/* Desktop app only (built from page.desktop.tsx with SCOUTREPORTER_TARGET=desktop). */
export const metadata: Metadata = { title: { absolute: "Scans | Scout Reporter" }, robots: { index: false } };

export default function DesktopPage() {
  return <DesktopHomeClient />;
}
