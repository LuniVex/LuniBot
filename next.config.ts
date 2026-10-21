import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Hides the Next.js dev-tools badge that floats in the bottom-left corner while running `next dev`.
  devIndicators: false,
};

export default config;
