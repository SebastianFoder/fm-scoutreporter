import { pageMetadata } from "@/lib/site";

export const generateMetadata = pageMetadata({
  page: "bestXi",
  path: "/players/best-xi",
});

export default function BestXiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
