"use client";

import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useState } from "react";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  StartChecklist,
  WorkflowPath,
} from "@/components/WorkspacePrimitives";
import { useCompanyWorkspaceData } from "@/components/company-workspace/useCompanyWorkspaceData";

const supabase = getSupabaseBrowserClient();

async function getAuthHeaders() {
  const sessionResult = await supabase.auth.getSession();
  const accessToken = sessionResult.data.session?.access_token;
  if (!accessToken) {
    throw new Error("Missing auth token.");
  }
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

type SubmissionState = {
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  category:
    | "hazard"
    | "near_miss"
    | "incident"
    | "good_catch"
    | "ppe_violation"
    | "housekeeping"
    | "equipment_issue"
    | "fall_hazard"
    | "electrical_hazard"
    | "excavation_trench_concern"
    | "fire_hot_work_concern"
    | "corrective_action";
  jobsiteId: string;
  photo: File | null;
};

const EMPTY_SUBMISSION: SubmissionState = {
  title: "",
  description: "",
  severity: "medium",
  category: "hazard",
  jobsiteId: "",
  photo: null,
};

export default function SafetySubmitPage() {
  const { jobsites } = useCompanyWorkspaceData();
  const [submission, setSubmission] = useState<SubmissionState>(EMPTY_SUBMISSION);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">(
    "neutral"
  );

  const checklistItems = [
    { label: "Add a clear issue title", done: submission.title.trim().length > 0 },
    { label: "Add field details", done: submission.description.trim().length > 0 },
    { label: "Select severity and issue category", done: Boolean(submission.severity && submission.category) },
    { label: "Attach optional photo proof", done: true },
  ];

  const workflowSteps = [
    {
      label: "Safety submission",
      detail: "Individual field concern is submitted separately from review requests.",
      active: true,
      complete: false,
    },
    {
      label: "Company admin review",
      detail: "Submission is reviewed and then updated as Open or Closed with issue category.",
      active: false,
      complete: false,
    },
    {
      label: "Assign and due date",
      detail: "Managers assign ownership and set closure timeline in Field iD Exchange.",
      active: false,
      complete: false,
    },
  ];

  async function handleSubmit() {
    if (!submission.title.trim()) {
      setMessage("Issue title is required.");
      setMessageTone("warning");
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      let photoPath: string | undefined;
      if (submission.photo) {
        const safeFileName = `${Date.now()}-${submission.photo.name.replace(/\s+/g, "-")}`;
        const uploadPath = `safety-submissions/${safeFileName}`;
        const uploadResult = await supabase.storage
          .from("documents")
          .upload(uploadPath, submission.photo, { upsert: false });

        if (uploadResult.error) {
          setMessage(`Photo upload failed: ${uploadResult.error.message}`);
          setMessageTone("error");
          setSubmitting(false);
          return;
        }

        photoPath = uploadResult.data?.path ?? uploadPath;
      }

      const response = await fetch("/api/company/safety-submissions", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          title: submission.title,
          description: submission.description,
          severity: submission.severity,
          category: submission.category,
          jobsiteId: submission.jobsiteId || undefined,
          photoPath,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string; actionId?: string }
        | null;
      if (!response.ok) {
        setMessage(payload?.error || "Failed to submit safety issue.");
        setMessageTone("error");
        setSubmitting(false);
        return;
      }

      setSubmission(EMPTY_SUBMISSION);
      setMessage(
        payload?.message ||
          "Safety issue submitted and queued for company admin review."
      );
      setMessageTone("success");
    } catch (error) {
      console.error("Failed to submit safety issue:", error);
      setMessage("Failed to submit safety issue right now.");
      setMessageTone("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Field Safety Intake"
        title="Individual Safety Submission"
        description="Submit site hazards in a dedicated flow separate from review requests. Company admins review each one and update issue status and category."
        actions={
          <>
            <Link
              href="/field-id-exchange"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Open Field iD Exchange
            </Link>
            <Link
              href="/submit"
              className="rounded-xl border border-slate-600 bg-slate-900/90 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Normal Review Request
            </Link>
          </>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Safety Submission Form"
          description="This is separate from standard review requests and creates a corrective action automatically."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Issue title
              </label>
              <input
                type="text"
                value={submission.title}
                onChange={(event) =>
                  setSubmission((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Forklift path blocked near north exit"
                className="mt-2 w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Description
              </label>
              <textarea
                rows={4}
                value={submission.description}
                onChange={(event) =>
                  setSubmission((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Describe what was observed, where, and any immediate risk."
                className="mt-2 w-full rounded-2xl border border-slate-600 px-4 py-3 text-sm leading-6 text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Severity
              </label>
              <select
                value={submission.severity}
                onChange={(event) =>
                  setSubmission((current) => ({
                    ...current,
                    severity: event.target.value as SubmissionState["severity"],
                  }))
                }
                className="mt-2 w-full rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 outline-none focus:border-sky-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Issue Category
              </label>
              <select
                value={submission.category}
                onChange={(event) =>
                  setSubmission((current) => ({
                    ...current,
                    category: event.target.value as SubmissionState["category"],
                  }))
                }
                className="mt-2 w-full rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 outline-none focus:border-sky-500"
              >
                <option value="hazard">Hazard</option>
                <option value="near_miss">Near Miss</option>
                <option value="incident">Incident</option>
                <option value="good_catch">Good Catch</option>
                <option value="ppe_violation">PPE Violation</option>
                <option value="housekeeping">Housekeeping</option>
                <option value="equipment_issue">Equipment Issue</option>
                <option value="fall_hazard">Fall Hazard</option>
                <option value="electrical_hazard">Electrical Hazard</option>
                <option value="excavation_trench_concern">Excavation / Trench Concern</option>
                <option value="fire_hot_work_concern">Fire / Hot Work Concern</option>
                <option value="corrective_action">Corrective Action</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Jobsite
              </label>
              <select
                value={submission.jobsiteId}
                onChange={(event) =>
                  setSubmission((current) => ({ ...current, jobsiteId: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 outline-none focus:border-sky-500"
              >
                <option value="">General Workspace</option>
                {jobsites.map((jobsite) => (
                  <option key={jobsite.id} value={jobsite.id}>
                    {jobsite.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Optional photo
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setSubmission((current) => ({
                    ...current,
                    photo: event.target.files?.[0] ?? null,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none focus:border-sky-500"
              />
              {submission.photo ? (
                <div className="mt-2 text-xs text-slate-500">Selected: {submission.photo.name}</div>
              ) : null}
            </div>
          </div>

          {message ? (
            <div className="mt-5">
              <InlineMessage tone={messageTone}>{message}</InlineMessage>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitting ? "Submitting..." : "Submit Safety Issue"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSubmission(EMPTY_SUBMISSION);
                setMessage(null);
              }}
              className="rounded-xl border border-slate-600 bg-slate-900/90 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Clear
            </button>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <StartChecklist title="Submission Checklist" items={checklistItems} />
          <WorkflowPath
            title="What Happens Next"
            description="Each individual safety submission bypasses normal review request intake and opens a corrective action directly."
            steps={workflowSteps}
          />
        </div>
      </section>
    </div>
  );
}
