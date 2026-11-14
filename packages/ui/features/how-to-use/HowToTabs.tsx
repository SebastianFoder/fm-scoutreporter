"use client";

import { SectionTabs } from "@scoutreporter/ui/components/SectionTabs";

export const HOW_TO_PAGES = [
  { href: "/how-to-use", label: "Setup guide" },
  { href: "/how-to-use/players", label: "Players" },
  { href: "/how-to-use/wonderkids", label: "Wonderkids" },
];

/** Section tabs for the how-to pages. Real links, so each guide has its own URL. */
export function HowToTabs() {
  return <SectionTabs tabs={HOW_TO_PAGES} label="Guides" />;
}
