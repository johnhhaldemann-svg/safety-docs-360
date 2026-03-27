"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SafetyObservationRow } from "@/lib/safety-observations/types";

const COLORS = ["#0ea5e9", "#6366f1", "#f97316", "#22c55e", "#eab308", "#ef4444", "#8b5cf6"];

function weekKey(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((t.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function formatCat(s: string) {
  return s.replace(/_/g, " ");
}

function aggregate(rows: SafetyObservationRow[]) {
  const catCount = new Map<string, number>();
  const subCount = new Map<string, number>();
  const sevCount = new Map<string, number>();
  const trend = new Map<string, { opened: number; closed: number }>();

  for (const r of rows) {
    catCount.set(r.category, (catCount.get(r.category) ?? 0) + 1);
    const subKey = `${r.category}::${r.subcategory}`;
    subCount.set(subKey, (subCount.get(subKey) ?? 0) + 1);
    sevCount.set(r.severity, (sevCount.get(r.severity) ?? 0) + 1);

    const wk = weekKey(r.created_at);
    const t = trend.get(wk) ?? { opened: 0, closed: 0 };
    t.opened += 1;
    trend.set(wk, t);
  }
  for (const r of rows) {
    if (r.closed_at) {
      const wk = weekKey(r.closed_at);
      const t = trend.get(wk) ?? { opened: 0, closed: 0 };
      t.closed += 1;
      trend.set(wk, t);
    }
  }

  const topCategories = Array.from(catCount.entries())
    .map(([name, value]) => ({ name: formatCat(name), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const topSubcategories = Array.from(subCount.entries())
    .map(([key, value]) => {
      const [, sub] = key.split("::");
      return { name: formatCat(sub ?? key), value };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const severityData = Array.from(sevCount.entries()).map(([name, value]) => ({ name, value }));

  const trendData = Array.from(trend.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-10)
    .map(([week, v]) => ({ week, opened: v.opened, closed: v.closed }));

  const repeatIssues = Array.from(catCount.entries())
    .filter(([, c]) => c > 1)
    .map(([name, value]) => ({ name: formatCat(name), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return { topCategories, topSubcategories, severityData, trendData, repeatIssues };
}

export default function ObservationChartsInner({ rows }: { rows: SafetyObservationRow[] }) {
  const { topCategories, topSubcategories, severityData, trendData, repeatIssues } = aggregate(rows);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Top categories</CardTitle>
          <CardDescription>Volume by primary category</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topCategories} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#0ea5e9" radius={[0, 6, 6, 0]} name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Top subcategories</CardTitle>
          <CardDescription>Most frequent subcategory labels</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topSubcategories} margin={{ bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
              <XAxis dataKey="name" angle={-35} textAnchor="end" height={70} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Severity breakdown</CardTitle>
          <CardDescription>Distribution across severity levels</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={severityData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {severityData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Opened vs closed by week</CardTitle>
          <CardDescription>Items created vs closed per ISO week bucket</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="opened" stroke="#0ea5e9" strokeWidth={2} dot name="Opened" />
              <Line type="monotone" dataKey="closed" stroke="#22c55e" strokeWidth={2} dot name="Closed" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-sm xl:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Repeat issues by category</CardTitle>
          <CardDescription>Categories with more than one observation in the current dataset</CardDescription>
        </CardHeader>
        <CardContent className="h-[260px]">
          {repeatIssues.length === 0 ? (
            <p className="text-sm text-slate-500">No repeat categories yet in this view.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={repeatIssues} margin={{ bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                <XAxis dataKey="name" angle={-25} textAnchor="end" height={70} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#f97316" radius={[6, 6, 0, 0]} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
