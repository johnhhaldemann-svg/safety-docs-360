"use client";

import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { deferEffect } from "@/lib/deferredEffect";
import { getSupabaseAccessToken } from "@/lib/supabaseClientSession";
import type { PlatformHelpTicketSummary } from "@/types/platform-support";

function emptySummary(): PlatformHelpTicketSummary {
  return {
    total: 0,
    open: 0,
    inProgress: 0,
    waitingOnUser: 0,
    resolved: 0,
    closed: 0,
    unseen: 0,
    critical: 0,
    high: 0,
  };
}

export function PlatformSupportAlert() {
  const [summary, setSummary] = useState<PlatformHelpTicketSummary>(emptySummary);

  const loadSummary = useCallback(async () => {
    const token = await getSupabaseAccessToken();
    if (!token) return;

    const response = await fetch("/api/superadmin/help-tickets?limit=150", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await response.json().catch(() => null)) as
      | { summary?: PlatformHelpTicketSummary }
      | null;
    if (response.ok && data?.summary) {
      setSummary(data.summary);
    }
  }, []);

  useEffect(() => {
    const cancelInitialLoad = deferEffect(() => {
      void loadSummary();
    });
    const id = window.setInterval(() => {
      void loadSummary();
    }, 60_000);
    return () => {
      cancelInitialLoad();
      window.clearInterval(id);
    };
  }, [loadSummary]);

  const activeCount = summary.open + summary.inProgress + summary.waitingOnUser;
  const urgentCount = summary.unseen || summary.critical || summary.high;

  return (
    <Link
      href="/superadmin/help-tickets"
      aria-label={`${summary.unseen} unseen platform help tickets`}
      className="relative inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-white px-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--app-text)] shadow-sm transition hover:bg-[var(--app-panel-soft)]"
    >
      <LifeBuoy aria-hidden="true" className="h-4 w-4 text-[var(--app-accent-primary)]" />
      <span className="hidden sm:inline">Support</span>
      <span className="rounded-full bg-[var(--app-panel)] px-2 py-0.5 text-[10px] text-[var(--app-muted)]">
        {activeCount}
      </span>
      {urgentCount > 0 ? (
        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-black leading-none text-white">
          {urgentCount > 9 ? "9+" : urgentCount}
        </span>
      ) : null}
    </Link>
  );
}
