"use client";

import { useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";

type AiEngineRefreshButtonProps = {
  days?: number;
  jobsiteId?: string | null;
  label?: string;
  compact?: boolean;
  buttonClassName?: string;
  onRefreshed?: () => void | Promise<void>;
};

export function AiEngineRefreshButton({
  days = 30,
  jobsiteId,
  label = "Refresh AI",
  compact = false,
  buttonClassName,
  onRefreshed,
}: AiEngineRefreshButtonProps) {
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (busy) return;
    setBusy(true);
    try {
      await onRefreshed?.();
    } finally {
      setBusy(false);
    }
  }

  const classes =
    buttonClassName ??
    "inline-flex h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 shadow-sm transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60";

  return (
    <button
      type="button"
      className={classes}
      disabled={busy || !jobsiteId}
      onClick={() => void refresh()}
      title={`${label} for the next ${days} days`}
    >
      {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {compact ? label : <span>{label}</span>}
    </button>
  );
}
