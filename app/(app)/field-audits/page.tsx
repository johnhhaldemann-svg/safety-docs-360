"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { ClipboardCheck, FileText, RefreshCw, Save, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FieldAuditChecklist } from "@/components/jobsite-audits/FieldAuditChecklist";
import { ExcelTemplateByCategory } from "@/components/jobsite-audits/ExcelTemplateByCategory";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import {
  deriveExcelSectionLabels,
  getEnvironmentalSections,
  getHealthSafetySections,
} from "@/lib/jobsiteAudits/auditRows";
import { AUDIT_SYSTEM_BLUEPRINT } from "@/lib/jobsiteAudits/auditSystemBlueprint";
import { CONSTRUCTION_TRADE_LABEL_BY_SLUG } from "@/lib/sharedTradeTaxonomy";
import {
  normalizeFieldAuditPayload,
  tradeLabel,
  type FieldAuditPhotoCounts,
  type FieldAuditStatusMap,
  type FieldAuditNotesMap,
} from "@/lib/fieldAudits/normalize";

const supabase = getSupabaseBrowserClient();
const DRAFT_KEY = "safety360docs:company-field-audit-draft:v1";

type Jobsite = {
  id: string;
  name: string;
  project_number?: string | null;
  location?: string | null;
};

type AuditListRow = {
  id: string;
  jobsite_id: string | null;
  audit_date: string | null;
  auditors: string | null;
  selected_trade: string;
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
  ingestionErrors?: string[];
};

type Draft = {
  jobsiteId: string;
  auditDate: string;
  auditors: string;
  selectedTrade: string;
  statusMap: FieldAuditStatusMap;
  notesMap: FieldAuditNotesMap;
  photoCounts: FieldAuditPhotoCounts;
};

function emptyDraft(): Draft {
  return {
    jobsiteId: "",
    auditDate: new Date().toISOString().slice(0, 10),
    auditors: "",
    selectedTrade: "general_contractor",
    statusMap: {},
    notesMap: {},
    photoCounts: {},
  };
}

function loadDraft(): Draft {
  if (typeof window === "undefined") return emptyDraft();
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return emptyDraft();
    const parsed = JSON.parse(raw) as Partial<Draft>;
    return {
      ...emptyDraft(),
      ...parsed,
      statusMap: parsed.statusMap && typeof parsed.statusMap === "object" ? parsed.statusMap : {},
      notesMap: parsed.notesMap && typeof parsed.notesMap === "object" ? parsed.notesMap : {},
      photoCounts: parsed.photoCounts && typeof parsed.photoCounts === "object" ? parsed.photoCounts : {},
    };
  } catch {
    return emptyDraft();
  }
}

function statusTone(status: string) {
  if (status === "pass") return "text-emerald-300";
  if (status === "fail") return "text-red-300";
  return "text-slate-300";
}

