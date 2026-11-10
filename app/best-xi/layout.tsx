import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Best XI",
  description:
    "Pick the highest-scoring eleven from an imported Football Manager export for a formation, within a minimum and maximum total budget.",
};

export default function BestXiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
