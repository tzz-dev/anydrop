import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @anydrop/protocol is a workspace package consumed as TS source (no build
  // step), so Next must transpile it like first-party app code.
  transpilePackages: ["@anydrop/protocol"],
};

export default nextConfig;
