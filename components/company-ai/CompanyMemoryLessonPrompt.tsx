"use client";

import Link from "next/link";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  /** Where the user can add memory (page with Company knowledge panel). */
  href?: string;
};

/**
 * Dismissible nudge after milestone actions (e.g. incident closed, JSA submitted) to seed company memory.
 */
export function CompanyMemoryLessonPrompt({
  visible,
  onDismiss,
  href = "/dashboard#company-knowledge",
}: Props) {
  if (!visible) return null;

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-sky-500/30 bg-sky-950/35 px-4 py-3 text-sm text-sky-100 sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <p className="min-w-0 leading-snug">
        <span className="font-semibold text-sky-50">Capture a lesson?</span> Add a short note to{" "}
        <span className="font-medium">Company knowledge</span> so the operations assistant can use it next time (site
        rules, PPE, or customer requirements).
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={href}
          className="rounded-lg border border-sky-500/50 bg-sky-950/50 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-900/60"
        >
          Open Company knowledge
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
