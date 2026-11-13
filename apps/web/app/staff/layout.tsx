import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Staff scout: rank FM26 coaches, scouts and directors",
  description:
    "Import an FM26 staff search export and rank every coach, scout, analyst and director on each staff role, with FM26's word ratings mapped back to the 1–20 scale.",
  path: "/staff",
});

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return children;
}
