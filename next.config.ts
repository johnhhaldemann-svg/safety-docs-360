import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const offlineDesktop = process.env.OFFLINE_DESKTOP === "1";

const nextConfig: NextConfig = {
  output: offlineDesktop ? "standalone" : undefined,
  outputFileTracingRoot: projectRoot,
  /** Lets Playwright open `http://127.0.0.1:3000` while Next dev listens on `localhost` (HMR / dev resources). */
  allowedDevOrigins: ["127.0.0.1"],
  /** Tree-shake large icon/chart barrels so pages only ship the symbols they use. */
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  async redirects() {
    return [
      {
        // The guided setup wizard moved into the native SafePredict workspace shell.
        // Keep old links/bookmarks working.
        source: "/get-started",
        destination: "/safe-predict/get-started",
        permanent: false,
      },
    ];
  },
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
            // Next.js App Router requires unsafe-inline/unsafe-eval for hydration scripts.
            // object-src + base-uri + default-src close the remaining high-value vectors.
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://va.vercel-scripts.com",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
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
