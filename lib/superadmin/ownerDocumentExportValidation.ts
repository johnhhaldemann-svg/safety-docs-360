import { PDFDocument } from "pdf-lib";
import { generatePshsepDocx } from "@/app/api/pshsep/export/route";
import { generateFieldAuditReportPdf } from "@/lib/fieldAudits/reportPdf";
import {
  ensureDefaultOwnerValidationModules,
  recordOwnerValidationRun,
  type OwnerValidationSupabaseClient,
} from "@/lib/superadmin/ownerValidation";
import {
  loadSafety360TestCompanySummary,
  SAFETY360_TEST_COMPANY_NAME,
} from "@/lib/superadmin/ownerValidationSandbox";
import type { OwnerValidationRunInput, OwnerValidationStatus } from "@/lib/superadmin/ownerValidationTypes";

type DocumentExportStatus = "pass" | "warning" | "fail";
export type OwnerDocumentExportValidationSupabaseClient = OwnerValidationSupabaseClient;

export type OwnerDocumentExportCheckResult = {
  moduleKey: "documents" | "pdf_word_exports";
  checkName: string;
  status: DocumentExportStatus;
  result: string;
  whyItMatters: string;
  recommendedOwnerAction: string;
};

export type OwnerDocumentExportValidationResponse = {
  overallStatus: OwnerValidationStatus;
  overallScore: number;
  summary: string;
  passedCount: number;
  warningCount: number;
  failedCount: number;
  checks: OwnerDocumentExportCheckResult[];
  run: unknown;
};

type TextInspectionInput = {
  artifactLabel: string;
  text: string;
  expectedPhrases: string[];
  requiredSections: string[];
};

const PLACEHOLDER_PATTERNS = [
  /\bTODO\b/i,
  /\bTBD\b/i,
  /\blorem ipsum\b/i,
  /\[insert[^\]]*\]/i,
  /\{\{[^}]+\}\}/i,
  /replace placeholder/i,
  /Confirm before issue/i,
  /\bJohn Doe\b/i,
];

const INTERNAL_NOTE_PATTERNS = [
  /\bINTERNAL NOTE\b/i,
  /\bDO NOT SHOW CUSTOMER\b/i,
  /\bDEBUG\b/i,
  /\bconsole\.log\b/i,
  /\bGeneratedSafetyPlan\b/i,
  /\bmoduleKey\b/i,
  /\bplainText\b/i,
];

function toValidationStatus(status: DocumentExportStatus): OwnerValidationStatus {
  if (status === "pass") return "green";
  if (status === "warning") return "yellow";
  return "red";
}

function countOccurrences(text: string, phrase: string) {
  const normalizedPhrase = phrase.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!normalizedPhrase) return 0;
  return Array.from(text.matchAll(new RegExp(normalizedPhrase, "gi"))).length;
}

function hasPhrase(text: string, phrase: string) {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

export function inspectOwnerDocumentExportText(input: TextInspectionInput) {
  const missingExpected = input.expectedPhrases.filter((phrase) => !hasPhrase(input.text, phrase));
  const missingSections = input.requiredSections.filter((section) => !hasPhrase(input.text, section));
  const placeholders = PLACEHOLDER_PATTERNS.filter((pattern) => pattern.test(input.text)).map((pattern) =>
    String(pattern)
  );
  const internalNotes = INTERNAL_NOTE_PATTERNS.filter((pattern) => pattern.test(input.text)).map((pattern) =>
    String(pattern)
  );
  const duplicateSections = input.requiredSections.filter((section) => countOccurrences(input.text, section) > 1);

  const issues = [
    ...missingExpected.map((phrase) => `Missing expected text: ${phrase}`),
    ...missingSections.map((section) => `Missing required section: ${section}`),
    ...placeholders.map((pattern) => `Possible placeholder text matched ${pattern}`),
    ...internalNotes.map((pattern) => `Possible internal note matched ${pattern}`),
    ...duplicateSections.map((section) => `Possible duplicate section: ${section}`),
  ];

  const status: DocumentExportStatus =
    missingExpected.length > 0 || missingSections.length > 0 || internalNotes.length > 0
      ? "fail"
      : placeholders.length > 0 || duplicateSections.length > 0
        ? "warning"
        : "pass";

  return {
    status,
    issues,
    missingExpected,
    missingSections,
    placeholders,
    internalNotes,
    duplicateSections,
    summary:
      status === "pass"
        ? `${input.artifactLabel} includes the expected sandbox company/project text and required sections.`
        : `${input.artifactLabel} needs review: ${issues.join("; ")}.`,
  };
}

function calculateOverall(checks: OwnerDocumentExportCheckResult[]) {
  const passedCount = checks.filter((check) => check.status === "pass").length;
  const warningCount = checks.filter((check) => check.status === "warning").length;
  const failedCount = checks.filter((check) => check.status === "fail").length;
  const total = checks.length || 1;
  const overallScore = Math.max(0, Math.round(((passedCount + warningCount * 0.5) / total) * 100));
  const overallStatus: OwnerValidationStatus =
    failedCount > 0 ? "red" : warningCount > 0 ? "yellow" : "green";

  return { passedCount, warningCount, failedCount, overallScore, overallStatus };
}

function sandboxDocumentCount(records: Array<{ record_kind?: string | null }>) {
  return records.filter((record) => record.record_kind === "document").length;
}

async function extractDocxText(bytes: Uint8Array) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return result.value;
}

