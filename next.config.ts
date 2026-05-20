import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const offlineDesktop = process.env.OFFLINE_DESKTOP === "1";

const nextConfig: NextConfig = {
  output: offlineDesktop ? "standalone" : undefined,
  outputFileTracingRoot: projectRoot,
  typescript: {
    ignoreBuildErrors: true,
  },
  /** Lets Playwright open `http://127.0.0.1:3000` while Next dev listens on `localhost` (HMR / dev resources). */
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
  turbopack: {
    root: projectRoot,
  },
  ...(offlineDesktop
    ? {
        /** Avoid default `/_next/image` sharp pipeline in packaged desktop builds (native DLL trace gaps). */
        images: {
          unoptimized: true,
        },
        outputFileTracingIncludes: {
          "/*": ["node_modules/sharp/**/*", "node_modules/@img/**/*"],
        },
      }
    : {}),
};

export default nextConfig;
