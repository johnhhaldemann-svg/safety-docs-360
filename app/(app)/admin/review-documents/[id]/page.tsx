"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type DocumentItem = {
  id: string;
  project_name: string;
  status: string;
  draft_file_path: string | null;
  final_file_path: string | null;
  reviewer_email: string | null;
  review_notes: string | null;
};

export default function ReviewDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [documentItem, setDocumentItem] = useState<DocumentItem | null>(null);
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadDocument() {
      const { data, error } = await supabase
        .from("documents")
        .select(
          "id, project_name, status, draft_file_path, final_file_path, reviewer_email, review_notes"
        )
        .eq("id", id)
        .single();

      if (!error && data) {
        setDocumentItem(data);
        setReviewerEmail(data.reviewer_email || "");
        setReviewNotes(data.review_notes || "");
      }

      setLoading(false);
    }

    if (id) loadDocument();
  }, [id]);

  async function uploadFinalDoc() {
    if (!file || !documentItem) {
      alert("Please upload the final DOCX.");
      return;
    }

    setSaving(true);

    try {
      const filePath = `final/${documentItem.id}/${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        alert(uploadError.message);
        setSaving(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("documents")
        .update({
          status: "approved",
          final_file_path: filePath,
          reviewer_email: reviewerEmail || null,
          review_notes: reviewNotes || null,
        })
        .eq("id", documentItem.id);

      if (updateError) {
        alert(updateError.message);
        setSaving(false);
        return;
      }

      alert("Final document sent to user.");

      router.push("/admin/review-documents");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Upload failed.");
    }

    setSaving(false);
  }

  if (loading) return <div className="p-6">Loading document...</div>;
  if (!documentItem) return <div className="p-6">Document not found.</div>;

  return (
    <div className="p-6">
      <div className="mx-auto max-w-3xl space-y-6">

        <div>
          <h1 className="text-2xl font-bold">Review PSHSEP</h1>
          <p className="text-sm text-slate-600">
            Download draft, review in Word, then upload final version.
          </p>
        </div>

        <div className="rounded-lg border p-5 shadow-sm">
          <p><strong>Project:</strong> {documentItem.project_name}</p>
          <p><strong>Status:</strong> {documentItem.status}</p>
        </div>

        <div className="rounded-lg border p-5 shadow-sm">
          <h3 className="mb-3 font-semibold">Draft Document</h3>

          <a
            href={`/api/documents/download/${documentItem.id}`}
            target="_blank"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700"
          >
            Open Draft DOCX
          </a>
        </div>

        <div className="rounded-lg border p-5 shadow-sm space-y-4">
          <h3 className="font-semibold">Upload Final Document</h3>

          <input
            type="file"
            accept=".docx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          <div>
            <label className="text-sm font-semibold block mb-1">
              Reviewer Email
            </label>
            <input
              type="email"
              value={reviewerEmail}
              onChange={(e) => setReviewerEmail(e.target.value)}
              className="w-full border rounded-lg p-2"
            />
          </div>

          <div>
            <label className="text-sm font-semibold block mb-1">
              Review Notes
            </label>
            <textarea
              rows={4}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              className="w-full border rounded-lg p-2"
            />
          </div>

          <button
            onClick={uploadFinalDoc}
            disabled={saving}
            className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? "Uploading..." : "Approve & Send Final"}
          </button>
        </div>

        <button
          onClick={() => router.push("/admin/review-documents")}
          className="rounded-lg border px-4 py-2 font-semibold"
        >
          Back
        </button>

      </div>
    </div>
  );
}