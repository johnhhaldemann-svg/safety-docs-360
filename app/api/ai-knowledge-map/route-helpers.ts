import { NextResponse } from "next/server";

export function aiKnowledgeMapActionError(error: unknown, fallback: string) {
  const message = error instanceof Error && error.message.trim() ? error.message : fallback;
  const lower = message.toLowerCase();
  const status = lower.includes("recently") || lower.includes("cooldown")
    ? 429
    : lower.includes("required")
      || lower.includes("select one company")
      || lower.includes("read-only")
      || lower.includes("meaningful")
      || lower.includes("disabled")
      || lower.includes("not found")
      || lower.includes("cannot")
      || lower.includes("must")
      || lower.includes("valid")
      ? 400
      : 500;
  return NextResponse.json({ error: message }, { status });
}
