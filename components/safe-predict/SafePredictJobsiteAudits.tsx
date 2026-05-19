"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, ClipboardCheck, Eye, FileText, RefreshCw, RotateCcw, Save, Send } from "lucide-react";
import { FieldAuditChecklist } from "@/components/jobsite-audits/FieldAuditChecklist";
import { Card, PageHeader, SectionTitle, SelectShell, cx } from "@/components/safe-predict/SafePredictPrimitives";
import { AUDIT_SYSTEM_BLUEPRINT } from "@/lib/jobsiteAudits/auditSystemBlueprint";
import { CONSTRUCTION_TRADE_LABEL_BY_SLUG } from "@/lib/sharedTradeTaxonomy";
import {
  normalizeFieldAuditPayload,
  tradeLabel,
  type FieldAuditNotesMap,
  type FieldAuditPhotoCounts,
  type FieldAuditStatusMap,
} from "@/lib/fieldAudits/normalize";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const supabase = getSupabaseBrowserClient();
const DRAFT_KEY = "safety360docs:safe-predict-jobsite-audit-draft:v1";

type Jobsite = {
  id: string;
  company_id?: string | null;
  name: string;
  project_number?: string | null;
  location?: string | null;
  status?: string | null;
  customer_company_name?: string | null;
  customer_report_email?: string | null;
  audit_customer_id?: string | null;
};

type AuditCompany = {
  id: string;
  name: string;
  report_email?: string | null;
  status?: string | null;
};

type AuditListRow = {
  id: string;
  company_id?: string | null;
  jobsite_id: string | null;
  audit_customer_id?: string | null;
  audit_customer_location_id?: string | null;
  audit_date: string | null;
  auditors: string | null;
  selected_trade: string;
  status?: string | null;
  ai_review_status?: string | null;
  ai_review_summary?: {
    executiveSummary?: string;
    requiredCorrections?: string[];
    meta?: { fallbackUsed?: boolean; fallbackReason?: string | null };
  } | null;
  payload?: { hoursBilled?: number | string | null } | null;
  score_summary: {
    total?: number;
    pass?: number;
    fail?: number;
    na?: number;
    compliancePercent?: number | null;
    photoCount?: number;
  };
  created_at: string;
};

type SubmitResponse = {
  success?: boolean;
  error?: string;
  audit?: { id: string };
  observationCount?: number;
  correctiveActionsCreated?: number;
  aiRecordsCreated?: number;
  aiReviewStatus?: string;
  ingestionErrors?: string[];
};

type Draft = {
  companyId: string;
  jobsiteId: string;
  auditDate: string;
  auditors: string;
  selectedTrade: string;
  hoursBilled: string;
  notes: string;
  statusMap: FieldAuditStatusMap;
  notesMap: FieldAuditNotesMap;
  photoCounts: FieldAuditPhotoCounts;
};

function emptyDraft(): Draft {
  return {
    companyId: "",
    jobsiteId: "",
    auditDate: new Date().toISOString().slice(0, 10),
    auditors: "",
    selectedTrade: "general_contractor",
    hoursBilled: "",
    notes: "",
    statusMap: {},
    notesMap: {},
    photoCounts: {},
  };
}

function loadDraft(): Draft {
  if (typeof window === "undefined") return emptyDraft();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "null") as Partial<Draft> | null;
    const fallback = emptyDraft();
    if (!parsed || typeof parsed !== "object") return fallback;
    return {
      companyId: typeof parsed.companyId === "string" ? parsed.companyId : fallback.companyId,
      jobsiteId: typeof parsed.jobsiteId === "string" ? parsed.jobsiteId : fallback.jobsiteId,
      auditDate: typeof parsed.auditDate === "string" ? parsed.auditDate : fallback.auditDate,
      auditors: typeof parsed.auditors === "string" ? parsed.auditors : fallback.auditors,
      selectedTrade: typeof parsed.selectedTrade === "string" ? parsed.selectedTrade : fallback.selectedTrade,
      hoursBilled: typeof parsed.hoursBilled === "string" ? parsed.hoursBilled : fallback.hoursBilled,
      notes: typeof parsed.notes === "string" ? parsed.notes : fallback.notes,
      statusMap: parsed.statusMap && typeof parsed.statusMap === "object" ? parsed.statusMap : {},
      notesMap: parsed.notesMap && typeof parsed.notesMap === "object" ? parsed.notesMap : {},
      photoCounts: parsed.photoCounts && typeof parsed.photoCounts === "object" ? parsed.photoCounts : {},
    };
  } catch {
    return emptyDraft();
  }
}

