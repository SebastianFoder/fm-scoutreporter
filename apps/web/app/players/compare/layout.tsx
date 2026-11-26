import { pageMetadata } from "@/lib/site";

/* Shows only the visitor's own import, so there is nothing for search engines here. */
export const generateMetadata = pageMetadata({
  page: "playersCompare",
  path: "/players/compare",
  noindex: true,
});

export default function AttributeCompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
