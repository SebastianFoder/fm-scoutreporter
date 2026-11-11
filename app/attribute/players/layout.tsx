import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

/* The list and every profile under it show only the visitor's own import: noindex. */
export const metadata: Metadata = pageMetadata({
  title: "Players",
  description:
    "Browse imported Football Manager players with weighted scoring and configurable highlighted attributes.",
  path: "/attribute/players",
  noindex: true,
});

export default function AttributePlayersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
