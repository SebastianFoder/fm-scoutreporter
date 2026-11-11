import { AUTHOR, SITE_NAME, absoluteUrl } from "@/lib/site";

type Thing = Record<string, unknown>;

/** Renders schema.org structured data. `<` is escaped so the JSON can't close the script tag. */
export function JsonLd({ data }: { data: Thing | Thing[] }) {
  const json = JSON.stringify(
    Array.isArray(data)
      ? { "@context": "https://schema.org", "@graph": data }
      : { "@context": "https://schema.org", ...data },
  ).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export const AUTHOR_LD: Thing = {
  "@type": "Person",
  name: AUTHOR.name,
  url: AUTHOR.url,
};

/** Breadcrumb trail from the home page. Pass the crumbs after "Home". */
export function breadcrumbLd(crumbs: { name: string; path: string }[]): Thing {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [{ name: SITE_NAME, path: "/" }, ...crumbs].map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}
