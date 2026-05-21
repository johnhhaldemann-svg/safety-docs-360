"use client";

import type { SorAuditLogRow } from "@/lib/sor/types";

export function SorAuditHistoryPanel({ logs }: { logs: SorAuditLogRow[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-slate-500">No audit history yet.</p>;
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <div key={log.id} className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{log.action_type}</span>
            <span className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">User: {log.user_id ?? "system"}</p>
          {log.notes ? <p className="mt-1 text-sm text-slate-300">{log.notes}</p> : null}
        </div>
      ))}
    </div>
  );
}
