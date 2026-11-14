import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

/* A profile shows only the visitor's own import: noindex. */
export const metadata: Metadata = pageMetadata({
  title: "Player",
  description: "A Football Manager player from your import: scores, attributes, FM27 roles and a development plan.",
  path: "/players",
  noindex: true,
});

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
