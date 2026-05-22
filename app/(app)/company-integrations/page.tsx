"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AppWindow,
  CalendarDays,
  CheckCircle2,
  Cloud,
  ExternalLink,
  FolderSync,
  KeyRound,
  ListChecks,
  PlugZap,
  RefreshCw,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";

const supabase = getSupabaseBrowserClient();
const MICROSOFT_PROJECT_STORE_SEARCH_URL = "ms-windows-store://search/?query=Microsoft%20Project";
const MICROSOFT_PROJECT_STORE_WEB_URL = "https://apps.microsoft.com/search?query=Microsoft%20Project";

type Webhook = {
  id: string;
  name: string;
  target_url: string;
  active: boolean;
  event_types?: string[];
  secretPreview?: string;
};

type WebhookDelivery = {
  id: string;
  event_type?: string | null;
  response_status?: number | null;
  delivered_at?: string | null;
};

const WEBHOOK_EVENT_OPTIONS = [
  { value: "ping", label: "Test ping" },
  { value: "safety_forms.submitted", label: "Safety forms" },
  { value: "training.gap", label: "Training gaps" },
  { value: "permits.auto_assigned", label: "Permit auto-assignments" },
  { value: "risk.recommendation", label: "Risk recommendations" },
  { value: "billing.invoice", label: "Billing invoices" },
];

type MicrosoftProjectStatus = {
  configured: {
    configured: boolean;
    clientId: boolean;
    clientSecret: boolean;
    redirectUri: boolean;
    tokenEncryptionKey: boolean;
  };
  connected: boolean;
  connection: {
    status: string;
    displayName?: string | null;
    accountEmail?: string | null;
    dataverseEnvironmentUrl?: string | null;
    lastSyncAt?: string | null;
  } | null;
  latestRun?: {
    status?: string;
    projects_imported?: number;
    tasks_imported?: number;
    assignments_imported?: number;
    error_message?: string | null;
    finished_at?: string | null;
  } | null;
  counts: {
    projects: number;
    tasks: number;
  };
};

type MicrosoftProjectRows = {
  projects: Array<{
    id: string;
    name: string;
    project_number?: string | null;
    status?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    owner_name?: string | null;
    owner_email?: string | null;
    last_seen_at?: string | null;
  }>;
  tasks: Array<{
    id: string;
    project_source_id?: string | null;
    title: string;
    status?: string | null;
    percent_complete?: number | null;
    due_at?: string | null;
  }>;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getMicrosoftProjectStoreUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_MICROSOFT_PROJECT_STORE_URL?.trim();
  if (configuredUrl) return configuredUrl;

  if (typeof navigator !== "undefined" && /\bWindows\b/i.test(navigator.userAgent)) {
    return MICROSOFT_PROJECT_STORE_SEARCH_URL;
  }

  return MICROSOFT_PROJECT_STORE_WEB_URL;
}

