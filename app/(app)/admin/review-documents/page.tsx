"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type DocumentItem = {
  id: string;
  user_id: string;
  document_type: string;
  project_name: string;
  status: string;
  created_at: string;
  review_notes: string | null;
};

export default function ReviewDocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDocuments() {
      const { data, error } = await supabase
        .from("documents")
        .select(
          "id, user_id, document_type, project_name, status, created_at, review_notes"
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Load documents error:", error.message);
      } else {
        setDocuments(data || []);
      }

      setLoading(false);
    }

    loadDocuments();
  }, []);

  if (loading) {
    return <div className="p-6">Loading submissions...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Review Documents</h1>

      <div className="space-y-4">
        {documents.length === 0 ? (
          <p>No submissions found.</p>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="rounded-lg border p-4 shadow-sm transition hover:bg-slate-50"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <Link
                  href={`/admin/review-documents/${doc.id}`}
                  className="block flex-1 cursor-pointer"
                >
                  <h2 className="text-lg font-semibold">{doc.project_name}</h2>
                  <p>Type: {doc.document_type}</p>
                  <p>Status: {doc.status}</p>
                  <p>User ID: {doc.user_id}</p>
                  <p>Submitted: {new Date(doc.created_at).toLocaleString()}</p>
                  {doc.review_notes ? <p>Notes: {doc.review_notes}</p> : null}
                </Link>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/api/documents/download/${doc.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-extrabold text-white hover:bg-blue-700"
                  >
                    Open Draft DOCX
                  </a>

                  <Link
                    href={`/admin/review-documents/${doc.id}`}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-extrabold text-slate-900 hover:bg-slate-100"
                  >
                    Review
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}