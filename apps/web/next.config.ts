import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @anydrop/protocol is a workspace package consumed as TS source (no build
  // step), so Next must transpile it like first-party app code.
  transpilePackages: ["@anydrop/protocol"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nothing here should be framed (clickjacking of the accept dialog).
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