export default function CompanyIntegrationsPage() {
  const pathname = usePathname();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMicrosoft, setLoadingMicrosoft] = useState(true);
  const [syncingMicrosoft, setSyncingMicrosoft] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"neutral" | "success" | "error" | "warning">("neutral");
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["ping", "safety_forms.submitted"]);
  const [deliveriesByWebhook, setDeliveriesByWebhook] = useState<Record<string, WebhookDelivery[]>>({});
  const [updatingWebhookId, setUpdatingWebhookId] = useState<string | null>(null);
  const [lastSecret, setLastSecret] = useState("");
  const [dataverseEnvironmentUrl, setDataverseEnvironmentUrl] = useState("");
  const [microsoftStatus, setMicrosoftStatus] = useState<MicrosoftProjectStatus | null>(null);
  const [microsoftRows, setMicrosoftRows] = useState<MicrosoftProjectRows>({ projects: [], tasks: [] });
  const microsoftAppState = loadingMicrosoft
    ? "Loading"
    : microsoftStatus?.connected
      ? "Installed"
      : microsoftStatus?.configured.configured
        ? "Ready to install"
        : "Setup required";
  const microsoftAppTone =
    microsoftStatus?.connected
      ? "border-[rgba(46,158,91,0.26)] bg-[var(--semantic-success-bg)] text-[var(--semantic-success)]"
      : microsoftStatus?.configured.configured
        ? "border-[var(--app-accent-border-24)] bg-[var(--app-accent-primary-soft)] text-[var(--app-accent-primary)]"
      : "border-[rgba(217,164,65,0.28)] bg-[var(--semantic-warning-bg)] text-[var(--semantic-warning)]";
  const microsoftProjectReturnTo = pathname.startsWith("/safe-predict/")
    ? pathname
    : "/company-integrations";

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Not signed in.");
    return session.access_token;
  }

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/company/integrations/webhooks", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => null)) as { webhooks?: Webhook[]; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Failed to load webhooks.");
      setWebhooks(data?.webhooks ?? []);
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Load failed.");
    }
    setLoading(false);
  }, []);

  const loadMicrosoftProject = useCallback(async () => {
    setLoadingMicrosoft(true);
    try {
      const token = await getAccessToken();
      const [statusRes, rowsRes] = await Promise.all([
        fetch("/api/company/integrations/microsoft-project/status", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/company/integrations/microsoft-project/projects", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const statusData = (await statusRes.json().catch(() => null)) as MicrosoftProjectStatus & { error?: string };
      const rowsData = (await rowsRes.json().catch(() => null)) as MicrosoftProjectRows & { error?: string };
      if (!statusRes.ok) throw new Error(statusData?.error || "Failed to load Microsoft Project status.");
      if (!rowsRes.ok) throw new Error(rowsData?.error || "Failed to load Microsoft Project imports.");
      setMicrosoftStatus(statusData);
      setMicrosoftRows({ projects: rowsData.projects ?? [], tasks: rowsData.tasks ?? [] });
      setDataverseEnvironmentUrl(statusData.connection?.dataverseEnvironmentUrl ?? "");
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Microsoft Project load failed.");
    }
    setLoadingMicrosoft(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
      void loadMicrosoftProject();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, loadMicrosoftProject]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const microsoftProject = params.get("microsoftProject");
      if (!microsoftProject) return;

      if (microsoftProject === "connected" || microsoftProject === "demo-connected") {
        setTone("success");
        setMessage(
          microsoftProject === "demo-connected"
            ? "Microsoft Project demo app installed for this workspace."
            : "Microsoft Project app installed for this workspace."
        );
        return;
      }

      if (microsoftProject === "error") {
        setTone("error");
        setMessage(params.get("message") || "Microsoft Project connection failed.");
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function openMicrosoftProjectApp() {
    document.getElementById("microsoft-project-app")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function openMicrosoftProjectStore() {
    window.location.href = getMicrosoftProjectStoreUrl();
  }

  async function connectMicrosoftProject() {
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/company/integrations/microsoft-project/connect", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dataverseEnvironmentUrl: dataverseEnvironmentUrl.trim(),
          returnTo: microsoftProjectReturnTo,
        }),
      });
      const data = (await res.json().catch(() => null)) as { authorizationUrl?: string; error?: string } | null;
      if (!res.ok || !data?.authorizationUrl) throw new Error(data?.error || "Microsoft Project connection failed.");
      window.location.href = data.authorizationUrl;
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Microsoft Project connection failed.");
    }
  }

  async function syncMicrosoftProject() {
    setSyncingMicrosoft(true);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/company/integrations/microsoft-project/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        status?: string;
        projectsImported?: number;
        tasksImported?: number;
        assignmentsImported?: number;
        warnings?: string[];
      } | null;
      if (!res.ok) throw new Error(data?.error || "Microsoft Project sync failed.");
      setTone(data?.warnings?.length ? "warning" : "success");
      setMessage(
        `Microsoft Project sync ${data?.status ?? "finished"}: ${data?.projectsImported ?? 0} projects, ${
          data?.tasksImported ?? 0
        } tasks, ${data?.assignmentsImported ?? 0} assignments.`
      );
      await loadMicrosoftProject();
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Microsoft Project sync failed.");
    }
    setSyncingMicrosoft(false);
  }

  async function createWebhook() {
    if (!name.trim() || !targetUrl.trim()) return;
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/company/integrations/webhooks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          targetUrl: targetUrl.trim(),
          eventTypes: selectedEvents,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        secret?: string;
        note?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error || "Create failed.");
      setName("");
      setTargetUrl("");
      setSelectedEvents(["ping", "safety_forms.submitted"]);
      setLastSecret(data?.secret ?? "");
      setTone("success");
      setMessage(data?.note || "Webhook created.");
      await load();
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Create failed.");
    }
  }

  async function patchWebhook(
    id: string,
    patch: { active?: boolean; eventTypes?: string[]; rotateSecret?: boolean }
  ) {
    setUpdatingWebhookId(id);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/company/integrations/webhooks/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patch),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        secret?: string;
        note?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error || "Webhook update failed.");
      if (data?.secret) {
        setLastSecret(data.secret);
        setMessage(data.note || "Signing secret rotated.");
        setTone("warning");
      } else {
        setMessage("Webhook updated.");
        setTone("success");
      }
      await load();
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Webhook update failed.");
    }
    setUpdatingWebhookId(null);
  }

  async function toggleWebhookEvent(webhook: Webhook, eventType: string) {
    const current = new Set(webhook.event_types ?? []);
    if (current.has(eventType)) current.delete(eventType);
    else current.add(eventType);
    await patchWebhook(webhook.id, { eventTypes: [...current] });
  }

  async function loadDeliveries(id: string) {
    setUpdatingWebhookId(id);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/company/integrations/webhooks/${encodeURIComponent(id)}/deliveries`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => null)) as {
        deliveries?: WebhookDelivery[];
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error || "Failed to load deliveries.");
      setDeliveriesByWebhook((prev) => ({ ...prev, [id]: data?.deliveries ?? [] }));
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Failed to load deliveries.");
    }
    setUpdatingWebhookId(null);
  }

  async function testPing(id: string) {
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/company/integrations/webhooks/${encodeURIComponent(id)}/deliveries`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ eventType: "ping", payload: { hello: true } }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; responseStatus?: number } | null;
      if (!res.ok) throw new Error(data?.error || "Test failed.");
      setTone("success");
      setMessage(`Test sent. HTTP status: ${data?.responseStatus ?? "n/a"}`);
      await loadDeliveries(id);
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Test failed.");
    }
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Company admin"
        title="Apps & Integrations"
        description="Install connected apps into the company workspace, then launch them from this app desktop."
      />

      {message ? <InlineMessage tone={tone}>{message}</InlineMessage> : null}
      {lastSecret ? (
        <InlineMessage tone="warning">
          Signing secret (copy now): <code className="break-all">{lastSecret}</code>
        </InlineMessage>
      ) : null}

      <SectionCard
        title="App Desktop"
        description="Connected tools appear here as launchable workspace apps."
        tone="attention"
      >
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <button
            type="button"
            onClick={openMicrosoftProjectApp}
            className="group relative overflow-hidden rounded-xl border border-[var(--app-border-strong)] bg-white p-5 text-left shadow-[0_14px_32px_rgba(44,58,86,0.07)] transition hover:-translate-y-0.5 hover:border-[var(--app-accent-border-24)]"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[var(--app-accent-border-20)] bg-[linear-gradient(135deg,_#ffffff_0%,_#eaf2ff_100%)] text-[var(--app-accent-primary)] shadow-[0_10px_18px_rgba(37,99,235,0.1)]">
                  <CalendarDays className="h-7 w-7" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight text-[var(--app-text-strong)]">
                      Microsoft Project
                    </h2>
                    <span
                      className={cx(
                        "inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.12em]",
                        microsoftAppTone
                      )}
                    >
                      {microsoftAppState}
                    </span>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--app-text)]">
                    Import project schedules, tasks, and assignments into jobsites and safety planning.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2 text-sm font-semibold text-[var(--app-accent-primary)] transition group-hover:bg-[var(--app-accent-primary-soft)]">
                <AppWindow className="h-4 w-4" aria-hidden="true" />
                Open app
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: CheckCircle2,
                  label: "Connection",
                  value: microsoftStatus?.connected ? "Connected" : "Not connected",
                },
                {
                  icon: FolderSync,
                  label: "Projects",
                  value: `${microsoftStatus?.counts.projects ?? 0} imported`,
                },
                {
                  icon: RefreshCw,
                  label: "Tasks",
                  value: `${microsoftStatus?.counts.tasks ?? 0} imported`,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3"
                  >
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {item.label}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-[var(--app-text-strong)]">{item.value}</div>
                  </div>
                );
              })}
            </div>
          </button>

          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--app-border)] bg-white text-[var(--app-accent-primary)]">
                <PlugZap className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-base font-bold text-[var(--app-text-strong)]">Install flow</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--app-text)]">
                  Install through Microsoft Store, then connect your Microsoft account and sync whenever schedules change.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={openMicrosoftProjectApp} className={appButtonPrimaryClassName}>
                <AppWindow className="h-4 w-4" aria-hidden="true" />
                Launch Microsoft Project
              </button>
              <button
                type="button"
                onClick={() => void loadMicrosoftProject()}
                disabled={loadingMicrosoft}
                className={appButtonSecondaryClassName}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Refresh apps
              </button>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Microsoft Project App"
        eyebrow={microsoftStatus?.connected ? "Installed app" : "Available app"}
        description="Read-only import from Microsoft Project for the web, new Planner, and Dataverse-backed project schedules."
        actions={
          <span
            className={cx(
              "inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.12em]",
              microsoftAppTone
            )}
          >
            {microsoftAppState}
          </span>
        }
      >
        <div id="microsoft-project-app" className="scroll-mt-8" />
        {loadingMicrosoft ? (
          <InlineMessage>Loading Microsoft Project connector...</InlineMessage>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-[var(--app-border)] bg-[linear-gradient(180deg,_#ffffff_0%,_#f6f9ff_100%)] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-bold text-[var(--app-text-strong)]">
                    <ShieldCheck className="h-4 w-4 text-[var(--app-accent-primary)]" aria-hidden="true" />
                    Account linking instructions
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--app-text)]">
                    Link a Microsoft work account that can read the company Project schedules. After Microsoft returns
                    you to SafePredict, run Sync to bring projects and tasks into this workspace.
                  </p>
                </div>
                <span
                  className={cx(
                    "inline-flex shrink-0 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.12em]",
                    microsoftAppTone
                  )}
                >
                  {microsoftAppState}
                </span>
              </div>

              <ol className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  {
                    title: "1. Confirm access",
                    detail:
                      "Use a Microsoft work or school account with access to the Project / Planner schedules you want imported.",
                  },
                  {
                    title: "2. Add environment",
                    detail:
                      "If your projects live in Dataverse, enter the Dynamics environment URL before installing the app.",
                  },
                  {
                    title: "3. Install and sync",
                    detail:
                      "Select Install app to open Microsoft Store, connect your Microsoft account, then select Sync to import schedules.",
                  },
                ].map((step) => (
                  <li
                    key={step.title}
                    className="rounded-xl border border-[var(--app-border)] bg-white/82 px-4 py-3 shadow-[0_8px_18px_rgba(76,108,161,0.045)]"
                  >
                    <div className="text-sm font-semibold text-[var(--app-text-strong)]">{step.title}</div>
                    <p className="mt-1 text-sm leading-6 text-[var(--app-text)]">{step.detail}</p>
                  </li>
                ))}
              </ol>

              <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-xl border border-[rgba(46,158,91,0.2)] bg-[var(--semantic-success-bg)] px-4 py-3 text-[var(--semantic-success)]">
                  Linked account: {microsoftStatus?.connection?.accountEmail || "Not linked yet"}
                </div>
                <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3 text-[var(--app-text)]">
                  Verify the link by checking that imported projects and tasks appear below after Sync.
                </div>
              </div>
            </div>

            <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-3">
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center gap-2 text-slate-100">
                  <Cloud className="h-4 w-4" aria-hidden="true" />
                  {microsoftStatus?.connected ? "Connected" : "Not connected"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {microsoftStatus?.connection?.accountEmail ||
                    (microsoftStatus?.configured.configured ? "Ready to connect" : "Environment not configured")}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-slate-100">{microsoftStatus?.counts.projects ?? 0} imported projects</div>
                <div className="mt-1 text-xs text-slate-500">{microsoftStatus?.counts.tasks ?? 0} imported tasks</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-slate-100">Last sync</div>
                <div className="mt-1 text-xs text-slate-500">
                  {microsoftStatus?.connection?.lastSyncAt
                    ? new Date(microsoftStatus.connection.lastSyncAt).toLocaleString()
                    : "Not synced yet"}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
              <input
                value={dataverseEnvironmentUrl}
                onChange={(e) => setDataverseEnvironmentUrl(e.target.value)}
                placeholder="https://your-org.crm.dynamics.com"
                className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
              />
              <button
                type="button"
                onClick={openMicrosoftProjectStore}
                className={appButtonPrimaryClassName}
              >
                <ExternalLink className="mr-2 inline h-4 w-4" aria-hidden="true" />
                Install app
              </button>
              <button
                type="button"
                onClick={() => void connectMicrosoftProject()}
                className={appButtonSecondaryClassName}
              >
                <FolderSync className="mr-2 inline h-4 w-4" aria-hidden="true" />
                {microsoftStatus?.connected ? "Reconnect account" : "Connect account"}
              </button>
              <button
                type="button"
                onClick={() => void syncMicrosoftProject()}
                disabled={!microsoftStatus?.connected || syncingMicrosoft}
                className={appButtonSecondaryClassName}
              >
                <RefreshCw className="mr-2 inline h-4 w-4" aria-hidden="true" />
                {syncingMicrosoft ? "Syncing" : "Sync"}
              </button>
            </div>

            {!microsoftStatus?.configured.configured ? (
              <InlineMessage tone="warning">
                <span className="inline-flex items-center gap-2">
                  <Settings2 className="h-4 w-4" aria-hidden="true" />
                  Microsoft Project environment variables are required before live installation.
                </span>
              </InlineMessage>
            ) : null}

            {microsoftStatus?.latestRun?.error_message ? (
              <InlineMessage tone="error">{microsoftStatus.latestRun.error_message}</InlineMessage>
            ) : null}

            {microsoftRows.projects.length === 0 ? (
              <EmptyState title="No imported projects" description="Connect Microsoft and run sync to populate this list." />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {microsoftRows.projects.slice(0, 6).map((project) => {
                  const projectTasks = microsoftRows.tasks.filter((task) => task.project_source_id === project.id);
                  return (
                    <div key={project.id} className="rounded-lg border border-slate-800 px-3 py-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-slate-100">{project.name}</div>
                          <div className="text-xs text-slate-500">
                            {[project.project_number, project.status, project.owner_name].filter(Boolean).join(" / ") ||
                              "Microsoft Project import"}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500">{projectTasks.length} tasks</div>
                      </div>
                      {projectTasks.length ? (
                        <ul className="mt-3 space-y-1 text-xs text-slate-400">
                          {projectTasks.slice(0, 3).map((task) => (
                            <li key={task.id} className="flex justify-between gap-3">
                              <span className="truncate">{task.title}</span>
                              <span className="shrink-0 text-slate-500">{task.status ?? "not started"}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Webhooks" description="Receivers should verify X-Safety360-Signature (HMAC-SHA256 of raw body).">
        {loading ? (
          <InlineMessage>Loading...</InlineMessage>
        ) : webhooks.length === 0 ? (
          <EmptyState title="No webhooks" description="Create one below for a test receiver (e.g. webhook.site)." />
        ) : (
          <ul className="space-y-4 text-sm text-slate-300">
            {webhooks.map((w) => (
              <li key={w.id} className="rounded-lg border border-slate-800 px-3 py-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-100">{w.name}</div>
                    <div className="break-all text-xs text-slate-500">{w.target_url}</div>
                    <div className="mt-1 text-xs text-slate-500">Secret preview: {w.secretPreview ?? "-"}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void patchWebhook(w.id, { active: !w.active })}
                      disabled={updatingWebhookId === w.id}
                      className={appButtonSecondaryClassName}
                    >
                      {w.active ? "Pause" : "Activate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void patchWebhook(w.id, { rotateSecret: true })}
                      disabled={updatingWebhookId === w.id}
                      className={appButtonSecondaryClassName}
                    >
                      <KeyRound className="h-4 w-4" aria-hidden="true" />
                      Rotate secret
                    </button>
                    <button
                      type="button"
                      onClick={() => void testPing(w.id)}
                      disabled={updatingWebhookId === w.id}
                      className={appButtonSecondaryClassName}
                    >
                      Send test
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadDeliveries(w.id)}
                      disabled={updatingWebhookId === w.id}
                      className={appButtonSecondaryClassName}
                    >
                      <ListChecks className="h-4 w-4" aria-hidden="true" />
                      Deliveries
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {WEBHOOK_EVENT_OPTIONS.map((option) => {
                    const checked = (w.event_types ?? []).includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className={cx(
                          "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
                          checked
                            ? "border-[var(--app-accent-border-24)] bg-[var(--app-accent-primary-soft)] text-[var(--app-accent-primary)]"
                            : "border-slate-800 bg-slate-950 text-slate-400"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => void toggleWebhookEvent(w, option.value)}
                          className="h-3.5 w-3.5"
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>

                {deliveriesByWebhook[w.id]?.length ? (
                  <div className="mt-3 overflow-hidden rounded-lg border border-slate-800">
                    <div className="grid grid-cols-[1fr_80px_150px] bg-slate-950 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      <span>Event</span>
                      <span>Status</span>
                      <span>Delivered</span>
                    </div>
                    {deliveriesByWebhook[w.id].slice(0, 5).map((delivery) => (
                      <div
                        key={delivery.id}
                        className="grid grid-cols-[1fr_80px_150px] border-t border-slate-800 px-3 py-2 text-xs text-slate-400"
                      >
                        <span className="truncate">{delivery.event_type ?? "event"}</span>
                        <span>{delivery.response_status ?? "n/a"}</span>
                        <span>
                          {delivery.delivered_at ? new Date(delivery.delivered_at).toLocaleString() : "Queued"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="New webhook" description="After create, copy the signing secret from the banner above.">
        <div className="flex max-w-xl flex-col gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
          />
          <input
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://..."
            className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
          />
          <div className="flex flex-wrap gap-2 py-2">
            {WEBHOOK_EVENT_OPTIONS.map((option) => {
              const checked = selectedEvents.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={cx(
                    "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
                    checked
                      ? "border-[var(--app-accent-border-24)] bg-[var(--app-accent-primary-soft)] text-[var(--app-accent-primary)]"
                      : "border-slate-800 bg-slate-950 text-slate-400"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedEvents((prev) =>
                        prev.includes(option.value)
                          ? prev.filter((value) => value !== option.value)
                          : [...prev, option.value]
                      )
                    }
                    className="h-3.5 w-3.5"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
          <button type="button" onClick={() => void createWebhook()} className={appButtonPrimaryClassName}>
            Create
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
