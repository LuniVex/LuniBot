import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // The dev-tools badge floats in a corner while `next dev` runs (anti-patterns A5).
  devIndicators: false,
};

export default config;
