"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  filterSafePredictPlatformActions,
  safePredictPlatformActionSections,
  type SafePredictPlatformAction,
  type SafePredictPlatformActionSection,
} from "@/lib/safePredictPlatformActions";
import { Card, PageHeader, SectionTitle, cx } from "@/components/safe-predict/SafePredictPrimitives";

const sourceLabels: Record<SafePredictPlatformAction["source"], string> = {
  company: "Company",
  admin: "Admin",
  superadmin: "Superadmin",
  platform: "Platform",
};

const sourceClasses: Record<SafePredictPlatformAction["source"], string> = {
  company: "border-blue-100 bg-blue-50 text-blue-700",
  admin: "border-amber-100 bg-amber-50 text-amber-700",
  superadmin: "border-red-100 bg-red-50 text-red-700",
  platform: "border-violet-100 bg-violet-50 text-violet-700",
};

function sourceIcon(source: SafePredictPlatformAction["source"]) {
  if (source === "company") return Building2;
  if (source === "platform") return Sparkles;
  if (source === "admin") return Lock;
  return ShieldCheck;
}

function actionDescription(action: SafePredictPlatformAction) {
  return action.description ?? action.primaryActionLabel ?? `Open ${action.label} in SafetyDoc360.`;
}

function sectionMatchesSource(
  section: SafePredictPlatformActionSection,
  source: SafePredictPlatformAction["source"] | "all"
) {
  return source === "all" || section.source === source;
}

export function SafePredictPlatformActions() {
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SafePredictPlatformAction["source"] | "all">("all");

  const sections = useMemo(() => {
    return safePredictPlatformActionSections
      .filter((section) => sectionMatchesSource(section, sourceFilter))
      .map((section) => ({
        ...section,
        items: filterSafePredictPlatformActions(section.items, query),
      }))
      .filter((section) => section.items.length > 0);
  }, [query, sourceFilter]);

  const totalActions = sections.reduce((sum, section) => sum + section.items.length, 0);

  return (
    <div className="min-h-[calc(100vh-5rem)] px-4 pb-8 sm:px-7">
      <PageHeader
        title="Platform Actions"
        subtitle="All operating functions routed through the SafetyDoc360 launch platform."
        actions={
          <div className="relative w-full min-w-0 sm:w-[420px]">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-12 pr-4 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
              placeholder="Search jobsites, permits, reports, users..."
              type="search"
            />
          </div>
        }
      />

      <Card className="mb-5 p-5">
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-blue-600">Operating system coverage</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
              {totalActions} actions available from SafetyDoc360
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
              These cards now route operational work into SafetyDoc360 first. Existing data and
              APIs remain connected behind the scenes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["company", "admin", "superadmin", "platform", "all"] as const).map((source) => (
              <button
                key={source}
                type="button"
                onClick={() => setSourceFilter(source)}
                className={cx(
                  "rounded-lg border px-3 py-2 text-xs font-black transition",
                  sourceFilter === source
                    ? "border-blue-500 bg-blue-600 text-white shadow-[0_10px_18px_rgba(37,99,235,0.22)]"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-200"
                )}
              >
                {source === "all" ? "All" : sourceLabels[source]}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="space-y-5">
        {sections.map((section) => {
          const Icon = sourceIcon(section.source);
          return (
            <Card key={`${section.source}-${section.title}`} className="p-5">
              <SectionTitle
                title={section.title}
                action={
                  <span className={cx("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black", sourceClasses[section.source])}>
                    <Icon className="h-3.5 w-3.5" />
                    {sourceLabels[section.source]}
                  </span>
                }
              />
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{section.description}</p>
              <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {section.items.map((action, actionIndex) => {
                  const ActionIcon = sourceIcon(action.source);
                  return (
                    <Link
                      key={`${section.source}-${section.title}-${action.href}-${actionIndex}`}
                      href={action.href}
                      className="group flex min-h-[132px] items-start gap-4 rounded-lg border border-slate-100 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-[0_14px_28px_rgba(15,23,42,0.1)] focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                    >
                      <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-lg border", sourceClasses[action.source])}>
                        <ActionIcon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-slate-950">{action.label}</span>
                        <span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">
                          {actionDescription(action)}
                        </span>
                        <span className="mt-3 inline-flex text-[10px] font-black uppercase tracking-wide text-blue-600">
                          {action.href}
                        </span>
                      </span>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-blue-600 transition group-hover:translate-x-0.5" />
                    </Link>
                  );
                })}
              </div>
            </Card>
          );
        })}

        {sections.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-lg font-black text-slate-950">No platform actions match that search.</p>
            <p className="mt-2 text-sm font-semibold text-slate-500">Clear the search or switch the action filter.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
