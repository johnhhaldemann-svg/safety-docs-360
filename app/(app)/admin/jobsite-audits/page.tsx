"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuditorDashboard, buildDefaultTrend } from "@/components/jobsite-audits/AuditorDashboard";
import { ExcelTemplateByCategory } from "@/components/jobsite-audits/ExcelTemplateByCategory";
import { FieldAuditChecklist } from "@/components/jobsite-audits/FieldAuditChecklist";
import {
  InlineMessage,
  PageHero,
  SectionCard,
} from "@/components/WorkspacePrimitives";
import { getEnvironmentalSections, getHealthSafetySections } from "@/lib/jobsiteAudits/auditRows";
import { OSHA_FIELD_AUDIT_SECTIONS, fieldItemKey } from "@/lib/jobsiteAudits/oshaFieldAuditTemplate";

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

function fieldComplianceScore(statusMap: Record<string, RowStatus>): number | null {
  let pass = 0;
  let fail = 0;
  for (const sec of OSHA_FIELD_AUDIT_SECTIONS) {
    for (const it of sec.items) {
      const st = statusMap[fieldItemKey(sec.id, it.id)] ?? "";
      if (st === "pass") pass += 1;
      if (st === "fail") fail += 1;
    }
  }
  if (pass + fail === 0) return null;
  return Math.round((pass / (pass + fail)) * 100);
}

function loadDraft(): PersistedDraft {
  if (typeof window === "undefined") {
    return {
      jobsite: "",
      auditDate: "",
      auditors: "",
      query: "",
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
    statusMap: {},
    photoCounts: {},
  };
}

export default function AdminJobsiteAuditsPage() {
  const envSections = useMemo(() => getEnvironmentalSections(), []);
  const hsSections = useMemo(() => getHealthSafetySections(), []);

  const [jobsite, setJobsite] = useState("");
  const [auditors, setAuditors] = useState("");
  const [auditDate, setAuditDate] = useState("");
  const [query, setQuery] = useState("");
  const [statusMap, setStatusMap] = useState<Record<string, RowStatus>>({});
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<MonthPoint[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const d = loadDraft();
      setJobsite(d.jobsite);
      setAuditors(d.auditors);
      setAuditDate(d.auditDate);
      setQuery(d.query);
      setStatusMap(d.statusMap);
      setPhotoCounts(d.photoCounts);
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
      statusMap,
      photoCounts,
    };
    window.localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(payload));
  }, [hydrated, jobsite, auditors, auditDate, query, statusMap, photoCounts]);

  useEffect(() => {
    if (!hydrated) return;
    const score = fieldComplianceScore(statusMap);
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
  }, [hydrated, statusMap]);

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
    setStatusMap({});
    setPhotoCounts({});
    setHistory([]);
    window.localStorage.removeItem(STORAGE_KEY_V2);
    window.localStorage.removeItem(STORAGE_KEY_V1);
    window.localStorage.removeItem(HISTORY_KEY);
  }, []);

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Internal — platform admin"
        title="Safety auditor workspace"
        description="Dashboard-style overview, OSHA-aligned field audit, and your original Excel-derived templates. Data stays in this browser until you export to your formal system."
      />

      <InlineMessage tone="warning">
        Stored locally on this device only (not in Safety360Docs database). Citations are abbreviated;
        confirm requirements with current OSHA / state rules.
      </InlineMessage>

      <SectionCard
        title="Audit header"
        description="Feeds the dashboard and field checklist."
        aside={
          <button
            type="button"
            onClick={clearDraft}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Clear all saved data
          </button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm font-semibold text-slate-700">
            Job / site name
            <input
              value={jobsite}
              onChange={(e) => setJobsite(e.target.value)}
              placeholder="e.g. Downtown Plaza Redevelopment"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Auditor(s)
            <input
              value={auditors}
              onChange={(e) => setAuditors(e.target.value)}
              placeholder="Names, comma-separated"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Audit date
            <input
              type="date"
              value={auditDate}
              onChange={(e) => setAuditDate(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm"
            />
          </label>
        </div>
      </SectionCard>

      <Tabs.Root defaultValue="dashboard" className="w-full">
        <Tabs.List className="flex flex-wrap gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-2">
          {[
            { id: "dashboard", label: "Dashboard" },
            { id: "field", label: "Field audit" },
            { id: "reference", label: "Excel templates" },
          ].map((t) => (
            <Tabs.Trigger
              key={t.id}
              value={t.id}
              className="rounded-xl px-4 py-2.5 text-sm font-bold text-emerald-900 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=inactive]:opacity-70"
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
              statusMap={statusMap}
              photoCounts={photoCounts}
              onStatus={setRowStatus}
              onPhotoCapture={bumpPhoto}
            />
          </div>
        </Tabs.Content>

        <Tabs.Content value="reference" className="mt-6 outline-none">
          <SectionCard
            title="Quick Audit Tool (Excel)"
            description="Original dual-column worksheets from your spreadsheets."
          >
            <label className="mb-4 block text-sm font-semibold text-slate-700">
              Filter
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search categories, permits, programs…"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm"
              />
            </label>
            <Tabs.Root defaultValue="hs" className="w-full">
              <Tabs.List className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                <Tabs.Trigger
                  value="hs"
                  className="rounded-xl border border-transparent px-4 py-2 text-sm font-semibold text-slate-600 data-[state=active]:border-emerald-200 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-900"
                >
                  Health & safety (V2)
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="env"
                  className="rounded-xl border border-transparent px-4 py-2 text-sm font-semibold text-slate-600 data-[state=active]:border-emerald-200 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-900"
                >
                  Environmental
                </Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="hs" className="mt-6 outline-none">
                <p className="mb-4 text-sm text-slate-600">
                  From <em>Quick Audit Tool V2 H&amp;S.xlsx</em>. Pick a block in the category list; use Prev
                  / Next to move between blocks.
                </p>
                <ExcelTemplateByCategory
                  sections={hsSections}
                  tabPrefix="hs"
                  query={query}
                  statusMap={statusMap}
                  onRowStatus={setRowStatus}
                  categoryLabel="H&S blocks"
                />
              </Tabs.Content>
              <Tabs.Content value="env" className="mt-6 outline-none">
                <p className="mb-4 text-sm text-slate-600">
                  From <em>Quick Audit Tool Env.xlsx</em> — generic program rows; site permit IDs stripped.
                </p>
                <ExcelTemplateByCategory
                  sections={envSections}
                  tabPrefix="env"
                  query={query}
                  statusMap={statusMap}
                  onRowStatus={setRowStatus}
                  categoryLabel="Environmental blocks"
                />
              </Tabs.Content>
            </Tabs.Root>
          </SectionCard>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
