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
    include: [
      "lib/**/*.test.ts",
      "app/**/*.test.ts",
      "components/**/*.test.ts",
      "components/**/*.test.tsx",
      "scripts/**/*.test.ts",
    ],
  },
});
