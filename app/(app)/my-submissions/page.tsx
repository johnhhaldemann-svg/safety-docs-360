"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
} from "@/components/WorkspacePrimitives";
import {
  getDocumentStatusLabel,
  getDocumentStatusTone,
  isApprovedDocumentStatus,
  isSubmittedDocumentStatus,
} from "@/lib/documentStatus";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type SubmissionRow = {
  id: string;
  created_at: string;
  title: string | null;
  service_type: string | null;
  status: string | null;
  customer_notes: string | null;
};

function formatRelative(timestamp?: string | null) {
  if (!timestamp) return "Recently";
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export default function MySubmissionsPage() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setMessage("You must be logged in to view your submissions.");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("submissions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          setMessage(error.message);
        } else {
          setSubmissions((data ?? []) as SubmissionRow[]);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load submissions.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(
    () => ({
      total: submissions.length,
      submitted: submissions.filter((item) => isSubmittedDocumentStatus(item.status)).length,
      approved: submissions.filter((item) => isApprovedDocumentStatus(item.status)).length,
    }),
    [submissions]
  );

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Submission Tracking"
        title="My Submissions"
        description="Track requests you’ve sent into the workflow and see which ones are still in review versus completed."
        actions={
          <>
            <Link
              href="/submit"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              New Submission
            </Link>
            <Link
              href="/library"
              className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Open Library
            </Link>
          </>
        }
      />

      <section className="grid gap-5 sm:grid-cols-3">
        <StatCard title="Total Requests" value={String(stats.total)} note="All submissions on record" />
        <StatCard title="In Review" value={String(stats.submitted)} note="Still waiting on admin action" />
        <StatCard title="Approved" value={String(stats.approved)} note="Finished requests" />
      </section>

      {message ? <InlineMessage tone="error">{message}</InlineMessage> : null}

      <SectionCard
        title="Submission History"
        description="Your recent requests and their current status."
      >
        {loading ? (
          <InlineMessage>Loading submissions...</InlineMessage>
        ) : submissions.length === 0 ? (
          <EmptyState
            title="No submissions yet"
            description="Start with a new request to send files into review."
            actionHref="/submit"
            actionLabel="Create Submission"
          />
        ) : (
          <div className="space-y-4">
            {submissions.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold text-slate-100">
                      {item.title || "Untitled submission"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-sky-950/35 px-3 py-1 text-xs font-semibold text-sky-300">
                        {item.service_type || "General"}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getDocumentStatusTone(item.status)}`}
                      >
                        {getDocumentStatusLabel(item.status)}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    {formatRelative(item.created_at)}
                  </div>
                </div>
                <div className="mt-4 text-sm leading-6 text-slate-400">
                  {item.customer_notes || "No notes were added to this request."}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function StatCard({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 text-4xl font-bold tracking-tight text-slate-100">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{note}</p>
    </div>
  );
}
