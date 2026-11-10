import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wonderkid mode",
  description:
    "Estimate full-potential attributes from FM27 v2 exports (CA, PA, Professionalism) and rank prospects on benchmarked FM27 roles.",
};

export default function WonderkidLayout({ children }: { children: React.ReactNode }) {
  return children;
}
