import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Players: score, rank and find FM wonderkids",
  description:
    "Import a Football Manager 27 or 26 player CSV export and rank every player by weighted attributes, with a Potential score from CA and PA to find wonderkids. FM27 benchmark role profiles, letter grades, vs Age and side-by-side comparison.",
  path: "/players",
});

export default function PlayersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
