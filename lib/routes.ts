/**
 * Public, indexable routes, in sitemap order. Pages that only show an imported CSV (player list,
 * player profile, compare) are left out: they are empty for crawlers and marked noindex.
 */
export const INDEXABLE_ROUTES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/attribute", priority: 0.9, changeFrequency: "monthly" },
  { path: "/wonderkid", priority: 0.9, changeFrequency: "monthly" },
  { path: "/best-xi", priority: 0.8, changeFrequency: "monthly" },
  { path: "/how-to-use", priority: 0.8, changeFrequency: "monthly" },
  { path: "/how-to-use/attribute-mode", priority: 0.6, changeFrequency: "monthly" },
  { path: "/how-to-use/wonderkid-mode", priority: 0.6, changeFrequency: "monthly" },
  { path: "/faq", priority: 0.7, changeFrequency: "monthly" },
];
