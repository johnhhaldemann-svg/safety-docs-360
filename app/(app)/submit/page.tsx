"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SubmitPage() {
  const [title, setTitle] = useState("");
  const [serviceType, setServiceType] = useState("document_review");
  const [customerNotes, setCustomerNotes] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(true);

  useEffect(() => {
    checkSubscription();
  }, []);

  async function checkSubscription() {
    setCheckingSubscription(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("You must be logged in.");
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
      setCheckingSubscription(false);
      return;
    }

    setSubscriptionStatus(data?.status ?? "inactive");
    setCheckingSubscription(false);
  }

  async function handleSubmit() {
    setMessage("");

    if (!title.trim()) {
      setMessage("Please enter a request title.");
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("You must be logged in.");
      return;
    }

    if (subscriptionStatus !== "active") {
      setMessage("An active subscription is required before submitting documents.");
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
    setSubmitting(false);
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
              Client Portal
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
              Submit Review Request
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">
              Send your source documents to our team for review and completion.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
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
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">New Submission</h2>
          <p className="mt-1 text-sm text-slate-500">
            Create a new request and upload the files our team needs to review.
          </p>

          <div className="mt-6 grid gap-5">
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
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleSubmit}
              disabled={submitting || checkingSubscription}
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>

          {message && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {message}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Subscription Status</h2>
            <p className="mt-1 text-sm text-slate-500">
              Your submission access is based on an active subscription.
            </p>

            <div className="mt-6">
              {checkingSubscription ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Checking subscription...
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  Status: {subscriptionStatus ?? "inactive"}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">How It Works</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>1. Create a request with a title and service type.</p>
              <p>2. Upload your source documents.</p>
              <p>3. Our team reviews and completes the work.</p>
              <p>4. We return the finished documents to your portal.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}