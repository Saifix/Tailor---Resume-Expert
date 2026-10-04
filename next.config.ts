import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: { position: "bottom-right" },
  // Launches the locally installed Chrome/Edge for PDFs — keep it out of the bundle.
  serverExternalPackages: ["playwright-core"],
};

export default nextConfig;
