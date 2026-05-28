"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityFeed,
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
} from "@/components/WorkspacePrimitives";
import { PermissionOverridesEditor } from "@/components/PermissionOverridesEditor";
import {
  normalizePermissionOverrides,
  type PermissionOverrides,
} from "@/lib/permissionOverrides";
import {
  ENTERPRISE_TIERS,
  PLATFORM_ADDONS,
  PLATFORM_FEATURES,
  getEnterpriseTier,
  type PlatformAddonKey,
  type PlatformAddonSelection,
  type PlatformFeatureKey,
} from "@/lib/platformPricing";
import {
  type CompanyOnboardingImportType,
  type ImportRowError,
  normalizeRowsArray,
  validateEmployeeImportRows,
  validateJobsiteImportRows,
  validateTrainingRecordImportRows,
} from "@/lib/companyOnboardingImport";
import { readExcelObjects } from "@/lib/excelRows";

const supabase = getSupabaseBrowserClient();

type CompanyDetail = {
  id: string;
  name: string;
  teamKey: string;
  industry: string;
  phone: string;
  website: string;
  addressLine1: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
  primaryContactName: string;
  primaryContactEmail: string;
  status: string;
  createdAt?: string | null;
  archivedAt?: string | null;
  archivedByEmail?: string;
  restoredAt?: string | null;
  restoredByEmail?: string;
  permissionOverrides?: PermissionOverrides;
  hasAccessOverrides?: boolean;
  hasPricingOverrides?: boolean;
};

type CompanySummary = {
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  suspendedUsers: number;
  pendingInvites: number;
  trackedEmployees: number;
  completedDocuments: number;
  submittedDocuments: number;
};

type CompanyUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

type CompanyInvite = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at?: string | null;
};

type TrackedEmployee = {
  id: string;
  external_employee_id?: string | null;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  trade_specialty?: string | null;
  readiness_status?: string | null;
  years_experience?: number | null;
  status?: string | null;
  certifications?: string[] | null;
  source?: string | null;
  archived_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  training_record_count?: number;
  jobsite_assignment_count?: number;
};

type TrackedEmployeeForm = {
  employee_id: string;
  full_name: string;
  email: string;
  phone: string;
  job_title: string;
  trade_specialty: string;
  readiness_status: string;
  years_experience: string;
  status: string;
  certifications: string;
};

const emptyTrackedEmployeeForm: TrackedEmployeeForm = {
  employee_id: "",
  full_name: "",
  email: "",
  phone: "",
  job_title: "",
  trade_specialty: "",
  readiness_status: "ready",
  years_experience: "",
  status: "active",
  certifications: "",
};

type CompanyDocument = {
  id: string;
  title: string;
  projectName: string;
  type: string;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  hasFinalFile: boolean;
  userId?: string | null;
};

type CompanyActivityItem = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  tone: "info" | "warning" | "success" | "neutral";
};

type CompanySubscriptionSummary = {
  status: string;
  planName: string;
  maxUserSeats: number | null;
  planTierKey: string | null;
  annualPlatformPriceCents: number | null;
  includedJobsiteLimit: number | null;
  includedUserLimit: number | null;
  onboardingFeeCents: number | null;
  enabledFeatureKeys: PlatformFeatureKey[] | null;
  selectedAddons: PlatformAddonSelection[];
  commercialNotes: string;
  subscriptionPriceCents: number | null;
  seatPriceCents: number | null;
  seatsUsed: number;
  membershipSeats: number;
  pendingInviteCount: number;
  activeJobsiteCount: number;
};

type CompanyHealthSummary = {
  score: number;
  band: string;
  adoption: {
    items: Array<{
      id: "company_profile" | "team_invites" | "first_jobsite" | "first_document" | "command_center";
      label: string;
      note: string;
      href: string;
      complete: boolean;
    }>;
    completedCount: number;
    totalCount: number;
    nextItem: {
      id: "company_profile" | "team_invites" | "first_jobsite" | "first_document" | "command_center";
      label: string;
      note: string;
      href: string;
      complete: boolean;
    } | null;
  };
  activationPercent: number;
  operationsPercent: number;
  billingPercent: number;
  retentionPercent: number;
  signals: Array<{
    id: string;
    label: string;
    value: string;
    detail: string;
    tone: "success" | "warning" | "error" | "info" | "neutral";
    href?: string;
  }>;
  nextActions: Array<{
    id: string;
    label: string;
    detail: string;
    href: string;
    priority: "high" | "medium" | "low";
  }>;
  counts: {
    openWork: number;
    overdueWork: number;
    activeJobsites: number;
    documentsStarted: number;
  };
};

