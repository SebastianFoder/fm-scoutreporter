import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

/* Shows only the visitor's own import, so there is nothing for search engines here. */
export const metadata: Metadata = pageMetadata({
  title: "Compare players",
  description:
    "Compare selected Football Manager players across highlighted attributes, with gold, silver and bronze per attribute.",
  path: "/players/compare",
  noindex: true,
});

export default function AttributeCompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
