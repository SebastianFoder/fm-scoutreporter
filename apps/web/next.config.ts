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
  transpilePackages: ["@scoutreporter/core", "@scoutreporter/ui"],
  outputFileTracingRoot: repoRoot,
  /* The fixtures route reads the CSVs at request time; make sure deployments ship them. */
  outputFileTracingIncludes: {
    "/api/fixtures/[name]": ["../../packages/core/fixtures/*.csv"],
  },
  turbopack: { root: repoRoot },
  /* Pre-mode URLs. Permanent (308) so search engines move any ranking to the new paths. */
  async redirects() {
    return [
      { source: "/players", destination: "/attribute/players", permanent: true },
      { source: "/players/:id", destination: "/attribute/players/:id", permanent: true },
      { source: "/compare", destination: "/attribute/compare", permanent: true },
    ];
  },
};

export default nextConfig;
