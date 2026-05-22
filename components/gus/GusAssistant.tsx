"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardList, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { GusCompanionStage } from "@/components/gus/GusCompanionStage";
import { GusConversation } from "@/components/gus/GusConversation";
import { GusEmailNotificationControls } from "@/components/gus/GusEmailNotificationControls";
import { GusPlanningMode } from "@/components/gus/GusPlanningMode";
import { GusBotFigure, GusSmartBot } from "@/components/gus/GusSmartBot";
import { GusVoiceControls } from "@/components/gus/GusVoiceControls";
import { useGusAssistant } from "@/components/gus/useGusAssistant";
import type { GusContext } from "@/lib/gus/gusContext";

function GusAvatar({ compact = false }: { compact?: boolean }) {
  return (
    <GusBotFigure state="thinking" compact={compact} />
  );
}

type GusAssistantProps = {
  currentPage?: string;
  route?: string;
  companyId?: string | null;
  jobsiteId?: string | null;
  userId?: string | null;
  liveContext?: Partial<GusContext>;
};

export function GusAssistant({ currentPage, route, companyId, jobsiteId, userId, liveContext }: GusAssistantProps) {
  const [planningOpen, setPlanningOpen] = useState(false);
  const {
    open,
    pathname,
    currentPage: resolvedCurrentPage,
    context,
    message,
    decision,
    isVisible,
    voiceEnabled,
    feedback,
    openAssistant,
    minimizeAssistant,
    dismissAssistant,
    disableForToday,
    recordFeedback,
  } = useGusAssistant({ currentPage, route, companyId, jobsiteId, userId, liveContext });

  if (!isVisible) {
    return null;
  }

  if (!open) {
    return (
      <GusSmartBot
        decision={decision}
        open={open}
        muted={!voiceEnabled && decision.botState === "muted"}
        onOpen={openAssistant}
        onPlan={() => setPlanningOpen(true)}
        onDismiss={dismissAssistant}
      />
    );
  }

  if (planningOpen) {
    return (
      <aside
        className="fixed inset-x-3 bottom-3 z-40 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[min(58rem,calc(100vw-2.5rem))]"
        aria-label={`Gus planning mode for ${resolvedCurrentPage}`}
      >
        <GusPlanningMode onClose={() => setPlanningOpen(false)} />
      </aside>
    );
  }

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-40 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[32rem]"
      aria-label={`Gus AI Safety Coach for ${resolvedCurrentPage}`}
    >
      <div className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-white shadow-[0_22px_52px_rgba(24,41,73,0.18)] ring-1 ring-[rgba(37,99,235,0.08)]">
        <div className="flex items-start gap-3 border-b border-[var(--app-border)] bg-[linear-gradient(135deg,_#ffffff_0%,_#eef5ff_100%)] p-4">
          <GusAvatar compact />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-accent-primary)]">
              Gus Smart AI Safety Bot
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--app-text-strong)]">
              {decision.kind === "warning" ? "Review signal detected. Human review required." : "Draft guidance only. Human review required."}
            </p>
          </div>
          <button
            type="button"
            onClick={minimizeAssistant}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--app-border)] bg-white/86 text-[var(--app-muted)] transition hover:bg-white hover:text-[var(--app-text-strong)]"
            aria-label="Minimize Gus"
            title="Minimize"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <GusCompanionStage
            decision={decision}
            onPlan={() => setPlanningOpen(true)}
            onDismiss={dismissAssistant}
          />

          <div className="flex gap-3">
            <GusAvatar compact />
            <div className="min-w-0 flex-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3">
              <p className="text-sm leading-6 text-[var(--app-text-strong)]">{message.message}</p>
              {message.reason ? (
                <p className="mt-2 rounded-lg border border-[var(--app-border-subtle)] bg-white/72 px-3 py-2 text-xs leading-5 text-[var(--app-muted)]">
                  {message.reason}
                </p>
              ) : null}
              {decision.signals.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {decision.signals.slice(0, 4).map((signal) => (
                    <span
                      key={signal.signalId}
                      className="rounded-full border border-[var(--app-border)] bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--app-text)]"
                    >
                      {signal.count ? `${signal.count} ` : ""}
                      {signal.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <GusConversation context={context} decision={decision} initialMessage={message.message} />

          <GusVoiceControls message={message} route={pathname} assistantOpen={open} />

          <GusEmailNotificationControls message={message} decision={decision} context={context} />

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => setPlanningOpen(true)}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--app-accent-primary)] px-3 py-2 text-sm font-semibold text-white shadow-[var(--app-shadow-primary-button)] transition hover:bg-[var(--app-accent-primary-hover)] sm:flex-none"
            >
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              Plan work with Gus
            </button>
            {message.actionHref && message.actionLabel ? (
              <Link
                href={message.actionHref}
                className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-soft)] sm:flex-none"
              >
                {message.actionLabel}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => recordFeedback("helpful")}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-soft)]"
            >
              <ThumbsUp className="h-4 w-4" aria-hidden="true" />
              Helpful
            </button>
            <button
              type="button"
              onClick={() => recordFeedback("not_helpful")}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-soft)]"
            >
              <ThumbsDown className="h-4 w-4" aria-hidden="true" />
              Not helpful
            </button>
          </div>
          {feedback ? (
            <p className="text-xs font-semibold text-emerald-700" role="status">
              Thanks. Gus feedback noted for this session.
            </p>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-[var(--app-border)] pt-3 sm:flex-row">
            <button
              type="button"
              onClick={dismissAssistant}
              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2 text-sm font-semibold text-[var(--app-text)] transition hover:bg-white"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={disableForToday}
              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--app-muted)] transition hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text-strong)]"
            >
              Do not show again today
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
