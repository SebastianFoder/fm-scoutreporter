import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Attribute mode: score and rank FM players",
  description:
    "Import a Football Manager 27 or 26 player CSV export and rank every player by weighted attributes. FM27 benchmark role profiles, letter grades, vs Age and side-by-side comparison.",
  path: "/attribute",
});

export default function AttributeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
