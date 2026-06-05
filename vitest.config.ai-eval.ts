import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = dirname(fileURLToPath(import.meta.url));

/**
 * Dedicated config for the AI eval harness (`npm run test:ai-eval`). Lives
 * separately from `vitest.config.ts` so the eval — which hits real OpenAI —
 * does NOT get pulled into the default `npm run test` glob if a developer
 * happens to have `OPENAI_API_KEY` set in their shell.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(rootDir, "."),
    },
  },
  test: {
    environment: "node",
    include: ["tests/ai/**/*.test.ts"],
    // Threads pool segfaults under Node on Windows (vitest v4); use forks
    // there, keep threads on Linux/CI. An explicit --pool flag overrides this.
    pool: process.platform === "win32" ? "forks" : "threads",
    /** Each fixture sets its own per-test timeout; this is just a global ceiling. */
    testTimeout: 180_000,
    hookTimeout: 60_000,
  },
});
