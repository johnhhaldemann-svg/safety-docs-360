import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(rootDir, "."),
      // React 19 moved server rendering to subpath exports; Vitest in Node env
      // needs the .node variant explicitly.
      "react-dom/server": resolve(rootDir, "node_modules/react-dom/server.node.js"),
    },
  },
  test: {
    environment: "node",
    // The threads pool segfaults under Node on Windows with this suite
    // (vitest v4). Use the forks pool on Windows; keep the faster threads
    // pool on Linux/CI. An explicit --pool flag still overrides this.
    pool: process.platform === "win32" ? "forks" : "threads",
    include: [
      "lib/**/*.test.ts",
      "app/**/*.test.ts",
      "components/**/*.test.ts",
      "components/**/*.test.tsx",
      "scripts/**/*.test.ts",
    ],
  },
});
