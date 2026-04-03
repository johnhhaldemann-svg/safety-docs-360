"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuditorDashboard, buildDefaultTrend } from "@/components/jobsite-audits/AuditorDashboard";
import { ExcelTemplateByCategory } from "@/components/jobsite-audits/ExcelTemplateByCategory";
import { FieldAuditChecklist } from "@/components/jobsite-audits/FieldAuditChecklist";
import {
  InlineMessage,
  PageHero,
  SectionCard,
} from "@/components/WorkspacePrimitives";
import {
  deriveExcelSectionLabels,
  getEnvironmentalSections,
  getHealthSafetySections,
} from "@/lib/jobsiteAudits/auditRows";
import {
  AUDIT_SYSTEM_BLUEPRINT,
  AUDIT_SYSTEM_BLUEPRINT_TEXT,
} from "@/lib/jobsiteAudits/auditSystemBlueprint";
import {
  fieldCompliancePercentForSections,
  getFieldAuditSectionsForTrade,
} from "@/lib/jobsiteAudits/fieldAuditTradeScope";

type AuditTrade =
  (typeof AUDIT_SYSTEM_BLUEPRINT.audit_system.audit_header.trade_scope_being_audited)[number];

function parseSelectedTrade(raw: unknown): AuditTrade {
  const trades = AUDIT_SYSTEM_BLUEPRINT.audit_system.audit_header
    .trade_scope_being_audited as readonly string[];
  if (typeof raw === "string" && trades.includes(raw)) {
    return raw as AuditTrade;
  }
  return "general_contractor";
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STORAGE_KEY_V2 = "safety360docs:jobsite-audit-checklist:v2";
const STORAGE_KEY_V1 = "safety360docs:jobsite-audit-checklist:v1";
const HISTORY_KEY = "safety360docs:audit-compliance-history:v1";

type RowStatus = "" | "pass" | "fail" | "na";

type MonthPoint = { month: string; score: number };

type PersistedDraft = {
  jobsite: string;
  auditDate: string;
  auditors: string;
  query: string;
  selectedTrade: AuditTrade;
  statusMap: Record<string, RowStatus>;
  photoCounts: Record<string, number>;
};

function loadHistory(): MonthPoint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(
      (x): x is MonthPoint =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as MonthPoint).month === "string" &&
        typeof (x as MonthPoint).score === "number"
    );
  } catch {
    return [];
  }
}

function saveHistory(points: MonthPoint[]) {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(points.slice(-12)));
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function fieldComplianceScore(
  statusMap: Record<string, RowStatus>,
  selectedTrade: string
): number | null {
  return fieldCompliancePercentForSections(
    getFieldAuditSectionsForTrade(selectedTrade),
    statusMap
  );
}

function loadDraft(): PersistedDraft {
  if (typeof window === "undefined") {
    return {
      jobsite: "",
      auditDate: "",
      auditors: "",
      query: "",
      selectedTrade: "general_contractor",
      statusMap: {},
      photoCounts: {},
    };
  }
  try {
    const rawV2 = window.localStorage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const data = JSON.parse(rawV2) as Partial<PersistedDraft>;
      return {
        jobsite: typeof data.jobsite === "string" ? data.jobsite : "",
        auditDate: typeof data.auditDate === "string" ? data.auditDate : "",
        auditors: typeof data.auditors === "string" ? data.auditors : "",
        query: typeof data.query === "string" ? data.query : "",
        selectedTrade: parseSelectedTrade(data.selectedTrade),
        statusMap:
          data.statusMap && typeof data.statusMap === "object" ? data.statusMap : {},
        photoCounts:
          data.photoCounts && typeof data.photoCounts === "object" ? data.photoCounts : {},
      };
    }
    const rawV1 = window.localStorage.getItem(STORAGE_KEY_V1);
    if (rawV1) {
      const data = JSON.parse(rawV1) as {
        jobsite?: string;
        auditDate?: string;
        query?: string;
        statusMap?: Record<string, RowStatus>;
      };
      return {
        jobsite: typeof data.jobsite === "string" ? data.jobsite : "",
        auditDate: typeof data.auditDate === "string" ? data.auditDate : "",
        auditors: "",
        query: typeof data.query === "string" ? data.query : "",
        selectedTrade: "general_contractor",
        statusMap: data.statusMap && typeof data.statusMap === "object" ? data.statusMap : {},
        photoCounts: {},
      };
    }
  } catch {
    /* ignore */
  }
  return {
    jobsite: "",
    auditDate: "",
    auditors: "",
    query: "",
    selectedTrade: "general_contractor",
    statusMap: {},
    photoCounts: {},
  };
}

