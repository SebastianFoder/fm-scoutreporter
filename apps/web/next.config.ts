import path from "node:path";
import type { NextConfig } from "next";

/** The monorepo root: shared packages live outside this app, so tracing and Turbopack must see the whole repo. */
const repoRoot = path.join(__dirname, "..", "..");

const nextConfig: NextConfig = {
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
