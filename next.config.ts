import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Bundles a minimal server into .next/standalone so the Docker image does
   * not need node_modules. See Dockerfile and DEPLOY.md.
   */
  output: "standalone",

  poweredByHeader: false,

  experimental: {
    serverActions: {
      // Menu scanning uploads up to four photos. The browser shrinks each one
      // to a few hundred KB first, so this is headroom rather than the norm.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
