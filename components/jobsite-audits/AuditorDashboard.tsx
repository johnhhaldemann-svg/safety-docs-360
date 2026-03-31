"use client";

import { useMemo } from "react";
import { OSHA_FIELD_AUDIT_SECTIONS, fieldItemKey } from "@/lib/jobsiteAudits/oshaFieldAuditTemplate";

type RowStatus = "" | "pass" | "fail" | "na";

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function pieSlicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${end.x} ${end.y} A ${r} ${r} 0 ${large} 1 ${start.x} ${start.y} Z`;
}

function PieChart({
  slices,
  centerLabel,
}: {
  slices: { label: string; value: number; color: string }[];
  centerLabel?: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const { list: paths } = slices.reduce<{
    angle: number;
    list: { key: number; d: string; fill: string }[];
  }>(
    (acc, sl, i) => {
      if (sl.value <= 0) return acc;
      const sliceAngle = (sl.value / total) * Math.PI * 2;
      const start = acc.angle;
      const end = start + sliceAngle;
      const d = pieSlicePath(50, 50, 42, start, end);
      return {
        angle: end,
        list: [...acc.list, { key: i, d, fill: sl.color }],
      };
    },
    { angle: -Math.PI / 2, list: [] }
  );
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 100" className="h-44 w-44 shrink-0">
        {paths.map((p) => (
          <path key={p.key} d={p.d} fill={p.fill} stroke="#fff" strokeWidth="0.8" />
        ))}
        <circle cx="50" cy="50" r="22" fill="white" />
        {centerLabel ? (
          <text
            x="50"
            y="52"
            textAnchor="middle"
            className="fill-slate-800 font-bold"
            style={{ fontSize: "14px" }}
          >
            {centerLabel}
          </text>
        ) : null}
      </svg>
      <ul className="mt-3 w-full max-w-xs space-y-1 text-xs">
        {slices.map((sl) => (
          <li key={sl.label} className="flex items-center justify-between gap-2 text-slate-700">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: sl.color }} />
              <span className="truncate">{sl.label}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-900">
              {total > 0 ? Math.round((sl.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LineTrendChart({
  points,
  labels,
}: {
  points: number[];
  labels: string[];
}) {
  const w = 320;
  const h = 120;
  const pad = 8;
  const max = Math.max(25, ...points, 1);
  const min = Math.min(0, ...points) * 0.95;
  const span = max - min || 1;
  const coords = points.map((p, i) => {
    const x = pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p - min) / span) * (h - pad * 2);
    return `${x},${y}`;
  });
  const polyline = coords.join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-full max-w-md">
      <defs>
        <linearGradient id="auditLineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(5 150 105)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="rgb(5 150 105)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke="rgb(5 150 105)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={polyline}
      />
      <polygon fill="url(#auditLineFill)" points={`${pad},${h - pad} ${polyline} ${w - pad},${h - pad}`} />
      {points.map((p, i) => {
        const x = pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
        const y = h - pad - ((p - min) / span) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r="3.5" fill="white" stroke="rgb(5 150 105)" strokeWidth="2" />;
      })}
      <g className="fill-slate-500" style={{ fontSize: "8px" }}>
        {labels.map((lab, i) => {
          const x = pad + (i / Math.max(1, labels.length - 1)) * (w - pad * 2);
          return (
            <text key={lab} x={x} y={h - 1} textAnchor="middle">
              {lab}
            </text>
          );
        })}
      </g>
    </svg>
  );
}

export type OpenIssueRow = {
  id: string;
  date: string;
  job: string;
  auditor: string;
  category: string;
  pctOpen: string;
  openFindings: string;
};

const COLORS = {
  fall: "#eab308",
  ppe: "#1e3a5f",
  excavation: "#dc2626",
  cranes: "#16a34a",
  other: "#38bdf8",
};

function categoryBucket(title: string): keyof typeof COLORS {
  const t = title.toLowerCase();
  if (t.includes("fall")) return "fall";
  if (t.includes("ppe") || t.includes("protective")) return "ppe";
  if (t.includes("excavat") || t.includes("trench")) return "excavation";
  if (t.includes("crane") || t.includes("rigging") || t.includes("hoist")) return "cranes";
  return "other";
}

export function AuditorDashboard({
  jobsite,
  auditors,
  auditDate,
  statusMap,
  trendPoints,
  trendLabels,
  demoTrend,
}: {
  jobsite: string;
  auditors: string;
  auditDate: string;
  statusMap: Record<string, RowStatus>;
  trendPoints: number[];
  trendLabels: string[];
  demoTrend: boolean;
}) {
  const fieldStats = useMemo(() => {
    let pass = 0;
    let fail = 0;
    let na = 0;
    const failsBySection: Record<string, number> = {};
    const issues: OpenIssueRow[] = [];

    for (const sec of OSHA_FIELD_AUDIT_SECTIONS) {
      for (const it of sec.items) {
        const key = fieldItemKey(sec.id, it.id);
        const st = statusMap[key] ?? "";
        if (st === "pass") pass += 1;
        else if (st === "fail") {
          fail += 1;
          failsBySection[sec.title] = (failsBySection[sec.title] ?? 0) + 1;
          issues.push({
            id: `${key}-${issues.length}`,
            date: auditDate || new Date().toISOString().slice(0, 10),
            job: jobsite || "—",
            auditor: auditors || "—",
            category: it.label.slice(0, 48) + (it.label.length > 48 ? "…" : ""),
            pctOpen: "100%",
            openFindings: it.critical ? "Critical" : "Open",
          });
        } else if (st === "na") na += 1;
      }
    }

    const denom = pass + fail;
    const compliantPct = denom > 0 ? Math.round((pass / denom) * 100) : 0;

    const findingSlices = Object.entries(failsBySection).map(([label, value]) => ({
      label,
      value,
      color: COLORS[categoryBucket(label)],
    }));

    const statusSlices = [
      { label: "Compliant", value: pass, color: "#16a34a" },
      { label: "Needs action", value: fail, color: "#38bdf8" },
      { label: "N/A", value: na, color: "#a855f7" },
    ];

    return {
      pass,
      fail,
      na,
      compliantPct,
      findingSlices,
      statusSlices,
      issues: issues.slice(0, 10),
    };
  }, [auditDate, auditors, jobsite, statusMap]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-700 to-emerald-900 px-5 py-4 text-white shadow-md">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/90">
          Safety auditor dashboard
        </p>
        <h2 className="mt-1 text-2xl font-black tracking-tight">Field audit overview</h2>
        <p className="mt-1 max-w-2xl text-sm text-emerald-100/90">
          Charts reflect this device&apos;s saved checklist. Trend line fills in as you record monthly snapshots.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Audit compliance scores</h3>
          <p className="text-xs text-slate-500">Last {trendPoints.length} data points (max 12 months)</p>
          {demoTrend ? (
            <p className="mt-1 text-[11px] font-medium text-amber-700">
              Showing sample curve until you have two or more saved months.
            </p>
          ) : null}
          <div className="mt-4 flex justify-center">
            <LineTrendChart points={trendPoints} labels={trendLabels} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Findings by category</h3>
          <p className="text-xs text-slate-500">Failed items grouped by checklist section</p>
          <div className="mt-4">
            {fieldStats.findingSlices.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                No failures yet. Failures appear here by section (fall protection, PPE, excavation, cranes, etc.).
              </p>
            ) : (
              <PieChart slices={fieldStats.findingSlices} />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Audit status</h3>
          <p className="text-xs text-slate-500">All scored field audit items</p>
          <div className="mt-4">
            {fieldStats.pass + fieldStats.fail + fieldStats.na === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                Complete items in the field audit tab to populate this chart.
              </p>
            ) : (
              <>
                <PieChart slices={fieldStats.statusSlices} centerLabel={`${fieldStats.compliantPct}%`} />
                <p className="mt-2 text-center text-xs text-slate-500">
                  Pass rate on answered pass/fail items (N/A excluded from rate).
                </p>
              </>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-900">Open audit issues</h3>
          <p className="text-xs text-slate-500">Up to 10 failed line items from the current draft</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Job</th>
                  <th className="py-2 pr-3">Auditor</th>
                  <th className="py-2 pr-3">Finding</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {fieldStats.issues.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No failed items yet. Mark any line &quot;Fail&quot; in the field audit to populate this table.
                    </td>
                  </tr>
                ) : (
                  fieldStats.issues.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="py-2.5 pr-3 text-slate-600">{row.date}</td>
                      <td className="py-2.5 pr-3 font-medium text-slate-900">{row.job}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{row.auditor}</td>
                      <td className="py-2.5 pr-3 text-slate-800">{row.category}</td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            row.openFindings === "Critical"
                              ? "bg-red-100 text-red-800"
                              : "bg-sky-100 text-sky-800"
                          }`}
                        >
                          {row.openFindings}
                        </span>
                      </td>
                      <td className="py-2.5 text-emerald-700">
                        <button type="button" className="text-xs font-semibold underline">
                          Log CAPA
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export function buildDefaultTrend(): { points: number[]; labels: string[] } {
  const now = new Date();
  const labels: string[] = [];
  const points = [62, 64, 61, 68, 70, 73, 71, 76, 79, 81, 84, 87];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleString("en-US", { month: "short" }));
  }
  return { points, labels };
}
