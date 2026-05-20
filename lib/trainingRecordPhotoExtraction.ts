import { resolveCompanyAiDefaultModel } from "@/lib/ai/defaultModel";
import { requestAiResponsesText, type AiExecutionMeta } from "@/lib/ai/responses";
import { normalizeDateOnly } from "@/lib/companyTrackedEmployees";

const DEFAULT_TRAINING_PHOTO_MODEL = "gpt-4o-mini";
const MAX_TEXT = {
  title: 180,
  provider: 180,
  notes: 1200,
  warning: 240,
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

function normalizeExtractedDate(value: unknown, fieldLabel: string, warnings: string[]) {
  const raw = cleanText(value, 80);
  if (!raw) return "";
  const normalized = normalizeDateOnly(raw);
  if (normalized) return normalized;
  warnings.push(`${fieldLabel} date was visible but could not be normalized.`);
  return "";
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
  const completedOn = normalizeExtractedDate(
    record.completedOn ?? record.completed_on,
    "Completed",
    warnings
  );
  const expiresOn = normalizeExtractedDate(record.expiresOn ?? record.expires_on, "Expiration", warnings);
  const title = cleanText(record.title ?? record.trainingTitle ?? record.training_title, MAX_TEXT.title);

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
      warnings: {
        type: "array",
        maxItems: 8,
        items: { type: "string" },
      },
    },
    required: ["title", "completedOn", "expiresOn", "provider", "notes", "confidence", "warnings"],
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
  const employeeName = params.employeeName?.trim() || "the selected employee";
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
              "Use ISO date format YYYY-MM-DD when a date is visible. If a field is not visible, return an empty string.",
              "Put card numbers, evaluator names, restrictions, certificate IDs, or uncertainty in notes.",
              "Set confidence from 0 to 1 based on image clarity and field certainty.",
              `Employee: ${employeeName}`,
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
