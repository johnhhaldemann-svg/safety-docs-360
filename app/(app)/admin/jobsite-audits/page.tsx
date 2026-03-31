"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  InlineMessage,
  PageHero,
  SectionCard,
} from "@/components/WorkspacePrimitives";
import {
  getEnvironmentalSections,
  getHealthSafetySections,
  humanizeFieldKey,
  orderedRowEntries,
  type AuditExcelRow,
} from "@/lib/jobsiteAudits/auditRows";

const STORAGE_KEY = "safety360docs:jobsite-audit-checklist:v1";

type RowStatus = "" | "pass" | "fail" | "na";

type PersistedDraft = {
  jobsite: string;
  auditDate: string;
  query: string;
  statusMap: Record<string, RowStatus>;
};

const STATUS_OPTIONS: { value: RowStatus; label: string }[] = [
  { value: "", label: "—" },
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
  { value: "na", label: "N/A" },
];

function loadDraft(): PersistedDraft {
  if (typeof window === "undefined") {
    return { jobsite: "", auditDate: "", query: "", statusMap: {} };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { jobsite: "", auditDate: "", query: "", statusMap: {} };
    }
    const data = JSON.parse(raw) as Partial<PersistedDraft>;
    return {
      jobsite: typeof data.jobsite === "string" ? data.jobsite : "",
      auditDate: typeof data.auditDate === "string" ? data.auditDate : "",
      query: typeof data.query === "string" ? data.query : "",
      statusMap:
        data.statusMap && typeof data.statusMap === "object" ? data.statusMap : {},
    };
  } catch {
    return { jobsite: "", auditDate: "", query: "", statusMap: {} };
  }
}

function rowMatchesQuery(row: AuditExcelRow, q: string): boolean {
  if (!q.trim()) return true;
  const needle = q.trim().toLowerCase();
  return Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(needle));
}

function AuditRowCard({
  rowKey,
  row,
  status,
  onStatus,
}: {
  rowKey: string;
  row: AuditExcelRow;
  status: RowStatus;
  onStatus: (next: RowStatus) => void;
}) {
  const entries = orderedRowEntries(row);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          {entries.map(([k, v]) => (
            <div key={`${rowKey}-${k}`} className="text-sm">
              <span className="font-semibold text-slate-700">{humanizeFieldKey(k)}: </span>
              <span className="text-slate-600">{String(v).trim()}</span>
            </div>
          ))}
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5 lg:flex-col lg:items-stretch">
          {STATUS_OPTIONS.map(({ value, label }) => (
            <button
              key={value || "clear"}
              type="button"
              onClick={() => onStatus(value)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                status === value
                  ? "border-sky-500 bg-sky-500 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminJobsiteAuditsPage() {
  const envSections = useMemo(() => getEnvironmentalSections(), []);
  const hsSections = useMemo(() => getHealthSafetySections(), []);

  const [jobsite, setJobsite] = useState("");
  const [auditDate, setAuditDate] = useState("");
  const [query, setQuery] = useState("");
  const [statusMap, setStatusMap] = useState<Record<string, RowStatus>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const d = loadDraft();
    setJobsite(d.jobsite);
    setAuditDate(d.auditDate);
    setQuery(d.query);
    setStatusMap(d.statusMap);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: PersistedDraft = { jobsite, auditDate, query, statusMap };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [hydrated, jobsite, auditDate, query, statusMap]);

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

  const clearDraft = useCallback(() => {
    setJobsite("");
    setAuditDate("");
    setQuery("");
    setStatusMap({});
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  function renderChecklist(sections: AuditExcelRow[][], tabPrefix: "env" | "hs") {
    return (
      <div className="space-y-8">
        {sections.map((sectionRows, sIdx) => {
          const filtered = sectionRows.filter((row) => rowMatchesQuery(row, query));
          if (filtered.length === 0) return null;
          return (
            <div key={`${tabPrefix}-sec-${sIdx}`} className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                Block {sIdx + 1}
              </h3>
              <div className="space-y-3">
                {filtered.map((row) => {
                  const originalIdx = sectionRows.indexOf(row);
                  const rowKey = `${tabPrefix}-${sIdx}-${originalIdx}`;
                  return (
                    <AuditRowCard
                      key={rowKey}
                      rowKey={rowKey}
                      row={row}
                      status={statusMap[rowKey] ?? ""}
                      onStatus={(next) => setRowStatus(rowKey, next)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Internal — platform admin"
        title="Jobsite audit checklists"
        description="Quick Audit Tool worksheets from Environmental and Health & Safety Excel templates. For internal field use only; findings stay in this browser until you copy them into your formal report."
      />

      <InlineMessage tone="warning">
        This page is only visible in the admin workspace. Checklist status and notes below are stored in{" "}
        <strong>local browser storage</strong> on this device, not in Safety360Docs records.
      </InlineMessage>

      <SectionCard
        title="Audit details"
        description="Optional context for your walkthrough. Saved locally with checklist marks."
        aside={
          <button
            type="button"
            onClick={clearDraft}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Clear saved draft
          </button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">
            Jobsite / project
            <input
              value={jobsite}
              onChange={(e) => setJobsite(e.target.value)}
              placeholder="e.g. Main plant — Building C"
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
        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Filter checklist (search text)
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories, permits, programs…"
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm"
          />
        </label>
      </SectionCard>

      <SectionCard
        title="Templates"
        description="Environmental Quick Audit Tool and Health & Safety V2, aligned to your Excel column layout."
      >
        <Tabs.Root defaultValue="hs" className="w-full">
          <Tabs.List className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
            <Tabs.Trigger
              value="hs"
              className="rounded-xl border border-transparent px-4 py-2 text-sm font-semibold text-slate-600 data-[state=active]:border-sky-200 data-[state=active]:bg-sky-50 data-[state=active]:text-sky-900"
            >
              Health & safety (V2)
            </Tabs.Trigger>
            <Tabs.Trigger
              value="env"
              className="rounded-xl border border-transparent px-4 py-2 text-sm font-semibold text-slate-600 data-[state=active]:border-sky-200 data-[state=active]:bg-sky-50 data-[state=active]:text-sky-900"
            >
              Environmental
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="hs" className="mt-6 outline-none">
            <p className="mb-4 text-sm text-slate-600">
              Cal OSHA programs, PPE, confined space, emergency planning, and related items — dual-column layout
              from <em>Quick Audit Tool V2 H&amp;S.xlsx</em>.
            </p>
            {renderChecklist(hsSections, "hs")}
          </Tabs.Content>
          <Tabs.Content value="env" className="mt-6 outline-none">
            <p className="mb-4 text-sm text-slate-600">
              Air, waste, water, permits, and equipment conditions — from <em>Quick Audit Tool Env.xlsx</em>. The list
              shows the shared program template: site-only permit rows and example IDs from the workbook are removed;
              enter your jobsite&apos;s permits and conditions as you audit.
            </p>
            {renderChecklist(envSections, "env")}
          </Tabs.Content>
        </Tabs.Root>
      </SectionCard>
    </div>
  );
}
