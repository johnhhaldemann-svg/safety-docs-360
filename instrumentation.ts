import { serverLog } from "@/lib/serverLog";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

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
