"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  ListChecks,
  Loader2,
  PlayCircle,
  RefreshCw,
  Save,
  ShieldAlert,
  Flag,
  Users,
  XCircle,
} from "lucide-react";
import {
  PageHero,
  SectionCard,
  appNativeSelectClassName,
  appButtonPrimaryClassName,
  appButtonQuietClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";
import type {
  OwnerCustomerReadyGate,
  OwnerCustomerReadyStatus,
  OwnerManualReviewItem,
  OwnerManualReviewStatus,
  OwnerValidationModule,
  OwnerValidationOverview,
  OwnerValidationStatus,
} from "@/lib/superadmin/ownerValidationTypes";

type SandboxSummary = {
  exists: boolean;
  companyId: string | null;
  companyName: string;
  sandboxKey: string;
  records: Array<{
    record_table?: string;
    record_kind?: string;
    record_label?: string;
  }>;
};

type PreviewPermission = {
  key: string;
  label: string;
  allowed: boolean;
  explanation: string;
};

type PreviewRole = {
  id: string;
  label: string;
  appRole: string;
  banner: string;
  sandboxCompanyName: string;
  sandboxKey: string;
  permissions: PreviewPermission[];
  plainEnglishSummary: string;
};

type PreviewRolesResponse = {
  sandbox: SandboxSummary;
  roles: PreviewRole[];
  note: string;
};

type PlatformCheckStatus = "pass" | "warning" | "fail";

type PlatformCheckResponse = {
  overallStatus: OwnerValidationStatus;
  overallScore: number;
  summary: string;
  passedCount: number;
  warningCount: number;
  failedCount: number;
  checks: Array<{
    moduleKey: string;
    checkName: string;
    status: PlatformCheckStatus;
    result: string;
    whyItMatters: string;
    recommendedOwnerAction: string;
  }>;
};

type DocumentExportCheckResponse = {
  overallStatus: OwnerValidationStatus;
  overallScore: number;
  summary: string;
  passedCount: number;
  warningCount: number;
  failedCount: number;
  checks: Array<{
    moduleKey: "documents" | "pdf_word_exports";
    checkName: string;
    status: PlatformCheckStatus;
    result: string;
    whyItMatters: string;
    recommendedOwnerAction: string;
  }>;
};

type GusValidationStatus = "needs_review" | "approved" | "flagged";

type GusValidationTestCase = {
  id: string;
  case_key: string;
  title: string;
  scenario: string;
  expected_focus: string[];
};

type GusValidationResult = {
  id: string;
  test_case_id: string | null;
  scenario: string;
  gus_response: string;
  validation_status: GusValidationStatus;
  company_context_used: string[];
  source_rules_used: string[];
  warnings: string[];
  blocked_by_rules: boolean;
  fallback_used: boolean;
  notes: string | null;
  created_at: string;
};

type GusValidationOverview = {
  testCases: GusValidationTestCase[];
  recentResults: GusValidationResult[];
  sourceRules: string[];
};

const MODULE_ORDER = [
  "login_auth",
  "roles_permissions",
  "company_setup",
  "jobsite_setup",
  "jsa_builder",
  "permit_system",
  "training_matrix",
  "observations",
  "incidents",
  "corrective_actions",
  "documents",
  "pdf_word_exports",
  "file_uploads",
  "notifications",
  "gus_ai",
  "ai_risk_engine",
  "mobile_views",
];

const STATUS_LABELS: Record<OwnerValidationStatus, string> = {
  green: "Working",
  yellow: "Needs review",
  red: "Broken",
  gray: "Not tested",
};

const STATUS_EXPLANATIONS: Record<OwnerValidationStatus, string> = {
  green: "The latest validation result says this module is working.",
  yellow: "This module is reachable, but it needs owner review before customer use.",
  red: "This module has a blocking problem that should be fixed before customer use.",
  gray: "This module has not been tested yet.",
};

const MANUAL_REVIEW_STATUS_LABELS: Record<OwnerManualReviewStatus, string> = {
  not_started: "Not started",
  passed: "Passed",
  needs_review: "Needs review",
  failed: "Failed",
};

const GUS_VALIDATION_STATUS_LABELS: Record<GusValidationStatus, string> = {
  needs_review: "Needs review",
  approved: "Approved",
  flagged: "Flagged",
};

const CUSTOMER_READY_STATUS_LABELS: Record<OwnerCustomerReadyStatus, string> = {
  "Not tested": "Not tested",
  Blocked: "Blocked",
  "Needs owner review": "Needs owner review",
  "Approved for demo": "Approved for demo",
  "Approved for customer use": "Approved for customer use",
};

function statusStyles(status: OwnerValidationStatus) {
  if (status === "green") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "yellow") return "border-amber-200 bg-amber-50 text-amber-950";
  if (status === "red") return "border-red-200 bg-red-50 text-red-950";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function statusDot(status: OwnerValidationStatus) {
  if (status === "green") return "bg-emerald-500";
  if (status === "yellow") return "bg-amber-500";
  if (status === "red") return "bg-red-500";
  return "bg-slate-400";
}

function platformStatusStyles(status: PlatformCheckStatus) {
  if (status === "pass") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "warning") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-red-200 bg-red-50 text-red-950";
}

