"use client";
import { deferEffect } from "@/lib/deferredEffect";

import type { FormEvent, InputHTMLAttributes } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileUp, RefreshCw, Save } from "lucide-react";
import {
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
} from "@/components/WorkspacePrimitives";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const supabase = getSupabaseBrowserClient();

type MarketplaceDocument = {
  id: string;
  created_at: string;
  document_title: string | null;
  project_name: string | null;
  document_type: string | null;
  category: string | null;
  file_name: string | null;
  file_size: number | null;
  status: string | null;
  final_file_path: string | null;
  marketplaceEnabled: boolean;
  priceCents: number | null;
};

function formatMoney(cents?: number | null) {
  if (!cents || cents <= 0) return "Not priced";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function documentTitle(document: MarketplaceDocument) {
  return document.document_title || document.project_name || document.file_name || "Untitled document";
}

export default function SuperadminDocumentLibraryPage() {
  const [documents, setDocuments] = useState<MarketplaceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "error">("neutral");

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error || !session?.access_token) {
      throw new Error("You must be logged in as a superadmin.");
    }
    return session.access_token;
  }, []);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/superadmin/document-library", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => null)) as
        | { documents?: MarketplaceDocument[]; error?: string }
        | null;
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load documents.");
      }
      setDocuments(Array.isArray(data?.documents) ? data.documents : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load documents.");
      setMessageTone("error");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => deferEffect(() => {
    void loadDocuments();
  }), [loadDocuments]);

  const stats = useMemo(() => {
    const listed = documents.filter((document) => document.marketplaceEnabled);
    return {
      total: documents.length,
      listed: listed.length,
      hidden: documents.length - listed.length,
    };
  }, [documents]);

  async function submitNewDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const token = await getAccessToken();
      const res = await fetch("/api/superadmin/document-library", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error || "Failed to publish document.");
      }
      form.reset();
      setMessage("Document published to the paid library.");
      setMessageTone("success");
      await loadDocuments();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to publish document.");
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  }

  async function submitUpdate(documentId: string, form: HTMLFormElement) {
    setSavingId(documentId);
    setMessage("");
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/superadmin/document-library/${documentId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: new FormData(form),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update listing.");
      }
      setMessage("Marketplace listing updated.");
      setMessageTone("success");
      await loadDocuments();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update listing.");
      setMessageTone("error");
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Superadmin"
        title="Paid Document Library"
        description="Publish global marketplace documents, set USD prices, and control what every company can buy from Document Library."
        actions={
          <button
            type="button"
            onClick={() => void loadDocuments()}
            className={appButtonSecondaryClassName}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Total documents" value={String(stats.total)} />
        <Metric label="Listed" value={String(stats.listed)} />
        <Metric label="Hidden" value={String(stats.hidden)} />
      </section>

      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

      <SectionCard
        title="Add Paid Document"
        description="Upload the final customer-facing file and set the price users will see in Document Library."
      >
        <form onSubmit={submitNewDocument} className="grid gap-4 lg:grid-cols-2">
          <Field label="Title" name="title" placeholder="Fall protection plan template" required />
          <Field label="Price (USD)" name="price" type="number" min="0.01" step="0.01" placeholder="49.00" required />
          <Field label="Type" name="documentType" placeholder="Template" />
          <Field label="Category" name="category" placeholder="Fall Protection" />
          <label className="lg:col-span-2">
            <span className="text-sm font-semibold text-[var(--app-text-strong)]">Document file</span>
            <input
              name="file"
              type="file"
              required
              className="mt-2 w-full rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 text-sm"
            />
          </label>
          <div className="lg:col-span-2">
            <button type="submit" disabled={saving} className={appButtonPrimaryClassName}>
              <FileUp className="h-4 w-4" aria-hidden />
              {saving ? "Publishing..." : "Publish document"}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Marketplace Listings"
        description="Update global paid documents without going through the customer review queue."
      >
        {loading ? (
          <InlineMessage>Loading paid documents...</InlineMessage>
        ) : documents.length === 0 ? (
          <EmptyState
            title="No paid documents yet"
            description="Published documents will appear here and in the marketplace tab for company users."
          />
        ) : (
          <div className="space-y-4">
            {documents.map((document) => (
              <DocumentListing
                key={document.id}
                document={document}
                saving={savingId === document.id}
                onSave={submitUpdate}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-white p-5 shadow-[var(--app-shadow-soft)]">
      <p className="text-sm text-[var(--app-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">{value}</p>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return (
    <label>
      <span className="text-sm font-semibold text-[var(--app-text-strong)]">{label}</span>
      <input
        name={name}
        type={type}
        className="mt-2 w-full rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--app-accent-primary)]"
        {...props}
      />
    </label>
  );
}

function DocumentListing({
  document,
  saving,
  onSave,
}: {
  document: MarketplaceDocument;
  saving: boolean;
  onSave: (documentId: string, form: HTMLFormElement) => Promise<void>;
}) {
  return (
    <form
      className="rounded-xl border border-[var(--app-border)] bg-white p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(document.id, event.currentTarget);
      }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-[var(--app-text-strong)]">
              {documentTitle(document)}
            </h3>
            <StatusBadge
              label={document.marketplaceEnabled ? "Listed" : "Hidden"}
              tone={document.marketplaceEnabled ? "success" : "neutral"}
            />
          </div>
          <p className="mt-2 text-sm text-[var(--app-muted)]">
            {formatMoney(document.priceCents)} · {document.file_name || "No file name"} · Added {formatDate(document.created_at)}
          </p>
        </div>
        <button type="submit" disabled={saving} className={appButtonSecondaryClassName}>
          <Save className="h-4 w-4" aria-hidden />
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-4">
        <Field label="Title" name="title" defaultValue={documentTitle(document)} required />
        <Field label="Price (USD)" name="price" type="number" min="0.01" step="0.01" defaultValue={document.priceCents ? String(document.priceCents / 100) : ""} required />
        <Field label="Type" name="documentType" defaultValue={document.document_type ?? ""} />
        <Field label="Category" name="category" defaultValue={document.category ?? ""} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <label className="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] px-4 py-3">
          <input type="hidden" name="enabled" value="false" />
          <input
            name="enabled"
            type="checkbox"
            defaultChecked={document.marketplaceEnabled}
            value="true"
            className="h-5 w-5"
          />
          <span className="text-sm font-semibold text-[var(--app-text-strong)]">Listed for sale</span>
        </label>
        <label>
          <span className="text-sm font-semibold text-[var(--app-text-strong)]">
            Replace file
          </span>
          <input
            name="file"
            type="file"
            className="mt-2 w-full rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 text-sm"
          />
        </label>
      </div>
    </form>
  );
}
