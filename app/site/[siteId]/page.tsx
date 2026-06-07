"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ShieldCheck, Phone, AlertTriangle, MapPin, Clock, ChevronDown, ChevronUp } from "lucide-react";

type SiteData = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  status: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  company: { name: string; logo_url: string | null } | null;
  activeHazards: Array<{
    id: string;
    title: string;
    severity: string;
    description: string | null;
  }>;
  recentNotices: Array<{
    id: string;
    title: string;
    created_at: string;
  }>;
};

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-100 text-red-800 border-red-200",
    high: "bg-orange-100 text-orange-800 border-orange-200",
    medium: "bg-amber-100 text-amber-800 border-amber-200",
    low: "bg-blue-100 text-blue-700 border-blue-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${colors[severity] ?? colors.low}`}>
      {severity}
    </span>
  );
}

export default function PublicSitePage() {
  const params = useParams<{ siteId: string }>();
  const siteId = params?.siteId ?? "";

  const [site, setSite] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hazardsExpanded, setHazardsExpanded] = useState(true);
  const [reportSent, setReportSent] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    fetch(`/api/public/site/${encodeURIComponent(siteId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setSite(data.site as SiteData);
      })
      .catch(() => setError("Could not load site information."))
      .finally(() => setLoading(false));
  }, [siteId]);

  async function handleReport(e: React.FormEvent) {
    e.preventDefault();
    if (!reportText.trim() || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      const res = await fetch(`/api/public/site/${encodeURIComponent(siteId)}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reportText.trim() }),
      });
      if (res.ok) {
        setReportSent(true);
        setReportText("");
      }
    } catch {
      // silent
    } finally {
      setReportSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-400 text-sm">Loading site information…</div>
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6">
        <ShieldCheck className="h-12 w-12 text-slate-300" />
        <h1 className="text-lg font-bold text-slate-700">Site not found</h1>
        <p className="text-sm text-slate-500">{error ?? "This QR code may be expired or inactive."}</p>
      </div>
    );
  }

  const locationParts = [site.address, site.city, site.state].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5 shadow-sm">
        <div className="mx-auto max-w-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {site.company?.name ?? "SafetyDocs360"}
              </p>
              <h1 className="text-lg font-bold text-slate-900">{site.name}</h1>
            </div>
          </div>
          {locationParts && (
            <div className="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{locationParts}</span>
            </div>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            <span>Check-in: {new Date().toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-6 py-6">
        {/* Emergency contact */}
        {(site.emergency_contact_name || site.emergency_contact_phone) && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-bold text-red-800">Emergency Contact</p>
                {site.emergency_contact_name && (
                  <p className="text-sm text-red-700">{site.emergency_contact_name}</p>
                )}
                {site.emergency_contact_phone && (
                  <a
                    href={`tel:${site.emergency_contact_phone}`}
                    className="mt-1 inline-block text-lg font-bold text-red-700 underline"
                  >
                    {site.emergency_contact_phone}
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Active hazards */}
        {site.activeHazards.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-white shadow-sm">
            <button
              onClick={() => setHazardsExpanded((v) => !v)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <span className="font-bold text-slate-800">
                  Active Hazards ({site.activeHazards.length})
                </span>
              </div>
              {hazardsExpanded ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>
            {hazardsExpanded && (
              <div className="divide-y divide-slate-100 border-t border-slate-100">
                {site.activeHazards.map((h) => (
                  <div key={h.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">{h.title}</p>
                      <SeverityBadge severity={h.severity} />
                    </div>
                    {h.description && (
                      <p className="mt-1 text-xs text-slate-500">{h.description.slice(0, 200)}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Safety notices */}
        {site.recentNotices.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-bold text-slate-700">Recent Safety Notices</p>
            </div>
            <div className="divide-y divide-slate-100">
              {site.recentNotices.map((n) => (
                <div key={n.id} className="px-4 py-3">
                  <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {new Date(n.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Report a hazard */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-700">Report a Hazard or Near-Miss</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Anonymous — your report goes directly to the safety team.
            </p>
          </div>
          <div className="p-4">
            {reportSent ? (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
                <p className="text-sm font-bold text-emerald-700">✅ Report received!</p>
                <p className="mt-1 text-xs text-emerald-600">Your safety team has been notified.</p>
                <button
                  onClick={() => setReportSent(false)}
                  className="mt-2 text-xs text-emerald-600 underline"
                >
                  Submit another
                </button>
              </div>
            ) : (
              <form onSubmit={handleReport} className="space-y-3">
                <textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="Describe what you saw — location, condition, any injuries…"
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={!reportText.trim() || reportSubmitting}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 active:bg-blue-700"
                >
                  {reportSubmitting ? "Sending…" : "Send Report"}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 pb-4">
          Powered by SafetyDocs360 · {site.company?.name}
        </p>
      </div>
    </div>
  );
}
