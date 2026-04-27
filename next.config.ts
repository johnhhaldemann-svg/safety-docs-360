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
