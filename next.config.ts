import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The AI comparison route reads agent instructions at runtime. Include them
  // in its serverless function when deployed on Vercel.
  outputFileTracingIncludes: {
    "/api/comparisons": ["./agents/**/*.md"],
  },
  images: { remotePatterns: [
    { protocol: "https", hostname: "cdn.trychannel3.com" },
    { protocol: "https", hostname: "geartrade.com" },
    { protocol: "https", hostname: "cdn.shopify.com" },
  ] },
  // Use the compiler API to avoid a Next 16.4 CLI --showConfig parsing
  // regression under the Node 24 build runtime.
  experimental: { useTypeScriptCli: false },
};

export default nextConfig;
