export type AuditFlowAnswerValue = "pass" | "fail" | "na";

export type AuditFlowTemplateItem = {
  id: string;
  label: string;
  weight: number;
  requirePhotoUrl: boolean;
  requireCommentOnFail: boolean;
};

export type AuditFlowTemplateSection = {
  id: string;
  title: string;
  items: AuditFlowTemplateItem[];
};

export type AuditFlowTemplateSchema = {
  sections: AuditFlowTemplateSection[];
};

export type AuditFlowSubmissionAnswer = {
  value: AuditFlowAnswerValue;
  comment?: string;
  photoUrl?: string;
};

export type AuditFlowSubmissionAnswers = Record<string, AuditFlowSubmissionAnswer>;

export type AuditFlowScoreSummary = {
  totalItems: number;
  answeredItems: number;
  pass: number;
  fail: number;
  na: number;
  possibleWeight: number;
  earnedWeight: number;
  compliancePercent: number | null;
  failedItems: Array<{
    itemKey: string;
    sectionTitle: string;
    itemLabel: string;
    comment: string;
    photoUrl: string;
  }>;
};

export type AuditFlowValidationResult = {
  ok: boolean;
  errors: string[];
};

const ANSWERS = new Set(["pass", "fail", "na"]);

function cleanText(value: unknown, max = 500) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanId(value: unknown, fallback: string) {
  const normalized = cleanText(value, 90)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function normalizeWeight(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.min(100, Math.round(parsed * 100) / 100);
}

export function itemKey(sectionId: string, itemId: string) {
  return `${sectionId}::${itemId}`;
}

export function parseAuditFlowTemplateSchema(input: unknown): AuditFlowTemplateSchema {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const rawSections = Array.isArray(record.sections) ? record.sections : [];
  const sections = rawSections
    .map((section, sectionIndex) => {
      const sectionRecord = section && typeof section === "object" ? (section as Record<string, unknown>) : {};
      const sectionId = cleanId(sectionRecord.id, `section-${sectionIndex + 1}`);
      const title = cleanText(sectionRecord.title, 160) || `Section ${sectionIndex + 1}`;
      const rawItems = Array.isArray(sectionRecord.items) ? sectionRecord.items : [];
      const items = rawItems
        .map((item, itemIndex) => {
          const itemRecord = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          const id = cleanId(itemRecord.id, `item-${itemIndex + 1}`);
          const label = cleanText(itemRecord.label, 260);
          if (!label) return null;
          return {
            id,
            label,
            weight: normalizeWeight(itemRecord.weight),
            requirePhotoUrl: itemRecord.requirePhotoUrl === true,
            requireCommentOnFail: itemRecord.requireCommentOnFail !== false,
          } satisfies AuditFlowTemplateItem;
        })
        .filter((item): item is AuditFlowTemplateItem => item != null);

      if (items.length < 1) return null;
      return { id: sectionId, title, items } satisfies AuditFlowTemplateSection;
    })
    .filter((section): section is AuditFlowTemplateSection => section != null);

  return { sections };
}

export function normalizeAuditFlowAnswers(input: unknown): AuditFlowSubmissionAnswers {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const answers: AuditFlowSubmissionAnswers = {};
  for (const [key, raw] of Object.entries(record)) {
    if (!key.trim() || !raw || typeof raw !== "object") continue;
    const rawAnswer = raw as Record<string, unknown>;
    const value = cleanText(rawAnswer.value, 10).toLowerCase();
    if (!ANSWERS.has(value)) continue;
    answers[key] = {
      value: value as AuditFlowAnswerValue,
      comment: cleanText(rawAnswer.comment, 2000),
      photoUrl: cleanText(rawAnswer.photoUrl, 2000),
    };
  }
  return answers;
}

export function scoreAuditFlowSubmission(
  schema: AuditFlowTemplateSchema,
  answers: AuditFlowSubmissionAnswers
): AuditFlowScoreSummary {
  let totalItems = 0;
  let answeredItems = 0;
  let pass = 0;
  let fail = 0;
  let na = 0;
  let possibleWeight = 0;
  let earnedWeight = 0;
  const failedItems: AuditFlowScoreSummary["failedItems"] = [];

  for (const section of schema.sections) {
    for (const item of section.items) {
      totalItems += 1;
      const key = itemKey(section.id, item.id);
      const answer = answers[key];
      if (!answer) continue;
      answeredItems += 1;
      if (answer.value === "na") {
        na += 1;
        continue;
      }
      possibleWeight += item.weight;
      if (answer.value === "pass") {
        pass += 1;
        earnedWeight += item.weight;
      } else {
        fail += 1;
        failedItems.push({
          itemKey: key,
          sectionTitle: section.title,
          itemLabel: item.label,
          comment: answer.comment ?? "",
          photoUrl: answer.photoUrl ?? "",
        });
      }
    }
  }

  return {
    totalItems,
    answeredItems,
    pass,
    fail,
    na,
    possibleWeight,
    earnedWeight,
    compliancePercent: possibleWeight > 0 ? Math.round((earnedWeight / possibleWeight) * 100) : null,
    failedItems,
  };
}

export function validateAuditFlowSubmission(
  schema: AuditFlowTemplateSchema,
  answers: AuditFlowSubmissionAnswers,
  signatureText: string
): AuditFlowValidationResult {
  const errors: string[] = [];
  if (!signatureText.trim()) errors.push("Signature is required.");

  for (const section of schema.sections) {
    for (const item of section.items) {
      const key = itemKey(section.id, item.id);
      const answer = answers[key];
      if (!answer) {
        errors.push(`${section.title}: ${item.label} must be scored.`);
        continue;
      }
      if (answer.value === "fail" && item.requireCommentOnFail && !answer.comment?.trim()) {
        errors.push(`${section.title}: ${item.label} needs a comment when marked fail.`);
      }
      if (item.requirePhotoUrl && !answer.photoUrl?.trim()) {
        errors.push(`${section.title}: ${item.label} requires a photo URL.`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function escapeAuditFlowHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeAuditFlowRole(role?: string | null) {
  const normalized = String(role ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (normalized === "operations_manager") return "manager";
  if (normalized === "safety_director") return "safety_manager";
  if (normalized === "superintendent") return "project_manager";
  return normalized;
}

function isAuditFlowAdminRole(role?: string | null) {
  const normalized = normalizeAuditFlowRole(role);
  return normalized === "platform_admin" || normalized === "super_admin" || normalized === "admin";
}

export function canManageAuditFlow(role?: string | null) {
  const normalized = normalizeAuditFlowRole(role);
  return (
    isAuditFlowAdminRole(normalized) ||
    normalized === "company_admin" ||
    normalized === "manager" ||
    normalized === "safety_manager" ||
    normalized === "project_manager"
  );
}

export function canReviewAuditFlow(role?: string | null) {
  const normalized = normalizeAuditFlowRole(role);
  return canManageAuditFlow(normalized) || normalized === "field_supervisor" || normalized === "foreman";
}

export function canSubmitAuditFlowAssignment(params: {
  role?: string | null;
  userId: string;
  assignedUserId?: string | null;
}) {
  if (canReviewAuditFlow(params.role)) return true;
  return Boolean(params.assignedUserId && params.assignedUserId === params.userId);
}
