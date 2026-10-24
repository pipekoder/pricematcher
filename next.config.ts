import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Use the compiler API to avoid a Next 16.4 CLI --showConfig parsing
  // regression under the Node 24 build runtime.
  experimental: { useTypeScriptCli: false },
};

export default nextConfig;
