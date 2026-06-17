import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Firebase App Hosting / Cloud Functions deployment.
  // Standalone mode bundles only what's needed for production.
  output: "standalone",
};

export default nextConfig;
