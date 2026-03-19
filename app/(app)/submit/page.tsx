"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { LegalAcceptanceBlock } from "@/components/LegalAcceptanceBlock";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  StartChecklist,
} from "@/components/WorkspacePrimitives";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SubmitPage() {
  const [title, setTitle] = useState("");
  const [serviceType, setServiceType] = useState("document_review");
  const [customerNotes, setCustomerNotes] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [agreedToSubmissionTerms, setAgreedToSubmissionTerms] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">(
    "neutral"
  );
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(true);

  async function checkSubscription() {
    setCheckingSubscription(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("You must be logged in.");
      setMessageTone("error");
      setCheckingSubscription(false);
      return;
    }

    const { data, error } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      setMessage(`Subscription check failed: ${error.message}`);
      setMessageTone("error");
      setCheckingSubscription(false);
      return;
    }

    setSubscriptionStatus(data?.status ?? "inactive");
    setCheckingSubscription(false);
  }

  useEffect(() => {
    async function loadSubscription() {
      await checkSubscription();
    }

    void loadSubscription();
  }, []);

  async function handleSubmit() {
    setMessage("");
    setMessageTone("neutral");

    if (!title.trim()) {
      setMessage("Please enter a request title.");
      setMessageTone("warning");
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("You must be logged in.");
      setMessageTone("error");
      return;
    }

    if (subscriptionStatus !== "active") {
      setMessage("An active subscription is required before submitting documents.");
      setMessageTone("warning");
      return;
    }

    if (!agreedToSubmissionTerms) {
      setMessage(
        "You must agree to the Terms of Service, Liability Waiver, and Licensing Agreement before submitting a document."
      );
      setMessageTone("warning");
      return;
    }

    setSubmitting(true);

    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .insert({
        user_id: user.id,
        title,
        service_type: serviceType,
        status: "submitted",
        customer_notes: customerNotes || null,
      })
      .select()
      .single();

    if (submissionError || !submission) {
      setMessage(`Submission creation failed: ${submissionError?.message ?? "Unknown error"}`);
      setMessageTone("error");
      setSubmitting(false);
      return;
    }

    if (selectedFiles && selectedFiles.length > 0) {
      for (const file of Array.from(selectedFiles)) {
        const safeFileName = `${Date.now()}-${file.name}`;
        const filePath = `submission-${submission.id}/${safeFileName}`;

        const { data: uploadData, error: storageError } = await supabase.storage
          .from("documents")
          .upload(filePath, file, { upsert: false });

        if (storageError) {
          setMessage(`File upload failed: ${storageError.message}`);
          setMessageTone("error");
          setSubmitting(false);
          return;
        }

        const { error: docError } = await supabase.from("documents").insert({
          user_id: user.id,
          submission_id: submission.id,
          project_name: null,
          document_title: file.name,
          document_type: "Customer Upload",
          category: serviceType,
          notes: customerNotes || null,
          file_name: file.name,
          file_path: uploadData?.path ?? filePath,
          file_size: file.size,
          uploaded_by: user.email ?? null,
          document_stage: "customer_upload",
        });

        if (docError) {
          setMessage(`Document record save failed: ${docError.message}`);
          setMessageTone("error");
          setSubmitting(false);
          return;
        }
      }
    }

    setTitle("");
    setServiceType("document_review");
    setCustomerNotes("");
    setSelectedFiles(null);
    setMessage("Submission created successfully.");
    setMessageTone("success");
    setSubmitting(false);
  }

  const hasFiles = Boolean(selectedFiles && selectedFiles.length > 0);
  const checklistItems = [
    { label: "Enter a clear request title", done: title.trim().length > 0 },
    { label: "Choose the service type you need", done: Boolean(serviceType) },
    { label: "Upload the source files", done: hasFiles },
    { label: "Accept terms and submit for review", done: agreedToSubmissionTerms },
  ];

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Client Portal"
        title="Submit Review Request"
        description="Send source files, notes, and service details into the review workflow so your documents can move from intake to approval."
        actions={
          <>
            <Link
              href="/my-submissions"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              My Submissions
            </Link>
            <Link
              href="/library"
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Library
            </Link>
          </>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="New Submission"
          description="Create a request, add source files, and send it into the queue."
          className="h-full"
        >
          <div className="grid gap-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Request Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Example: Lilly Area B Safety Plan Review"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Service Type
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500"
              >
                <option value="document_review">Document Review</option>
                <option value="peshep_review">PESHEP Review</option>
                <option value="form_completion">Form Completion</option>
                <option value="template_update">Template Update</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Notes for Our Team
              </label>
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                rows={5}
                placeholder="Tell us what you need completed, reviewed, or returned."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Upload Source Files
              </label>
              <input
                type="file"
                multiple
                onChange={(e) => setSelectedFiles(e.target.files)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
              {selectedFiles && selectedFiles.length > 0 && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  {Array.from(selectedFiles).map((file) => (
                    <div key={file.name}>{file.name}</div>
                  ))}
                </div>
              )}
            </div>

            <LegalAcceptanceBlock
              checked={agreedToSubmissionTerms}
              onChange={setAgreedToSubmissionTerms}
            />
          </div>

          <div className="sticky bottom-3 mt-6 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <button
              onClick={handleSubmit}
              disabled={submitting || checkingSubscription || !agreedToSubmissionTerms}
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
            <Link
              href="/upload"
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Upload Instead
            </Link>
          </div>

          {message ? <div className="mt-4"><InlineMessage tone={messageTone}>{message}</InlineMessage></div> : null}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Subscription Status"
            description="Submission access is based on an active subscription."
          >
            <div>
              {checkingSubscription ? (
                <InlineMessage>Checking subscription...</InlineMessage>
              ) : (
                <InlineMessage tone={subscriptionStatus === "active" ? "success" : "warning"}>
                  Status: {subscriptionStatus ?? "inactive"}
                </InlineMessage>
              )}
            </div>
          </SectionCard>

          <StartChecklist title="Start Here Checklist" items={checklistItems} />

          <SectionCard
            title="How It Works"
            description="The standard workflow for a new request."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Upload or attach source files",
                "Submit the request into review",
                "Admin completes approval work",
                "Final documents land in the library",
              ].map((item, index) => (
                <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Step {index + 1}
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-700">{item}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          {!hasFiles ? (
            <EmptyState
              title="No source files attached yet"
              description="You can submit directly from here, or go to Upload if you want to manage file metadata first."
              actionHref="/upload"
              actionLabel="Open Upload"
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
