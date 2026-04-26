"use client";

import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useEffect, useState } from "react";
import { InlineMessage, StatusBadge } from "@/components/WorkspacePrimitives";

const supabase = getSupabaseBrowserClient();

export function InductionReadinessCard() {
  const [status, setStatus] = useState<"eligible" | "blocked" | "idle" | "error">("idle");
  const [hint, setHint] = useState("");
  const [jobsiteId, setJobsiteId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          if (!cancelled) setStatus("idle");
          return;
        }
        const h = { Authorization: `Bearer ${session.access_token}` };
        const jRes = await fetch("/api/company/jobsites", { headers: h });
        const jData = (await jRes.json().catch(() => null)) as { jobsites?: Array<{ id?: string; status?: string }> } | null;
        const list = (jData?.jobsites ?? []).filter((r) => String(r.status ?? "active").toLowerCase() === "active");
        const first = list[0]?.id;
        if (!first) {
          if (!cancelled) {
            setStatus("idle");
            setHint("Add an active jobsite to evaluate induction readiness.");
          }
          return;
        }
        if (!cancelled) setJobsiteId(first);
        const eRes = await fetch(
          `/api/company/inductions/evaluate?jobsiteId=${encodeURIComponent(String(first))}`,
          { headers: h }
        );
        const eData = (await eRes.json().catch(() => null)) as
          | { status?: "eligible" | "blocked"; error?: string }
          | null;
        if (!eRes.ok) {
          if (!cancelled) {
            setStatus("error");
            setHint(eData?.error || "Could not evaluate inductions.");
          }
          return;
        }
        if (!cancelled) {
          setStatus(eData?.status === "eligible" ? "eligible" : "blocked");
          setHint(
            eData?.status === "eligible"
              ? "First active jobsite passes configured induction rules."
              : "Complete required inductions for the first active jobsite."
          );
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setHint("Could not load induction readiness.");
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "idle" && !hint) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/90 p-5 shadow-[var(--app-shadow-soft)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Site readiness</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {status === "error" ? (
          <InlineMessage tone="warning">{hint}</InlineMessage>
        ) : (
          <>
            <StatusBadge
              label={status === "eligible" ? "Eligible" : status === "blocked" ? "Action needed" : "—"}
              tone={status === "eligible" ? "success" : status === "blocked" ? "warning" : "neutral"}
            />
            <p className="min-w-0 flex-1 text-sm text-[var(--app-text)]">{hint}</p>
          </>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={jobsiteId ? `/jobsites/${encodeURIComponent(jobsiteId)}/inductions` : "/jobsites"}
          className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--app-accent-primary)]"
        >
          Open inductions
        </Link>
        <span className="text-[var(--app-muted)]">·</span>
        <Link href="/company-inductions" className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--app-accent-primary)]">
          Configure programs
        </Link>
      </div>
    </div>
  );
}