function platformStatusLabel(status: PlatformCheckStatus) {
  if (status === "pass") return "Pass";
  if (status === "warning") return "Warning";
  return "Fail";
}

function manualStatusStyles(status: OwnerManualReviewStatus) {
  if (status === "passed") return "bg-emerald-50 text-emerald-900";
  if (status === "needs_review") return "bg-amber-50 text-amber-950";
  if (status === "failed") return "bg-red-50 text-red-950";
  return "bg-slate-100 text-slate-700";
}

function gusValidationStatusStyles(status: GusValidationStatus) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "flagged") return "border-red-200 bg-red-50 text-red-950";
  return "border-amber-200 bg-amber-50 text-amber-950";
}

function customerReadyStatusStyles(status?: OwnerCustomerReadyStatus) {
  if (status === "Approved for customer use") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "Approved for demo") return "border-sky-200 bg-sky-50 text-sky-950";
  if (status === "Blocked") return "border-red-200 bg-red-50 text-red-950";
  if (status === "Needs owner review") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function StatusIcon({ status }: { status: OwnerValidationStatus }) {
  if (status === "green") return <CheckCircle2 className="h-4 w-4" aria-hidden />;
  if (status === "yellow") return <AlertTriangle className="h-4 w-4" aria-hidden />;
  if (status === "red") return <XCircle className="h-4 w-4" aria-hidden />;
  return <ShieldAlert className="h-4 w-4" aria-hidden />;
}

