import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Bundles a minimal server into .next/standalone so the Docker image does
   * not need node_modules. See Dockerfile and DEPLOY.md.
   */
  output: "standalone",

  poweredByHeader: false,
};

export default nextConfig;
