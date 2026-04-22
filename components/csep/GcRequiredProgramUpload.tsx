"use client";

import type { DragEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { InlineMessage, SectionCard } from "@/components/WorkspacePrimitives";
import type { PermissionMap } from "@/lib/rbac";

const supabase = getSupabaseBrowserClient();

type GcDoc = {
  id: string;
  document_title: string | null;
  file_name: string | null;
  file_path: string | null;
  final_file_path?: string | null;
  created_at: string | null;
};

type GcGetResponse = {
  document?: GcDoc | null;
  pendingReview?: boolean;
  submittedAt?: string | null;
  error?: string;
};

export function GcRequiredProgramUpload({
  permissionMap,
  authLoading,
  /** CSEP project name when filled; stored on the document row for NOT NULL project_name. */
  projectName,
}: {
  permissionMap: PermissionMap | null;
  authLoading: boolean;
  projectName?: string;
}) {
  const [doc, setDoc] = useState<GcDoc | null>(null);
  const [pendingReview, setPendingReview] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "error">("success");
  const [dragActive, setDragActive] = useState(false);

  const canUpload = Boolean(
    permissionMap?.can_submit_documents || permissionMap?.can_create_documents
  );

  const loadCurrent = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    const res = await fetch("/api/company/gc-program-document", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = (await res.json().catch(() => null)) as GcGetResponse | null;
    if (res.ok) {
      setDoc(data?.document ?? null);
      setPendingReview(Boolean(data?.pendingReview));
      setSubmittedAt(data?.submittedAt ?? null);
    } else {
      setPendingReview(false);
      setSubmittedAt(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadCurrent();
  }, [loadCurrent]);

  async function uploadFile(file: File) {
    setMessage("");
    if (!canUpload) {
      setMessageTone("warning");
      setMessage("Your role cannot upload files.");
      return;
    }
    setUploading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setMessageTone("error");
        setMessage("Session expired. Sign in again.");
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      if (title.trim()) {
        formData.append("title", title.trim());
      }
      if (projectName?.trim()) {
        formData.append("project_name", projectName.trim().slice(0, 200));
      }
      const res = await fetch("/api/company/gc-program-document", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        success?: boolean;
        pendingReview?: boolean;
      } | null;
      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Upload failed.");
        return;
      }
      setMessageTone("success");
      setMessage(
        data?.pendingReview
          ? "Your file was submitted for review. You will see it here after a platform administrator approves it."
          : "GC-required document saved. It applies to your company’s work on top of OSHA."
      );
      setTitle("");
      await loadCurrent();
    } catch (e) {
      setMessageTone("error");
      setMessage(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function removeDoc() {
    setMessage("");
    setUploading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setMessageTone("error");
        setMessage("Session expired.");
        return;
      }
      const res = await fetch("/api/company/gc-program-document", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Could not remove file.");
        return;
      }
      setDoc(null);
      setPendingReview(false);
      setSubmittedAt(null);
      setMessageTone("success");
      setMessage("Pending submission withdrawn.");
    } catch (e) {
      setMessageTone("error");
      setMessage(e instanceof Error ? e.message : "Remove failed.");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void uploadFile(f);
  }

  return (
    <SectionCard
      title="GC-required program document"
      description="Upload the document your General Contractor requires your company to follow on this job—in addition to OSHA and regulatory baselines. PDF or Office files; one active file per company (replaces any previous upload)."
    >
      {message ? (
        <div className="mb-4">
          <InlineMessage tone={messageTone}>{message}</InlineMessage>
        </div>
      ) : null}

      <div className="space-y-4">
        <label className="block text-sm font-medium text-slate-300">
          Label (optional)
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Site safety plan addendum, exhibit A"
            disabled={authLoading || !canUpload || uploading}
            className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </label>

        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={[
            "rounded-2xl border-2 border-dashed px-4 py-8 text-center transition",
            dragActive ? "border-sky-400 bg-sky-500/15" : "border-slate-700/80 bg-slate-950/50",
            !canUpload || uploading ? "pointer-events-none opacity-50" : "",
          ].join(" ")}
        >
          <p className="text-sm font-semibold text-slate-200">Drop a file here</p>
          <p className="mt-1 text-xs text-slate-500">or choose a file (max 40 MB)</p>
          <label className="mt-4 inline-block">
            <span className="cursor-pointer rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
              {uploading ? "Uploading…" : "Choose file"}
            </span>
            <input
              type="file"
              className="hidden"
              disabled={authLoading || !canUpload || uploading}
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : pendingReview && !doc ? (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-500/35 bg-amber-950/40/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-amber-900">
                Submitted — awaiting review
              </div>
              <p className="mt-1 text-sm text-slate-300">
                Your upload is pending review by a platform administrator. The file is hidden from this workspace
                until it is approved.
              </p>
              {submittedAt ? (
                <div className="mt-2 text-xs text-slate-400">
                  Submitted {new Date(submittedAt).toLocaleString()}
                </div>
              ) : null}
            </div>
            {canUpload ? (
              <button
                type="button"
                onClick={() => void removeDoc()}
                disabled={uploading}
                className="shrink-0 rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/50 disabled:opacity-50"
              >
                Withdraw submission
              </button>
            ) : null}
          </div>
        ) : doc ? (
          <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-emerald-100">On file</div>
              <div className="mt-1 text-sm font-semibold text-slate-100">
                {doc.document_title || doc.file_name || "GC document"}
              </div>
              <div className="text-xs text-slate-400">
                {doc.file_name}
                {doc.created_at ? ` · ${new Date(doc.created_at).toLocaleString()}` : ""}
              </div>
            </div>
            {canUpload && !doc.final_file_path ? (
              <button
                type="button"
                onClick={() => void removeDoc()}
                disabled={uploading}
                className="shrink-0 rounded-lg border border-red-500/35 bg-slate-900/90 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-950/40 disabled:opacity-50"
              >
                Remove
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No GC-required document on file yet.</p>
        )}

        {!canUpload && !authLoading ? (
          <p className="text-xs text-slate-500">
            Your role can view this page but cannot upload. Ask a company admin or safety lead to add the GC document.
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}
