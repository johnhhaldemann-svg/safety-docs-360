"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  Archive,
  Building2,
  CheckCircle2,
  Database,
  FileText,
  PlayCircle,
  RefreshCcw,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  PageHero,
  SectionCard,
  InlineMessage,
  StatusBadge,
  appNativeSelectClassName,
} from "@/components/WorkspacePrimitives";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type CheckStatus = "green" | "yellow" | "red";

type SystemTestCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  metric?: string;
};

type SystemTestResult = {
  ranAt: string;
  durationMs: number;
  mode: "service_role" | "fallback";
  targetUser: {
    id: string;
    email: string;
    name: string;
    role: string;
    team: string;
    status: string;
    companyId: string | null;
    companyName: string | null;
  };
  environment: {
    url: boolean;
    anonKey: boolean;
    serviceRoleKey: boolean;
    sources: {
      url: string | null;
      anonKey: string | null;
      serviceRoleKey: string | null;
    };
  };
  summary: {
    total: number;
    green: number;
    yellow: number;
    red: number;
  };
  checks: SystemTestCheck[];
};

type DirectoryUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  team: string;
  status: string;
  companyId: string | null;
  companyName: string;
};

function statusTone(status: CheckStatus): "success" | "warning" | "error" {
  if (status === "green") return "success";
  if (status === "yellow") return "warning";
  return "error";
}

function statusLabel(status: CheckStatus) {
  if (status === "green") return "Passed";
  if (status === "yellow") return "Fallback";
  return "Needs attention";
}

function checkIcon(id: string, status: CheckStatus) {
  const baseClass =
    status === "green"
      ? "text-emerald-200"
      : status === "yellow"
        ? "text-amber-200"
        : "text-red-200";

  if (id.includes("session")) return <ShieldCheck className={`h-5 w-5 ${baseClass}`} />;
  if (id.includes("env")) return <Database className={`h-5 w-5 ${baseClass}`} />;
  if (id.includes("agreement")) return <FileText className={`h-5 w-5 ${baseClass}`} />;
  if (id.includes("user")) return <Users className={`h-5 w-5 ${baseClass}`} />;
  if (id.includes("company") || id.includes("workspace")) return <Building2 className={`h-5 w-5 ${baseClass}`} />;
  if (id.includes("document") || id.includes("credit")) return <Archive className={`h-5 w-5 ${baseClass}`} />;
  return <CheckCircle2 className={`h-5 w-5 ${baseClass}`} />;
}

function formatRunTime(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function CheckCard({ check }: { check: SystemTestCheck }) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 shadow-sm transition hover:border-slate-600 hover:bg-slate-950/60">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-700/80 bg-slate-900/90">
            {checkIcon(check.id, check.status)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">{check.label}</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">{check.detail}</p>
          </div>
        </div>
        <StatusBadge label={statusLabel(check.status)} tone={statusTone(check.status)} />
      </div>

      {check.metric ? (
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-800/80 pt-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
            Result
          </span>
          <span className="text-sm font-semibold text-slate-100">{check.metric}</span>
        </div>
      ) : null}
    </div>
  );
}

