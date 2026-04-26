"use client";

import { useCallback, useState } from "react";
import type { DashboardBlockId } from "@/components/dashboard/types";
import { fetchWithTimeoutSafe } from "@/lib/fetchWithTimeout";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const supabase = getSupabaseBrowserClient();

type PinResponse = {
  error?: string;
  layoutChanged?: boolean;
};

export function AddInsightToDashboardButton({
  blockId,
  className = "",
}: {
  blockId: DashboardBlockId;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "working" | "done" | "noop" | "error">("idle");
  const [detail, setDetail] = useState<string | null>(null);

  const onClick = useCallback(async () => {
    setStatus("working");
    setDetail(null);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) {
        setStatus("error");
        setDetail("Sign in to customize your dashboard.");
        return;
      }

      const response = await fetchWithTimeoutSafe(
        "/api/dashboard/layout/pin",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ blockId }),
        },
        15000,
        "Pin dashboard widget"
      );

      const payload = (await response.json().catch(() => null)) as PinResponse | null;
      if (!response.ok || !payload) {
        setStatus("error");
        setDetail(payload?.error || "Could not update your dashboard.");
        return;
      }

      if (payload.error) {
        setStatus("error");
        setDetail(payload.error);
        return;
      }

      if (payload.layoutChanged === false) {
        setStatus("noop");
        setDetail("Already on your dashboard.");
      } else {
        setStatus("done");
        setDetail("Added to your dashboard.");
      }
    } catch {
      setStatus("error");
      setDetail("Could not update your dashboard.");
    }
  }, [blockId]);

  const label =
    status === "working"
      ? "Adding…"
      : status === "done" || status === "noop"
        ? status === "noop"
          ? "On dashboard"
          : "Added"
        : "Add to dashboard";

  return (
    <span className={`inline-flex flex-col items-end gap-0.5 ${className}`}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          void onClick();
        }}
        disabled={status === "working"}
        className="whitespace-nowrap rounded-lg border border-[var(--app-accent-border-24)] bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--app-accent-primary)] shadow-sm transition hover:bg-[var(--app-accent-primary-soft)] disabled:opacity-60"
      >
        {label}
      </button>
      {detail && status !== "idle" && status !== "working" ? (
        <span
          className={[
            "max-w-[14rem] text-right text-[10px] font-medium leading-snug",
            status === "error" ? "text-rose-600" : "text-[var(--app-muted)]",
          ].join(" ")}
        >
          {detail}
        </span>
      ) : null}
    </span>
  );
}
