import { resolveCompanyAiDefaultModel } from "@/lib/ai/defaultModel";
import { requestAiResponsesText, type AiExecutionMeta } from "@/lib/ai/responses";
import { normalizeDateOnly } from "@/lib/companyTrackedEmployees";

const DEFAULT_TRAINING_PHOTO_MODEL = "gpt-4o-mini";
const MAX_TEXT = {
  title: 180,
  provider: 180,
  notes: 1200,
  rawVisibleText: 4000,
  warning: 240,
};

const GENERIC_CERTIFICATE_TITLES = new Set([
  "certificate",
  "certificate of completion",
  "completion certificate",
  "training certificate",
]);

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

export type TrainingRecordPhotoDraft = {
  title: string;
  completedOn: string;
  expiresOn: string;
  provider: string;
  notes: string;
  confidence: number;
  warnings: string[];
};

export type TrainingRecordPhotoExtractionResult = {
  draft: TrainingRecordPhotoDraft | null;
  meta: AiExecutionMeta;
  error: string | null;
};

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function stripJsonFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function normalizeVisibleDate(raw: string): string | null {
  const normalized = normalizeDateOnly(raw);
  if (normalized) return normalized;

  const monthName = /^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{4})$/i.exec(raw.trim());
  if (!monthName) return null;
  const month = MONTH_INDEX[monthName[1]?.toLowerCase() ?? ""];
  const day = Number(monthName[2]);
  const year = Number(monthName[3]);
  if (month == null || !Number.isInteger(day) || !Number.isInteger(year)) return null;
  const date = new Date(Date.UTC(year, month, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function normalizeExtractedDate(value: unknown, fieldLabel: string, warnings: string[]) {
  const raw = cleanText(value, 80);
  if (!raw) return "";
  const normalized = normalizeVisibleDate(raw);
  if (normalized) return normalized;
  warnings.push(`${fieldLabel} date was visible but could not be normalized.`);
  return "";
}

function normalizeLabel(value: unknown): string {
  return cleanText(value, 80).toLowerCase();
}

function hasExpirationLabel(value: unknown): boolean {
  const label = normalizeLabel(value);
  return /\b(expir|expires|expiration|valid\s+(through|thru|until|to))\b/.test(label);
}

function hasCompletionLabel(value: unknown): boolean {
  const label = normalizeLabel(value);
  return /\b(completed|completion|date|issued|course\s+date|training\s+date)\b/.test(label);
}

function normalizeCourseTitleFromVisibleText(rawVisibleText: string): string {
  const osha = /\bOSHA\s*(10|30)(?:\s*[-–—]?\s*HOUR)?\s+(CONSTRUCTION|GENERAL\s+INDUSTRY)?(?:\s+SAFETY)?\b/i.exec(
    rawVisibleText
  );
  if (osha) {
    const hours = osha[1];
    const track = osha[2]?.replace(/\s+/g, " ").toLowerCase();
    const trackLabel =
      track === "general industry"
        ? "General Industry"
        : track === "construction"
          ? "Construction"
          : "";
    return `OSHA ${hours}-Hour${trackLabel ? ` ${trackLabel}` : ""} Safety`;
  }

  return "";
}

function normalizeTrainingTitle(value: unknown, rawVisibleText: string, warnings: string[]) {
  const title = cleanText(value, MAX_TEXT.title);
  const titleKey = title.toLowerCase();
  const fallbackTitle = normalizeCourseTitleFromVisibleText(rawVisibleText);
  if (fallbackTitle && (!title || GENERIC_CERTIFICATE_TITLES.has(titleKey))) {
    return fallbackTitle;
  }
  if (GENERIC_CERTIFICATE_TITLES.has(titleKey)) {
    warnings.push("Generic certificate heading ignored; confirm the training title.");
    return "";
  }
  return title;
}

export function parseTrainingRecordPhotoExtraction(text: string): TrainingRecordPhotoDraft | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(text));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const record = parsed as Record<string, unknown>;
  const warnings = Array.isArray(record.warnings)
    ? record.warnings.map((item) => cleanText(item, MAX_TEXT.warning)).filter(Boolean).slice(0, 8)
    : [];
  const rawVisibleText = cleanText(record.rawVisibleText ?? record.raw_visible_text, MAX_TEXT.rawVisibleText);
  let completedOn = normalizeExtractedDate(
    record.completedOn ?? record.completed_on,
    "Completed",
    warnings
  );
  let expiresOn = normalizeExtractedDate(record.expiresOn ?? record.expires_on, "Expiration", warnings);
  if (expiresOn && !hasExpirationLabel(record.expiresOnLabel ?? record.expires_on_label)) {
    if (!completedOn && hasCompletionLabel(record.expiresOnLabel ?? record.expires_on_label)) {
      completedOn = expiresOn;
    }
    expiresOn = "";
    warnings.push("A date was visible, but no expiration label was visible; review before saving.");
  }
  const title = normalizeTrainingTitle(
    record.title ?? record.trainingTitle ?? record.training_title,
    rawVisibleText,
    warnings
  );

  if (!title) {
    warnings.push("Training title was not visible enough to extract.");
  }

  return {
    title,
    completedOn,
    expiresOn,
    provider: cleanText(record.provider, MAX_TEXT.provider),
    notes: cleanText(record.notes, MAX_TEXT.notes),
    confidence: normalizeConfidence(record.confidence),
    warnings: Array.from(new Set(warnings)).slice(0, 8),
  };
}

function trainingPhotoSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      completedOn: { type: "string" },
      expiresOn: { type: "string" },
      provider: { type: "string" },
      notes: { type: "string" },
      confidence: { type: "number" },
      completedOnLabel: { type: "string" },
      expiresOnLabel: { type: "string" },
      rawVisibleText: { type: "string" },
      warnings: {
        type: "array",
        maxItems: 8,
        items: { type: "string" },
      },
    },
    required: [
      "title",
      "completedOn",
      "expiresOn",
      "provider",
      "notes",
      "confidence",
      "completedOnLabel",
      "expiresOnLabel",
      "rawVisibleText",
      "warnings",
    ],
  };
}

export async function extractTrainingRecordFromPhoto(params: {
  dataUrl: string;
  fileName?: string | null;
  employeeName?: string | null;
  model?: string | null;
}): Promise<TrainingRecordPhotoExtractionResult> {
  const model =
    params.model?.trim() ||
    process.env.TRAINING_RECORD_PHOTO_AI_MODEL?.trim() ||
    process.env.COMPANY_AI_MODEL?.trim() ||
    resolveCompanyAiDefaultModel(DEFAULT_TRAINING_PHOTO_MODEL);
  const fileName = params.fileName?.trim() || "uploaded image";

  const response = await requestAiResponsesText({
    model,
    surface: "training-records.photo-extract",
    maxAttempts: 2,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "You extract construction safety training record fields from a photographed card or certificate.",
              "Return strict JSON only. Extract only text that is visible in the image; never invent dates, providers, card numbers, or expiration periods.",
              "Title rule: title must be the course/training name (for example OSHA 10-Hour Construction Safety), not generic headings like Certificate of Completion.",
              "Date rule: if a certificate shows one generic Date or completion date, put it in completedOn and leave expiresOn empty.",
              "Expiration rule: only fill expiresOn when the image has an explicit expiration/valid-through/expires label.",
              "Use ISO date format YYYY-MM-DD when a date is visible. If a field is not visible, return an empty string.",
              "Label fields: completedOnLabel and expiresOnLabel must contain the visible label next to the date you used, or empty string.",
              "rawVisibleText should contain the key visible certificate text needed to audit the extraction.",
              "Put card numbers, evaluator names, restrictions, certificate IDs, or uncertainty in notes.",
              "Do not use the selected app profile, current user, filename, or surrounding page text as extracted certificate data.",
              "Set confidence from 0 to 1 based on image clarity and field certainty.",
              `File: ${fileName}`,
            ].join("\n"),
          },
          {
            type: "input_image",
            image_url: params.dataUrl,
          },
        ],
      },
    ],
    body: {
      text: {
        format: {
          type: "json_schema",
          name: "training_record_photo_extraction",
          schema: trainingPhotoSchema(),
        },
      },
    },
  });

  if (!response.text) {
    return {
      draft: null,
      meta: response.meta,
      error: "AI could not read this training image. You can still enter the record manually.",
    };
  }

  const draft = parseTrainingRecordPhotoExtraction(response.text);
  if (!draft) {
    return {
      draft: null,
      meta: { ...response.meta, fallbackUsed: true, fallbackReason: "invalid_json" },
      error: "AI returned an unreadable extraction result. You can still enter the record manually.",
    };
  }

  return { draft, meta: response.meta, error: null };
}
