import { pageMetadata } from "@/lib/site";

/* A profile shows only the visitor's own import: noindex. */
export const generateMetadata = pageMetadata({
  page: "player",
  path: "/players",
  noindex: true,
});

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