function statusTone(status?: string | null) {
  const normalized = (status ?? "").toLowerCase();
  if (normalized.includes("approved") || normalized.includes("complete")) return "bg-emerald-50 text-emerald-700";
  if (normalized.includes("reject") || normalized.includes("failed")) return "bg-red-50 text-red-700";
  return "bg-blue-50 text-blue-700";
}

function formatStatus(status?: string | null) {
  return (status || "submitted").replaceAll("_", " ");
}

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not signed in.");
  return session.access_token;
}

export function SafePredictJobsiteAudits() {
  const tradeOptions = AUDIT_SYSTEM_BLUEPRINT.audit_system.audit_header.trade_scope_being_audited;
  const [companyId, setCompanyId] = useState("");
  const [jobsiteId, setJobsiteId] = useState("");
  const [auditDate, setAuditDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [auditors, setAuditors] = useState("");
  const [selectedTrade, setSelectedTrade] = useState("general_contractor");
  const [hoursBilled, setHoursBilled] = useState("");
  const [notes, setNotes] = useState("");
  const [statusMap, setStatusMap] = useState<FieldAuditStatusMap>({});
  const [notesMap, setNotesMap] = useState<FieldAuditNotesMap>({});
  const [photoCounts, setPhotoCounts] = useState<FieldAuditPhotoCounts>({});
  const [companies, setCompanies] = useState<AuditCompany[]>([]);
  const [jobsites, setJobsites] = useState<Jobsite[]>([]);
  const [audits, setAudits] = useState<AuditListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewingAuditId, setPreviewingAuditId] = useState<string | null>(null);
  const [reviewingAuditId, setReviewingAuditId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "error" | "warning">("neutral");

  useEffect(() => {
    const draft = loadDraft();
    setCompanyId(draft.companyId);
    setJobsiteId(draft.jobsiteId);
    setAuditDate(draft.auditDate);
    setAuditors(draft.auditors);
    setSelectedTrade(draft.selectedTrade);
    setHoursBilled(draft.hoursBilled);
    setNotes(draft.notes);
    setStatusMap(draft.statusMap);
    setNotesMap(draft.notesMap);
    setPhotoCounts(draft.photoCounts);
  }, []);

  useEffect(() => {
    const draft: Draft = {
      companyId,
      jobsiteId,
      auditDate,
      auditors,
      selectedTrade,
      hoursBilled,
      notes,
      statusMap,
      notesMap,
      photoCounts,
    };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [auditDate, auditors, companyId, hoursBilled, jobsiteId, notes, notesMap, photoCounts, selectedTrade, statusMap]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const contextUrl = companyId
        ? `/api/company/field-audits/context?companyId=${encodeURIComponent(companyId)}`
        : "/api/company/field-audits/context";
      const contextRes = await fetch(contextUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const contextData = (await contextRes.json().catch(() => null)) as
        | { companies?: AuditCompany[]; jobsites?: Jobsite[]; error?: string; warning?: string }
        | null;
      if (!contextRes.ok) throw new Error(contextData?.error || contextData?.warning || "Failed to load audit setup.");

      const nextCompanies = contextData?.companies ?? [];
      const effectiveCompanyId = nextCompanies.some((company) => company.id === companyId)
        ? companyId
        : nextCompanies.length === 1
          ? nextCompanies[0].id
          : "";
      const auditsUrl = effectiveCompanyId
        ? `/api/company/field-audits?companyId=${encodeURIComponent(effectiveCompanyId)}`
        : "/api/company/field-audits";
      const auditsRes = await fetch(auditsUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const auditsData = (await auditsRes.json().catch(() => null)) as { audits?: AuditListRow[]; error?: string; warning?: string } | null;
      if (!auditsRes.ok) throw new Error(auditsData?.error || auditsData?.warning || "Failed to load recent audits.");

      setCompanies(nextCompanies);
      setJobsites(contextData?.jobsites ?? []);
      setAudits(auditsData?.audits ?? []);
      if (effectiveCompanyId && effectiveCompanyId !== companyId) {
        setCompanyId(effectiveCompanyId);
      }
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Could not load jobsite audits.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedCompany = companies.find((company) => company.id === companyId);
  const filteredJobsites = useMemo(
    () =>
      companyId
        ? jobsites.filter((jobsite) => jobsite.company_id === companyId && String(jobsite.status ?? "").toLowerCase() === "active")
        : [],
    [companyId, jobsites]
  );
  const selectedJobsite = jobsites.find((jobsite) => jobsite.id === jobsiteId);
  const normalized = useMemo(
    () => normalizeFieldAuditPayload({ selectedTrade, statusMap, notesMap, photoCounts }),
    [notesMap, photoCounts, selectedTrade, statusMap]
  );
  const score = normalized.scoreSummary;

  useEffect(() => {
    if (!jobsiteId || !companyId) return;
    if (!filteredJobsites.some((jobsite) => jobsite.id === jobsiteId)) {
      setJobsiteId("");
    }
  }, [companyId, filteredJobsites, jobsiteId]);

  const setRowStatus = useCallback((key: string, next: "pass" | "fail" | "na" | "") => {
    setStatusMap((prev) => {
      const copy = { ...prev };
      if (!next) delete copy[key];
      else copy[key] = next;
      return copy;
    });
  }, []);

  const bumpPhoto = useCallback((key: string) => {
    setPhotoCounts((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
  }, []);

  function clearDraft() {
    const draft = emptyDraft();
    setJobsiteId("");
    setAuditDate(draft.auditDate);
    setAuditors("");
    setSelectedTrade(draft.selectedTrade);
    setHoursBilled("");
    setNotes("");
    setStatusMap({});
    setNotesMap({});
    setPhotoCounts({});
    setMessageTone("neutral");
    setMessage("Audit draft cleared.");
  }

  async function submitAudit() {
    setSubmitting(true);
    setMessage("");
    try {
      if (!companyId) throw new Error("Choose a company before submitting this audit.");
      if (!jobsiteId) throw new Error("Choose an active jobsite before submitting this audit.");
      if (normalized.observations.length < 1) throw new Error("Score at least one audit item before submitting.");

      const token = await getAccessToken();
      const res = await fetch("/api/company/field-audits", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
          jobsiteId,
          auditCustomerId: selectedJobsite?.audit_customer_id || null,
          auditCustomerLocationId: null,
          auditDate: auditDate || null,
          auditors,
          hoursBilled,
          selectedTrade,
          templateSource: "field",
          status: "pending_review",
          statusMap,
          notesMap: { ...notesMap, audit_general_notes: notes },
          photoCounts,
        }),
      });
      const data = (await res.json().catch(() => null)) as SubmitResponse | null;
      if (!res.ok) throw new Error(data?.error || "Submit failed.");

      setMessageTone((data?.ingestionErrors?.length ?? 0) > 0 ? "warning" : "success");
      setMessage(
        `Audit submitted with ${data?.observationCount ?? 0} observations, ${data?.correctiveActionsCreated ?? 0} corrective actions, ${data?.aiRecordsCreated ?? 0} AI records, and ${formatStatus(data?.aiReviewStatus)} AI review.`
      );
      window.localStorage.removeItem(DRAFT_KEY);
      setStatusMap({});
      setNotesMap({});
      setPhotoCounts({});
      setNotes("");
      await loadData();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Submit failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function openAuditPdf(auditId: string) {
    setPreviewingAuditId(auditId);
    setMessage("");
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/company/field-audits/${auditId}/report-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Could not open the audit PDF.");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) throw new Error("Your browser blocked the PDF window. Allow popups for this site and try again.");
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Could not open the audit PDF.");
    } finally {
      setPreviewingAuditId(null);
    }
  }

  async function reviewAudit(auditId: string, decision: "approved" | "rejected") {
    setReviewingAuditId(auditId);
    setMessage("");
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/company/field-audits/${auditId}/review`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ decision }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; message?: string; warning?: string; customerEmailSent?: boolean } | null;
      if (!res.ok) throw new Error(data?.error || "Audit review failed.");
      setMessageTone(data?.warning || data?.customerEmailSent === false ? "warning" : "success");
      setMessage(data?.warning || data?.message || "Audit review completed.");
      await loadData();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Audit review failed.");
    } finally {
      setReviewingAuditId(null);
    }
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] px-4 pb-8 sm:px-7">
      <PageHeader
        title="Jobsite Audits"
        subtitle="Run standalone company jobsite audits, score checklist items, and create corrective actions from failed findings."
        actions={
          <>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading || submitting}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <RefreshCw className={cx("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </button>
            <button
              type="button"
              onClick={clearDraft}
              disabled={submitting}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <RotateCcw className="h-4 w-4" />
              Clear
            </button>
            <button
              type="button"
              onClick={() => void submitAudit()}
              disabled={submitting || loading}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-[0_12px_20px_rgba(37,99,235,0.24)] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Send className="h-4 w-4" />
              {submitting ? "Submitting..." : "Submit Audit"}
            </button>
          </>
        }
      />

      {message ? (
        <div
          className={cx(
            "mb-5 rounded-lg border px-4 py-3 text-sm font-bold",
            messageTone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
            messageTone === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
            messageTone === "error" && "border-red-200 bg-red-50 text-red-700",
            messageTone === "neutral" && "border-slate-200 bg-white text-slate-700"
          )}
        >
          {message}
        </div>
      ) : null}

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle title="Audit Setup" />
            <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr_170px_170px]">
              <SelectShell
                label="Company"
                value={companyId}
                onChange={(value) => {
                  setCompanyId(value);
                  setJobsiteId("");
                }}
                options={[{ label: "Choose company", value: "" }, ...companies.map((company) => ({ label: company.name, value: company.id }))]}
              />
              <SelectShell
                label="Active jobsite"
                value={jobsiteId}
                onChange={setJobsiteId}
                options={[{ label: companyId ? "Choose active jobsite" : "Choose company first", value: "" }, ...filteredJobsites.map((jobsite) => ({ label: jobsite.name, value: jobsite.id }))]}
              />
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-600">Audit date</span>
                <input
                  type="date"
                  value={auditDate}
                  onChange={(event) => setAuditDate(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-blue-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-600">Hours billed</span>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={hoursBilled}
                  onChange={(event) => setHoursBilled(event.target.value)}
                  placeholder="0"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-blue-500"
                />
              </label>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-600">Auditors</span>
                <input
                  value={auditors}
                  onChange={(event) => setAuditors(event.target.value)}
                  placeholder="Safety lead, foreman"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-blue-500"
                />
              </label>
              <SelectShell
                label="Trade"
                value={selectedTrade}
                onChange={setSelectedTrade}
                options={tradeOptions.map((trade) => ({
                  label: CONSTRUCTION_TRADE_LABEL_BY_SLUG[trade] ?? trade.replaceAll("_", " "),
                  value: trade,
                }))}
              />
            </div>
            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-bold text-slate-600">Audit notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="General notes, customer context, weather, or follow-up instructions"
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-blue-500"
              />
            </label>
          </Card>

          <Card className="p-5">
            <SectionTitle title="Checklist Scoring" />
            <div className="mt-4">
              <FieldAuditChecklist
                jobsite={selectedJobsite?.name ?? ""}
                auditors={auditors}
                auditDate={auditDate}
                selectedTrade={selectedTrade}
                statusMap={statusMap}
                photoCounts={photoCounts}
                onStatus={setRowStatus}
                onPhotoCapture={bumpPhoto}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle title="Audit Readiness" />
            <div className="mt-4 grid gap-3 text-sm font-bold text-slate-700">
              <div className="rounded-lg bg-blue-50 p-3 text-blue-700">
                <p className="text-xs uppercase tracking-wide">Company</p>
                <p className="mt-1 text-base text-slate-950">{selectedCompany?.name ?? "Not selected"}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Jobsite</p>
                <p className="mt-1 text-base text-slate-950">{selectedJobsite?.name ?? "Not selected"}</p>
                <p className="mt-1 text-xs text-slate-500">{selectedJobsite?.location ?? selectedJobsite?.project_number ?? "Active jobsites load after company selection."}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-emerald-50 p-3 text-emerald-700">
                  <p className="text-xs uppercase tracking-wide">Compliance</p>
                  <p className="mt-1 text-2xl font-black">{score.compliancePercent ?? "--"}%</p>
                </div>
                <div className="rounded-lg bg-red-50 p-3 text-red-700">
                  <p className="text-xs uppercase tracking-wide">Findings</p>
                  <p className="mt-1 text-2xl font-black">{score.fail}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Scored</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{score.scored}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-slate-500">
                    <Camera className="h-3.5 w-3.5" />
                    Photos
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{score.photoCount}</p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void submitAudit()}
              disabled={submitting || loading}
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Save className="h-4 w-4" />
              {submitting ? "Submitting..." : "Submit audit"}
            </button>
          </Card>

          <Card className="p-5">
            <SectionTitle title="Recent Audits" action={<span className="text-sm font-black text-slate-500">{audits.length} records</span>} />
            <div className="mt-4 space-y-3">
              {loading ? <p className="text-sm font-semibold text-slate-500">Loading audits...</p> : null}
              {!loading && audits.length === 0 ? <p className="text-sm font-semibold text-slate-500">No audits have been submitted for this scope.</p> : null}
              {audits.slice(0, 8).map((audit) => {
                const jobsite = jobsites.find((row) => row.id === audit.jobsite_id);
                return (
                  <article key={audit.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">{jobsite?.name ?? "Jobsite audit"}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          {audit.audit_date ?? new Date(audit.created_at).toLocaleDateString()} | {tradeLabel(audit.selected_trade)}
                        </p>
                      </div>
                      <FileText className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                      <span className={cx("rounded-full px-2 py-1", statusTone(audit.status))}>{formatStatus(audit.status)}</span>
                      <span className="rounded-full bg-white px-2 py-1 text-slate-700">{audit.score_summary?.compliancePercent ?? "--"}% compliance</span>
                      <span className="rounded-full bg-white px-2 py-1 text-red-700">{audit.score_summary?.fail ?? 0} findings</span>
                      <span className="rounded-full bg-white px-2 py-1 text-slate-700">{audit.payload?.hoursBilled ?? "--"} hours</span>
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">AI: {formatStatus(audit.ai_review_status)}</span>
                    </div>
                    {audit.ai_review_summary?.executiveSummary ? (
                      <p className="mt-3 text-xs font-semibold leading-5 text-slate-600">{audit.ai_review_summary.executiveSummary}</p>
                    ) : null}
                    {audit.ai_review_summary?.requiredCorrections?.length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs font-semibold leading-5 text-amber-700">
                        {audit.ai_review_summary.requiredCorrections.slice(0, 3).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="mt-3 grid gap-2">
                      <button
                        type="button"
                        onClick={() => void openAuditPdf(audit.id)}
                        disabled={previewingAuditId === audit.id || reviewingAuditId === audit.id}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        <Eye className="h-4 w-4" />
                        {previewingAuditId === audit.id ? "Opening PDF..." : "View PDF"}
                      </button>
                      {audit.status === "pending_review" ? (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => void reviewAudit(audit.id, "approved")}
                            disabled={reviewingAuditId === audit.id || previewingAuditId === audit.id}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            <Send className="h-4 w-4" />
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => void reviewAudit(audit.id, "rejected")}
                            disabled={reviewingAuditId === audit.id || previewingAuditId === audit.id}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                          >
                            <RotateCcw className="h-4 w-4" />
                            Send back
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-5 p-5">
        <p className="inline-flex items-center gap-2 text-sm font-bold text-slate-600">
          <ClipboardCheck className="h-4 w-4 text-blue-600" />
          Failed checklist items automatically open corrective actions and feed structured Safety Intelligence records.
        </p>
      </Card>
    </div>
  );
}