export default function SafetyObservationHub() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SystemTestResult | null>(null);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [usersWarning, setUsersWarning] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setUsersLoading(true);
      setUsersError("");
      setUsersWarning("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          router.replace("/login");
          return;
        }

        setSelectedUserId((current) => current || session.user.id || "");

        const response = await fetch("/api/admin/users", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const payload = (await response.json().catch(() => null)) as
          | { users?: DirectoryUser[]; warning?: string; error?: string }
          | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to load users.");
        }

        if (cancelled) {
          return;
        }

        const directoryUsers = (payload?.users ?? []).map((user) => ({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          team: user.team,
          status: user.status,
          companyId: user.companyId ?? null,
          companyName: user.companyName || "General",
        }));

        setUsers(directoryUsers);
        setSelectedUserId((current) => current || session.user.id || directoryUsers[0]?.id || "");
        setUsersWarning(payload?.warning ?? "");
      } catch (loadError) {
        if (!cancelled) {
          setUsersError(loadError instanceof Error ? loadError.message : "Failed to load users.");
        }
      } finally {
        if (!cancelled) {
          setUsersLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [users, selectedUserId]
  );

  const summaryTone = useMemo<"success" | "warning" | "error" | "neutral">(() => {
    if (!result) return "neutral";
    if (result.summary.red > 0) return "error";
    if (result.summary.yellow > 0) return "warning";
    return "success";
  }, [result]);

  const runSystemTest = useCallback(async (userId?: string) => {
    setRunning(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const targetUserId = (userId ?? selectedUserId).trim() || session.user.id;
      const url = new URL("/api/superadmin/system-test", window.location.origin);
      url.searchParams.set("userId", targetUserId);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | SystemTestResult
        | null;

      if (!response.ok) {
        setError((data as { error?: string } | null)?.error ?? "System test failed.");
        setResult(null);
        return;
      }

      setResult(data as SystemTestResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "System test failed.");
      setResult(null);
    } finally {
      setRunning(false);
    }
  }, [router, selectedUserId]);

  const summaryCards = useMemo(
    () => [
      {
        title: "Passed checks",
        value: result ? String(result.summary.green) : "-",
        note: "Checks that passed cleanly",
        tone: "success" as const,
      },
      {
        title: "Fallback checks",
        value: result ? String(result.summary.yellow) : "-",
        note: "Fallbacks or empty states",
        tone: "warning" as const,
      },
      {
        title: "Needs attention",
        value: result ? String(result.summary.red) : "-",
        note: "Functions that need attention",
        tone: "error" as const,
      },
      {
        title: "Run duration",
        value: result ? formatDuration(result.durationMs) : "-",
        note: result ? `Mode: ${result.mode === "service_role" ? "service role" : "fallback"}` : "Runs only when requested",
        tone: "info" as const,
      },
    ],
    [result]
  );

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Superadmin / System test"
        title="Full system function test"
        description="Run a read-only smoke pass across session, environment, agreement settings, company data, user access, document queues, credit records, and archive history. Pick any user below and the test will evaluate that user's workspace context."
        actions={
          <button
            type="button"
            onClick={() => runSystemTest(selectedUserId)}
            disabled={running || usersLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {running ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            {running ? "Running test..." : "Run selected user test"}
          </button>
        }
      />

      <SectionCard
        title="Select user"
        description="Choose any user from the directory, then run the smoke test against that account's scope."
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
              Test user
            </span>
            <select
              className={`${appNativeSelectClassName} mt-2 w-full`}
              value={selectedUserId}
              onChange={(event) => {
                setSelectedUserId(event.target.value);
                setResult(null);
                setError("");
              }}
              disabled={usersLoading || users.length === 0}
            >
              {usersLoading ? (
                <option value="">Loading users…</option>
              ) : users.length === 0 ? (
                <option value="">No users available</option>
              ) : (
                users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {user.email || user.id} · {user.role}
                  </option>
                ))
              )}
            </select>
          </label>

          <button
            type="button"
            onClick={() => runSystemTest(selectedUserId)}
            disabled={running || usersLoading || !selectedUserId}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {running ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            {running ? "Running test..." : "Run selected user test"}
          </button>
        </div>

        {selectedUser ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                Selected user
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-100">{selectedUser.name}</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">{selectedUser.email || selectedUser.id}</p>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                Role
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-100">{selectedUser.role}</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">{selectedUser.status}</p>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                Company
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-100">
                {selectedUser.companyName || "No company assigned"}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                {selectedUser.companyId ? selectedUser.companyId : "Workspace scope not attached yet"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                Ready
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-100">
                {selectedUser.companyId ? "Company-scoped" : "Needs assignment"}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                {selectedUser.id === selectedUserId ? "Selected in the dropdown" : "Selection sync pending"}
              </p>
            </div>
          </div>
        ) : null}

        {usersWarning ? (
          <div className="mt-4">
            <InlineMessage tone="warning">{usersWarning}</InlineMessage>
          </div>
        ) : null}

        {usersError ? (
          <div className="mt-4">
            <InlineMessage tone="error">{usersError}</InlineMessage>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Test instructions"
        description="Click the button when you want a fresh read-only pass. The page does not auto-refresh, so the result you see is the result you asked for."
        aside={
          result ? (
            <StatusBadge
              label={
                result.summary.red > 0
                  ? "Needs attention"
                  : result.summary.yellow > 0
                    ? "Fallbacks"
                    : "All passed"
              }
              tone={summaryTone === "error" ? "error" : summaryTone === "warning" ? "warning" : "success"}
            />
          ) : null
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 shadow-sm"
            >
              <p className="text-sm font-medium text-slate-400">{card.title}</p>
              <p className="mt-3 text-3xl font-black tracking-tight text-slate-100">{card.value}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{card.note}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {error ? (
        <InlineMessage tone="error">{error}</InlineMessage>
      ) : null}

      {result?.mode === "fallback" ? (
        <InlineMessage tone="warning">
          The test is using fallback data for some checks because the service role key is not available at runtime.
          The green lights still show what passed, but the fallback mode is a signal to verify production env vars.
        </InlineMessage>
      ) : null}

      {result ? (
        <SectionCard
          title={`Environment and summary for ${result.targetUser.name}`}
          description={`Last run at ${formatRunTime(result.ranAt)} for ${result.targetUser.email || result.targetUser.id}. This pass completed in ${formatDuration(result.durationMs)}.`}
          aside={
            <StatusBadge
              label={
                result.summary.red > 0
                  ? "Attention needed"
                  : result.summary.yellow > 0
                    ? "Mostly green"
                    : "All green"
              }
              tone={summaryTone === "error" ? "error" : summaryTone === "warning" ? "warning" : "success"}
            />
          }
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                Target user
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-100">{result.targetUser.name}</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                {result.targetUser.email || result.targetUser.id}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                Supabase URL
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-100">
                {result.environment.url ? "Loaded" : "Missing"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                Supabase anon key
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-100">
                {result.environment.anonKey ? "Loaded" : "Missing"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                Service role key
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-100">
                {result.environment.serviceRoleKey ? "Loaded" : "Missing"}
              </p>
            </div>
          </div>
        </SectionCard>
      ) : (
        <SectionCard
          title="Ready when you are"
          description="Nothing runs automatically here. Click the button above to generate the next set of green lights."
        >
          <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-950/40 p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-600 bg-slate-900/80">
              <ShieldCheck className="h-7 w-7 text-sky-300" />
            </div>
            <p className="mt-4 text-base font-semibold text-slate-100">No system test has been run yet</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              This keeps the page quiet until you want a fresh read-only smoke check.
            </p>
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Color guide"
        description="These colors stay consistent across the test cards so it is easy to tell what needs attention for the selected user."
      >
        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              label: "Green",
              tone: "success" as const,
              title: "Passed",
              detail: "The check answered successfully and the path is working as expected.",
            },
            {
              label: "Yellow",
              tone: "warning" as const,
              title: "Fallback or empty",
              detail: "The check used a safe fallback or there is not enough data yet to mark it green.",
            },
            {
              label: "Red",
              tone: "error" as const,
              title: "Needs attention",
              detail: "The check failed or a required config or data path could not be read.",
            },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                    {item.label}
                  </div>
                  <div className="mt-2 text-base font-bold text-slate-100">{item.title}</div>
                </div>
                <StatusBadge label={item.label} tone={item.tone} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">{item.detail}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {result ? (
        <SectionCard
          title="Function checks"
          description={`Each card is a single function or system path for ${result.targetUser.name}. Green means the function answered successfully.`}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {result.checks.map((check) => (
              <CheckCard key={check.id} check={check} />
            ))}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
