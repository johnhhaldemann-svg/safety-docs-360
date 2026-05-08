"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Database, RotateCcw } from "lucide-react";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const supabase = getSupabaseBrowserClient();

async function accessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sign in before loading the demo environment.");
  return session.access_token;
}

export default function DemoLoadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"neutral" | "success" | "warning" | "error">("neutral");

  async function loadDemo() {
    if (!window.confirm("Load isolated demo data and switch your active workspace to Demo Construction?")) return;
    setLoading(true);
    setMessage(null);
    try {
      const token = await accessToken();
      const res = await fetch("/api/demo/load", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; companyName?: string; counts?: { jobsites?: number; microsoftTasks?: number } }
        | null;
      if (!res.ok) throw new Error(data?.error || "Failed to load demo environment.");
      setTone("success");
      setMessage(
        `${data?.companyName ?? "Demo Construction"} loaded with ${data?.counts?.jobsites ?? 0} projects and ${
          data?.counts?.microsoftTasks ?? 0
        } schedule activities.`
      );
      router.push("/dashboard?demo=loaded");
      router.refresh();
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to load demo environment.");
    }
    setLoading(false);
  }

  async function resetDemo() {
    if (!window.confirm("Reset your isolated demo environment and restore your previous workspace if available?")) return;
    setResetting(true);
    setMessage(null);
    try {
      const token = await accessToken();
      const res = await fetch("/api/demo/reset", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => null)) as { error?: string; restoredCompanyId?: string | null } | null;
      if (!res.ok) throw new Error(data?.error || "Failed to reset demo environment.");
      setTone("success");
      setMessage(data?.restoredCompanyId ? "Demo reset complete. Your previous workspace was restored." : "Demo reset complete.");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to reset demo environment.");
    }
    setResetting(false);
  }

  return (
    <div className="space-y-8 pb-10">
      <PageHero
        eyebrow="Demo mode"
        title="Load Demo Environment"
        description="Seed an isolated Demo Construction workspace with projects, schedules, permits, observations, incidents, training gaps, and predictive-risk signals."
        actions={
          <>
            <button type="button" onClick={loadDemo} disabled={loading || resetting} className={appButtonPrimaryClassName}>
              <Database className="h-4 w-4" />
              {loading ? "Loading..." : "Load Demo Environment"}
            </button>
            <button type="button" onClick={resetDemo} disabled={loading || resetting} className={appButtonSecondaryClassName}>
              <RotateCcw className="h-4 w-4" />
              {resetting ? "Resetting..." : "Reset Demo"}
            </button>
          </>
        }
      />

      {message ? <InlineMessage tone={tone}>{message}</InlineMessage> : null}

      <SectionCard
        eyebrow="What gets seeded"
        title="Real workflow data without external accounts"
        description="The loader does not call Procore, Microsoft, OAuth, or any external API. It creates normalized demo rows that the current dashboards and workflows already read."
      >
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["Projects", "LKC Phase 3, Hospital Expansion, Warehouse Buildout"],
            ["Risk Signals", "Open corrective actions, active permits, high-risk JSAs, incidents"],
            ["Imports", "Microsoft Project-style projects, tasks, assignments, and sync history"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-[var(--app-border)] bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">{label}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--app-text-strong)]">{value}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
