import type {
  JsonObject,
  NormalizedSafetyIntakeRecord,
  PreparedSafetyIntake,
  SafetyIngestionSourceType,
  SafetyIntakeValidationError,
} from "@/types/safety-intelligence";
import { hashPayload } from "@/lib/safety-intelligence/ingestion/hash";
import {
  extractCanonicalFields,
  extractNormalizedDates,
  getJsonObjectFromEnvelope,
  getPayloadObject,
} from "@/lib/safety-intelligence/ingestion/normalize";
import { redactCompanyNames } from "@/lib/safety-intelligence/ingestion/redact";
import { isRecord } from "@/lib/safety-intelligence/validation/common";

function addError(
  errors: SafetyIntakeValidationError[],
  field: string,
  code: string,
  message: string
) {
  errors.push({ field, code, message });
}

function deriveSourceType(
  envelope: JsonObject,
  payload: JsonObject,
  candidate: SafetyIngestionSourceType
) {
  if (candidate !== "other") {
    return candidate;
  }

  const envelopeCandidate = String(envelope.source_type ?? envelope.sourceType ?? "").trim();
  const payloadCandidate = String(payload.source_type ?? payload.sourceType ?? "").trim();
  if (envelopeCandidate || payloadCandidate) {
    return "other";
  }

  return "other";
}

function buildNormalizedRecord(params: {
  companyId: string;
  jobsiteId?: string | null;
  sourceType: SafetyIngestionSourceType;
  payload: JsonObject;
}): {
  normalizedRecord: NormalizedSafetyIntakeRecord | null;
  validationErrors: SafetyIntakeValidationError[];
} {
  const { companyId, payload } = params;
  const fields = extractCanonicalFields(payload);
  const dates = extractNormalizedDates(payload);
  const validationErrors: SafetyIntakeValidationError[] = [];

  if (params.sourceType === "other") {
    addError(validationErrors, "sourceType", "invalid_source_type", "sourceType is required and must be recognized.");
  }

  const title = fields.title ?? fields.summary ?? fields.description ?? null;
  if (!title) {
    addError(validationErrors, "title", "missing_title", "A title, summary, or description is required.");
  }

  if (fields.severity == null) {
    addError(
      validationErrors,
      "severity",
      "invalid_severity",
      "severity must be one of low, medium, high, or critical."
    );
  }

  for (const [field, result] of Object.entries(dates)) {
    if (result.error) {
      addError(validationErrors, field, "invalid_date", result.error);
    }
  }

  const sourceCreatedAt = dates.createdAt.iso ?? dates.eventAt.iso ?? dates.validFrom.iso ?? null;
  if (!sourceCreatedAt) {
    addError(
      validationErrors,
      "sourceCreatedAt",
      "missing_date",
      "At least one valid date field is required."
    );
  }

  if (validationErrors.length > 0 || !title || !fields.severity || !sourceCreatedAt) {
    return {
      normalizedRecord: null,
      validationErrors,
    };
  }

  return {
    normalizedRecord: {
      companyId,
      jobsiteId: params.jobsiteId ?? fields.jobsiteId ?? null,
      sourceType: params.sourceType,
      sourceRecordId: fields.sourceRecordId ?? null,
      title,
      summary: fields.summary ?? null,
      description: fields.description ?? null,
      severity: fields.severity,
      trade: fields.trade ?? null,
      category: fields.category ?? null,
      sourceCreatedAt,
      eventAt: dates.eventAt.iso ?? null,
      reportedAt: dates.createdAt.iso ?? null,
      dueAt: dates.dueAt.iso ?? null,
      validFrom: dates.validFrom.iso ?? null,
      validTo: dates.validTo.iso ?? null,
      payload,
      metadata: {
        ingestedAt: new Date().toISOString(),
      },
    },
    validationErrors,
  };
}

export function prepareSafetyIntake(params: {
  body: unknown;
  companyId: string;
  companyName?: string | null;
  defaultJobsiteId?: string | null;
}): PreparedSafetyIntake {
  if (!isRecord(params.body)) {
    const rawPayloadHash = hashPayload(params.body);
    return {
      companyId: params.companyId,
      jobsiteId: params.defaultJobsiteId ?? null,
      sourceType: "other",
      sourceRecordId: null,
      rawPayloadHash,
      validationStatus: "rejected",
      validationErrors: [
        {
          field: "body",
          code: "invalid_payload",
          message: "Request body must be a JSON object.",
        },
      ],
      removedCompanyTokens: [],
      sanitizedPayload: {},
      normalizedRecord: null,
    };
  }

  const rawPayloadHash = hashPayload(params.body);
  const envelope = getJsonObjectFromEnvelope(params.body);
  const payload = getPayloadObject(params.body);
  const combinedPayload = {
    ...envelope,
    ...payload,
  };
  const sourceTypeCandidate = extractCanonicalFields({
    ...combinedPayload,
  }).sourceType;
  const sourceType = deriveSourceType(envelope, combinedPayload, sourceTypeCandidate);

  const { sanitizedPayload, removedCompanyTokens } = redactCompanyNames({
    payload: combinedPayload,
    companyName: params.companyName,
  });

  const { normalizedRecord, validationErrors } = buildNormalizedRecord({
    companyId: params.companyId,
    jobsiteId: params.defaultJobsiteId ?? null,
    sourceType,
    payload: sanitizedPayload,
  });

  return {
    companyId: params.companyId,
    jobsiteId: normalizedRecord?.jobsiteId ?? params.defaultJobsiteId ?? null,
    sourceType,
    sourceRecordId: normalizedRecord?.sourceRecordId ?? null,
    rawPayloadHash,
    validationStatus: validationErrors.length > 0 ? "rejected" : "accepted",
    validationErrors,
    removedCompanyTokens,
    sanitizedPayload,
    normalizedRecord,
  };
}
