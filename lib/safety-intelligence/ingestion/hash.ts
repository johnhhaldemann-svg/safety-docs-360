import { createHash } from "node:crypto";

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right)
  );

  return `{${entries
    .map(([key, current]) => `${JSON.stringify(key)}:${stableStringify(current)}`)
    .join(",")}}`;
}

export function hashPayload(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}
