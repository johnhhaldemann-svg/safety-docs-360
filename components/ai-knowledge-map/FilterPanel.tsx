"use client";

import { Filter, Search } from "lucide-react";
import type { AiKnowledgeMapFilters, AiKnowledgeNode } from "@/lib/aiKnowledgeMap/types";

const savedViews = ["High Risk Work Activities", "Permit to Work Flow", "Incident Hotspots", "Training Gaps"];
const riskLevels = ["all", "critical", "high", "moderate", "low", "unknown"] as const;
const sourceTypes = ["all", "permit", "task", "hazard", "control", "training", "incident", "risk_record", "document", "observation", "corrective_action"] as const;

export function FilterPanel({
  companies,
  filters,
  nodes,
  onChange,
  onApply,
}: {
  companies: Array<{ id: string; name: string }>;
  filters: AiKnowledgeMapFilters;
  nodes: AiKnowledgeNode[];
  onChange: (filters: AiKnowledgeMapFilters) => void;
  onApply: () => void;
}) {
  const projects = Array.from(new Set(nodes.map((node) => node.project).filter(Boolean))).sort() as string[];
  const categories = Array.from(new Set(nodes.map((node) => node.category).filter(Boolean))).sort();
  const trades = Array.from(new Set(nodes.map((node) => node.trade).filter(Boolean))).sort() as string[];

  return (
    <aside className="flex min-h-0 flex-col rounded-xl border border-white/10 bg-slate-950/72 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-center gap-2 text-white">
        <Filter className="h-4 w-4 text-sky-300" />
        <h2 className="text-sm font-black">Filters</h2>
      </div>
      <label className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
        <Search className="h-4 w-4 text-slate-500" />
        <input
          value={filters.query ?? ""}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500"
          placeholder="Search knowledge map"
        />
      </label>
      <div className="mt-4 space-y-3 text-xs font-bold text-slate-300">
        <CompanySelect
          companies={companies}
          value={filters.companyId ?? ""}
          onChange={(companyId) => onChange({ ...filters, companyId: companyId || undefined, project: "all", trade: "all" })}
        />
        <Select label="Project" value={filters.project ?? "all"} onChange={(project) => onChange({ ...filters, project })} options={["all", ...projects]} />
        <Select label="Category" value={filters.category ?? "all"} onChange={(category) => onChange({ ...filters, category })} options={["all", ...categories]} />
        <Select label="Risk level" value={filters.riskLevel ?? "all"} onChange={(riskLevel) => onChange({ ...filters, riskLevel: riskLevel as AiKnowledgeMapFilters["riskLevel"] })} options={[...riskLevels]} />
        <Select label="Date range" value={filters.dateRange ?? "all"} onChange={(dateRange) => onChange({ ...filters, dateRange })} options={["all", "last 7 days", "last 30 days", "last 90 days", "this year"]} />
        <Select label="Trade" value={filters.trade ?? "all"} onChange={(trade) => onChange({ ...filters, trade })} options={["all", ...trades]} />
        <Select label="Source type" value={filters.sourceType ?? "all"} onChange={(sourceType) => onChange({ ...filters, sourceType: sourceType as AiKnowledgeMapFilters["sourceType"] })} options={[...sourceTypes]} />
      </div>
      <button type="button" onClick={onApply} className="mt-4 rounded-lg bg-sky-400 px-3 py-2 text-sm font-black text-slate-950 transition hover:bg-sky-300">
        Apply filters
      </button>
      <div className="mt-5">
        <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Saved views</h3>
        <div className="mt-2 space-y-2">
          {savedViews.map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => onChange({ ...filters, query: view })}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs font-bold text-slate-200 hover:bg-white/[0.08]"
            >
              {view}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

function CompanySelect({ companies, value, onChange }: { companies: Array<{ id: string; name: string }>; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-slate-500">Company</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none">
        <option value="all">All companies</option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>{company.name}</option>
        ))}
      </select>
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none">
        {options.map((option) => (
          <option key={option} value={option}>{option === "all" ? "All" : option}</option>
        ))}
      </select>
    </label>
  );
}