async function extractPdfText(bytes: Uint8Array) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: Buffer.from(bytes) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function buildWordExportChecks(): Promise<OwnerDocumentExportCheckResult[]> {
  try {
    const projectName = "Safety360 Test Company Export Validation Project";
    const generated = await generatePshsepDocx({
      company_name: SAFETY360_TEST_COMPANY_NAME,
      company_address: "100 Sandbox Way, Austin, TX",
      project_name: projectName,
      project_number: "S360-DOC-001",
      project_address: "100 Sandbox Way, Austin, TX",
      project_phase: "Construction",
      owner_client: "Safety360 Sandbox Owner",
      gc_cm: "Safety360 Test GC",
      contractor_company: SAFETY360_TEST_COMPANY_NAME,
      contractor_phone: "555-0100",
      contractor_email: "owner@safety360.test",
      plan_author: "Morgan Lee",
      approval_name: "Avery Parker",
      approval_date: "2026-05-27",
      include_hot_work: true,
      include_confined_space: true,
      include_excavation: true,
      include_electrical_loto: true,
      incident_reporting_process_text:
        "SANDBOX TEST RECORD: report incidents to the Safety360 Test Company safety manager before work continues.",
      special_conditions_permit_text:
        "SANDBOX TEST RECORD: hot work, confined space, excavation, and LOTO permits are reviewed before release.",
    });

    const bytes = generated.body;
    const text = await extractDocxText(bytes);
    const inspection = inspectOwnerDocumentExportText({
      artifactLabel: "Word export",
      text,
      expectedPhrases: [SAFETY360_TEST_COMPANY_NAME, projectName],
      requiredSections: ["Project", "Training", "DISCLAIMER"],
    });

    return [
      {
        moduleKey: "pdf_word_exports",
        checkName: "Word export generates a file",
        status: bytes.length > 0 ? "pass" : "fail",
        result:
          bytes.length > 0
            ? `Word export completed. A sample safety plan DOCX was generated for ${SAFETY360_TEST_COMPANY_NAME}.`
            : "Word export returned an empty file.",
        whyItMatters: "Customers need downloadable Word safety plans that can be reviewed and edited.",
        recommendedOwnerAction: "Open the Documents page and manually export a sandbox Word document.",
      },
      {
        moduleKey: "pdf_word_exports",
        checkName: "Word export content looks customer-safe",
        status: inspection.status,
        result: inspection.summary,
        whyItMatters: "A generated safety document should not ship with missing company details, internal notes, or unresolved placeholder text.",
        recommendedOwnerAction:
          inspection.status === "pass"
            ? "Visually open the sandbox Word export and confirm the cover/title and major sections look right."
            : "Open the sandbox Word export and review the flagged content before showing document exports to customers.",
      },
    ];
  } catch (error) {
    return [
      {
        moduleKey: "pdf_word_exports",
        checkName: "Word export generates a file",
        status: "fail",
        result: `Word export failed. Users may not be able to download safety plans as Word files. ${error instanceof Error ? error.message : ""}`.trim(),
        whyItMatters: "Customers may rely on Word downloads for safety plans, JSAs, permits, and review workflows.",
        recommendedOwnerAction: "Ask Codex/development to fix the Word export failure, then run this check again.",
      },
    ];
  }
}

