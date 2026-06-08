"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Eye,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Card, PageHeader, SectionTitle, cx } from "@/components/safe-predict/SafePredictPrimitives";
import { BODY_PART_LABELS, type BodyPart } from "@/lib/incidents/bodyPart";
import { EXPOSURE_EVENT_TYPE_LABELS, type ExposureEventType } from "@/lib/incidents/exposureEventType";
import { INCIDENT_SOURCE_LABELS, type IncidentSource } from "@/lib/incidents/incidentSource";
import { INJURY_TYPE_LABELS, type InjuryType } from "@/lib/incidents/injuryType";
import { demoIncidentRows } from "@/lib/demoWorkspace";

const supabase = getSupabaseBrowserClient();

async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Missing auth token.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function isSalesDemoRequest(headers: HeadersInit) {
  const response = await fetch("/api/auth/me", { headers });
  const data = (await response.json().catch(() => null)) as {
    user?: { role?: string | null };
  } | null;
  return response.ok && data?.user?.role === "sales_demo";
}

type IncidentRow = {
  id: string;
  title: string;
  status: string;
  category: string;
  severity: string;
  injury_type?: InjuryType | null;
  body_part?: BodyPart | null;
  injury_source?: IncidentSource | null;
  exposure_event_type?: ExposureEventType | null;
  days_away_from_work?: number | null;
  days_restricted?: number | null;
  job_transfer?: boolean | null;
  recordable?: boolean | null;
  lost_time?: boolean | null;
  fatality?: boolean | null;
  idlh_flag?: boolean | null;
  sif_flag: boolean;
  escalation_level: string;
  stop_work_status: string;
  created_at: string;
  occurred_at?: string | null;
  injury_month?: number | null;
  injury_season?: string | null;
  injury_day_of_week?: string | null;
  injury_time_of_day?: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  closed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold capitalize",
        className
      )}
    >
      {label.replace(/_/g, " ")}
    </span>
  );
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-sm text-slate-700">{value ?? <span className="text-slate-400 italic">—</span>}</span>
    </div>
  );
}

const STATUS_ORDER = ["open", "in_progress", "closed"] as const;
const STATUS_ICONS: Record<string, React.ReactNode> = {
  open: <Clock className="h-3.5 w-3.5" />,
  in_progress: <RefreshCw className="h-3.5 w-3.5" />,
  closed: <CheckCircle2 className="h-3.5 w-3.5" />,
};

