import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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
  async redirects() {
    const legacyHostRedirect = {
      source: "/:path*",
      has: [{ type: "host" as const, value: "fm26-scoutreporter\\.vercel\\.app" }],
      destination: "https://fmscouting.sebastianfoder.com/:path*",
      permanent: true,
    };
    return [
      ...(!desktop ? [legacyHostRedirect] : []),
      // Attribute, Wonderkid and Best XI used to be separate menu items.
      { source: "/attribute", destination: "/players", permanent: true },
      { source: "/attribute/players", destination: "/players", permanent: true },
      { source: "/attribute/players/:id", destination: "/players/:id", permanent: true },
      { source: "/attribute/compare", destination: "/players/compare", permanent: true },
      /* Old player-compare links carry ?ids=; plain /compare is now the tool comparison (app/compare). */
      { source: "/compare", has: [{ type: "query", key: "ids" }], destination: "/players/compare", permanent: true },
      { source: "/wonderkid", destination: "/players", permanent: true },
      { source: "/best-xi", destination: "/players/best-xi", permanent: true },
      { source: "/how-to-use/attribute-mode", destination: "/how-to-use/players", permanent: true },
      { source: "/how-to-use/wonderkid-mode", destination: "/how-to-use/wonderkids", permanent: true },
    ];
  },
};

/* The language comes from the URL on the website (proxy.ts) and a cookie in the desktop app: see i18n/request.ts. */
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