type SubmissionRow = {
  id: string;
  created_at: string;
  created_by_email: string | null;
  jobsite_name: string | null;
  audit_date: string | null;
  auditors: string | null;
};

export default function AdminJobsiteAuditsPage() {
  const auditSystem = AUDIT_SYSTEM_BLUEPRINT.audit_system;
  const tradeOptions = auditSystem.audit_header.trade_scope_being_audited;
  const envSections = useMemo(() => getEnvironmentalSections(), []);
  const hsSections = useMemo(() => getHealthSafetySections(), []);
  const hsSectionTitles = useMemo(() => deriveExcelSectionLabels(hsSections, "hs"), [hsSections]);
  const envSectionTitles = useMemo(() => deriveExcelSectionLabels(envSections, "env"), [envSections]);

  const [jobsite, setJobsite] = useState("");
  const [auditors, setAuditors] = useState("");
  const [auditDate, setAuditDate] = useState("");
  const [selectedTrade, setSelectedTrade] = useState<(typeof tradeOptions)[number]>("general_contractor");
  const [query, setQuery] = useState("");
  const [statusMap, setStatusMap] = useState<Record<string, RowStatus>>({});
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<MonthPoint[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const d = loadDraft();
      setJobsite(d.jobsite);
      setAuditors(d.auditors);
      setAuditDate(d.auditDate);
      setQuery(d.query);
      setStatusMap(d.statusMap);
      setPhotoCounts(d.photoCounts);
      setSelectedTrade(d.selectedTrade);
      setHistory(loadHistory());
      setHydrated(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: PersistedDraft = {
      jobsite,
      auditors,
      auditDate,
      query,
      selectedTrade,
      statusMap,
      photoCounts,
    };
    window.localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(payload));
  }, [hydrated, jobsite, auditors, auditDate, query, selectedTrade, statusMap, photoCounts]);

  useEffect(() => {
    if (!hydrated) return;
    const score = fieldComplianceScore(statusMap, selectedTrade);
    if (score === null) return;
    const month = currentMonthKey();
    const id = requestAnimationFrame(() => {
      setHistory((prev) => {
        const base = prev.length > 0 ? prev : loadHistory();
        const next = [...base];
        const idx = next.findIndex((p) => p.month === month);
        if (idx >= 0) next[idx] = { month, score };
        else next.push({ month, score });
        next.sort((a, b) => a.month.localeCompare(b.month));
        const trimmed = next.slice(-12);
        saveHistory(trimmed);
        return trimmed;
      });
    });
    return () => cancelAnimationFrame(id);
  }, [hydrated, selectedTrade, statusMap]);

  const { trendPoints, trendLabels, demoTrend } = useMemo(() => {
    const def = buildDefaultTrend();
    if (history.length >= 2) {
      return {
        trendPoints: history.map((h) => h.score),
        trendLabels: history.map((h) => {
          const [y, m] = h.month.split("-").map(Number);
          return new Date(y, (m ?? 1) - 1, 1).toLocaleString("en-US", { month: "short" });
        }),
        demoTrend: false,
      };
    }
    return { trendPoints: def.points, trendLabels: def.labels, demoTrend: true };
  }, [history]);

  const setRowStatus = useCallback((key: string, next: RowStatus) => {
    setStatusMap((prev) => {
      if (next === "") {
        const rest = { ...prev };
        delete rest[key];
        return rest;
      }
      return { ...prev, [key]: next };
    });
  }, []);

  const bumpPhoto = useCallback((key: string) => {
    setPhotoCounts((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
  }, []);

  const clearDraft = useCallback(() => {
    setJobsite("");
    setAuditors("");
    setAuditDate("");
    setQuery("");
    setSelectedTrade("general_contractor");
    setStatusMap({});
    setPhotoCounts({});
    setHistory([]);
    window.localStorage.removeItem(STORAGE_KEY_V2);
    window.localStorage.removeItem(STORAGE_KEY_V1);
    window.localStorage.removeItem(HISTORY_KEY);
  }, []);

  const buildPayload = useCallback(() => {
    const tradeProfile =
      auditSystem.trade_profiles[
        selectedTrade as keyof typeof auditSystem.trade_profiles
      ] ?? null;
    const excludedTradePrompts = Object.entries(auditSystem.trade_profiles)
      .filter(([trade]) => trade !== selectedTrade)
      .flatMap(([, profile]) => [
        ...profile.checklist_items,
        ...profile.common_hazards,
        ...profile.required_permits,
      ]);
    return {
      version: "safety360-jobsite-audit-v3",
      capturedAt: new Date().toISOString(),
      sourcePath: "/admin/jobsite-audits",
      query,
      auditHeader: {
        trade_scope_being_audited: [selectedTrade],
      },
      statusMap,
      photoCounts,
      complianceHistory: history,
      excel: {
        hsSectionLabels: hsSectionTitles,
        envSectionLabels: envSectionTitles,
        hsBlockCount: hsSections.length,
        envBlockCount: envSections.length,
      },
      fieldAuditTemplate: getFieldAuditSectionsForTrade(selectedTrade).map((s) => ({
        id: s.id,
        title: s.title,
        itemIds: s.items.map((i) => i.id),
      })),
      summary: {
        scoredCells: Object.keys(statusMap).length,
        photosAttached: Object.values(photoCounts).reduce((a, n) => a + n, 0),
      },
      auditSystemBlueprint: AUDIT_SYSTEM_BLUEPRINT,
      tradeDrivenReportScope: {
        selectedTrade,
        universal_items_always_included: auditSystem.universal_audit_sections,
        applicable_trade_checklist_items: tradeProfile?.checklist_items ?? [],
        applicable_trade_hazard_prompts: tradeProfile?.common_hazards ?? [],
        applicable_trade_permit_prompts: tradeProfile?.required_permits ?? [],
        non_applicable_trade_prompts_excluded: excludedTradePrompts,
      },
    };
  }, [
    auditSystem,
    envSectionTitles,
    history,
    hsSectionTitles,
    hsSections.length,
    envSections.length,
    photoCounts,
    query,
    selectedTrade,
    statusMap,
  ]);

  const refreshSubmissions = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    const res = await fetch("/api/admin/jobsite-audits", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = (await res.json().catch(() => null)) as { submissions?: SubmissionRow[] } | null;
    if (res.ok && data?.submissions) {
      setSubmissions(data.submissions);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void refreshSubmissions();
  }, [hydrated, refreshSubmissions]);

  const downloadJson = useCallback(() => {
    const payload = buildPayload();
    const body = JSON.stringify(
      {
        jobsite,
        auditors,
        auditDate,
        ...payload,
      },
      null,
      2
    );
    const blob = new Blob([body], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jobsite-audit-${auditDate || "draft"}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSubmitMessage("Download started.");
    setSubmitError("");
  }, [auditDate, auditors, buildPayload, jobsite]);

  const submitToServer = useCallback(async () => {
    setSubmitting(true);
    setSubmitError("");
    setSubmitMessage("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setSubmitError("You must be signed in to submit.");
        return;
      }
      const payload = buildPayload();
      const res = await fetch("/api/admin/jobsite-audits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          jobsite,
          auditors,
          auditDate: auditDate || null,
          payload: {
            jobsite,
            auditors,
            auditDate,
            ...payload,
          },
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; submission?: { id: string } } | null;
      if (!res.ok) {
        setSubmitError(data?.error || "Submit failed.");
        return;
      }
      setSubmitMessage(`Saved to platform (id ${data?.submission?.id?.slice(0, 8) ?? "…"}).`);
      void refreshSubmissions();
    } catch {
      setSubmitError("Network error while submitting.");
    } finally {
      setSubmitting(false);
    }
  }, [auditDate, auditors, buildPayload, jobsite, refreshSubmissions]);

  return (
    <div className="space-y-6 antialiased">
      <PageHero
        eyebrow="Internal — platform admin"
        title="Safety auditor workspace"
        description="Dashboard, OSHA field checklist, and full Excel-derived templates split by category. Drafts autosave in this browser; submit or download JSON to record the same payload on the platform."
      />

      <InlineMessage tone="warning">
        Draft checklist scores are cached in local storage on this device. Use Submit or Download JSON to capture
        a full snapshot (field audit + Excel lines + labels). Citations are abbreviated; confirm rules in force for
        your jurisdiction.
      </InlineMessage>

      <SectionCard
        title="Audit header"
        description="Feeds the dashboard and field checklist."
        aside={
          <button
            type="button"
            onClick={clearDraft}
            className="rounded-xl border border-slate-600/90 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-900 hover:border-slate-500"
          >
            Clear all saved data
          </button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm font-semibold text-slate-100">
            Job / site name
            <input
              value={jobsite}
              onChange={(e) => setJobsite(e.target.value)}
              placeholder="e.g. Downtown Plaza Redevelopment"
              className="mt-1.5 w-full rounded-xl border border-slate-600/80 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-50 shadow-sm placeholder:text-slate-500"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-100">
            Auditor(s)
            <input
              value={auditors}
              onChange={(e) => setAuditors(e.target.value)}
              placeholder="Names, comma-separated"
              className="mt-1.5 w-full rounded-xl border border-slate-600/80 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-50 shadow-sm placeholder:text-slate-500"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-100">
            Audit date
            <input
              type="date"
              value={auditDate}
              onChange={(e) => setAuditDate(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-600/80 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-50 shadow-sm"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-100">
            Trade scope being audited
            <select
              value={selectedTrade}
              onChange={(e) => setSelectedTrade(e.target.value as (typeof tradeOptions)[number])}
              className="mt-1.5 w-full rounded-xl border border-slate-600/80 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-50 shadow-sm [color-scheme:dark]"
            >
              {tradeOptions.map((trade) => (
                <option key={trade} value={trade}>
                  {trade.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Submit audit record"
        description="Saves checklist scores, Excel category labels, and metadata for internal admins (requires service role on the server)."
        aside={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadJson}
              className="rounded-xl border border-slate-600/90 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-900"
            >
              Download JSON
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submitToServer()}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit to platform"}
            </button>
          </div>
        }
      >
        {submitError ? (
          <p className="mb-3 rounded-xl border border-red-500/35 bg-red-950/40 px-3 py-2 text-sm text-red-100">{submitError}</p>
        ) : null}
        {submitMessage ? (
          <p className="mb-3 rounded-xl border border-emerald-500/40 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-50">
            {submitMessage}
          </p>
        ) : null}
        <p className="text-sm leading-relaxed text-slate-300">
          Submit stores one row in <code className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-100">internal_jobsite_audits</code> with a
          JSON payload mirroring your workbook lines (keys <code className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-100">hs-*</code>,{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-100">env-*</code>, <code className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-100">field-*</code>
          ) and monthly trend history. Report prompts are filtered by the selected trade so non-applicable trade items
          are excluded.
        </p>
        <div className="mt-4 max-h-48 overflow-y-auto rounded-xl border border-slate-700/60">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-950/90 text-xs font-bold uppercase tracking-wide text-slate-300">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Job</th>
                <th className="px-3 py-2">Auditors</th>
              </tr>
            </thead>
            <tbody>
              {submissions.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-slate-400">
                    No submissions yet, or list still loading.
                  </td>
                </tr>
              ) : (
                submissions.map((s) => (
                  <tr key={s.id} className="border-t border-slate-700/60">
                    <td className="px-3 py-2 text-slate-400">
                      {new Date(s.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-100">{s.jobsite_name || "—"}</td>
                    <td className="px-3 py-2 text-slate-400">{s.auditors || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <Tabs.Root defaultValue="dashboard" className="w-full">
        <Tabs.List className="flex flex-wrap gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-950/60 p-2">
          {[
            { id: "dashboard", label: "Dashboard" },
            { id: "field", label: "Field audit" },
            { id: "audit-system", label: "Audit system" },
            { id: "reference", label: "Excel templates" },
          ].map((t) => (
            <Tabs.Trigger
              key={t.id}
              value={t.id}
              className="rounded-xl px-4 py-2.5 text-sm font-bold text-emerald-50/90 transition-colors hover:text-white data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-emerald-400/30 data-[state=inactive]:text-emerald-100/80"
            >
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="dashboard" className="mt-6 outline-none">
          <AuditorDashboard
            jobsite={jobsite}
            auditors={auditors}
            auditDate={auditDate}
            statusMap={statusMap}
            selectedTrade={selectedTrade}
            trendPoints={trendPoints}
            trendLabels={trendLabels}
            demoTrend={demoTrend}
          />
        </Tabs.Content>

        <Tabs.Content value="field" className="mt-6 outline-none">
          <div className="w-full">
            <FieldAuditChecklist
              jobsite={jobsite}
              auditors={auditors}
              auditDate={auditDate}
              selectedTrade={selectedTrade}
              statusMap={statusMap}
              photoCounts={photoCounts}
              onStatus={setRowStatus}
              onPhotoCapture={bumpPhoto}
            />
          </div>
        </Tabs.Content>

        <Tabs.Content value="audit-system" className="mt-6 outline-none">
          <SectionCard
            title="Audit system blueprint"
            description="Master hierarchy for the Audit tab, including header fields, universal sections, trade profiles, observation entries, report logic, and templates."
          >
            <pre className="max-h-[70vh] overflow-auto rounded-xl border border-slate-700/80 bg-slate-950/50 p-4 text-xs leading-5 text-slate-300">
              {AUDIT_SYSTEM_BLUEPRINT_TEXT}
            </pre>
          </SectionCard>
        </Tabs.Content>

        <Tabs.Content value="reference" className="mt-6 outline-none">
          <SectionCard
            title="Quick Audit Tool (Excel)"
            description="Original dual-column worksheets from your spreadsheets."
          >
            <label className="mb-4 block text-sm font-semibold text-slate-100">
              Filter
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search categories, permits, programs…"
                className="mt-1.5 w-full rounded-xl border border-slate-600/80 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-50 shadow-sm placeholder:text-slate-500"
              />
            </label>
            <Tabs.Root defaultValue="hs" className="w-full">
              <Tabs.List className="flex flex-wrap gap-2 border-b border-slate-700/80 pb-3">
                <Tabs.Trigger
                  value="hs"
                  className="rounded-xl border border-transparent px-4 py-2 text-sm font-semibold text-slate-300 data-[state=active]:border-emerald-500/40 data-[state=active]:bg-emerald-950/50 data-[state=active]:text-emerald-50"
                >
                  Health & safety (V2)
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="env"
                  className="rounded-xl border border-transparent px-4 py-2 text-sm font-semibold text-slate-300 data-[state=active]:border-emerald-500/40 data-[state=active]:bg-emerald-950/50 data-[state=active]:text-emerald-50"
                >
                  Environmental
                </Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="hs" className="mt-6 outline-none">
                <p className="mb-4 text-sm leading-relaxed text-slate-300">
                  From <em className="text-slate-200">Quick Audit Tool V2 H&amp;S.xlsx</em>. Pick a block in the category list; use Prev
                  / Next to move between blocks.
                </p>
                <ExcelTemplateByCategory
                  sections={hsSections}
                  sectionTitles={hsSectionTitles}
                  tabPrefix="hs"
                  query={query}
                  statusMap={statusMap}
                  onRowStatus={setRowStatus}
                  categoryLabel="H&S categories"
                />
              </Tabs.Content>
              <Tabs.Content value="env" className="mt-6 outline-none">
                <p className="mb-4 text-sm leading-relaxed text-slate-300">
                  From <em className="text-slate-200">Quick Audit Tool Env.xlsx</em> — full Sheet1 export (all rows and columns from the
                  workbook JSON).
                </p>
                <ExcelTemplateByCategory
                  sections={envSections}
                  sectionTitles={envSectionTitles}
                  tabPrefix="env"
                  query={query}
                  statusMap={statusMap}
                  onRowStatus={setRowStatus}
                  categoryLabel="Environmental categories"
                />
              </Tabs.Content>
            </Tabs.Root>
          </SectionCard>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
