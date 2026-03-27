import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ShieldAlert,
  ThumbsUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SafetyObservationKpis } from "@/lib/safety-observations/types";

const items: Array<{
  key: keyof SafetyObservationKpis;
  label: string;
  icon: typeof Activity;
  accent: string;
}> = [
  {
    key: "totalObservations",
    label: "Total observations",
    icon: ClipboardList,
    accent: "border-sky-200 bg-sky-50/80 text-sky-900",
  },
  {
    key: "openHazards",
    label: "Open hazards",
    icon: AlertTriangle,
    accent: "border-amber-200 bg-amber-50/90 text-amber-950",
  },
  {
    key: "highCriticalOpen",
    label: "High / critical open",
    icon: ShieldAlert,
    accent: "border-red-200 bg-red-50/90 text-red-950",
  },
  {
    key: "positiveObservations",
    label: "Positive observations",
    icon: ThumbsUp,
    accent: "border-emerald-200 bg-emerald-50/90 text-emerald-950",
  },
  {
    key: "nearMisses",
    label: "Near misses",
    icon: Activity,
    accent: "border-violet-200 bg-violet-50/80 text-violet-950",
  },
  {
    key: "closedThisWeek",
    label: "Closed this week",
    icon: CheckCircle2,
    accent: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
  },
];

export function ObservationKpiCards({
  kpis,
  loading,
}: {
  kpis: SafetyObservationKpis;
  loading: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map(({ key, label, icon: Icon, accent }) => (
        <Card
          key={key}
          className={cn("overflow-hidden border shadow-sm transition hover:shadow-md", accent)}
        >
          <CardContent className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] opacity-80">{label}</span>
              <Icon className="size-5 shrink-0 opacity-70" aria-hidden />
            </div>
            <div className="text-3xl font-black tracking-tight">
              {loading ? <span className="text-slate-400">—</span> : kpis[key]}
            </div>
            <p className="text-[11px] font-medium leading-snug opacity-75">Window-scoped company metrics</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
