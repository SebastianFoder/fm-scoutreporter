import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Wonderkid finder: FM27 potential estimator",
  description:
    "Find FM27 and FM26 wonderkids. Estimate each prospect's attributes at full potential from CA, PA and Professionalism, then rank them on benchmarked FM27 roles.",
  path: "/wonderkid",
});

export default function WonderkidLayout({ children }: { children: React.ReactNode }) {
  return children;
}
