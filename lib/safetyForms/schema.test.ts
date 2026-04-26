import { describe, expect, it } from "vitest";
import { parseSafetyFormSchema, validateAnswersAgainstSchema } from "./schema";

describe("safetyForms schema", () => {
  it("parses valid schema", () => {
    const s = parseSafetyFormSchema({
      fields: [
        { id: "a", label: "Note", type: "text", required: true },
        { id: "b", label: "Ack", type: "checkbox", required: true },
      ],
    });
    expect(s?.fields).toHaveLength(2);
  });

  it("validates answers", () => {
    const s = parseSafetyFormSchema({
      fields: [{ id: "a", label: "Note", type: "text", required: true }],
    })!;
    expect(validateAnswersAgainstSchema(s, { a: "ok" }).ok).toBe(true);
    expect(validateAnswersAgainstSchema(s, { a: "" }).ok).toBe(false);
    expect(validateAnswersAgainstSchema(s, { x: 1 } as Record<string, unknown>).ok).toBe(false);
  });
});