export default function CompanyFieldAuditsPage() {
  const tradeOptions = AUDIT_SYSTEM_BLUEPRINT.audit_system.audit_header.trade_scope_being_audited;
  const hsSections = useMemo(() => getHealthSafetySections(), []);
  const envSections = useMemo(() => getEnvironmentalSections(), []);
  const hsSectionTitles = useMemo(() => deriveExcelSectionLabels(hsSections, "hs"), [hsSections]);
  const envSectionTitles = useMemo(() => deriveExcelSectionLabels(envSections, "env"), [envSections]);

  const [jobsiteId, setJobsiteId] = useState("");
  const [auditDate, setAuditDate] = useState("");
  const [auditors, setAuditors] = useState("");
  const [selectedTrade, setSelectedTrade] = useState("general_contractor");
  const [statusMap, setStatusMap] = useState<FieldAuditStatusMap>({});
  const [notesMap, setNotesMap] = useState<FieldAuditNotesMap>({});
  const [photoCounts, setPhotoCounts] = useState<FieldAuditPhotoCounts>({});
  const [query, setQuery] = useState("");
  const [excelWorkbook, setExcelWorkbook] = useState<"hs" | "env">("hs");
  const [jobsites, setJobsites] = useState<Jobsite[]>([]);
  const [audits, setAudits] = useState<AuditListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "error" | "warning">("neutral");

  useEffect(() => {
    const draft = loadDraft();
    setJobsiteId(draft.jobsiteId);
    setAuditDate(draft.auditDate);
    setAuditors(draft.auditors);
    setSelectedTrade(draft.selectedTrade);
    setStatusMap(draft.statusMap);
    setNotesMap(draft.notesMap);
    setPhotoCounts(draft.photoCounts);
  }, []);

  useEffect(() => {
    const draft: Draft = {
      jobsiteId,
      auditDate,
      auditors,
      selectedTrade,
      statusMap,
      notesMap,
      photoCounts,
    };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [auditDate, auditors, jobsiteId, notesMap, photoCounts, selectedTrade, statusMap]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const [jobsitesRes, auditsRes] = await Promise.all([
        fetch("/api/company/jobsites", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch("/api/company/field-audits", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);
      const jobsitesData = (await jobsitesRes.json().catch(() => null)) as { jobsites?: Jobsite[]; error?: string } | null;
      const auditsData = (await auditsRes.json().catch(() => null)) as { audits?: AuditListRow[]; error?: string; warning?: string } | null;
      if (!jobsitesRes.ok) throw new Error(jobsitesData?.error || "Failed to load jobsites.");
      if (!auditsRes.ok) throw new Error(auditsData?.error || auditsData?.warning || "Failed to load audits.");
      setJobsites(jobsitesData?.jobsites ?? []);
      setAudits(auditsData?.audits ?? []);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Could not load field audit data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedJobsite = jobsites.find((jobsite) => jobsite.id === jobsiteId);
  const normalized = useMemo(
    () => normalizeFieldAuditPayload({ selectedTrade, statusMap, notesMap, photoCounts }),
    [notesMap, photoCounts, selectedTrade, statusMap]
  );
  const scoredObservations = normalized.observations;
  const score = normalized.scoreSummary;

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
    setStatusMap({});
    setNotesMap({});
    setPhotoCounts({});
    setMessageTone("neutral");
    setMessage("Draft cleared.");
  }

  async function submitAudit() {
    setSubmitting(true);
    setMessage("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const res = await fetch("/api/company/field-audits", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobsiteId: jobsiteId || null,
          auditDate: auditDate || null,
          auditors,
          selectedTrade,
          templateSource: "mixed",
          statusMap,
          notesMap,
          photoCounts,
        }),
      });
      const data = (await res.json().catch(() => null)) as SubmitResponse | null;
      if (!res.ok) throw new Error(data?.error || "Submit failed.");
      setMessageTone((data?.ingestionErrors?.length ?? 0) > 0 ? "warning" : "success");
      setMessage(
        `Audit saved with ${data?.observationCount ?? 0} observations, ${data?.correctiveActionsCreated ?? 0} corrective actions, and ${data?.aiRecordsCreated ?? 0} AI records.`
      );
      window.localStorage.removeItem(DRAFT_KEY);
      setStatusMap({});
      setNotesMap({});
      setPhotoCounts({});
      await loadData();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Submit failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 antialiased">
      <PageHero
        eyebrow="Field work"
        title="Field audits"
        description="Run trade-specific jobsite audits, capture observations, create corrective actions, and feed structured findings into Safety Intelligence."
        actions={
          <button
            type="button"
            onClick={() => void loadData()}
            className={appButtonSecondaryClassName}
            disabled={loading || submitting}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

      <SectionCard
        title="Audit header"
        description="Choose the jobsite and trade before scoring. Drafts save locally until submitted."
        aside={
          <button type="button" onClick={clearDraft} className={appButtonSecondaryClassName} disabled={submitting}>
            Clear draft
          </button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm font-semibold text-slate-100">
            Jobsite
            <select
              value={jobsiteId}
              onChange={(event) => setJobsiteId(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-600/80 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-50 [color-scheme:dark]"
            >
              <option value="">No jobsite selected</option>
              {jobsites.map((jobsite) => (
                <option key={jobsite.id} value={jobsite.id}>
                  {jobsite.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-100">
            Audit date
            <input
              type="date"
              value={auditDate}
              onChange={(event) => setAuditDate(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-600/80 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-50 [color-scheme:dark]"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-100">
            Auditor(s)
            <input
              value={auditors}
              onChange={(event) => setAuditors(event.target.value)}
              placeholder="Names, comma-separated"
              className="mt-1.5 w-full rounded-xl border border-slate-600/80 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-50 placeholder:text-slate-500"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-100">
            Trade observed
            <select
              value={selectedTrade}
              onChange={(event) => setSelectedTrade(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-600/80 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-50 [color-scheme:dark]"
            >
              {tradeOptions.map((trade) => (
                <option key={trade} value={trade}>
                  {CONSTRUCTION_TRADE_LABEL_BY_SLUG[trade] ?? trade.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <SectionCard
          title="Audit workspace"
          description="Score built-in field, health & safety, and environmental templates."
        >
          <Tabs.Root defaultValue="field" className="w-full">
            <Tabs.List className="flex flex-wrap gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-950/60 p-2">
              {[
                { id: "field", label: "Field checklist" },
                { id: "excel", label: "H&S / Env." },
                { id: "notes", label: "Notes" },
              ].map((tab) => (
                <Tabs.Trigger
                  key={tab.id}
                  value={tab.id}
                  className="rounded-xl px-4 py-2.5 text-sm font-bold text-emerald-50/90 transition hover:text-white data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-md"
                >
                  {tab.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            <Tabs.Content value="field" className="mt-5 outline-none">
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
            </Tabs.Content>

            <Tabs.Content value="excel" className="mt-5 outline-none">
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <label className="block min-w-[240px] flex-1 text-sm font-semibold text-slate-100">
                  <span className="inline-flex items-center gap-1">
                    <Search className="h-4 w-4" />
                    Filter template lines
                  </span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search categories, permits, controls..."
                    className="mt-1.5 w-full rounded-xl border border-slate-600/80 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-50 placeholder:text-slate-500"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExcelWorkbook("hs")}
                    className={excelWorkbook === "hs" ? appButtonPrimaryClassName : appButtonSecondaryClassName}
                  >
                    H&S
                  </button>
                  <button
                    type="button"
                    onClick={() => setExcelWorkbook("env")}
                    className={excelWorkbook === "env" ? appButtonPrimaryClassName : appButtonSecondaryClassName}
                  >
                    Env.
                  </button>
                </div>
              </div>
              {excelWorkbook === "hs" ? (
                <ExcelTemplateByCategory
                  sections={hsSections}
                  sectionTitles={hsSectionTitles}
                  tabPrefix="hs"
                  query={query}
                  statusMap={statusMap}
                  onRowStatus={setRowStatus}
                  categoryLabel="H&S categories"
                />
              ) : (
                <ExcelTemplateByCategory
                  sections={envSections}
                  sectionTitles={envSectionTitles}
                  tabPrefix="env"
                  query={query}
                  statusMap={statusMap}
                  onRowStatus={setRowStatus}
                  categoryLabel="Environmental categories"
                />
              )}
            </Tabs.Content>

            <Tabs.Content value="notes" className="mt-5 outline-none">
              {scoredObservations.length === 0 ? (
                <InlineMessage>Score at least one item to add notes.</InlineMessage>
              ) : (
                <div className="space-y-3">
                  {scoredObservations.map((observation) => (
                    <label
                      key={observation.sourceKey}
                      className="block rounded-xl border border-slate-700/80 bg-slate-950/50 p-3 text-sm"
                    >
                      <span className="flex flex-wrap items-center justify-between gap-2 font-semibold text-slate-100">
                        <span>{observation.itemLabel}</span>
                        <span className={`text-xs uppercase tracking-wide ${statusTone(observation.status)}`}>
                          {observation.status} | {observation.severity}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs text-slate-400">
                        {observation.categoryLabel} | {tradeLabel(observation.tradeCode ?? selectedTrade)}
                      </span>
                      <textarea
                        value={notesMap[observation.sourceKey] ?? ""}
                        onChange={(event) =>
                          setNotesMap((prev) => ({
                            ...prev,
                            [observation.sourceKey]: event.target.value,
                          }))
                        }
                        rows={3}
                        placeholder="Observation detail, immediate action, who/where, or evidence reference..."
                        className="mt-2 w-full rounded-xl border border-slate-600/80 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500"
                      />
                    </label>
                  ))}
                </div>
              )}
            </Tabs.Content>
          </Tabs.Root>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Submit" description="Creates observation data, corrective actions, and AI-ready records.">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Compliance</p>
                <p className="text-2xl font-black text-slate-50">
                  {score.compliancePercent == null ? "--" : `${score.compliancePercent}%`}
                </p>
              </div>
              <div className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Findings</p>
                <p className="text-2xl font-black text-red-200">{score.fail}</p>
              </div>
              <div className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Scored</p>
                <p className="text-2xl font-black text-slate-50">{score.total}</p>
              </div>
              <div className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Evidence</p>
                <p className="text-2xl font-black text-slate-50">{score.photoCount}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void submitAudit()}
              disabled={submitting || score.total < 1}
              className={`mt-4 w-full ${appButtonPrimaryClassName}`}
            >
              <Save className="h-4 w-4" />
              {submitting ? "Submitting..." : "Submit audit"}
            </button>
          </SectionCard>

          <SectionCard title="Recent audits" description="Latest company field audit submissions.">
            {loading ? (
              <InlineMessage>Loading...</InlineMessage>
            ) : audits.length === 0 ? (
              <InlineMessage>No field audits submitted yet.</InlineMessage>
            ) : (
              <div className="max-h-[520px] space-y-2 overflow-y-auto">
                {audits.map((audit) => {
                  const jobsite = jobsites.find((row) => row.id === audit.jobsite_id);
                  return (
                    <div key={audit.id} className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-100">{jobsite?.name ?? "No jobsite"}</p>
                          <p className="text-xs text-slate-400">
                            {audit.audit_date ?? new Date(audit.created_at).toLocaleDateString()} |{" "}
                            {tradeLabel(audit.selected_trade)}
                          </p>
                        </div>
                        <FileText className="h-4 w-4 text-emerald-300" />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
                        <span className="rounded-full bg-slate-900 px-2 py-1">
                          {audit.score_summary?.compliancePercent ?? "--"}% compliance
                        </span>
                        <span className="rounded-full bg-slate-900 px-2 py-1">
                          {audit.score_summary?.fail ?? 0} findings
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <InlineMessage>
        <span className="inline-flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />
          Failed items automatically open corrective actions and become structured Safety Intelligence inputs.
        </span>
      </InlineMessage>
    </div>
  );
}
