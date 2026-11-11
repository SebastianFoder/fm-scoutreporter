import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Best backroom: pick your FM26 staff team",
  description:
    "Choose the staff roles you need and Scout Reporter hires the best backroom from your FM26 staff export: coaches for every training group, scouts, analysts and medical staff, nobody used twice.",
  path: "/staff/backroom",
});

export default function BackroomLayout({ children }: { children: React.ReactNode }) {
  return children;
}
