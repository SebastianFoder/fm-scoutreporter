import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
