"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { useGusNotificationSettings } from "@/components/gus/useGusNotificationSettings";
import type { GusContext } from "@/lib/gus/gusContext";
import type { GusDecision, GusMessage } from "@/lib/gus/gusTypes";

type GusEmailNotificationControlsProps = {
  message: GusMessage;
  decision: GusDecision;
  context: GusContext;
};

type SendState = "idle" | "sending" | "sent" | "skipped" | "error";

export function GusEmailNotificationControls({ message, decision, context }: GusEmailNotificationControlsProps) {
  const { settings } = useGusNotificationSettings();
  const [status, setStatus] = useState<SendState>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  if (!settings.emailEnabled) {
    return (
      <div className="rounded-lg border border-[var(--app-border)] bg-white px-3 py-2">
        <button
          type="button"
          disabled
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--app-muted)] disabled:cursor-not-allowed"
        >
          <MailCheck className="h-4 w-4" aria-hidden="true" />
          Gus email notifications off
        </button>
        <p className="mt-2 text-[11px] leading-4 text-[var(--app-muted)]" role="status">
          Update Gus notification preferences from your profile.
        </p>
      </div>
    );
  }

  async function sendEmailNotification() {
    if (status === "sending") return;
    const confirmed = window.confirm(
      "Send this Gus safety review note to your account email? Gus will not email anyone without this confirmation.",
    );
    if (!confirmed) return;

    setStatus("sending");
    setStatusMessage("");

    try {
      const response = await fetch("/api/gus/notifications/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed: true,
          subject: `Gus safety review: ${context.currentPage}`,
          message: message.message,
          reason: message.reason ?? decision.reason,
          actionLabel: message.actionLabel ?? decision.actions[0]?.label,
          actionHref: message.actionHref ?? decision.actions[0]?.href,
          jobsiteName: context.currentPage.includes("Jobsite") ? context.currentPage : undefined,
          priority: message.priority,
          category: message.category,
          attentionLevel: decision.attentionLevel,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        sent?: boolean;
        warning?: string | null;
        error?: string;
        toEmail?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Gus could not send that email notification.");
      }

      if (payload?.sent) {
        setStatus("sent");
        setStatusMessage(`Sent to ${payload.toEmail ?? "your account email"}.`);
      } else {
        setStatus("skipped");
        setStatusMessage(payload?.warning || "Email delivery is not configured yet.");
      }
    } catch (error) {
      setStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "Gus could not send that email notification.");
    }
  }

  return (
    <div className="rounded-lg border border-[var(--app-border)] bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={sendEmailNotification}
          disabled={status === "sending"}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-soft)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <MailCheck className="h-4 w-4" aria-hidden="true" />
          {status === "sending" ? "Sending..." : "Email me this Gus alert"}
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-[var(--app-muted)]" role="status">
        {statusMessage || "Gus sends email only after your confirmation."}
      </p>
    </div>
  );
}
