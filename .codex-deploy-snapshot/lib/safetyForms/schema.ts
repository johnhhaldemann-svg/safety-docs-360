export type SafetyFormFieldType = "text" | "checkbox";

export type SafetyFormField = {
  id: string;
  label: string;
  type: SafetyFormFieldType;
  required?: boolean;
};

export type SafetyFormSchema = {
  fields: SafetyFormField[];
};

export function parseSafetyFormSchema(raw: unknown): SafetyFormSchema | null {
  if (!raw || typeof raw !== "object") return null;
  const fieldsRaw = (raw as { fields?: unknown }).fields;
  if (!Array.isArray(fieldsRaw)) return null;
  const fields: SafetyFormField[] = [];
  for (const f of fieldsRaw) {
    if (!f || typeof f !== "object") continue;
    const id = String((f as { id?: unknown }).id ?? "").trim();
    const label = String((f as { label?: unknown }).label ?? "").trim();
    const type = String((f as { type?: unknown }).type ?? "");
    if (!id || !label) continue;
    if (type !== "text" && type !== "checkbox") continue;
    const required = Boolean((f as { required?: unknown }).required);
    fields.push({ id, label, type, required });
  }
  return { fields };
}

export function validateAnswersAgainstSchema(
  schema: SafetyFormSchema,
  answers: Record<string, unknown>
): { ok: true } | { ok: false; error: string } {
  for (const field of schema.fields) {
    const v = answers[field.id];
    if (field.required) {
      if (field.type === "text") {
        if (typeof v !== "string" || !v.trim()) {
          return { ok: false, error: `Missing required field: ${field.label}` };
        }
      } else if (field.type === "checkbox") {
        if (v !== true) {
          return { ok: false, error: `Required checkbox: ${field.label}` };
        }
      }
    } else if (field.type === "checkbox" && v !== undefined && v !== null && typeof v !== "boolean") {
      return { ok: false, error: `Invalid value for ${field.label}` };
    } else if (field.type === "text" && v !== undefined && v !== null && typeof v !== "string") {
      return { ok: false, error: `Invalid value for ${field.label}` };
    }
  }
  for (const key of Object.keys(answers)) {
    if (!schema.fields.some((f) => f.id === key)) {
      return { ok: false, error: `Unknown field id: ${key}` };
    }
  }
  return { ok: true };
}
