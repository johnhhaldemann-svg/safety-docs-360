"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useCallback, useEffect, useState } from "react";
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

export default function CompanyIntegrationsPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"neutral" | "success" | "error" | "warning">("neutral");
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [lastSecret, setLastSecret] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const res = await fetch("/api/company/integrations/webhooks", {
        headers: { Authorization: `Bearer ${session.access_token}` },
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

  useEffect(() => {
    void load();
  }, [load]);

  async function createWebhook() {
    if (!name.trim() || !targetUrl.trim()) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const res = await fetch("/api/company/integrations/webhooks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const res = await fetch(`/api/company/integrations/webhooks/${encodeURIComponent(id)}/deliveries`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
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
        description="Outbound webhooks with signed payloads. HRIS roster sync is available at POST /api/company/integrations/hris/roster."
      />

      {message ? <InlineMessage tone={tone}>{message}</InlineMessage> : null}
      {lastSecret ? (
        <InlineMessage tone="warning">
          Signing secret (copy now): <code className="break-all">{lastSecret}</code>
        </InlineMessage>
      ) : null}

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
