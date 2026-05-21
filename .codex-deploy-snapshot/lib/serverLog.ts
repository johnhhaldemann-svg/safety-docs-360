/**
 * Structured server-side logging for API routes and background work.
 * Uses JSON lines so log aggregators can parse severity and event names.
 */

export type ServerLogLevel = "info" | "warn" | "error";

export type ServerLogFields = Record<string, string | number | boolean | null | undefined>;

export function serverLog(level: ServerLogLevel, event: string, fields?: ServerLogFields) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}
