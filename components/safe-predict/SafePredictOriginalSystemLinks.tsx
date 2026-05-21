"use client";

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  FileCheck,
  FileText,
  GraduationCap,
  HardHat,
  Link2,
  MapPinned,
  Settings,
  Users,
} from "lucide-react";
import { Card, SectionTitle, cx } from "@/components/safe-predict/SafePredictPrimitives";
import { mapSafePredictSurfaceHref } from "@/lib/safePredictRouteMap";
import type { SafePredictWorkspaceSlug } from "@/lib/safePredictWorkspaceConfig";

type OriginalSystemLink = {
  href: string;
  label: string;
  detail: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone: "blue" | "green" | "amber" | "red" | "purple";
};

const toneClasses: Record<OriginalSystemLink["tone"], string> = {
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  green: "bg-emerald-50 text-emerald-600 border-emerald-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
  red: "bg-red-50 text-red-600 border-red-100",
  purple: "bg-violet-50 text-violet-600 border-violet-100",
};

const originalSystemLinks: Record<SafePredictWorkspaceSlug | "risk-mitigation", OriginalSystemLink[]> = {
  incidents: [
    { href: "/incidents", label: "Incident Log", detail: "Review incident response records inside SafetyDoc360.", icon: AlertTriangle, tone: "red" },
    { href: "/field-audits", label: "Field Audits", detail: "Review observations and audit findings in the new operating view.", icon: FileCheck, tone: "amber" },
    { href: "/reports", label: "Reports", detail: "Open report-ready incident summaries.", icon: BarChart3, tone: "blue" },
  ],
  "corrective-actions": [
    { href: "/field-id-exchange", label: "Field Issues", detail: "Track corrective actions and field issue follow-up in SafetyDoc360.", icon: ClipboardCheck, tone: "blue" },
    { href: "/jobsites", label: "Job Sites", detail: "Open the project command center tied to each action.", icon: MapPinned, tone: "green" },
    { href: "/reports", label: "Reports", detail: "Send action status into leadership reporting.", icon: BarChart3, tone: "purple" },
  ],
  inspections: [
    { href: "/field-audits", label: "Field Audits", detail: "Run inspections and review audit findings.", icon: FileCheck, tone: "amber" },
    { href: "/jobsites", label: "Job Sites", detail: "Open site-specific inspection context.", icon: HardHat, tone: "green" },
    { href: "/reports", label: "Reports", detail: "Export inspection and audit summaries.", icon: BarChart3, tone: "blue" },
  ],
  training: [
    { href: "/training-matrix", label: "Training Tracker", detail: "Use the existing training readiness matrix.", icon: GraduationCap, tone: "green" },
    { href: "/training", label: "Platform Training", detail: "Open existing training resources.", icon: FileText, tone: "blue" },
    { href: "/company-inductions", label: "Inductions", detail: "Manage jobsite induction requirements.", icon: Users, tone: "purple" },
  ],
  permits: [
    { href: "/permits", label: "Permit Center", detail: "Use the original permit workflow.", icon: FileText, tone: "amber" },
    { href: "/jsa", label: "JSA Builder", detail: "Connect permits to pre-task planning.", icon: ClipboardCheck, tone: "blue" },
    { href: "/jobsites", label: "Job Sites", detail: "Open permit activity by project.", icon: MapPinned, tone: "green" },
  ],
  documents: [
    { href: "/csep", label: "CSEP Build", detail: "Build and review construction safety execution plans.", icon: FileText, tone: "blue" },
    { href: "/peshep", label: "PESHEP Build", detail: "Prepare site-specific health and safety plans.", icon: FileCheck, tone: "green" },
    { href: "/reports", label: "Reports", detail: "Package controlled documents into reporting workflows.", icon: BarChart3, tone: "purple" },
  ],
  reports: [
    { href: "/reports", label: "Reports", detail: "Open the existing reporting center.", icon: BarChart3, tone: "blue" },
    { href: "/analytics", label: "Safety Analytics", detail: "Review deeper safety metrics.", icon: FileCheck, tone: "purple" },
    { href: "/analytics/predictive-model", label: "Predictive Model", detail: "Compare against the original model lab.", icon: Link2, tone: "green" },
  ],
  settings: [
    { href: "/company-integrations", label: "Apps & Integrations", detail: "Install connected apps and data sources.", icon: Link2, tone: "purple" },
    { href: "/company-users", label: "Team & Access", detail: "Manage users and permissions.", icon: Users, tone: "blue" },
    { href: "/settings/risk-memory", label: "Risk Memory", detail: "Open existing risk memory setup.", icon: Settings, tone: "green" },
  ],
  "risk-mitigation": [
    { href: "/field-id-exchange", label: "Field Issues", detail: "Send actions into the existing field issue flow.", icon: ClipboardCheck, tone: "blue" },
    { href: "/incidents", label: "Incident Log", detail: "Open related incidents without leaving the product.", icon: AlertTriangle, tone: "red" },
    { href: "/permits", label: "Permit Center", detail: "Check active permits tied to this risk.", icon: FileText, tone: "amber" },
    { href: "/training-matrix", label: "Training Tracker", detail: "Review readiness gaps behind this risk.", icon: GraduationCap, tone: "green" },
  ],
  observations: [
    { href: "/field-audits", label: "Field Audits", detail: "Review audit observations and close out findings.", icon: FileCheck, tone: "amber" },
    { href: "/field-id-exchange", label: "Field Issues", detail: "Convert observations into corrective actions.", icon: ClipboardCheck, tone: "blue" },
    { href: "/safety-submit", label: "Safety Submit", detail: "Open the existing field submission workflow.", icon: FileText, tone: "green" },
  ],
  hazards: [
    { href: "/safety-intelligence", label: "Safety Intelligence", detail: "Review hazard controls and generated guidance.", icon: Link2, tone: "purple" },
    { href: "/field-id-exchange", label: "Field Issues", detail: "Create or track hazard-related corrective actions.", icon: ClipboardCheck, tone: "blue" },
    { href: "/field-audits", label: "Field Audits", detail: "Validate hazard controls in the field.", icon: FileCheck, tone: "amber" },
  ],
  analytics: [
    { href: "/analytics", label: "Safety Analytics", detail: "Open the existing analytics workspace.", icon: BarChart3, tone: "blue" },
    { href: "/analytics/predictive-model", label: "Predictive Model", detail: "Compare SafetyDoc360 forecasts against model lab trends.", icon: Link2, tone: "green" },
    { href: "/reports", label: "Reports", detail: "Package analytics into leadership reporting.", icon: FileText, tone: "purple" },
  ],
};

export function SafePredictOriginalSystemLinks({
  workspace,
  compact = false,
}: {
  workspace: SafePredictWorkspaceSlug | "risk-mitigation";
  compact?: boolean;
}) {
  const links = originalSystemLinks[workspace];

  return (
    <Card className={cx("p-5", compact ? "border-blue-100 bg-blue-50/35 shadow-none" : undefined)}>
      <SectionTitle title="Connected SafetyDoc360 Workflows" />
      <div className={cx("mt-4 grid gap-3", compact ? "lg:grid-cols-2" : "xl:grid-cols-2 2xl:grid-cols-3")}>
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => window.location.assign(mapSafePredictSurfaceHref(item.href))}
              className="group flex w-full items-center gap-3 rounded-lg border border-slate-100 bg-white p-3 text-left shadow-sm transition hover:border-blue-200 hover:shadow-[0_12px_22px_rgba(15,23,42,0.08)]"
              aria-label={`Open ${item.label} in SafetyDoc360`}
            >
              <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-lg border", toneClasses[item.tone])}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-slate-950">{item.label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-600">{item.detail}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-blue-600 transition group-hover:translate-x-0.5" aria-hidden />
            </button>
          );
        })}
      </div>
    </Card>
  );
}
