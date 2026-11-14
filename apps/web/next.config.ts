import path from "node:path";
import type { NextConfig } from "next";

/** The monorepo root: shared packages live outside this app, so tracing and Turbopack must see the whole repo. */
const repoRoot = path.join(__dirname, "..", "..");

/**
 * SCOUTREPORTER_TARGET=desktop builds the pages for the desktop app (apps/desktop): a standalone
 * server in .next-desktop (so it never mixes with the website build), plus the desktop-only pages,
 * which are named page.desktop.tsx and are not routes in the website build.
 */
const desktop = process.env.SCOUTREPORTER_TARGET === "desktop";

const nextConfig: NextConfig = {
  ...(desktop && { output: "standalone" as const, distDir: ".next-desktop" }),
  pageExtensions: desktop ? ["desktop.tsx", "tsx", "ts", "jsx", "js"] : ["tsx", "ts", "jsx", "js"],
  /* Read by the pages (packages/ui/desktop/target.ts) to leave out what the desktop app does not need. */
  env: { SCOUTREPORTER_TARGET: desktop ? "desktop" : "web" },
  transpilePackages: ["@scoutreporter/core", "@scoutreporter/ui"],
  outputFileTracingRoot: repoRoot,
  /* The fixtures route reads the CSVs at request time; make sure deployments ship them. */
  outputFileTracingIncludes: {
    "/api/fixtures/[name]": ["../../packages/core/fixtures/*.csv"],
  },
  turbopack: { root: repoRoot },
  /*
   * Old URLs: Attribute, Wonderkid and Best XI were separate menu items before they became the
   * Players section. Permanent (308) so search engines move any ranking to the new paths.
   */
  async redirects() {
    return [
      { source: "/attribute", destination: "/players", permanent: true },
      { source: "/attribute/players", destination: "/players", permanent: true },
      { source: "/attribute/players/:id", destination: "/players/:id", permanent: true },
      { source: "/attribute/compare", destination: "/players/compare", permanent: true },
      { source: "/compare", destination: "/players/compare", permanent: true },
      { source: "/wonderkid", destination: "/players", permanent: true },
      { source: "/best-xi", destination: "/players/best-xi", permanent: true },
      { source: "/how-to-use/attribute-mode", destination: "/how-to-use/players", permanent: true },
      { source: "/how-to-use/wonderkid-mode", destination: "/how-to-use/wonderkids", permanent: true },
    ];
  },
};

export default nextConfig;
