import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Squad analysis for FM27 and FM26",
  description:
    "Import your Football Manager squad, pick your formation and see your first and second eleven, thin or weak positions, ageing starters, youngsters ready to step up and upgrades from your scouting list.",
  path: "/squad",
});

export default function SquadLayout({ children }: { children: React.ReactNode }) {
  return children;
}
