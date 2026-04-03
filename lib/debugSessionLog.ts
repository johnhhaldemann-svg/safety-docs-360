import { appendFileSync } from "fs";
import { join } from "path";

const DEBUG_LOG_FILE = "debug-1be144.log";

/** Append one NDJSON line for local debug sessions (works when HTTP ingest is unavailable). */
export function appendDebugSessionLog(entry: {
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
  runId?: string;
}) {
  try {
    const line = JSON.stringify({
      sessionId: "1be144",
      timestamp: Date.now(),
      ...entry,
    });
    appendFileSync(join(process.cwd(), DEBUG_LOG_FILE), `${line}\n`, "utf8");
  } catch {
    // e.g. read-only cwd on serverless
  }
}