async function buildPdfExportChecks(): Promise<OwnerDocumentExportCheckResult[]> {
  try {
    const report = await generateFieldAuditReportPdf({
      companyName: SAFETY360_TEST_COMPANY_NAME,
      customerName: "Safety360 Sandbox Owner",
      jobsiteName: "High-risk jobsite",
      auditDate: "2026-05-27",
      auditors: "Morgan Lee",
      hoursBilled: 1,
      selectedTrade: "hot_work",
      scoreSummary: { compliancePercent: 86, fail: 1, total: 8 },
      aiReviewSummary: {
        emailSummary: {
          openingSummary: "SANDBOX TEST RECORD: field audit report generated for document export validation.",
          findingHighlights: ["Combustible materials need owner review before hot work continues."],
        },
      },
      observations: [
        {
          item_label: "Combustible materials controlled",
          category_label: "Hot work",
          status: "fail",
          severity: "high",
          notes: "SANDBOX TEST RECORD: move combustibles or protect them before hot work.",
        },
      ],
      reviewerName: "Avery Parker",
      reportStatus: "preview",
    });

    const pdf = await PDFDocument.load(report.bytes);
    const text = await extractPdfText(report.bytes);
    const inspection = inspectOwnerDocumentExportText({
      artifactLabel: "PDF export",
      text,
      expectedPhrases: [SAFETY360_TEST_COMPANY_NAME, "High-risk jobsite", "Finished Field Audit Report"],
      requiredSections: ["Report details", "Findings summary", "Approval note"],
    });

    return [
      {
        moduleKey: "pdf_word_exports",
        checkName: "PDF export generates a file",
        status: report.bytes.length > 0 && pdf.getPageCount() > 0 ? "pass" : "fail",
        result:
          report.bytes.length > 0 && pdf.getPageCount() > 0
            ? `PDF export completed. A sample field audit PDF was generated for ${SAFETY360_TEST_COMPANY_NAME}.`
            : "PDF export returned an empty or unreadable file.",
        whyItMatters: "Customers need PDF exports for reports and customer-facing safety evidence.",
        recommendedOwnerAction: "Open a sandbox report PDF and confirm it is readable on desktop and mobile.",
      },
      {
        moduleKey: "pdf_word_exports",
        checkName: "PDF export content looks customer-safe",
        status: inspection.status,
        result: inspection.summary,
        whyItMatters: "A PDF should include the right company/jobsite information and avoid placeholders or internal notes.",
        recommendedOwnerAction:
          inspection.status === "pass"
            ? "Visually open the sandbox PDF and confirm the title, company, jobsite, and sections look right."
            : "Open the sandbox PDF and review the flagged content before showing PDF exports to customers.",
      },
    ];
  } catch (error) {
    return [
      {
        moduleKey: "pdf_word_exports",
        checkName: "PDF export generates a file",
        status: "fail",
        result: `PDF export failed. Users may not be able to download safety reports. ${error instanceof Error ? error.message : ""}`.trim(),
        whyItMatters: "Customers may need PDF documents for audits, field reports, and safety records.",
        recommendedOwnerAction: "Ask Codex/development to fix the PDF export failure, then run this check again.",
      },
    ];
  }
}

export async function runOwnerDocumentExportValidation(params: {
  client: OwnerValidationSupabaseClient;
  startedBy: string | null;
}): Promise<OwnerDocumentExportValidationResponse> {
  await ensureDefaultOwnerValidationModules(params.client);

  const sandbox = await loadSafety360TestCompanySummary(params.client);
  const records = Array.isArray(sandbox.records)
    ? (sandbox.records as Array<{ record_kind?: string | null }>)
    : [];
  const documentCount = sandboxDocumentCount(records);

  const checks: OwnerDocumentExportCheckResult[] = [
    {
      moduleKey: "documents",
      checkName: "Sandbox document records exist",
      status: documentCount >= 3 ? "pass" : "fail",
      result:
        documentCount >= 3
          ? `${SAFETY360_TEST_COMPANY_NAME} has ${documentCount} sandbox document records for safe export validation.`
          : `${SAFETY360_TEST_COMPANY_NAME} needs at least 3 sandbox document records before export validation is complete.`,
      whyItMatters: "Document export validation must use fake records and must not touch real customer files.",
      recommendedOwnerAction:
        documentCount >= 3
          ? "Confirm the document records are clearly labeled as sandbox/test records."
          : "Create or refresh Safety360 Test Company, then run Document Export Check again.",
    },
    ...(await buildWordExportChecks()),
    ...(await buildPdfExportChecks()),
  ];

  const totals = calculateOverall(checks);
  const summary =
    totals.failedCount > 0
      ? `Document export validation found ${totals.failedCount} blocking issue(s), ${totals.warningCount} warning(s), and ${totals.passedCount} passed check(s).`
      : totals.warningCount > 0
        ? `Document export validation generated sandbox files with ${totals.warningCount} owner-review warning(s).`
        : "Document export validation generated sandbox Word and PDF files and found no obvious customer-facing issues.";

  const input: OwnerValidationRunInput = {
    completedAt: new Date().toISOString(),
    overallStatus: totals.overallStatus,
    overallScore: totals.overallScore,
    summary,
    checks: checks.map((check) => ({
      moduleKey: check.moduleKey,
      checkName: check.checkName,
      status: toValidationStatus(check.status),
      result: check.result,
      technicalDetails: {
        whyItMatters: check.whyItMatters,
        source: "safe-owner-document-export-validation",
        sandboxCompany: SAFETY360_TEST_COMPANY_NAME,
      },
      recommendedOwnerAction: check.recommendedOwnerAction,
    })),
  };

  const run = await recordOwnerValidationRun({
    client: params.client,
    startedBy: params.startedBy,
    input,
  });

  return {
    ...totals,
    summary,
    checks,
    run,
  };
}