function formatCents(cents: number | null) {
  if (cents == null) {
    return "Default";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function centsToDollarsInput(cents: number | null) {
  return cents == null ? "" : String(Math.round(cents / 100));
}

function moneyToCentsInput(value: string) {
  const numeric = Number(value.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.round(numeric * 100);
}

function formatRelative(timestamp?: string | null) {
  if (!timestamp) return "Recently";
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  const diffMonths = Math.max(1, Math.round(diffDays / 30));
  return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
}

function statusTone(status: string): "success" | "warning" | "error" | "neutral" {
  const normalized = status.trim().toLowerCase();
  if (normalized === "active" || normalized === "approved") return "success";
  if (normalized === "archived" || normalized === "pending") return "warning";
  if (normalized === "suspended") return "error";
  return "neutral";
}

function readinessLabel(value?: string | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "Ready";
  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const IMPORT_TABS: Array<{ id: CompanyOnboardingImportType; label: string }> = [
  { id: "employees", label: "Non-users" },
  { id: "jobsites", label: "Jobsites" },
  { id: "training_records", label: "Training records" },
];

const emptyImportPreview: Record<CompanyOnboardingImportType, Array<Record<string, unknown>>> = {
  employees: [],
  jobsites: [],
  training_records: [],
};

function validationForImportTab(
  tab: CompanyOnboardingImportType,
  rows: Array<Record<string, unknown>>
) {
  if (tab === "employees") return validateEmployeeImportRows(rows);
  if (tab === "jobsites") return validateJobsiteImportRows(rows);
  return validateTrainingRecordImportRows(rows);
}

function rowsPreview(rows: Array<Record<string, unknown>>) {
  return rows.slice(0, 8);
}

export default function AdminCompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState("");
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [summary, setSummary] = useState<CompanySummary | null>(null);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [invites, setInvites] = useState<CompanyInvite[]>([]);
  const [trackedEmployees, setTrackedEmployees] = useState<TrackedEmployee[]>([]);
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [activity, setActivity] = useState<CompanyActivityItem[]>([]);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "error" | "neutral">(
    "neutral"
  );
  const [loading, setLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState(false);
  const [canPermanentlyDeleteCompanies, setCanPermanentlyDeleteCompanies] = useState(false);
  const [canManageCompanySubscription, setCanManageCompanySubscription] = useState(false);
  const [canOverrideCompanyPricing, setCanOverrideCompanyPricing] = useState(false);
  const [canManageCompanyPermissions, setCanManageCompanyPermissions] = useState(false);
  const [subscription, setSubscription] = useState<CompanySubscriptionSummary | null>(null);
  const [companyHealth, setCompanyHealth] = useState<CompanyHealthSummary | null>(null);
  const [subStatusDraft, setSubStatusDraft] = useState("inactive");
  const [subPlanDraft, setSubPlanDraft] = useState("Pro");
  const [subMaxSeatsDraft, setSubMaxSeatsDraft] = useState("");
  const [subTierDraft, setSubTierDraft] = useState<string>(ENTERPRISE_TIERS[1].key);
  const [annualPlatformPriceDraft, setAnnualPlatformPriceDraft] = useState("");
  const [includedJobsiteLimitDraft, setIncludedJobsiteLimitDraft] = useState("");
  const [includedUserLimitDraft, setIncludedUserLimitDraft] = useState("");
  const [onboardingFeeDraft, setOnboardingFeeDraft] = useState("");
  const [enabledFeatureDraft, setEnabledFeatureDraft] = useState<PlatformFeatureKey[]>([]);
  const [addonPriceDraft, setAddonPriceDraft] = useState<Record<PlatformAddonKey, string>>(
    {} as Record<PlatformAddonKey, string>
  );
  const [commercialNotesDraft, setCommercialNotesDraft] = useState("");
  const [subSubscriptionPriceDraft, setSubSubscriptionPriceDraft] = useState("");
  const [subSeatPriceDraft, setSubSeatPriceDraft] = useState("");
  const [companyPermissionDraft, setCompanyPermissionDraft] = useState<PermissionOverrides>({
    allow: [],
    deny: [],
  });
  const [savingSubscription, setSavingSubscription] = useState(false);
  const [savingCompanyPermissions, setSavingCompanyPermissions] = useState(false);
  const [creatingBillingDraft, setCreatingBillingDraft] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deletingCompany, setDeletingCompany] = useState(false);
  const [importTab, setImportTab] = useState<CompanyOnboardingImportType>("employees");
  const [importPreview, setImportPreview] =
    useState<Record<CompanyOnboardingImportType, Array<Record<string, unknown>>>>(
      emptyImportPreview
    );
  const [importMessage, setImportMessage] = useState("");
  const [importMessageTone, setImportMessageTone] =
    useState<"success" | "warning" | "error" | "neutral">("neutral");
  const [importRowErrors, setImportRowErrors] = useState<ImportRowError[]>([]);
  const [importSaving, setImportSaving] = useState(false);
  const [editingTrackedEmployee, setEditingTrackedEmployee] = useState<TrackedEmployee | null>(null);
  const [trackedEmployeeForm, setTrackedEmployeeForm] = useState<TrackedEmployeeForm>(
    emptyTrackedEmployeeForm
  );
  const [trackedEmployeeSaving, setTrackedEmployeeSaving] = useState(false);

  const activeImportRows = importPreview[importTab];
  const activeImportValidation = useMemo(
    () => validationForImportTab(importTab, activeImportRows),
    [activeImportRows, importTab]
  );

  useEffect(() => {
    void params.then((resolved) => setCompanyId(resolved.id));
  }, [params]);

  const loadCompany = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.access_token) {
        setMessageTone("error");
        setMessage("You must be logged in as an internal admin.");
        setLoading(false);
        return;
      }

      const headers = {
        Authorization: `Bearer ${session.access_token}`,
      };
      const [res, healthRes] = await Promise.all([
        fetch(`/api/admin/companies/${companyId}`, { headers }),
        fetch(`/api/admin/companies/${companyId}/health`, { headers }),
      ]);

      const data = (await res.json().catch(() => null)) as
        | {
            error?: string;
            capabilities?: {
              canPermanentlyDeleteCompanies?: boolean;
              canManageCompanySubscription?: boolean;
              canOverrideCompanyPricing?: boolean;
              canManageCompanyPermissions?: boolean;
            };
            subscription?: CompanySubscriptionSummary;
            company?: CompanyDetail;
            summary?: CompanySummary;
            users?: CompanyUser[];
            invites?: CompanyInvite[];
            trackedEmployees?: TrackedEmployee[];
            documents?: CompanyDocument[];
            activity?: CompanyActivityItem[];
          }
        | null;
      const healthData = (await healthRes.json().catch(() => null)) as
        | {
            health?: CompanyHealthSummary;
            error?: string;
          }
        | null;

      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to load company workspace.");
        setCompany(null);
        setSummary(null);
        setUsers([]);
        setInvites([]);
        setTrackedEmployees([]);
        setDocuments([]);
        setActivity([]);
        setCanPermanentlyDeleteCompanies(false);
        setCanManageCompanySubscription(false);
        setCanOverrideCompanyPricing(false);
        setCanManageCompanyPermissions(false);
        setSubscription(null);
        setCompanyHealth(null);
        setCompanyPermissionDraft({ allow: [], deny: [] });
        setLoading(false);
        return;
      }

      setCanPermanentlyDeleteCompanies(
        Boolean(data?.capabilities?.canPermanentlyDeleteCompanies)
      );
      setCanManageCompanySubscription(
        Boolean(data?.capabilities?.canManageCompanySubscription)
      );
      setCanOverrideCompanyPricing(Boolean(data?.capabilities?.canOverrideCompanyPricing));
      setCanManageCompanyPermissions(
        Boolean(data?.capabilities?.canManageCompanyPermissions)
      );
      const sub = data?.subscription;
      if (sub) {
        setSubscription(sub);
        setSubStatusDraft(sub.status);
        setSubPlanDraft(sub.planName);
        setSubMaxSeatsDraft(sub.maxUserSeats != null ? String(sub.maxUserSeats) : "");
        setSubTierDraft(sub.planTierKey ?? ENTERPRISE_TIERS[1].key);
        setAnnualPlatformPriceDraft(centsToDollarsInput(sub.annualPlatformPriceCents));
        setIncludedJobsiteLimitDraft(
          sub.includedJobsiteLimit != null ? String(sub.includedJobsiteLimit) : ""
        );
        setIncludedUserLimitDraft(sub.includedUserLimit != null ? String(sub.includedUserLimit) : "");
        setOnboardingFeeDraft(centsToDollarsInput(sub.onboardingFeeCents));
        setEnabledFeatureDraft(sub.enabledFeatureKeys ?? []);
        setAddonPriceDraft(
          sub.selectedAddons.reduce((acc, addon) => {
            if (addon.unitPriceCents != null) {
              acc[addon.key] = centsToDollarsInput(addon.unitPriceCents);
            }
            return acc;
          }, {} as Record<PlatformAddonKey, string>)
        );
        setCommercialNotesDraft(sub.commercialNotes ?? "");
        setSubSubscriptionPriceDraft(
          sub.subscriptionPriceCents != null ? String(sub.subscriptionPriceCents) : ""
        );
        setSubSeatPriceDraft(sub.seatPriceCents != null ? String(sub.seatPriceCents) : "");
      } else {
        setSubscription(null);
      }
      setCompany(data?.company ?? null);
      setCompanyPermissionDraft(
        normalizePermissionOverrides(data?.company?.permissionOverrides ?? null)
      );
      setSummary(data?.summary ?? null);
      setUsers(data?.users ?? []);
      setInvites(data?.invites ?? []);
      setTrackedEmployees(data?.trackedEmployees ?? []);
      setDocuments(data?.documents ?? []);
      setActivity(data?.activity ?? []);
      setCompanyHealth(healthRes.ok ? healthData?.health ?? null : null);
      if (!healthRes.ok && healthData?.error) {
        setMessageTone("warning");
        setMessage(healthData.error);
      }
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to load company workspace.");
      setCompany(null);
      setSummary(null);
      setUsers([]);
      setInvites([]);
      setTrackedEmployees([]);
      setDocuments([]);
      setActivity([]);
      setCompanyHealth(null);
      setCanOverrideCompanyPricing(false);
      setCanManageCompanyPermissions(false);
      setCompanyPermissionDraft({ allow: [], deny: [] });
    }

    setLoading(false);
  }, [companyId]);

  const handleCompanyAction = useCallback(
    async (action: "archive" | "restore") => {
      if (!company) return;

      setProcessingAction(true);
      setMessage("");

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error || !session?.access_token) {
          setMessageTone("error");
          setMessage("You must be logged in as an internal admin.");
          setProcessingAction(false);
          return;
        }

        const res = await fetch("/api/admin/companies", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            companyId: company.id,
            action,
          }),
        });

        const data = (await res.json().catch(() => null)) as
          | {
              error?: string;
              message?: string;
            }
          | null;

        if (!res.ok) {
          setMessageTone("error");
          setMessage(data?.error || "Failed to update company workspace.");
          setProcessingAction(false);
          return;
        }

        setMessageTone("success");
        setMessage(
          data?.message ||
            (action === "archive"
              ? "Company archived successfully."
              : "Company restored successfully.")
        );
        await loadCompany();
      } catch (error) {
        setMessageTone("error");
        setMessage(
          error instanceof Error ? error.message : "Failed to update company workspace."
        );
      }

      setProcessingAction(false);
    },
    [company, loadCompany]
  );

  const handleSaveSubscription = useCallback(async () => {
    if (!companyId) return;

    setSavingSubscription(true);
    setMessage("");

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.access_token) {
        setMessageTone("error");
        setMessage("You must be logged in as an internal admin.");
        setSavingSubscription(false);
        return;
      }

      const maxParsed = subMaxSeatsDraft.trim();
      const maxUserSeats =
        maxParsed === "" ? null : parseInt(maxParsed, 10);
      if (
        maxUserSeats !== null &&
        (!Number.isFinite(maxUserSeats) || maxUserSeats < 1)
      ) {
        setMessageTone("error");
        setMessage("Max users must be blank (unlimited) or a whole number ≥ 1.");
        setSavingSubscription(false);
        return;
      }

      const subscriptionPriceParsed = subSubscriptionPriceDraft.trim();
      const subscriptionPriceCents =
        subscriptionPriceParsed === "" ? null : parseInt(subscriptionPriceParsed, 10);
      const seatPriceParsed = subSeatPriceDraft.trim();
      const seatPriceCents = seatPriceParsed === "" ? null : parseInt(seatPriceParsed, 10);
      const annualPlatformPriceCents = annualPlatformPriceDraft.trim()
        ? moneyToCentsInput(annualPlatformPriceDraft)
        : null;
      const onboardingFeeCents = onboardingFeeDraft.trim()
        ? moneyToCentsInput(onboardingFeeDraft)
        : null;
      const includedJobsiteLimit = includedJobsiteLimitDraft.trim()
        ? parseInt(includedJobsiteLimitDraft, 10)
        : null;
      const includedUserLimit = includedUserLimitDraft.trim()
        ? parseInt(includedUserLimitDraft, 10)
        : null;
      const selectedAddons = Object.entries(addonPriceDraft)
        .map(([key, price]) => {
          const addon = PLATFORM_ADDONS.find((item) => item.key === key);
          const unitPriceCents = price.trim() ? moneyToCentsInput(price) : null;
          return addon && unitPriceCents != null
            ? { key: addon.key, label: addon.label, quantity: 1, unitPriceCents }
            : null;
        })
        .filter(Boolean);
      if (
        [subscriptionPriceCents, seatPriceCents].some(
          (value) => value !== null && (!Number.isFinite(value) || value < 0)
        )
      ) {
        setMessageTone("error");
        setMessage("Pricing overrides must be blank or a whole number of cents ≥ 0.");
        setSavingSubscription(false);
        return;
      }
      if (
        [annualPlatformPriceCents, onboardingFeeCents, includedJobsiteLimit, includedUserLimit].some(
          (value) => value !== null && (!Number.isFinite(value) || value < 0)
        )
      ) {
        setMessageTone("error");
        setMessage("Commercial price and included limit fields must be blank or non-negative numbers.");
        setSavingSubscription(false);
        return;
      }

      const res = await fetch(`/api/admin/companies/${companyId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          subscriptionStatus: subStatusDraft,
          planName: subPlanDraft.trim() || "Pro",
          planTierKey: subTierDraft,
          annualPlatformPriceCents,
          includedJobsiteLimit,
          includedUserLimit,
          onboardingFeeCents,
          enabledFeatureKeys: enabledFeatureDraft,
          selectedAddons,
          commercialNotes: commercialNotesDraft,
          maxUserSeats,
          ...(canOverrideCompanyPricing
            ? {
                subscriptionPriceCents,
                seatPriceCents,
              }
            : {}),
        }),
      });

      const data = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to save subscription settings.");
        setSavingSubscription(false);
        return;
      }

      setMessageTone("success");
      setMessage("Subscription settings saved.");
      await loadCompany();
    } catch (err) {
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Failed to save subscription settings.");
    }

    setSavingSubscription(false);
  }, [
    companyId,
    addonPriceDraft,
    annualPlatformPriceDraft,
    canOverrideCompanyPricing,
    commercialNotesDraft,
    enabledFeatureDraft,
    includedJobsiteLimitDraft,
    includedUserLimitDraft,
    loadCompany,
    onboardingFeeDraft,
    subMaxSeatsDraft,
    subPlanDraft,
    subSeatPriceDraft,
    subSubscriptionPriceDraft,
    subStatusDraft,
    subTierDraft,
  ]);

  const handleSaveCompanyPermissions = useCallback(async () => {
    if (!companyId) return;

    setSavingCompanyPermissions(true);
    setMessage("");

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.access_token) {
        setMessageTone("error");
        setMessage("You must be logged in as an internal admin.");
        setSavingCompanyPermissions(false);
        return;
      }

      const res = await fetch(`/api/admin/companies/${companyId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          permissionOverrides: companyPermissionDraft,
        }),
      });

      const data = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to save company access rules.");
        setSavingCompanyPermissions(false);
        return;
      }

      setMessageTone("success");
      setMessage("Company access rules saved.");
      await loadCompany();
    } catch (err) {
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Failed to save company access rules.");
    }

    setSavingCompanyPermissions(false);
  }, [companyId, companyPermissionDraft, loadCompany]);

  const handleCreateBillingDraft = useCallback(async () => {
    if (!companyId) return;

    setCreatingBillingDraft(true);
    setMessage("");

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.access_token) {
        setMessageTone("error");
        setMessage("You must be logged in as an internal admin.");
        setCreatingBillingDraft(false);
        return;
      }

      const res = await fetch("/api/billing/company-invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          company_id: companyId,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | {
            error?: string;
            invoice?: { id?: string };
          }
        | null;

      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to create billing draft.");
        setCreatingBillingDraft(false);
        return;
      }

      setMessageTone("success");
      setMessage("Billing draft created.");

      if (data?.invoice?.id) {
        router.push(`/billing/invoices/${data.invoice.id}`);
      }
    } catch (err) {
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Failed to create billing draft.");
    }

    setCreatingBillingDraft(false);
  }, [companyId, router]);

  const handlePermanentDelete = useCallback(async () => {
    if (!company) return;

    setDeletingCompany(true);
    setMessage("");

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.access_token) {
        setMessageTone("error");
        setMessage("You must be logged in as an internal admin.");
        setDeletingCompany(false);
        return;
      }

      const res = await fetch(`/api/admin/companies/${company.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ confirmName: deleteConfirmName.trim() }),
      });

      const data = (await res.json().catch(() => null)) as
        | {
            error?: string;
            message?: string;
          }
        | null;

      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to delete company workspace.");
        setDeletingCompany(false);
        return;
      }

      setMessageTone("success");
      setMessage(data?.message || "Company removed.");
      setDeleteConfirmOpen(false);
      setDeleteConfirmName("");
      router.push("/admin/companies");
    } catch (err) {
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Failed to delete company workspace.");
    }

    setDeletingCompany(false);
  }, [company, deleteConfirmName, router]);

  const handleCompanyImportFile = useCallback(
    async (file: File | null) => {
      if (!file) return;

      setImportRowErrors([]);
      setImportMessage("");
      setImportMessageTone("neutral");

      try {
        const buffer = await file.arrayBuffer();
        const raw = await readExcelObjects(buffer);
        if (!raw.length) {
          throw new Error("The uploaded file does not contain any rows.");
        }
        const rows = normalizeRowsArray(raw);
        setImportPreview((current) => ({ ...current, [importTab]: rows }));
        setImportMessage(`${rows.length} row${rows.length === 1 ? "" : "s"} ready for preview.`);
        setImportMessageTone(rows.length > 0 ? "success" : "warning");
      } catch (error) {
        setImportMessage(error instanceof Error ? error.message : "Failed to parse upload.");
        setImportMessageTone("error");
      }
    },
    [importTab]
  );

  const handleSubmitCompanyImport = useCallback(async () => {
    if (!companyId) return;

    if (activeImportRows.length === 0) {
      setImportMessage("Upload a template file before importing.");
      setImportMessageTone("warning");
      return;
    }

    if (activeImportValidation.validRows.length === 0) {
      setImportMessage("No valid rows are ready to import.");
      setImportMessageTone("error");
      setImportRowErrors(activeImportValidation.rowErrors);
      return;
    }

    setImportSaving(true);
    setImportRowErrors([]);
    setImportMessage("");
    setImportMessageTone("neutral");

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.access_token) {
        setImportMessageTone("error");
        setImportMessage("You must be logged in as a Super Admin.");
        setImportSaving(false);
        return;
      }

      const payload =
        importTab === "employees"
          ? { employees: activeImportRows }
          : importTab === "jobsites"
            ? { jobsites: activeImportRows }
            : { trainingRecords: activeImportRows };

      const response = await fetch(`/api/admin/companies/${companyId}/onboarding/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...payload,
          source: "superadmin_company_profile_upload",
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            acceptedCount?: number;
            skippedCount?: number;
            rowErrors?: ImportRowError[];
          }
        | null;

      if (!response.ok) {
        setImportMessageTone("error");
        setImportMessage(data?.error || "Import failed.");
        setImportRowErrors(data?.rowErrors ?? activeImportValidation.rowErrors);
        setImportSaving(false);
        return;
      }

      const acceptedCount = data?.acceptedCount ?? 0;
      const skippedCount = data?.skippedCount ?? 0;
      setImportPreview((current) => ({ ...current, [importTab]: [] }));
      setImportRowErrors(data?.rowErrors ?? []);
      setImportMessageTone(skippedCount > 0 || (data?.rowErrors?.length ?? 0) > 0 ? "warning" : "success");
      setImportMessage(
        `Saved ${acceptedCount} row${acceptedCount === 1 ? "" : "s"}${
          skippedCount > 0 ? `; ${skippedCount} duplicate or invalid row${skippedCount === 1 ? "" : "s"} skipped` : ""
        }.`
      );
      await loadCompany();
    } catch (error) {
      setImportMessageTone("error");
      setImportMessage(error instanceof Error ? error.message : "Import failed.");
    }

    setImportSaving(false);
  }, [
    activeImportRows,
    activeImportValidation,
    companyId,
    importTab,
    loadCompany,
  ]);

  const openTrackedEmployeeEditor = useCallback((employee: TrackedEmployee) => {
    setEditingTrackedEmployee(employee);
    setTrackedEmployeeForm({
      employee_id: employee.external_employee_id ?? "",
      full_name: employee.full_name ?? "",
      email: employee.email ?? "",
      phone: employee.phone ?? "",
      job_title: employee.job_title ?? "",
      trade_specialty: employee.trade_specialty ?? "",
      readiness_status: employee.readiness_status ?? "ready",
      years_experience:
        employee.years_experience == null ? "" : String(employee.years_experience),
      status: employee.status ?? "active",
      certifications: (employee.certifications ?? []).join("; "),
    });
    setMessage("");
    setMessageTone("neutral");
  }, []);

  const resetTrackedEmployeeEditor = useCallback(() => {
    setEditingTrackedEmployee(null);
    setTrackedEmployeeForm(emptyTrackedEmployeeForm);
  }, []);

  const handleSaveTrackedEmployee = useCallback(async () => {
    if (!companyId || !editingTrackedEmployee) return;
    if (!trackedEmployeeForm.full_name.trim()) {
      setMessageTone("warning");
      setMessage("Full name is required before saving a training-only employee.");
      return;
    }

    setTrackedEmployeeSaving(true);
    setMessage("");

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.access_token) {
        setMessageTone("error");
        setMessage("You must be logged in as a Super Admin.");
        setTrackedEmployeeSaving(false);
        return;
      }

      const response = await fetch(
        `/api/admin/companies/${companyId}/tracked-employees/${editingTrackedEmployee.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(trackedEmployeeForm),
        }
      );
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to update training-only employee.");
        setTrackedEmployeeSaving(false);
        return;
      }

      resetTrackedEmployeeEditor();
      setMessageTone("success");
      setMessage("Training-only employee updated.");
      await loadCompany();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to update training-only employee.");
    }

    setTrackedEmployeeSaving(false);
  }, [companyId, editingTrackedEmployee, loadCompany, resetTrackedEmployeeEditor, trackedEmployeeForm]);

  useEffect(() => {
    if (!companyId) return;
    queueMicrotask(() => {
      void loadCompany();
    });
  }, [companyId, loadCompany]);

  const statCards = useMemo(
    () =>
      summary
        ? [
            {
              title: "Users",
              value: String(summary.totalUsers),
              note: `${summary.activeUsers} active, ${summary.suspendedUsers} suspended`,
            },
            {
              title: "Invites",
              value: String(summary.pendingInvites),
              note: `${summary.pendingUsers} pending people`,
            },
            {
              title: "Training-Only",
              value: String(summary.trackedEmployees),
              note: "No-login employees in the Training Matrix",
            },
            {
              title: "Completed Docs",
              value: String(summary.completedDocuments),
              note: `${summary.submittedDocuments} still in review`,
            },
          ]
        : [],
    [summary]
  );

  const canGenerateBillingDraft =
    Boolean(subscription) &&
    (subscription?.annualPlatformPriceCents != null ||
      subscription?.onboardingFeeCents != null ||
      (subscription?.selectedAddons ?? []).some((addon) => addon.unitPriceCents != null) ||
      subscription?.subscriptionPriceCents != null ||
      subscription?.seatPriceCents != null);

  const pricingSummary = useMemo(() => {
    if (!subscription) {
      return null;
    }

    return {
      status: subscription.status,
      planName: subscription.planName,
      tier: subscription.planTierKey ? getEnterpriseTier(subscription.planTierKey).label : "No tier set",
      annualPlatformPrice: formatCents(subscription.annualPlatformPriceCents),
      onboardingFee: formatCents(subscription.onboardingFeeCents),
      subscriptionPrice: formatCents(subscription.subscriptionPriceCents),
      seatPrice: formatCents(subscription.seatPriceCents),
      maxUsers:
        subscription.includedUserLimit != null
          ? String(subscription.includedUserLimit)
          : subscription.maxUserSeats != null
            ? String(subscription.maxUserSeats)
            : "Unlimited",
      maxJobsites:
        subscription.includedJobsiteLimit != null ? String(subscription.includedJobsiteLimit) : "Unlimited",
    };
  }, [subscription]);

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Company Oversight"
        title={company?.name || "Company Workspace"}
        description="Review one customer workspace end to end, including people, invites, documents, and status."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/companies"
              className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Back to Companies
            </Link>
            {company ? (
              <button
                type="button"
                onClick={() =>
                  void handleCompanyAction(
                    company.status.trim().toLowerCase() === "archived"
                      ? "restore"
                      : "archive"
                  )
                }
                disabled={processingAction}
                className={
                  company.status.trim().toLowerCase() === "archived"
                    ? "rounded-xl border border-emerald-300 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-950/35 disabled:cursor-not-allowed disabled:opacity-60"
                    : "rounded-xl border border-amber-300 px-5 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-950/40 disabled:cursor-not-allowed disabled:opacity-60"
                }
              >
                {processingAction
                  ? company.status.trim().toLowerCase() === "archived"
                    ? "Restoring..."
                    : "Archiving..."
                  : company.status.trim().toLowerCase() === "archived"
                    ? "Restore Workspace"
                    : "Archive Workspace"}
              </button>
            ) : null}
            {company && canPermanentlyDeleteCompanies ? (
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(true);
                  setDeleteConfirmName("");
                }}
                disabled={processingAction || deletingCompany}
                className="rounded-xl border border-red-300 px-5 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Delete from database
              </button>
            ) : null}
          </div>
        }
      />

      {deleteConfirmOpen && company ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            className="max-w-lg rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-company-title"
          >
            <h2
              id="delete-company-title"
              className="text-lg font-bold text-slate-100"
            >
              Permanently delete this workspace?
            </h2>
            <p className="mt-3 text-sm text-slate-400">
              This removes the company row and related workspace data (memberships, invites, jobsites,
              safety data, documents, and billing rows). Former members are reset to Viewer in{" "}
              <code className="rounded bg-slate-800/70 px-1 py-0.5 text-xs">user_roles</code> when their
              profile was tied to this company. This cannot be undone.
            </p>
            <p className="mt-3 text-sm font-medium text-slate-200">
              Type the workspace name to confirm:{" "}
              <span className="font-bold text-slate-100">{company.name}</span>
            </p>
            <input
              type="text"
              aria-label="Type workspace name to confirm deletion"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-100 outline-none ring-slate-400 focus:ring-2"
              placeholder="Workspace name"
              autoComplete="off"
            />
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteConfirmName("");
                }}
                disabled={deletingCompany}
                className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handlePermanentDelete()}
                disabled={
                  deletingCompany ||
                  deleteConfirmName.trim() !== company.name.trim()
                }
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingCompany ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pricingSummary ? (
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Subscription
            </div>
            <div className="mt-2 text-lg font-bold text-slate-100">{pricingSummary.status}</div>
            <div className="mt-1 text-sm text-slate-500">{pricingSummary.planName}</div>
            <div className="mt-1 text-sm text-slate-500">{pricingSummary.tier}</div>
          </div>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Pricing
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-100">
              Annual platform {pricingSummary.annualPlatformPrice}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Onboarding {pricingSummary.onboardingFee} · Seat license {pricingSummary.seatPrice}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Capacity
            </div>
            <div className="mt-2 text-lg font-bold text-slate-100">{pricingSummary.maxUsers} users</div>
            <div className="mt-1 text-sm text-slate-500">{pricingSummary.maxJobsites} jobsites</div>
          </div>
        </section>
      ) : null}

      {companyHealth ? (
        <SectionCard
          title="Pilot Success & Renewal Signals"
          description="Revenue-readiness score based on launch progress, workspace activation, open work, billing, and renewal indicators."
          tone={companyHealth.score >= 65 ? "elevated" : "attention"}
          aside={<StatusBadge label={companyHealth.band} tone={companyHealth.score >= 65 ? "success" : "warning"} />}
        >
          <div className="grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
            <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/80 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">
                Customer health
              </div>
              <div className="mt-3 text-5xl font-bold text-[var(--app-text-strong)]">
                {companyHealth.score}
              </div>
              <div className="mt-2 text-sm text-[var(--app-text)]">
                Open work: {companyHealth.counts.openWork} · Overdue:{" "}
                {companyHealth.counts.overdueWork} · Active jobsites:{" "}
                {companyHealth.counts.activeJobsites}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Activation", companyHealth.activationPercent],
                  ["Operations", companyHealth.operationsPercent],
                  ["Billing", companyHealth.billingPercent],
                  ["Retention", companyHealth.retentionPercent],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-3"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                      {label}
                    </div>
                    <div className="mt-1 text-lg font-bold text-[var(--app-text-strong)]">
                      {value}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {companyHealth.signals.map((signal) => (
                <div
                  key={signal.id}
                  className="rounded-2xl border border-[var(--app-border-strong)] bg-white/80 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">
                        {signal.label}
                      </div>
                      <div className="mt-2 text-2xl font-bold text-[var(--app-text-strong)]">
                        {signal.value}
                      </div>
                    </div>
                    <StatusBadge label={signal.tone} tone={signal.tone} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--app-text)]">{signal.detail}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/90 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--app-text-strong)]">
                  Onboarding Checklist
                </div>
                <p className="mt-1 text-sm text-[var(--app-text)]">
                  {companyHealth.adoption.completedCount}/{companyHealth.adoption.totalCount} launch steps complete.
                </p>
              </div>
              <StatusBadge
                label={
                  companyHealth.adoption.completedCount === companyHealth.adoption.totalCount
                    ? "complete"
                    : "needs setup"
                }
                tone={
                  companyHealth.adoption.completedCount === companyHealth.adoption.totalCount
                    ? "success"
                    : "error"
                }
              />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {companyHealth.adoption.items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`rounded-xl border px-4 py-3 transition hover:bg-white ${
                    item.complete
                      ? "border-emerald-200 bg-emerald-50/75 hover:border-emerald-300"
                      : "border-red-200 bg-red-50/75 hover:border-red-300"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full ${
                        item.complete
                          ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                          : "bg-red-100 text-red-700 ring-1 ring-red-200"
                      }`}
                    >
                      {item.complete ? (
                        <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
                      ) : (
                        <XCircle aria-hidden="true" className="h-5 w-5" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[var(--app-text-strong)]">
                        {item.label}
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-[var(--app-text)]">
                        {item.note}
                      </span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
          {companyHealth.nextActions.length > 0 ? (
            <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] p-4">
              <div className="text-sm font-semibold text-[var(--app-text-strong)]">
                Next best actions
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {companyHealth.nextActions.map((action) => (
                  <Link
                    key={action.id}
                    href={action.href}
                    className="rounded-xl border border-[var(--app-border)] bg-white/85 px-4 py-3 transition hover:border-[rgba(37,99,235,0.28)] hover:bg-white"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-[var(--app-text-strong)]">
                        {action.label}
                      </span>
                      <StatusBadge
                        label={action.priority}
                        tone={action.priority === "high" ? "warning" : "info"}
                      />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{action.detail}</p>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Workspace Profile"
          description="Primary contact, company identity, and current workspace status."
        >
          {loading ? (
            <InlineMessage>Loading company profile...</InlineMessage>
          ) : !company ? (
            <EmptyState
              title="Company not found"
              description="This workspace may have been removed or you may not have access."
            />
          ) : (
            <div className="grid gap-4 text-sm text-slate-400 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Workspace
                </div>
                <div className="mt-2 text-lg font-bold text-slate-100">{company.name}</div>
                <div className="mt-1">Key: {company.teamKey}</div>
                <div className="mt-3">
                  <StatusBadge label={company.status} tone={statusTone(company.status)} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {company.hasAccessOverrides ? (
                    <StatusBadge label="Access overrides active" tone="info" />
                  ) : null}
                  {company.hasPricingOverrides ? (
                    <StatusBadge label="Pricing overrides active" tone="warning" />
                  ) : null}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Primary Contact
                </div>
                <div className="mt-2 text-base font-semibold text-slate-100">
                  {company.primaryContactName || "Not provided"}
                </div>
                <div className="mt-1">{company.primaryContactEmail || "Not provided"}</div>
                <div className="mt-1">{company.phone || "No phone on file"}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Company Details
                </div>
                <div className="mt-2">Industry: {company.industry || "Not provided"}</div>
                <div className="mt-1">Website: {company.website || "Not provided"}</div>
                <div className="mt-1">Created {formatRelative(company.createdAt)}</div>
                {company.archivedAt ? (
                  <div className="mt-1">
                    Archived {formatRelative(company.archivedAt)}
                    {company.archivedByEmail ? ` by ${company.archivedByEmail}` : ""}
                  </div>
                ) : null}
                {company.restoredAt ? (
                  <div className="mt-1">
                    Restored {formatRelative(company.restoredAt)}
                    {company.restoredByEmail ? ` by ${company.restoredByEmail}` : ""}
                  </div>
                ) : null}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Address
                </div>
                <div className="mt-2">
                  {[
                    company.addressLine1,
                    company.city,
                    company.stateRegion,
                    company.postalCode,
                    company.country,
                  ]
                    .filter(Boolean)
                    .join(", ") || "Not provided"}
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          {statCards.map((card) => (
            <div key={card.title} className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-500">{card.title}</p>
              <p className="mt-3 text-4xl font-bold tracking-tight text-slate-100">
                {loading ? "-" : card.value}
              </p>
              <p className="mt-2 text-sm text-slate-500">{card.note}</p>
            </div>
          ))}
        </section>
      </section>

      {canManageCompanyPermissions ? (
        <SectionCard
          title="Superadmin Template Import"
          description="Download a starter file, upload completed rows, and save company jobsites or training-only people directly from this profile."
          aside={<StatusBadge label="No duplicate inserts" tone="info" />}
        >
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-700/80 bg-slate-950/50 p-2">
              {IMPORT_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setImportTab(tab.id);
                    setImportMessage("");
                    setImportRowErrors([]);
                  }}
                  className={
                    importTab === tab.id
                      ? "rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white"
                      : "rounded-xl px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800/80"
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-3 rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                <div className="flex flex-wrap gap-3">
                  <a
                    href={`/api/company/onboarding/import/template?type=${importTab}`}
                    className="rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-900"
                  >
                    Download Template
                  </a>
                  <label className="cursor-pointer rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700">
                    Upload Template
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="sr-only"
                      onChange={(event) => {
                        void handleCompanyImportFile(event.target.files?.[0] ?? null);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>

                {importMessage ? (
                  <InlineMessage tone={importMessageTone}>{importMessage}</InlineMessage>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Parsed
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-100">
                      {activeImportRows.length}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Valid
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-100">
                      {activeImportValidation.validRows.length}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Issues
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-100">
                      {activeImportValidation.rowErrors.length}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleSubmitCompanyImport()}
                  disabled={importSaving || activeImportValidation.validRows.length === 0}
                  className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {importSaving ? "Importing..." : "Import Valid Rows"}
                </button>
              </div>

              <div className="space-y-3">
                {activeImportRows.length > 0 ? (
                  <CompanyImportPreviewTable rows={rowsPreview(activeImportRows)} />
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-950/40 p-6 text-sm text-slate-500">
                    No upload preview yet.
                  </div>
                )}
                {activeImportValidation.rowErrors.length > 0 ? (
                  <CompanyImportRowErrors errors={activeImportValidation.rowErrors.slice(0, 8)} />
                ) : null}
                {importRowErrors.length > 0 ? (
                  <CompanyImportRowErrors errors={importRowErrors.slice(0, 10)} />
                ) : null}
              </div>
            </div>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Training-Only Employees"
        description="Non-user employees saved to this company profile. They do not have app login access or consume licensed seats."
        aside={
          <StatusBadge
            label={`${trackedEmployees.filter((employee) => employee.status !== "archived").length} active`}
            tone={trackedEmployees.length ? "info" : "neutral"}
          />
        }
      >
        {loading ? (
          <InlineMessage>Loading training-only employees...</InlineMessage>
        ) : trackedEmployees.length === 0 ? (
          <EmptyState
            title="No training-only employees"
            description="Imported non-user employees will appear here after a successful Superadmin Template Import."
          />
        ) : (
          <div className="space-y-5">
            {editingTrackedEmployee ? (
              <div className="rounded-2xl border border-sky-400/30 bg-sky-950/20 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">
                      Edit {editingTrackedEmployee.full_name}
                    </div>
                    <p className="mt-1 text-sm text-slate-400">
                      Update the no-login employee record used by the Training Matrix.
                    </p>
                  </div>
                  <StatusBadge label="No app login" tone="info" />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    type="text"
                    value={trackedEmployeeForm.full_name}
                    onChange={(event) =>
                      setTrackedEmployeeForm((current) => ({ ...current, full_name: event.target.value }))
                    }
                    placeholder="Full name"
                    className="app-dark-input"
                  />
                  <input
                    type="email"
                    value={trackedEmployeeForm.email}
                    onChange={(event) =>
                      setTrackedEmployeeForm((current) => ({ ...current, email: event.target.value }))
                    }
                    placeholder="Email"
                    className="app-dark-input"
                  />
                  <input
                    type="text"
                    value={trackedEmployeeForm.employee_id}
                    onChange={(event) =>
                      setTrackedEmployeeForm((current) => ({ ...current, employee_id: event.target.value }))
                    }
                    placeholder="Employee ID"
                    className="app-dark-input"
                  />
                  <input
                    type="text"
                    value={trackedEmployeeForm.job_title}
                    onChange={(event) =>
                      setTrackedEmployeeForm((current) => ({ ...current, job_title: event.target.value }))
                    }
                    placeholder="Job title"
                    className="app-dark-input"
                  />
                  <input
                    type="text"
                    value={trackedEmployeeForm.trade_specialty}
                    onChange={(event) =>
                      setTrackedEmployeeForm((current) => ({ ...current, trade_specialty: event.target.value }))
                    }
                    placeholder="Trade specialty"
                    className="app-dark-input"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={trackedEmployeeForm.years_experience}
                    onChange={(event) =>
                      setTrackedEmployeeForm((current) => ({ ...current, years_experience: event.target.value }))
                    }
                    placeholder="Years experience"
                    className="app-dark-input"
                  />
                  <select
                    value={trackedEmployeeForm.readiness_status}
                    onChange={(event) =>
                      setTrackedEmployeeForm((current) => ({ ...current, readiness_status: event.target.value }))
                    }
                    className="app-dark-input"
                    aria-label="Readiness status"
                  >
                    <option value="ready">Ready</option>
                    <option value="travel_ready">Travel ready</option>
                    <option value="limited">Limited</option>
                    <option value="needs_training">Needs training</option>
                    <option value="onboarding">Onboarding</option>
                  </select>
                  <select
                    value={trackedEmployeeForm.status}
                    onChange={(event) =>
                      setTrackedEmployeeForm((current) => ({ ...current, status: event.target.value }))
                    }
                    className="app-dark-input"
                    aria-label="Employee status"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                  <input
                    type="text"
                    value={trackedEmployeeForm.certifications}
                    onChange={(event) =>
                      setTrackedEmployeeForm((current) => ({ ...current, certifications: event.target.value }))
                    }
                    placeholder="Certifications"
                    className="app-dark-input"
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSaveTrackedEmployee()}
                    disabled={trackedEmployeeSaving || !trackedEmployeeForm.full_name.trim()}
                    className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {trackedEmployeeSaving ? "Saving..." : "Save training-only employee"}
                  </button>
                  <button
                    type="button"
                    onClick={resetTrackedEmployeeEditor}
                    className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-900"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
            <div className="overflow-x-auto rounded-2xl border border-slate-700/80">
              <div className="grid min-w-[1080px] grid-cols-[1.25fr_0.9fr_0.9fr_0.8fr_0.7fr_0.7fr_0.55fr] gap-3 border-b border-slate-700/80 bg-slate-950/50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                <div>Employee</div>
                <div>Role</div>
                <div>Trade</div>
                <div>Readiness</div>
                <div>Records</div>
                <div>Status</div>
                <div>Action</div>
              </div>
              {trackedEmployees.map((employee) => (
                <div
                  key={employee.id}
                  className="grid min-w-[1080px] grid-cols-[1.25fr_0.9fr_0.9fr_0.8fr_0.7fr_0.7fr_0.55fr] gap-3 border-t border-slate-700/60 px-5 py-4 text-sm text-slate-400 first:border-t-0"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-100">{employee.full_name}</div>
                    <div className="mt-1 truncate text-slate-500">
                      {employee.email || employee.external_employee_id || "No email or employee ID"}
                    </div>
                  </div>
                  <div>{employee.job_title || "Not set"}</div>
                  <div>{employee.trade_specialty || "Not set"}</div>
                  <div>
                    <StatusBadge
                      label={readinessLabel(employee.readiness_status)}
                      tone={employee.readiness_status === "needs_training" ? "warning" : "success"}
                    />
                  </div>
                  <div>{employee.training_record_count ?? 0}</div>
                  <div>
                    <StatusBadge label={employee.status || "active"} tone={statusTone(employee.status || "active")} />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => openTrackedEmployeeEditor(employee)}
                      className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-900"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Commercial Terms, Capacity & Invoice"
        description="Set internal pricing, included jobsites/users, selected add-ons, and create a draft invoice for review."
      >
        {loading ? (
          <InlineMessage>Loading subscription…</InlineMessage>
        ) : !subscription ? (
          <EmptyState
            title="Subscription not loaded"
            description="Try refreshing the page. If this persists, check the company_subscriptions row in the database."
          />
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Seat usage
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-100">
                  {subscription.seatsUsed}
                  {subscription.maxUserSeats != null
                    ? ` / ${subscription.maxUserSeats}`
                    : " / ∞"}
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {subscription.membershipSeats} licensed members (active or pending approval) +{" "}
                  {subscription.pendingInviteCount} pending invite
                  {subscription.pendingInviteCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Jobsite usage
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-100">
                  {subscription.activeJobsiteCount}
                  {subscription.includedJobsiteLimit != null
                    ? ` / ${subscription.includedJobsiteLimit}`
                    : " / unlimited"}
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Active jobsites counted against the contract.
                </p>
              </div>
            </div>

            {canManageCompanySubscription ? (
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block text-sm">
                  <span className="font-semibold text-slate-300">Subscription status</span>
                  <select
                    value={subStatusDraft}
                    onChange={(e) => setSubStatusDraft(e.target.value)}
                    className="app-dark-input mt-2"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="font-semibold text-slate-300">Plan name</span>
                  <input
                    type="text"
                    value={subPlanDraft}
                    onChange={(e) => setSubPlanDraft(e.target.value)}
                    placeholder="Pro, CSEP, …"
                    className="app-dark-input mt-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-semibold text-slate-300">Max licensed users (optional)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={subMaxSeatsDraft}
                    onChange={(e) => setSubMaxSeatsDraft(e.target.value)}
                    placeholder="Blank = unlimited"
                    className="app-dark-input mt-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-semibold text-slate-300">Enterprise tier</span>
                  <select
                    value={subTierDraft}
                    onChange={(e) => {
                      const tier = getEnterpriseTier(e.target.value);
                      setSubTierDraft(tier.key);
                      setAnnualPlatformPriceDraft(centsToDollarsInput(tier.annualPriceCents));
                      setIncludedJobsiteLimitDraft(String(tier.includedJobsites));
                      setIncludedUserLimitDraft(String(tier.includedUsers));
                    }}
                    className="app-dark-input mt-2"
                  >
                    {ENTERPRISE_TIERS.map((tier) => (
                      <option key={tier.key} value={tier.key}>
                        {tier.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="font-semibold text-slate-300">Annual platform price ($)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={annualPlatformPriceDraft}
                    onChange={(e) => setAnnualPlatformPriceDraft(e.target.value)}
                    className="app-dark-input mt-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-semibold text-slate-300">Included jobsites</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={includedJobsiteLimitDraft}
                    onChange={(e) => setIncludedJobsiteLimitDraft(e.target.value)}
                    className="app-dark-input mt-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-semibold text-slate-300">Included users</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={includedUserLimitDraft}
                    onChange={(e) => {
                      setIncludedUserLimitDraft(e.target.value);
                      setSubMaxSeatsDraft(e.target.value);
                    }}
                    className="app-dark-input mt-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-semibold text-slate-300">Onboarding fee ($)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={onboardingFeeDraft}
                    onChange={(e) => setOnboardingFeeDraft(e.target.value)}
                    className="app-dark-input mt-2"
                  />
                </label>
                <label className="block text-sm md:col-span-3">
                  <span className="font-semibold text-slate-300">Commercial notes</span>
                  <textarea
                    value={commercialNotesDraft}
                    onChange={(e) => setCommercialNotesDraft(e.target.value)}
                    rows={3}
                    className="app-dark-input mt-2"
                  />
                </label>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4 text-sm text-slate-400">
                Current status:{" "}
                <span className="font-semibold text-slate-100">{subscription.status}</span>
                {" · "}
                Plan:{" "}
                <span className="font-semibold text-slate-100">{subscription.planName}</span>
                {subscription.maxUserSeats != null ? (
                  <>
                    {" "}
                    · Max licensed users:{" "}
                    <span className="font-semibold text-slate-100">
                      {subscription.maxUserSeats}
                    </span>
                  </>
                ) : null}
                . Only Super Admin, Platform Admin, or App Admin can change these settings.
              </div>
            )}

            {canOverrideCompanyPricing ? (
              <div className="rounded-2xl border border-violet-400/30 bg-violet-950/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Superadmin pricing override</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Leave a field blank to use the default plan price.
                    </p>
                  </div>
                  <StatusBadge label="Super Admin only" tone="info" />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block text-sm">
                    <span className="font-semibold text-slate-300">Subscription price (cents)</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={subSubscriptionPriceDraft}
                      onChange={(e) => setSubSubscriptionPriceDraft(e.target.value)}
                      placeholder="Default pricing"
                      className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 outline-none focus:border-violet-400"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Default: {formatCents(subscription.subscriptionPriceCents)}
                    </p>
                  </label>
                  <label className="block text-sm">
                    <span className="font-semibold text-slate-300">Seat license price (cents)</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={subSeatPriceDraft}
                      onChange={(e) => setSubSeatPriceDraft(e.target.value)}
                      placeholder="Default pricing"
                      className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 outline-none focus:border-violet-400"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Default: {formatCents(subscription.seatPriceCents)}
                    </p>
                  </label>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4 text-sm text-slate-400">
                Pricing: subscription {formatCents(subscription.subscriptionPriceCents)} · seat license{" "}
                {formatCents(subscription.seatPriceCents)}.
                <span className="mt-1 block text-slate-500">
                  Pricing overrides are controlled by Super Admins.
                </span>
              </div>
            )}

            {canManageCompanySubscription ? (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleSaveSubscription()}
                  disabled={savingSubscription}
                  className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingSubscription ? "Saving…" : "Save subscription, licenses & pricing"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreateBillingDraft()}
                  disabled={creatingBillingDraft || loading || !canGenerateBillingDraft}
                  className="rounded-xl border border-violet-400/60 px-5 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-950/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingBillingDraft ? "Creating..." : "Create billing draft"}
                </button>
              </div>
            ) : null}
            {canManageCompanySubscription && !canGenerateBillingDraft ? (
              <p className="text-sm text-slate-500">
                Add a subscription or seat price override first to generate an automatic billing
                draft.
              </p>
            ) : null}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Feature Access"
        description="Choose the company-level modules this workspace can use. User roles still decide each person's actions inside enabled modules."
      >
        {loading ? (
          <InlineMessage>Loading feature access...</InlineMessage>
        ) : !subscription ? (
          <EmptyState
            title="Feature access unavailable"
            description="This workspace subscription could not be loaded."
          />
        ) : canManageCompanySubscription ? (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {PLATFORM_FEATURES.map((feature) => (
                <label
                  key={feature.key}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-3 text-sm text-slate-300"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={enabledFeatureDraft.includes(feature.key)}
                    onChange={(event) =>
                      setEnabledFeatureDraft((current) =>
                        event.target.checked
                          ? [...current, feature.key]
                          : current.filter((key) => key !== feature.key)
                      )
                    }
                  />
                  <span>
                    <span className="block font-semibold text-slate-100">{feature.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {feature.permissions.length
                        ? feature.permissions.join(", ")
                        : "Commercial entitlement only"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
              <div className="text-sm font-semibold text-slate-100">Invoice add-ons</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {PLATFORM_ADDONS.map((addon) => (
                  <label key={addon.key} className="block text-sm">
                    <span className="font-semibold text-slate-300">{addon.label}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Price ($)"
                      value={addonPriceDraft[addon.key] ?? ""}
                      onChange={(event) =>
                        setAddonPriceDraft((current) => ({
                          ...current,
                          [addon.key]: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-400"
                    />
                  </label>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleSaveSubscription()}
              disabled={savingSubscription}
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingSubscription ? "Saving..." : "Save commercial terms and features"}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4 text-sm text-slate-400">
            Feature access is controlled by Platform Admins.
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Company Access Rules"
        description="Set company-wide function defaults for this workspace. User-level overrides still live in the user admin page."
      >
        {loading ? (
          <InlineMessage>Loading company access rules...</InlineMessage>
        ) : !company ? (
          <EmptyState
            title="Company access rules unavailable"
            description="This workspace could not be loaded."
          />
        ) : canManageCompanyPermissions ? (
          <div className="space-y-5">
            <PermissionOverridesEditor
              title="Company function defaults"
              description="These defaults apply to users in this workspace unless a user-level override takes precedence."
              value={companyPermissionDraft}
              onChange={setCompanyPermissionDraft}
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSaveCompanyPermissions()}
                disabled={savingCompanyPermissions}
                className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingCompanyPermissions ? "Saving..." : "Save company access rules"}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4 text-sm text-slate-400">
            Company access rules are controlled by Super Admins.
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Company Users"
        description="People attached to this company workspace right now."
      >
        {loading ? (
          <InlineMessage>Loading company users...</InlineMessage>
        ) : users.length === 0 ? (
          <EmptyState
            title="No users in this workspace"
            description="Company admins and employees will appear here once they are linked to the workspace."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-700/80">
            <div className="grid grid-cols-[1.4fr_0.9fr_0.9fr_1fr] gap-3 border-b border-slate-700/80 bg-slate-950/50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              <div>User</div>
              <div>Role</div>
              <div>Status</div>
              <div>Last Seen</div>
            </div>
            {users.map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-[1.4fr_0.9fr_0.9fr_1fr] gap-3 border-t border-slate-700/60 px-5 py-4 text-sm text-slate-400 first:border-t-0"
              >
                <div>
                  <div className="font-semibold text-slate-100">{user.name}</div>
                  <div className="mt-1 text-slate-500">{user.email || user.id}</div>
                </div>
                <div>{user.role}</div>
                <div>
                  <StatusBadge label={user.status} tone={statusTone(user.status)} />
                </div>
                <div>{formatRelative(user.last_sign_in_at ?? user.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <section className="grid gap-8 xl:grid-cols-2">
        <ActivityFeed
          title="Recent Company Activity"
          description="Latest workspace lifecycle events, invites, users, and document changes."
          items={
            loading
              ? [
                  {
                    id: "loading-activity",
                    title: "Loading company activity",
                    detail: "Recent workspace events will appear here in a moment.",
                    meta: "Working",
                    tone: "neutral",
                  },
                ]
              : activity.length > 0
                ? activity
                : [
                    {
                      id: "empty-activity",
                      title: "No recent activity yet",
                      detail: "Invites, user links, document updates, and lifecycle events will appear here.",
                      meta: "Waiting",
                      tone: "neutral",
                    },
                  ]
          }
        />

        <SectionCard
          title="Archive History"
          description="Audit trail for workspace lifecycle changes."
        >
          {loading ? (
            <InlineMessage>Loading archive history...</InlineMessage>
          ) : !company ? (
            <EmptyState
              title="No company history available"
              description="This company workspace could not be loaded."
            />
          ) : !company.archivedAt && !company.restoredAt ? (
            <EmptyState
              title="No archive events yet"
              description="Archive and restore actions will appear here once this workspace lifecycle changes."
            />
          ) : (
            <div className="space-y-3">
              {company.archivedAt ? (
                <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4">
                  <div className="font-semibold text-slate-100">Workspace archived</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {formatRelative(company.archivedAt)}
                    {company.archivedByEmail ? ` by ${company.archivedByEmail}` : ""}
                  </div>
                </div>
              ) : null}
              {company.restoredAt ? (
                <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4">
                  <div className="font-semibold text-slate-100">Workspace restored</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {formatRelative(company.restoredAt)}
                    {company.restoredByEmail ? ` by ${company.restoredByEmail}` : ""}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Pending Invites"
          description="Invites still waiting to be claimed or accepted."
        >
          {loading ? (
            <InlineMessage>Loading invites...</InlineMessage>
          ) : invites.length === 0 ? (
            <EmptyState
              title="No pending invites"
              description="Outstanding company invites will appear here."
            />
          ) : (
            <div className="space-y-3">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-100">{invite.email}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {invite.role} invited {formatRelative(invite.created_at)}
                      </div>
                    </div>
                    <StatusBadge label={invite.status} tone={statusTone(invite.status)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Company Documents"
          description="Submitted and completed documents linked to this workspace."
        >
          {loading ? (
            <InlineMessage>Loading company documents...</InlineMessage>
          ) : documents.length === 0 ? (
            <EmptyState
              title="No company documents yet"
              description="Submitted and approved records will appear here once the company starts using the workspace."
            />
          ) : (
            <div className="space-y-3">
              {documents.slice(0, 12).map((document) => (
                <div
                  key={document.id}
                  className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-100">{document.title}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {document.projectName || "No project"} · {document.type || "Document"} ·{" "}
                        {formatRelative(document.updatedAt ?? document.createdAt)}
                      </div>
                    </div>
                    <StatusBadge label={document.status} tone={statusTone(document.status)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </section>
    </div>
  );
}

function CompanyImportPreviewTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].slice(0, 8);
  if (rows.length === 0 || columns.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-700/80 bg-slate-950/50">
      <table className="min-w-full text-left text-xs">
        <thead className="border-b border-slate-700/80 bg-slate-900/80 text-slate-400">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 font-semibold">
                {column.replaceAll("_", " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/80">
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column} className="max-w-[12rem] truncate px-3 py-2 text-slate-300">
                  {String(row[column] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompanyImportRowErrors({ errors }: { errors: ImportRowError[] }) {
  return (
    <div className="rounded-2xl border border-amber-400/25 bg-amber-950/20 p-4 text-sm text-amber-100">
      <div className="font-semibold">Import notes</div>
      <ul className="mt-2 space-y-1">
        {errors.map((error, index) => (
          <li key={`${error.entity}-${error.rowNumber}-${index}`}>
            Row {error.rowNumber}: {error.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
