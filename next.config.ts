import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Bundles a minimal server into .next/standalone so the Docker image does
   * not need node_modules. See Dockerfile and DEPLOY.md.
   */
  output: "standalone",

  poweredByHeader: false,

  // Dashboard pages that moved when navigation was regrouped into four tabs
  // plus Settings. Kept so bookmarks and old links still land somewhere.
  async redirects() {
    return [
      ["/dashboard/hours", "/dashboard/availability"],
      ["/dashboard/staff", "/dashboard/availability/staff"],
      ["/dashboard/profile", "/dashboard/settings/profile"],
      ["/dashboard/share", "/dashboard/settings/share"],
      ["/dashboard/billing", "/dashboard/settings/billing"],
    ].map(([source, destination]) => ({ source, destination, permanent: true }));
  },

  experimental: {
    serverActions: {
      // Menu scanning uploads up to four photos. The browser shrinks each one
      // to a few hundred KB first, so this is headroom rather than the norm.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
