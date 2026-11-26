import { pageMetadata } from "@/lib/site";

export const generateMetadata = pageMetadata({
  page: "players",
  path: "/players",
});

export default function PlayersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
