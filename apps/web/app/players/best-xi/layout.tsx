import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Best XI picker for FM27 and FM26",
  description:
    "Pick the highest-scoring eleven from a Football Manager player export for 4-2-3-1, 4-3-3, 4-4-2, 3-5-2 and more, within a minimum and maximum total transfer budget.",
  path: "/players/best-xi",
});

export default function BestXiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
