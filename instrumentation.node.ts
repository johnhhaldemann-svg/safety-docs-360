import { serverLog } from "@/lib/serverLog";

/**
 * Node-only process hooks. Kept out of `instrumentation.ts` so the Edge analyzer
 * does not flag `process.on` when tracing unrelated server bundles.
 */
export function registerNodeProcessHandlers() {
  process.on("unhandledRejection", (reason) => {
    serverLog("error", "unhandled_rejection", {
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  process.on("uncaughtException", (err) => {
    serverLog("error", "uncaught_exception", {
      message: err.message,
      stack: err.stack,
    });
  });
}