export default function IncidentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [incident, setIncident] = useState<IncidentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function loadIncident() {
      try {
        const headers = await getAuthHeaders();
        const isDemo = await isSalesDemoRequest(headers);

        if (isDemo) {
          const found = (demoIncidentRows as IncidentRow[]).find((r) => r.id === id) ?? null;
          if (!cancelled) {
            setIncident(found);
            setNotFound(!found);
            setLoading(false);
          }
          return;
        }

        const res = await fetch("/api/company/incidents", { headers });
        if (!res.ok) throw new Error("Failed to fetch incidents");
        const data = (await res.json()) as { incidents?: IncidentRow[] };
        const rows: IncidentRow[] = data.incidents ?? [];
        const found = rows.find((r) => r.id === id) ?? null;

        if (!cancelled) {
          setIncident(found);
          setNotFound(!found);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
      }
    }

    loadIncident();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleStatusChange(newStatus: string) {
    if (!incident || updating) return;
    setUpdating(true);
    setUpdateError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/company/incidents", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: incident.id, status: newStatus }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Failed to update status");
      }
      setIncident((prev) => (prev ? { ...prev, status: newStatus } : prev));
    } catch (e) {
      setUpdateError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading incident…</span>
        </div>
      </div>
    );
  }

  if (notFound || !incident) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-10 w-10 text-amber-400" />
        <p className="text-base font-semibold text-slate-600">Incident not found</p>
        <Link
          href="/safe-predict/incidents"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Incidents
        </Link>
      </div>
    );
  }

  const occurredDate = incident.occurred_at
    ? new Date(incident.occurred_at).toLocaleString()
    : null;
  const createdDate = new Date(incident.created_at).toLocaleString();

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      {/* Back link */}
      <Link
        href="/safe-predict/incidents"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Incidents
      </Link>

      {/* Page heading */}
      <PageHeader title={incident.title} />

      {/* Badge strip */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          label={incident.status}
          className={STATUS_STYLES[incident.status] ?? "bg-slate-100 text-slate-600 border-slate-200"}
        />
        <Badge
          label={incident.severity}
          className={SEVERITY_STYLES[incident.severity] ?? "bg-slate-100 text-slate-600 border-slate-200"}
        />
        {incident.sif_flag && (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
            <ShieldAlert className="h-3 w-3" />
            SIF
          </span>
        )}
        {incident.stop_work_status === "active" && (
          <span className="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-700">
            <AlertTriangle className="h-3 w-3" />
            Stop Work Active
          </span>
        )}
        {incident.fatality && (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-400 bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800">
            Fatality
          </span>
        )}
        {incident.idlh_flag && (
          <span className="inline-flex items-center gap-1 rounded-full border border-purple-300 bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700">
            <Eye className="h-3 w-3" />
            IDLH
          </span>
        )}
      </div>

      {/* Main detail card */}
      <Card>
        <SectionTitle>Incident Details</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          <DetailItem label="Category" value={incident.category} />
          <DetailItem label="Severity" value={incident.severity} />
          <DetailItem label="Status" value={incident.status.replace(/_/g, " ")} />
          <DetailItem label="Escalation Level" value={incident.escalation_level} />
          <DetailItem label="Occurred At" value={occurredDate} />
          <DetailItem label="Created At" value={createdDate} />
          <DetailItem
            label="OSHA Recordable"
            value={
              incident.recordable == null ? null : incident.recordable ? (
                <span className="font-semibold text-red-600">Yes</span>
              ) : (
                "No"
              )
            }
          />
          <DetailItem
            label="Lost Time"
            value={
              incident.lost_time == null ? null : incident.lost_time ? (
                <span className="font-semibold text-amber-600">Yes</span>
              ) : (
                "No"
              )
            }
          />
          <DetailItem
            label="Days Away From Work"
            value={
              incident.days_away_from_work != null
                ? incident.days_away_from_work.toString()
                : null
            }
          />
          <DetailItem
            label="Days Restricted"
            value={
              incident.days_restricted != null ? incident.days_restricted.toString() : null
            }
          />
          {incident.injury_type && (
            <DetailItem
              label="Injury Type"
              value={INJURY_TYPE_LABELS[incident.injury_type] ?? incident.injury_type}
            />
          )}
          {incident.body_part && (
            <DetailItem
              label="Body Part"
              value={BODY_PART_LABELS[incident.body_part] ?? incident.body_part}
            />
          )}
          {incident.injury_source && (
            <DetailItem
              label="Injury Source"
              value={INCIDENT_SOURCE_LABELS[incident.injury_source] ?? incident.injury_source}
            />
          )}
          {incident.exposure_event_type && (
            <DetailItem
              label="Exposure Event Type"
              value={
                EXPOSURE_EVENT_TYPE_LABELS[incident.exposure_event_type] ??
                incident.exposure_event_type
              }
            />
          )}
        </div>
      </Card>

      {/* Status update card */}
      <Card>
        <SectionTitle>Update Status</SectionTitle>
        <div className="mt-4 flex flex-wrap gap-2">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              disabled={incident.status === s || updating}
              onClick={() => handleStatusChange(s)}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-opacity",
                STATUS_STYLES[s] ?? "bg-slate-100 text-slate-600 border-slate-200",
                incident.status === s
                  ? "ring-2 ring-offset-1 ring-blue-400 opacity-100"
                  : "opacity-70 hover:opacity-100",
                (updating || incident.status === s) ? "cursor-default" : "cursor-pointer"
              )}
            >
              {STATUS_ICONS[s]}
              {s.replace(/_/g, " ")}
              {incident.status === s && " (current)"}
            </button>
          ))}
        </div>
        {updating && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Saving…
          </p>
        )}
        {updateError && (
          <p className="mt-2 text-xs font-medium text-red-600">{updateError}</p>
        )}
      </Card>

      {/* Corrective action cross-link */}
      <Card>
        <SectionTitle>Corrective Actions</SectionTitle>
        <p className="mt-2 text-sm text-slate-500">
          Track corrective actions linked to this incident in the Corrective Actions module.
        </p>
        <div className="mt-4">
          <Link
            href="/safe-predict/corrective-actions"
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Create Corrective Action for this Incident
          </Link>
        </div>
      </Card>
    </div>
  );
}
