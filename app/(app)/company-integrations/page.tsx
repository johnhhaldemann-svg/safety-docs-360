"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useCallback, useEffect, useState } from "react";
import { Cloud, FolderSync, RefreshCw } from "lucide-react";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";

const supabase = getSupabaseBrowserClient();

type Webhook = {
  id: string;
  name: string;
  target_url: string;
  active: boolean;
  secretPreview?: string;
};

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

export default function CompanyIntegrationsPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMicrosoft, setLoadingMicrosoft] = useState(true);
  const [syncingMicrosoft, setSyncingMicrosoft] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"neutral" | "success" | "error" | "warning">("neutral");
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [lastSecret, setLastSecret] = useState("");
  const [dataverseEnvironmentUrl, setDataverseEnvironmentUrl] = useState("");
  const [microsoftStatus, setMicrosoftStatus] = useState<MicrosoftProjectStatus | null>(null);
  const [microsoftRows, setMicrosoftRows] = useState<MicrosoftProjectRows>({ projects: [], tasks: [] });

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
          returnTo: "/company-integrations",
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
          eventTypes: ["ping", "safety_forms.submitted"],
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
      setLastSecret(data?.secret ?? "");
      setTone("success");
      setMessage(data?.note || "Webhook created.");
      await load();
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Create failed.");
    }
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
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Test failed.");
    }
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Company admin"
        title="Integrations"
        description="Microsoft Project imports, outbound webhooks, and company data exchange tools."
      />

      {message ? <InlineMessage tone={tone}>{message}</InlineMessage> : null}
      {lastSecret ? (
        <InlineMessage tone="warning">
          Signing secret (copy now): <code className="break-all">{lastSecret}</code>
        </InlineMessage>
      ) : null}

      <SectionCard
        title="Microsoft Project"
        description="Read-only import from Microsoft Project for the web, new Planner, and Dataverse-backed project schedules."
      >
        {loadingMicrosoft ? (
          <InlineMessage>Loading Microsoft Project connector...</InlineMessage>
        ) : (
          <div className="space-y-5">
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

            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <input
                value={dataverseEnvironmentUrl}
                onChange={(e) => setDataverseEnvironmentUrl(e.target.value)}
                placeholder="https://your-org.crm.dynamics.com"
                className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
              />
              <button
                type="button"
                onClick={() => void connectMicrosoftProject()}
                className={appButtonPrimaryClassName}
              >
                <FolderSync className="mr-2 inline h-4 w-4" aria-hidden="true" />
                Connect
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
          <InlineMessage>Loading…</InlineMessage>
        ) : webhooks.length === 0 ? (
          <EmptyState title="No webhooks" description="Create one below for a test receiver (e.g. webhook.site)." />
        ) : (
          <ul className="space-y-3 text-sm text-slate-300">
            {webhooks.map((w) => (
              <li key={w.id} className="rounded-lg border border-slate-800 px-3 py-2">
                <div className="font-medium text-slate-100">{w.name}</div>
                <div className="text-xs text-slate-500 break-all">{w.target_url}</div>
                <div className="mt-1 text-xs text-slate-500">Secret preview: {w.secretPreview ?? "—"}</div>
                <button
                  type="button"
                  onClick={() => void testPing(w.id)}
                  className={`mt-2 ${appButtonSecondaryClassName}`}
                >
                  Send test
                </button>
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
            placeholder="https://…"
            className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
          />
          <button type="button" onClick={() => void createWebhook()} className={appButtonPrimaryClassName}>
            Create
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
