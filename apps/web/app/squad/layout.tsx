import { pageMetadata } from "@/lib/site";

export const generateMetadata = pageMetadata({
  page: "squad",
  path: "/squad",
});

export default function SquadLayout({ children }: { children: React.ReactNode }) {
  return children;
}
