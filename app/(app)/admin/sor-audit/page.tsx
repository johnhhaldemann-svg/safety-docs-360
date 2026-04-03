"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHero, SectionCard } from "@/components/WorkspacePrimitives";
import { SorStatusBadge, SorVerificationBadge } from "@/components/sor/SorBadges";
import type { SorAuditLogRow, SorRecordRow } from "@/lib/sor/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type RecordWithVerification = SorRecordRow & { verification: "valid" | "invalid" };

export default function AdminSorAuditPage() {
  const [records, setRecords] = useState<RecordWithVerification[]>([]);
  const [logs, setLogs] = useState<SorAuditLogRow[]>([]);
  const [status, setStatus] = useState("");
  const [project, setProject] = useState("");
  const [trade, setTrade] = useState("");
  const [userId, setUserId] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(true);

  useEffect(() => {
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      if (project) qs.set("project", project);
      if (trade) qs.set("trade", trade);
      if (userId) qs.set("userId", userId);
      qs.set("includeDeleted", String(includeDeleted));
      const res = await fetch(`/api/admin/sor-audit?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = (await res.json().catch(() => null)) as
        | { records?: RecordWithVerification[]; logs?: SorAuditLogRow[] }
        | null;
      setRecords(data?.records ?? []);
      setLogs(data?.logs ?? []);
    })();
  }, [status, project, trade, userId, includeDeleted]);

  const groupedLogs = useMemo(() => {
    const map = new Map<string, SorAuditLogRow[]>();
    for (const log of logs) {
      const bucket = map.get(log.sor_id) ?? [];
      bucket.push(log);
      map.set(log.sor_id, bucket);
    }
    return map;
  }, [logs]);

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Administration"
        title="SOR Audit Console"
        description="Cross-check hash verification, version chains, user actions, and deleted records."
      />

      <SectionCard title="Filters">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input value={project} onChange={(e) => setProject(e.target.value)} placeholder="Project" className="rounded-xl border border-slate-700/80 px-3 py-2 text-sm" />
          <input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="Trade" className="rounded-xl border border-slate-700/80 px-3 py-2 text-sm" />
          <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" className="rounded-xl border border-slate-700/80 px-3 py-2 text-sm" />
          <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Status" className="rounded-xl border border-slate-700/80 px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 rounded-xl border border-slate-700/80 px-3 py-2 text-sm">
            <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
            Include deleted
          </label>
        </div>
      </SectionCard>

      <SectionCard title="SOR Records">
        <div className="space-y-3">
          {records.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-700/80 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SorStatusBadge status={r.status} />
                  <SorVerificationBadge result={r.verification} />
                  {r.is_deleted ? <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-100">Deleted</span> : null}
                </div>
                <Link href={`/sor/${r.id}`} className="text-sm font-semibold text-sky-300 hover:underline">
                  Open detail
                </Link>
              </div>
              <p className="mt-2 text-sm text-slate-300">{r.project} · {r.trade} · v{r.version_number}</p>
              <p className="text-xs text-slate-500">Created by {r.created_by ?? "—"} · Updated by {r.updated_by ?? "—"}</p>
              <p className="mt-1 break-all text-xs text-slate-500">Hash: {r.record_hash ?? "—"}</p>
              <p className="break-all text-xs text-slate-500">Previous hash: {r.previous_hash ?? "—"}</p>
              <p className="text-xs text-slate-500">Audit events: {(groupedLogs.get(r.id) ?? []).length}</p>
            </div>
          ))}
          {records.length === 0 ? <p className="text-sm text-slate-500">No matching records.</p> : null}
        </div>
      </SectionCard>
    </div>
  );
}