function formatDate(value: string | null) {
  if (!value) return "Not tested yet";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function customerReadyLabel(gate?: OwnerCustomerReadyGate, module?: OwnerValidationModule) {
  if (gate?.customer_ready_status) return gate.customer_ready_status;
  if (module?.customer_ready || gate?.customer_ready) return "Approved for customer use";
  if (gate?.automated_validation_status === "red") return "Blocked";
  if (gate?.automated_validation_status === "green" && gate?.owner_visual_review_status !== "passed") {
    return "Needs owner review";
  }
  return "Not tested";
}

function sortModules(modules: OwnerValidationModule[]) {
  const rank = new Map(MODULE_ORDER.map((key, index) => [key, index]));
  return [...modules].sort((a, b) => {
    const aRank = rank.get(a.module_key) ?? 999;
    const bRank = rank.get(b.module_key) ?? 999;
    if (aRank !== bRank) return aRank - bRank;
    return a.display_name.localeCompare(b.display_name);
  });
}

function summarizeSandboxRecords(summary: SandboxSummary | null) {
  if (!summary?.records) return {};
  return summary.records.reduce<Record<string, number>>((acc, record) => {
    const kind = record.record_kind ?? "record";
    acc[kind] = (acc[kind] ?? 0) + 1;
    return acc;
  }, {});
}

function ManualReviewItemRow({
  item,
  onSaved,
  onError,
}: {
  item: OwnerManualReviewItem;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [status, setStatus] = useState<OwnerManualReviewStatus>(item.status ?? "not_started");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch(`/api/superadmin/owner-validation/manual-review/${item.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Checklist save failed (${response.status})`);
      }

      await onSaved();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Checklist item could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--app-border)] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--app-text-strong)]">{item.checklist_item}</p>
          <p className="mt-1 text-xs text-[var(--app-muted)]">
            {item.required ? "Required for customer-ready review" : "Optional review item"}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${manualStatusStyles(status)}`}>
          {MANUAL_REVIEW_STATUS_LABELS[status]}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-start">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
            Status
          </span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as OwnerManualReviewStatus)}
            className={`${appNativeSelectClassName} w-full`}
          >
            <option value="not_started">Not started</option>
            <option value="passed">Passed</option>
            <option value="needs_review">Needs review</option>
            <option value="failed">Failed</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
            Notes
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="w-full rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
            placeholder="Plain-English owner notes"
          />
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className={`${appButtonSecondaryClassName} md:mt-5`}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          Save
        </button>
      </div>
    </div>
  );
}

export default function OwnerValidationConsolePage() {
  const [overview, setOverview] = useState<OwnerValidationOverview | null>(null);
  const [sandbox, setSandbox] = useState<SandboxSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [selectedModuleKey, setSelectedModuleKey] = useState<string | null>(null);
  const [platformCheck, setPlatformCheck] = useState<PlatformCheckResponse | null>(null);
  const [documentExportCheck, setDocumentExportCheck] = useState<DocumentExportCheckResponse | null>(null);
  const [previewRoles, setPreviewRoles] = useState<PreviewRole[]>([]);
  const [selectedPreviewRoleId, setSelectedPreviewRoleId] = useState<string | null>("company_admin");
  const [gateDrafts, setGateDrafts] = useState<Record<string, OwnerCustomerReadyStatus>>({});
  const [gusValidation, setGusValidation] = useState<GusValidationOverview | null>(null);
  const [selectedGusCaseId, setSelectedGusCaseId] = useState<string | null>(null);
  const [gusScenario, setGusScenario] = useState("Crew is doing hot work near combustible material.");
  const [latestGusResult, setLatestGusResult] = useState<GusValidationResult | null>(null);
  const [gusNotes, setGusNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const [overviewRes, sandboxRes, previewRolesRes, gusValidationRes] = await Promise.all([
        fetch("/api/superadmin/owner-validation", {
          credentials: "include",
          cache: "no-store",
        }),
        fetch("/api/superadmin/owner-validation/sandbox", {
          credentials: "include",
          cache: "no-store",
        }),
        fetch("/api/superadmin/owner-validation/preview-roles", {
          credentials: "include",
          cache: "no-store",
        }),
        fetch("/api/superadmin/owner-validation/gus-validation", {
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      if (
        overviewRes.status === 403 ||
        sandboxRes.status === 403 ||
        previewRolesRes.status === 403 ||
        gusValidationRes.status === 403
      ) {
        setForbidden(true);
        setOverview(null);
        setSandbox(null);
        setPreviewRoles([]);
        setGusValidation(null);
        return;
      }

      if (!overviewRes.ok) {
        const body = await overviewRes.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Validation console failed (${overviewRes.status})`);
      }
      if (!sandboxRes.ok) {
        const body = await sandboxRes.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Sandbox summary failed (${sandboxRes.status})`);
      }
      if (!previewRolesRes.ok) {
        const body = await previewRolesRes.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Preview roles failed (${previewRolesRes.status})`);
      }
      if (!gusValidationRes.ok) {
        const body = await gusValidationRes.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Gus validation failed (${gusValidationRes.status})`);
      }

      const nextOverview = (await overviewRes.json()) as OwnerValidationOverview;
      const nextPreviewRoles = (await previewRolesRes.json()) as PreviewRolesResponse;
      const nextGusValidation = (await gusValidationRes.json()) as GusValidationOverview;
      setOverview(nextOverview);
      setSandbox((await sandboxRes.json()) as SandboxSummary);
      setPreviewRoles(nextPreviewRoles.roles);
      setGusValidation(nextGusValidation);
      setLatestGusResult((current) => current ?? nextGusValidation.recentResults[0] ?? null);
      setGateDrafts(
        Object.fromEntries(
          (nextOverview.customerReadyGates ?? []).map((gate) => [
            gate.module_key,
            gate.customer_ready_status ?? "Not tested",
          ])
        )
      );
      setSelectedModuleKey((current) => current ?? nextOverview.modules[0]?.module_key ?? null);
      setSelectedPreviewRoleId((current) => current ?? nextPreviewRoles.roles[0]?.id ?? null);
      setSelectedGusCaseId((current) => current ?? nextGusValidation.testCases[0]?.id ?? null);
      setGusScenario((current) => current || nextGusValidation.testCases[0]?.scenario || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Owner Validation Console could not load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const modules = useMemo(() => sortModules(overview?.modules ?? []), [overview]);
  const gatesByModule = useMemo(
    () => new Map((overview?.customerReadyGates ?? []).map((gate) => [gate.module_key, gate])),
    [overview]
  );
  const manualItemsByModule = useMemo(() => {
    const map = new Map<string, OwnerManualReviewItem[]>();
    for (const item of overview?.manualReviewItems ?? []) {
      const existing = map.get(item.module_key) ?? [];
      existing.push(item);
      map.set(item.module_key, existing);
    }
    return map;
  }, [overview]);
  const selectedModule = modules.find((module) => module.module_key === selectedModuleKey) ?? modules[0] ?? null;
  const selectedPreviewRole =
    previewRoles.find((role) => role.id === selectedPreviewRoleId) ?? previewRoles[0] ?? null;
  const selectedGusCase =
    gusValidation?.testCases.find((testCase) => testCase.id === selectedGusCaseId) ??
    gusValidation?.testCases[0] ??
    null;
  const sandboxCounts = summarizeSandboxRecords(sandbox);

  const statusCounts = useMemo(() => {
    return modules.reduce<Record<OwnerValidationStatus, number>>(
      (acc, module) => {
        acc[module.status] += 1;
        return acc;
      },
      { green: 0, yellow: 0, red: 0, gray: 0 }
    );
  }, [modules]);

  async function runModuleCheck(module: OwnerValidationModule) {
    setActionKey(module.module_key);
    setError(null);
    try {
      const response = await fetch("/api/superadmin/owner-validation/runs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overallStatus: "yellow",
          overallScore: 50,
          summary: `${module.display_name} was queued from the Owner Validation Console. Full automated module checks are still being built.`,
          checks: [
            {
              moduleKey: module.module_key,
              checkName: `${module.display_name} first UI check`,
              status: "yellow",
              result: `${module.display_name} has an owner-visible review card. Automated checks for this module still need the next validation step.`,
              technicalDetails: { source: "owner-validation-console-module-button" },
              recommendedOwnerAction: `Open ${module.display_name} and visually confirm the page works with sandbox data.`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Module test failed (${response.status})`);
      }
      await load();
      setSelectedModuleKey(module.module_key);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Module test could not be recorded.");
    } finally {
      setActionKey(null);
    }
  }

  async function runPlatformCheck() {
    setActionKey("platform-check");
    setError(null);
    try {
      const response = await fetch("/api/superadmin/owner-validation/platform-check", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Platform check failed (${response.status})`);
      }

      setPlatformCheck((await response.json()) as PlatformCheckResponse);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Platform check could not be completed.");
    } finally {
      setActionKey(null);
    }
  }

  async function runDocumentExportCheck() {
    setActionKey("document-export-check");
    setError(null);
    try {
      const response = await fetch("/api/superadmin/owner-validation/document-exports", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Document export check failed (${response.status})`);
      }

      setDocumentExportCheck((await response.json()) as DocumentExportCheckResponse);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Document export check could not be completed.");
    } finally {
      setActionKey(null);
    }
  }

  async function seedSandbox() {
    setActionKey("sandbox");
    setError(null);
    try {
      const response = await fetch("/api/superadmin/owner-validation/sandbox", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Sandbox seed failed (${response.status})`);
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Safety360 Test Company could not be created.");
    } finally {
      setActionKey(null);
    }
  }

  async function updateCustomerReadyGate(moduleKey: string) {
    const customerReadyStatus = gateDrafts[moduleKey] ?? "Needs owner review";
    setActionKey(`gate-${moduleKey}`);
    setError(null);
    try {
      const response = await fetch(`/api/superadmin/owner-validation/customer-ready-gates/${moduleKey}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerReadyStatus }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Customer-ready gate failed (${response.status})`);
      }

      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Customer-ready gate could not be updated.");
    } finally {
      setActionKey(null);
    }
  }

  async function runGusValidation() {
    setActionKey("gus-validation");
    setError(null);
    try {
      const response = await fetch("/api/superadmin/owner-validation/gus-validation", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: gusScenario,
          testCaseId: selectedGusCaseId,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Gus validation failed (${response.status})`);
      }

      const body = (await response.json()) as { result: GusValidationResult };
      setLatestGusResult(body.result);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gus validation could not run.");
    } finally {
      setActionKey(null);
    }
  }

  async function saveGusTestCase() {
    setActionKey("gus-save-test-case");
    setError(null);
    try {
      const response = await fetch("/api/superadmin/owner-validation/gus-validation", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_test_case",
          title: selectedGusCase?.title ? `${selectedGusCase.title} copy` : "Custom Gus validation scenario",
          scenario: gusScenario,
          expectedFocus: selectedGusCase?.expected_focus ?? [],
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Gus test case save failed (${response.status})`);
      }

      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gus test case could not be saved.");
    } finally {
      setActionKey(null);
    }
  }

  async function updateGusResult(status: GusValidationStatus) {
    if (!latestGusResult) return;
    setActionKey(`gus-result-${status}`);
    setError(null);
    try {
      const response = await fetch(`/api/superadmin/owner-validation/gus-validation/results/${latestGusResult.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes: gusNotes }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Gus result update failed (${response.status})`);
      }

      const body = (await response.json()) as { result: GusValidationResult };
      setLatestGusResult(body.result);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gus validation result could not be updated.");
    } finally {
      setActionKey(null);
    }
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <section className="rounded-xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-12 w-12 text-red-600" aria-hidden />
          <h1 className="mt-4 text-xl font-bold text-red-950">Access denied</h1>
          <p className="mt-2 text-sm leading-6 text-red-900">
            The Owner Validation Console is restricted to Super Admin users only.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <PageHero
        eyebrow="Super Admin"
        title="Owner Validation Console"
        description="A plain-English control room for what is working, what needs review, what is blocked, and what should not be shown to customers yet."
        actions={
          <>
            <button type="button" className={appButtonSecondaryClassName} onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
              Refresh
            </button>
            <Link href="/superadmin/what-changed" className={appButtonSecondaryClassName}>
              <FileCheck2 className="h-4 w-4" aria-hidden />
              What Changed?
            </Link>
            <Link href="/superadmin/owner-validation/report" className={appButtonSecondaryClassName}>
              <FileCheck2 className="h-4 w-4" aria-hidden />
              Owner Report
            </Link>
            <button
              type="button"
              className={appButtonPrimaryClassName}
              onClick={() => void runPlatformCheck()}
              disabled={actionKey === "platform-check"}
            >
              {actionKey === "platform-check" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ListChecks className="h-4 w-4" aria-hidden />}
              Run Platform Check
            </button>
          </>
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-950">
          {error}
        </div>
      ) : null}

      {loading && !overview ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[var(--app-muted)]">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          Loading owner validation status...
        </div>
      ) : null}

      {overview ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {([
              ["green", "Working"],
              ["yellow", "Needs review"],
              ["red", "Broken"],
              ["gray", "Not tested"],
            ] as const).map(([status, label]) => (
              <div key={status} className={`rounded-xl border px-4 py-3 ${statusStyles(status)}`}>
                <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-75">{label}</p>
                <p className="mt-1 text-3xl font-black">{statusCounts[status]}</p>
              </div>
            ))}
            <div className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 shadow-[0_10px_22px_rgba(44,58,86,0.055)]">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">Sandbox</p>
              <p className="mt-1 text-lg font-black text-[var(--app-text-strong)]">
                {sandbox?.exists ? "Ready" : "Missing"}
              </p>
              <p className="mt-1 text-xs text-[var(--app-muted)]">
                {sandbox?.exists ? `${sandbox.records.length} marked test records` : "Create before running checks"}
              </p>
            </div>
          </section>

          <SectionCard
            title="Safety360 Test Company"
            description="This sandbox company is used for validation only. It is marked as demo/test data and should be the default target for future platform checks."
            actions={
              <button
                type="button"
                className={appButtonQuietClassName}
                onClick={() => void seedSandbox()}
                disabled={actionKey === "sandbox"}
              >
                {actionKey === "sandbox" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
                {sandbox?.exists ? "Reseed sandbox" : "Create sandbox"}
              </button>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Company", sandbox?.exists ? sandbox.companyName : "Not created"],
                ["Employees", String(sandboxCounts.employee ?? 0)],
                ["Jobsites", String(sandboxCounts.jobsite ?? 0)],
                ["Documents", String(sandboxCounts.document ?? 0)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">{label}</p>
                  <p className="mt-1 text-sm font-bold text-[var(--app-text-strong)]">{value}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Preview As User"
            description="This Super Admin-only preview shows what each role should be able to see and do inside Safety360 Test Company without changing the real signed-in session."
            actions={
              <button
                type="button"
                className={appButtonQuietClassName}
                onClick={() => setSelectedPreviewRoleId(null)}
              >
                <Users className="h-4 w-4" aria-hidden />
                Return to Super Admin view
              </button>
            }
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {previewRoles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedPreviewRoleId(role.id)}
                    className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${
                      selectedPreviewRoleId === role.id
                        ? "border-[var(--app-accent-primary)] bg-[var(--app-accent-primary-soft)] text-[var(--app-accent-primary)]"
                        : "border-[var(--app-border)] bg-white text-[var(--app-text-strong)] hover:bg-[var(--app-panel-soft)]"
                    }`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>

              {selectedPreviewRole ? (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-950">
                  <p className="text-sm font-black">{selectedPreviewRole.banner}</p>
                  <p className="mt-2 text-sm leading-6">{selectedPreviewRole.plainEnglishSummary}</p>
                  <p className="mt-2 text-xs font-semibold">
                    Sandbox only: {selectedPreviewRole.sandboxCompanyName}. This preview does not perform dangerous actions.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4">
                  <p className="text-sm font-bold text-[var(--app-text-strong)]">Super Admin view restored.</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--app-text)]">
                    Choose a role above when you want to review what that role should be allowed to do.
                  </p>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="min-w-[1320px] w-full text-left text-sm">
                  <thead className="border-b border-[var(--app-border)] text-xs uppercase tracking-[0.14em] text-[var(--app-muted)]">
                    <tr>
                      <th className="py-3 pr-4 font-bold">Role</th>
                      {(previewRoles[0]?.permissions ?? []).map((permission) => (
                        <th key={permission.key} className="py-3 pr-4 font-bold">
                          {permission.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--app-border)]">
                    {previewRoles.map((role) => (
                      <tr key={role.id} className={selectedPreviewRoleId === role.id ? "bg-[var(--app-panel-soft)]" : undefined}>
                        <td className="py-4 pr-4">
                          <button
                            type="button"
                            onClick={() => setSelectedPreviewRoleId(role.id)}
                            className="text-left font-bold text-[var(--app-text-strong)] hover:text-[var(--app-accent-primary)]"
                          >
                            {role.label}
                          </button>
                          <p className="mt-1 font-mono text-xs text-[var(--app-muted)]">{role.appRole}</p>
                        </td>
                        {role.permissions.map((permission) => (
                          <td key={permission.key} className="py-4 pr-4">
                            <span
                              title={permission.explanation}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                                permission.allowed ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
                              }`}
                              aria-label={`${role.label}: ${permission.label} ${permission.allowed ? "allowed" : "not allowed"}`}
                            >
                              {permission.allowed ? (
                                <CheckCircle2 className="h-4 w-4" aria-hidden />
                              ) : (
                                <XCircle className="h-4 w-4" aria-hidden />
                              )}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedPreviewRole ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedPreviewRole.permissions.map((permission) => (
                    <div key={permission.key} className="rounded-lg border border-[var(--app-border)] bg-white p-3">
                      <div className="flex items-center gap-2">
                        {permission.allowed ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                        ) : (
                          <XCircle className="h-4 w-4 text-slate-400" aria-hidden />
                        )}
                        <p className="text-sm font-bold text-[var(--app-text-strong)]">{permission.label}</p>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[var(--app-muted)]">{permission.explanation}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Gus / AI Safety Coach Validation"
            description="Run sandbox safety scenarios through Gus and review whether the response is practical, source-aware, draft-only, and safe enough for owner approval."
            tone="attention"
            actions={
              <button
                type="button"
                className={appButtonPrimaryClassName}
                onClick={() => void runGusValidation()}
                disabled={actionKey === "gus-validation"}
              >
                {actionKey === "gus-validation" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <BrainCircuit className="h-4 w-4" aria-hidden />
                )}
                Run Gus Test
              </button>
            }
          >
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                      Default test case
                    </span>
                    <select
                      value={selectedGusCaseId ?? ""}
                      onChange={(event) => {
                        const nextCase = gusValidation?.testCases.find((item) => item.id === event.target.value) ?? null;
                        setSelectedGusCaseId(event.target.value || null);
                        if (nextCase) setGusScenario(nextCase.scenario);
                      }}
                      className={`${appNativeSelectClassName} w-full`}
                    >
                      {(gusValidation?.testCases ?? []).map((testCase) => (
                        <option key={testCase.id} value={testCase.id}>
                          {testCase.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                      Input scenario
                    </span>
                    <textarea
                      value={gusScenario}
                      onChange={(event) => setGusScenario(event.target.value)}
                      rows={5}
                      className="w-full rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
                      placeholder="Enter a sandbox safety scenario for Gus"
                    />
                  </label>
                  {selectedGusCase ? (
                    <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                        Expected focus
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedGusCase.expected_focus.map((item) => (
                          <span key={item} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[var(--app-text-strong)]">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={appButtonSecondaryClassName}
                      onClick={() => void saveGusTestCase()}
                      disabled={actionKey === "gus-save-test-case"}
                    >
                      {actionKey === "gus-save-test-case" ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Save className="h-4 w-4" aria-hidden />
                      )}
                      Save as test case
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {latestGusResult ? (
                    <>
                      <div className={`rounded-xl border p-4 ${gusValidationStatusStyles(latestGusResult.validation_status)}`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-black">
                            {GUS_VALIDATION_STATUS_LABELS[latestGusResult.validation_status]}
                          </p>
                          <p className="text-xs font-semibold">{formatDate(latestGusResult.created_at)}</p>
                        </div>
                        <p className="mt-3 text-sm font-bold">Gus response</p>
                        <p className="mt-2 text-sm leading-6">{latestGusResult.gus_response}</p>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-[var(--app-border)] bg-white p-3">
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                            Company/jobsite context used
                          </p>
                          <ul className="mt-2 space-y-1 text-sm leading-6 text-[var(--app-text)]">
                            {latestGusResult.company_context_used.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-lg border border-[var(--app-border)] bg-white p-3">
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                            Source rules used
                          </p>
                          <ul className="mt-2 space-y-1 text-sm leading-6 text-[var(--app-text)]">
                            {latestGusResult.source_rules_used.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-75">Warnings</p>
                        {latestGusResult.warnings.length > 0 ? (
                          <ul className="mt-2 space-y-1 text-sm leading-6">
                            {latestGusResult.warnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-sm leading-6">
                            No obvious warning was detected. Owner review is still required before trusting safety AI output.
                          </p>
                        )}
                      </div>

                      <label className="block">
                        <span className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                          Approval / flag notes
                        </span>
                        <textarea
                          value={gusNotes}
                          onChange={(event) => setGusNotes(event.target.value)}
                          rows={2}
                          className="w-full rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
                          placeholder="Plain-English notes about why this response is approved or flagged"
                        />
                      </label>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={appButtonSecondaryClassName}
                          onClick={() => void updateGusResult("approved")}
                          disabled={actionKey === "gus-result-approved"}
                        >
                          {actionKey === "gus-result-approved" ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" aria-hidden />
                          )}
                          Approve response
                        </button>
                        <button
                          type="button"
                          className={appButtonSecondaryClassName}
                          onClick={() => void updateGusResult("flagged")}
                          disabled={actionKey === "gus-result-flagged"}
                        >
                          {actionKey === "gus-result-flagged" ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <Flag className="h-4 w-4" aria-hidden />
                          )}
                          Flag response
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[var(--app-border-strong)] bg-white p-5 text-sm leading-6 text-[var(--app-text)]">
                      Run a Gus test to see the scenario, response, source rules, warnings, and owner approval buttons.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4">
                <p className="text-sm font-bold text-[var(--app-text-strong)]">Default source rules</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {(gusValidation?.sourceRules ?? []).map((rule) => (
                    <p key={rule} className="rounded-lg bg-white p-3 text-xs leading-5 text-[var(--app-text)]">
                      {rule}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Document Export Validation"
            description="Generates sandbox-only Word and PDF files, checks that they are not empty, and scans for expected company/project text, placeholders, internal notes, and duplicate sections."
            tone="attention"
            actions={
              <button
                type="button"
                className={appButtonPrimaryClassName}
                onClick={() => void runDocumentExportCheck()}
                disabled={actionKey === "document-export-check"}
              >
                {actionKey === "document-export-check" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Download className="h-4 w-4" aria-hidden />
                )}
                Run Document Export Check
              </button>
            }
          >
            {documentExportCheck ? (
              <div className="space-y-4">
                <div className={`rounded-xl border p-4 ${statusStyles(documentExportCheck.overallStatus)}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold">Latest document export check</p>
                      <p className="mt-1 text-sm leading-6">{documentExportCheck.summary}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black">{documentExportCheck.overallScore}</p>
                      <p className="text-xs font-bold uppercase tracking-[0.16em]">Score</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs font-semibold">
                    Passed {documentExportCheck.passedCount}, warnings {documentExportCheck.warningCount}, failed {documentExportCheck.failedCount}
                  </p>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  {documentExportCheck.checks.map((check) => (
                    <div key={`${check.moduleKey}-${check.checkName}`} className="rounded-xl border border-[var(--app-border)] bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${platformStatusStyles(check.status)}`}>
                          {platformStatusLabel(check.status)}
                        </span>
                        <span className="rounded-full bg-[var(--app-panel-soft)] px-2.5 py-1 font-mono text-[11px] font-bold text-[var(--app-muted)]">
                          {check.moduleKey}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-bold text-[var(--app-text-strong)]">{check.checkName}</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{check.result}</p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)]">Why it matters</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--app-text)]">{check.whyItMatters}</p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)]">Owner action</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--app-text)]">{check.recommendedOwnerAction}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--app-border-strong)] bg-white p-5 text-sm leading-6 text-[var(--app-text)]">
                Click <strong>Run Document Export Check</strong> to generate sandbox-only sample Word and PDF files and scan them for obvious customer-facing document problems.
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Run Platform Check"
            description="Runs safe validation checks against Safety360 Test Company only. Results are written in plain English and saved as an Owner Proof Report."
            tone="attention"
            actions={
              <button
                type="button"
                className={appButtonPrimaryClassName}
                onClick={() => void runPlatformCheck()}
                disabled={actionKey === "platform-check"}
              >
                {actionKey === "platform-check" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <PlayCircle className="h-4 w-4" aria-hidden />}
                Run Platform Check
              </button>
            }
          >
            {platformCheck ? (
              <div className="space-y-4">
                <div className={`rounded-xl border p-4 ${statusStyles(platformCheck.overallStatus)}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold">Latest platform check</p>
                      <p className="mt-1 text-sm leading-6">{platformCheck.summary}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black">{platformCheck.overallScore}</p>
                      <p className="text-xs font-bold uppercase tracking-[0.16em]">Score</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs font-semibold">
                    Passed {platformCheck.passedCount}, warnings {platformCheck.warningCount}, failed {platformCheck.failedCount}
                  </p>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  {platformCheck.checks.map((check) => (
                    <div key={`${check.moduleKey}-${check.checkName}`} className="rounded-xl border border-[var(--app-border)] bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${platformStatusStyles(check.status)}`}>
                          {platformStatusLabel(check.status)}
                        </span>
                        <span className="rounded-full bg-[var(--app-panel-soft)] px-2.5 py-1 font-mono text-[11px] font-bold text-[var(--app-muted)]">
                          {check.moduleKey}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-bold text-[var(--app-text-strong)]">{check.checkName}</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{check.result}</p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)]">Why it matters</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--app-text)]">{check.whyItMatters}</p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)]">Owner action</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--app-text)]">{check.recommendedOwnerAction}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--app-border-strong)] bg-white p-5 text-sm leading-6 text-[var(--app-text)]">
                Click <strong>Run Platform Check</strong> to check sandbox setup, core safety records, owner-only access, and the areas that still need visual review.
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Validation Dashboard"
            description="Each module shows the latest validation color, when it was tested, what it means, and where the owner should review it."
          >
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full text-left text-sm">
                <thead className="border-b border-[var(--app-border)] text-xs uppercase tracking-[0.16em] text-[var(--app-muted)]">
                  <tr>
                    <th className="py-3 pr-4 font-bold">Module</th>
                    <th className="py-3 pr-4 font-bold">Status</th>
                    <th className="py-3 pr-4 font-bold">Last tested</th>
                    <th className="py-3 pr-4 font-bold">Plain-English explanation</th>
                    <th className="py-3 pr-4 font-bold">Customer gate</th>
                    <th className="py-3 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--app-border)]">
                  {modules.map((module) => {
                    const gate = gatesByModule.get(module.module_key);
                    const isRunning = actionKey === module.module_key;
                    return (
                      <tr key={module.module_key} className="align-top">
                        <td className="py-4 pr-4">
                          <button
                            type="button"
                            onClick={() => setSelectedModuleKey(module.module_key)}
                            className="text-left text-sm font-bold text-[var(--app-text-strong)] hover:text-[var(--app-accent-primary)]"
                          >
                            {module.display_name}
                          </button>
                          <p className="mt-1 font-mono text-xs text-[var(--app-muted)]">{module.module_key}</p>
                        </td>
                        <td className="py-4 pr-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyles(module.status)}`}>
                            <span className={`h-2 w-2 rounded-full ${statusDot(module.status)}`} />
                            {STATUS_LABELS[module.status]}
                          </span>
                        </td>
                        <td className="py-4 pr-4 text-xs text-[var(--app-muted)]">{formatDate(module.last_tested_at)}</td>
                        <td className="max-w-sm py-4 pr-4 text-sm leading-6 text-[var(--app-text)]">
                          {module.summary || STATUS_EXPLANATIONS[module.status]}
                        </td>
                        <td className="py-4 pr-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${customerReadyStatusStyles(gate?.customer_ready_status)}`}>
                            {customerReadyLabel(gate, module)}
                          </span>
                          {gate?.blocking_reason ? (
                            <p className="mt-1 max-w-44 text-xs leading-5 text-[var(--app-muted)]">{gate.blocking_reason}</p>
                          ) : null}
                          <p className="mt-2 text-[11px] leading-5 text-[var(--app-muted)]">
                            Auto: {STATUS_LABELS[gate?.automated_validation_status ?? "gray"]}; Review: {gate?.owner_visual_review_status ?? "not_started"}
                          </p>
                        </td>
                        <td className="py-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void runModuleCheck(module)}
                              disabled={isRunning}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-soft)]"
                            >
                              {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <PlayCircle className="h-3.5 w-3.5" aria-hidden />}
                              Run Test
                            </button>
                            {module.related_page_url ? (
                              <Link
                                href={module.related_page_url}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-soft)]"
                              >
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                                Open Page
                              </Link>
                            ) : null}
                            <a
                              href="#owner-review"
                              onClick={() => setSelectedModuleKey(module.module_key)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-soft)]"
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden />
                              Checklist
                            </a>
                            <label className="sr-only" htmlFor={`gate-${module.module_key}`}>
                              Customer-ready status for {module.display_name}
                            </label>
                            <select
                              id={`gate-${module.module_key}`}
                              value={gateDrafts[module.module_key] ?? gate?.customer_ready_status ?? "Not tested"}
                              onChange={(event) =>
                                setGateDrafts((current) => ({
                                  ...current,
                                  [module.module_key]: event.target.value as OwnerCustomerReadyStatus,
                                }))
                              }
                              className={`${appNativeSelectClassName} w-48 text-xs`}
                            >
                              {Object.entries(CUSTOMER_READY_STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => void updateCustomerReadyGate(module.module_key)}
                              disabled={actionKey === `gate-${module.module_key}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-soft)]"
                            >
                              {actionKey === `gate-${module.module_key}` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              ) : (
                                <FileCheck2 className="h-3.5 w-3.5" aria-hidden />
                              )}
                              Update Gate
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <section id="owner-review" className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <SectionCard
              title="Selected Module Review"
              description="This panel gives the owner a plain-English place to understand the selected module before the full checklist system is added."
            >
              {selectedModule ? (
                <div className="space-y-4">
                  <div className={`rounded-xl border p-4 ${statusStyles(selectedModule.status)}`}>
                    <div className="flex items-center gap-2">
                      <StatusIcon status={selectedModule.status} />
                      <p className="font-bold">{selectedModule.display_name}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6">{selectedModule.summary || STATUS_EXPLANATIONS[selectedModule.status]}</p>
                    <p className="mt-3 text-xs font-semibold">Last tested: {formatDate(selectedModule.last_tested_at)}</p>
                  </div>
                  <div className={`rounded-xl border p-4 ${customerReadyStatusStyles(gatesByModule.get(selectedModule.module_key)?.customer_ready_status)}`}>
                    <p className="text-sm font-bold">Customer-ready gate</p>
                    <p className="mt-2 text-lg font-black">
                      {customerReadyLabel(gatesByModule.get(selectedModule.module_key), selectedModule)}
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      {gatesByModule.get(selectedModule.module_key)?.blocking_reason ??
                        "No blocking reason is recorded for this module."}
                    </p>
                    <p className="mt-3 text-xs font-semibold">
                      Automated validation: {STATUS_LABELS[gatesByModule.get(selectedModule.module_key)?.automated_validation_status ?? "gray"]}. Owner review: {gatesByModule.get(selectedModule.module_key)?.owner_visual_review_status ?? "not_started"}.
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--app-border)] bg-white p-4">
                    <p className="text-sm font-bold text-[var(--app-text-strong)]">Owner should visually review</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">
                      Open the related page, confirm it loads, confirm it uses sandbox/test records where testing is needed, and confirm no customer-ready claim is shown until review is complete.
                    </p>
                    {selectedModule.related_page_url ? (
                      <Link href={selectedModule.related_page_url} className={`mt-4 ${appButtonSecondaryClassName}`}>
                        <ExternalLink className="h-4 w-4" aria-hidden />
                        Open related page
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </SectionCard>

            <SectionCard
              title="Owner Proof Reports"
              description="Latest validation runs will appear here after module checks and platform checks are recorded."
            >
              <div className="space-y-3">
                {(overview.recentRuns ?? []).slice(0, 5).map((run) => (
                  <div key={run.id} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyles(run.overall_status)}`}>
                        <StatusIcon status={run.overall_status} />
                        {STATUS_LABELS[run.overall_status]}
                      </span>
                      <span className="font-mono text-xs font-bold text-[var(--app-muted)]">Score {run.overall_score}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[var(--app-text-strong)]">{run.summary}</p>
                    <p className="mt-1 text-xs text-[var(--app-muted)]">
                      {formatDate(run.started_at)} - Passed {run.passed_count}, warnings {run.warning_count}, failed {run.failed_count}
                    </p>
                  </div>
                ))}
                {overview.recentRuns.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--app-border-strong)] bg-white p-5 text-sm text-[var(--app-muted)]">
                    No Owner Proof Reports have been recorded yet.
                  </div>
                ) : null}
              </div>
            </SectionCard>
          </section>

          <SectionCard
            title="Manual Review Items"
            description="Automated tests are not enough. Use these click-by-click checklist items to record owner visual review before a module can be considered customer-ready."
          >
            {selectedModule ? (
              <div className="space-y-3">
                {(manualItemsByModule.get(selectedModule.module_key) ?? []).map((item) => (
                  <ManualReviewItemRow
                    key={`${item.id}-${item.status}-${item.notes ?? ""}`}
                    item={item}
                    onSaved={load}
                    onError={setError}
                  />
                ))}
                {(manualItemsByModule.get(selectedModule.module_key) ?? []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--app-border-strong)] bg-white p-5 text-sm text-[var(--app-muted)]">
                    No checklist items exist for {selectedModule.display_name} yet.
                  </div>
                ) : null}
              </div>
            ) : null}
          </SectionCard>

          <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
            <div className="flex items-start gap-3">
              <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <p>
                Customer-ready gate rule: a module cannot be approved for customer use until automated validation is green or approved yellow,
                no red blocking failures remain, required owner checklist items are passed, a latest Owner Proof Report exists, and a Super Admin approves it.
              </p>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
