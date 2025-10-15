import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No romper el build por ESLint
  eslint: {
    ignoreDuringBuilds: true,
  },

  // No romper el build por TypeScript (mantienes tu estructura actual)
  typescript: {
    ignoreBuildErrors: true,
  },

  reactStrictMode: true,

  async redirects() {
    return [
      { source: "/", destination: "/login", permanent: false },
    ];
  },
};

export default nextConfig;
