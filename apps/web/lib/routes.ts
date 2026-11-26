/** Public routes and their hreflang alternates. Add lastModified only for a dated content update. */
export const INDEXABLE_ROUTES: {
  path: string;
  priority: number;
  changeFrequency: "weekly" | "monthly";
  lastModified?: string;
}[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/players", priority: 0.9, changeFrequency: "monthly" },
  { path: "/players/best-xi", priority: 0.8, changeFrequency: "monthly" },
  { path: "/squad", priority: 0.8, changeFrequency: "monthly" },
  { path: "/staff", priority: 0.8, changeFrequency: "monthly" },
  { path: "/staff/backroom", priority: 0.7, changeFrequency: "monthly" },
  { path: "/how-to-use", priority: 0.8, changeFrequency: "monthly" },
  { path: "/how-to-use/players", priority: 0.6, changeFrequency: "monthly" },
  { path: "/how-to-use/wonderkids", priority: 0.6, changeFrequency: "monthly" },
  { path: "/faq", priority: 0.7, changeFrequency: "monthly" },
  { path: "/download", priority: 0.8, changeFrequency: "weekly" },
  { path: "/compare", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-11-26" },
  { path: "/compare/genie-scout", priority: 0.6, changeFrequency: "monthly", lastModified: "2026-11-26" },
  { path: "/compare/fmrte", priority: 0.6, changeFrequency: "monthly", lastModified: "2026-11-26" },
];
