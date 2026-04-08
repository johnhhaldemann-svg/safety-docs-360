"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
} from "@/components/WorkspacePrimitives";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ReportRow = {
  id: string;
  title: string;
  report_type: string;
  status: string;
  jobsite_id?: string | null;
  generated_at: string | null;
  created_at: string;
  file_path?: string | null;
};

type ReportAttachmentRow = {
  id: string;
  report_id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  created_at: string;
};

type GeneratedReportPayload = {
  metrics?: {
    totals?: Record<string, number>;
    status?: Record<string, number>;
    kpis?: Record<string, number>;
    topHazardCategories?: Array<{ category: string; count: number }>;
  };
  file_path?: string | null;
};

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

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [latestGenerated, setLatestGenerated] = useState<GeneratedReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<"daily_report" | "weekly_summary" | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">(
    "neutral"
  );
  const [uploadingReportId, setUploadingReportId] = useState<string | null>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<Record<string, File | null>>({});
  const [attachmentsByReport, setAttachmentsByReport] = useState<Record<string, ReportAttachmentRow[]>>({});
  const [jobsiteId, setJobsiteId] = useState("");
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const [narrative, setNarrative] = useState("");
  const [openingPath, setOpeningPath] = useState<string | null>(null);

  async function loadReports() {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/company/reports", { headers });
      const data = (await response.json().catch(() => null)) as { reports?: ReportRow[]; error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to load reports.");
      setReports(data?.reports ?? []);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to load reports.");
      setReports([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadReports();
  }, []);

  async function loadAttachments(reportId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/company/reports/${reportId}/attachments`, { headers });
    const data = (await response.json().catch(() => null)) as
      | { attachments?: ReportAttachmentRow[]; error?: string }
      | null;
    if (!response.ok) throw new Error(data?.error || "Failed to load report attachments.");
    setAttachmentsByReport((prev) => ({ ...prev, [reportId]: data?.attachments ?? [] }));
  }

  async function generateReport(reportType: "daily_report" | "weekly_summary") {
    setGenerating(reportType);
    setMessage("");
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/company/reports", {
        method: "POST",
        headers,
        body: JSON.stringify({ reportType }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        generatedReport?: GeneratedReportPayload;
      } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to generate report.");
      setLatestGenerated(data?.generatedReport ?? null);
      setMessageTone("success");
      setMessage(reportType === "daily_report" ? "Daily report generated." : "Weekly summary generated.");
      await loadReports();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to generate report.");
    }
    setGenerating(null);
  }

  async function generateEndOfDayReport() {
    setGenerating("daily_report");
    setMessage("");
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/company/reports", {
        method: "POST",
        headers,
        body: JSON.stringify({
          reportType: "end_of_day",
          jobsiteId: jobsiteId.trim() || null,
          workDate,
          narrative: narrative.trim() || null,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        generatedReport?: GeneratedReportPayload;
      } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to generate end-of-day report.");
      setLatestGenerated(data?.generatedReport ?? null);
      setMessageTone("success");
      setMessage("End-of-day report generated and saved to the jobsite record.");
      await loadReports();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to generate end-of-day report.");
    } finally {
      setGenerating(null);
    }
  }

  async function openStoredFile(path: string) {
    setOpeningPath(path);
    try {
      const signed = await supabase.storage.from("documents").createSignedUrl(path, 60);
      if (signed.error || !signed.data?.signedUrl) {
        throw new Error(signed.error?.message || "Failed to open exported report file.");
      }
      window.open(signed.data.signedUrl, "_blank");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to open file.");
    } finally {
      setOpeningPath(null);
    }
  }

  async function uploadReportAttachment(report: ReportRow) {
    const file = attachmentFiles[report.id];
    if (!file) {
      setMessageTone("warning");
      setMessage("Choose a file before attaching it to this report.");
      return;
    }
    setUploadingReportId(report.id);
    setMessage("");
    try {
      const headers = await getAuthHeaders();
      const uploadInitResponse = await fetch(`/api/company/reports/${report.id}/attachments/upload-url`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
        }),
      });
      const uploadInit = (await uploadInitResponse.json().catch(() => null)) as
        | { error?: string; path?: string; token?: string; bucket?: string }
        | null;
      if (!uploadInitResponse.ok || !uploadInit?.path || !uploadInit?.token) {
        throw new Error(uploadInit?.error || "Failed to initialize report attachment upload.");
      }
      const uploadResult = await supabase.storage
        .from(uploadInit.bucket || "documents")
        .uploadToSignedUrl(uploadInit.path, uploadInit.token, file);
      if (uploadResult.error) {
        throw new Error(uploadResult.error.message || "Report attachment upload failed.");
      }
      const attachResponse = await fetch(`/api/company/reports/${report.id}/attachments`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          filePath: uploadInit.path,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
        }),
      });
      const attachPayload = (await attachResponse.json().catch(() => null)) as { error?: string } | null;
      if (!attachResponse.ok) throw new Error(attachPayload?.error || "Failed to attach uploaded report file.");
      setAttachmentFiles((prev) => ({ ...prev, [report.id]: null }));
      setMessageTone("success");
      setMessage("Report attachment uploaded and linked successfully.");
      await loadAttachments(report.id);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to upload report attachment.");
    } finally {
      setUploadingReportId(null);
    }
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Company Board"
        title="Reports"
        description="Generate daily and weekly summaries from live safety data."
        actions={
          <>
            <button
              type="button"
              onClick={() => void loadReports()}
              className="rounded-xl border border-sky-500/35 bg-sky-950/35 px-5 py-3 text-sm font-semibold text-sky-300 transition hover:bg-sky-100"
            >
              {loading ? "Refreshing..." : "Refresh Reports"}
            </button>
            <Link
              href="/analytics"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Open Analytics
            </Link>
            <Link
              href="/field-id-exchange"
              className="rounded-xl border border-slate-600 bg-slate-900/90 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Open Field iD Exchange
            </Link>
          </>
        }
      />

      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}
      <InlineMessage tone="neutral">
        Reports update on demand. Click Refresh Reports when you want the latest data.
      </InlineMessage>

      <section className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Generate Reports" description="Run summaries on demand.">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => void generateReport("daily_report")}
              disabled={generating !== null}
              className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {generating === "daily_report" ? "Generating..." : "Generate Daily Report"}
            </button>
            <button
              onClick={() => void generateReport("weekly_summary")}
              disabled={generating !== null}
              className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 disabled:opacity-60"
            >
              {generating === "weekly_summary" ? "Generating..." : "Generate Weekly Summary"}
            </button>
          </div>
          <div className="mt-5 space-y-3 rounded-xl border border-slate-700/80 bg-slate-950/50 p-4">
            <div className="text-sm font-semibold text-slate-100">End-of-Day Report</div>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="text"
                value={jobsiteId}
                onChange={(event) => setJobsiteId(event.target.value)}
                placeholder="Jobsite ID (optional)"
                className="rounded-xl border border-slate-600 bg-slate-900/90 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={workDate}
                onChange={(event) => setWorkDate(event.target.value)}
                className="rounded-xl border border-slate-600 bg-slate-900/90 px-3 py-2 text-sm"
              />
            </div>
            <textarea
              value={narrative}
              onChange={(event) => setNarrative(event.target.value)}
              rows={3}
              placeholder="Optional summary note"
              className="w-full rounded-xl border border-slate-600 bg-slate-900/90 px-3 py-2 text-sm"
            />
            <button
              onClick={() => void generateEndOfDayReport()}
              disabled={generating !== null}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {generating !== null ? "Generating..." : "Generate End-of-Day Report"}
            </button>
          </div>
        </SectionCard>
        <SectionCard title="Latest Report Output" description="Most recent report output.">
          {!latestGenerated?.metrics ? (
            <InlineMessage tone="neutral">Generate a report to view the latest metrics.</InlineMessage>
          ) : (
            <div className="space-y-3 text-sm text-slate-300">
              <div>
                <span className="font-semibold">Totals:</span>{" "}
                {Object.entries(latestGenerated.metrics.totals ?? {})
                  .map(([key, value]) => `${key} ${value}`)
                  .join(" · ")}
              </div>
              <div>
                <span className="font-semibold">Status:</span>{" "}
                {Object.entries(latestGenerated.metrics.status ?? {})
                  .map(([key, value]) => `${key} ${value}`)
                  .join(" · ")}
              </div>
              <div>
                <span className="font-semibold">KPIs:</span>{" "}
                {Object.entries(latestGenerated.metrics.kpis ?? {})
                  .map(([key, value]) => `${key} ${value}`)
                  .join(" · ")}
              </div>
            </div>
          )}
        </SectionCard>
      </section>

      <SectionCard title="Report History" description="Generated daily and weekly reports.">
        {loading ? (
          <InlineMessage>Loading reports...</InlineMessage>
        ) : reports.length === 0 ? (
          <InlineMessage tone="neutral">No reports generated yet.</InlineMessage>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div key={report.id} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{report.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {report.report_type} · {report.generated_at ? new Date(report.generated_at).toLocaleString() : "Not generated"}
                    </div>
                  </div>
                  <StatusBadge label={report.status} tone={report.status === "published" ? "success" : "info"} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {report.file_path ? (
                    <button
                      onClick={() => void openStoredFile(report.file_path as string)}
                      disabled={openingPath === report.file_path}
                      className="rounded-lg border border-emerald-300 bg-emerald-950/35 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-60"
                    >
                      {openingPath === report.file_path ? "Opening..." : "Open Export"}
                    </button>
                  ) : null}
                  <input
                    type="file"
                    onChange={(event) =>
                      setAttachmentFiles((prev) => ({
                        ...prev,
                        [report.id]: event.target.files?.[0] ?? null,
                      }))
                    }
                    className="rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-2 text-xs"
                  />
                  <button
                    onClick={() => void uploadReportAttachment(report)}
                    disabled={uploadingReportId === report.id}
                    className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {uploadingReportId === report.id ? "Uploading..." : "Attach File"}
                  </button>
                  <button
                    onClick={() => void loadAttachments(report.id)}
                    className="rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-300"
                  >
                    Refresh Attachments
                  </button>
                </div>
                {(attachmentsByReport[report.id] ?? []).length > 0 ? (
                  <div className="mt-3 space-y-1 text-xs text-slate-400">
                    {(attachmentsByReport[report.id] ?? []).slice(0, 3).map((attachment) => (
                      <div key={attachment.id}>
                        {attachment.file_name} · {new Date(attachment.created_at).toLocaleString()}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}


