import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Players and wonderkids: score and rank FM players",
  description:
    "Import a Football Manager 27 or 26 player CSV export and rank every player by weighted attributes, or find wonderkids by their estimated attributes at full potential. FM27 benchmark role profiles, letter grades, vs Age and side-by-side comparison.",
  path: "/players",
});

export default function PlayersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
