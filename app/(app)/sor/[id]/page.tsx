"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHero, SectionCard } from "@/components/WorkspacePrimitives";
import { SorAuditHistoryPanel } from "@/components/sor/SorAuditHistoryPanel";
import { SorStatusBadge, SorVerificationBadge } from "@/components/sor/SorBadges";
import type { SorAuditLogRow, SorRecordRow } from "@/lib/sor/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SorDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [record, setRecord] = useState<SorRecordRow | null>(null);
  const [logs, setLogs] = useState<SorAuditLogRow[]>([]);
  const [verification, setVerification] = useState<"valid" | "invalid" | "broken_chain">("valid");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      if (!id) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("You must be signed in.");
        return;
      }
      const headers = { Authorization: `Bearer ${session.access_token}` };

      const detailRes = await fetch(`/api/company/sor/${id}`, { headers });
      const detailData = (await detailRes.json().catch(() => null)) as { record?: SorRecordRow; error?: string } | null;
      if (!detailRes.ok || !detailData?.record) {
        setError(detailData?.error || "Failed to load SOR.");
        return;
      }
      setRecord(detailData.record);

      const verifyRes = await fetch(`/api/company/sor/${id}/verify`, { headers });
      const verifyData = (await verifyRes.json().catch(() => null)) as { result?: "valid" | "invalid" | "broken_chain" } | null;
      if (verifyData?.result) setVerification(verifyData.result);

      const auditRes = await fetch(`/api/company/sor/${id}/audit`, { headers });
      const auditData = (await auditRes.json().catch(() => null)) as { logs?: SorAuditLogRow[] } | null;
      setLogs(auditData?.logs ?? []);
    })();
  }, [id]);

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="SOR"
        title="SOR Detail"
        description="Immutable submission metadata, cryptographic hash values, version links, and audit timeline."
      />

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {record ? (
        <>
          <SectionCard title="Record State">
            <div className="flex flex-wrap gap-2">
              <SorStatusBadge status={record.status} />
              <SorVerificationBadge result={verification} />
            </div>
          </SectionCard>

          <SectionCard title="Audit Metadata">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <p>Created by: {record.created_by ?? "—"}</p>
              <p>Created at: {new Date(record.created_at).toLocaleString()}</p>
              <p>Updated by: {record.updated_by ?? "—"}</p>
              <p>Updated at: {new Date(record.updated_at).toLocaleString()}</p>
              <p>Version number: {record.version_number}</p>
              <p>Hazard class: {record.hazard_category_code ?? "—"}</p>
              <p>Previous version: {record.previous_version_id ?? "—"}</p>
              <p className="sm:col-span-2 break-all">Record hash: {record.record_hash ?? "—"}</p>
              <p className="sm:col-span-2 break-all">Previous hash: {record.previous_hash ?? "—"}</p>
            </div>
          </SectionCard>

          <SectionCard title="Audit History">
            <SorAuditHistoryPanel logs={logs} />
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
