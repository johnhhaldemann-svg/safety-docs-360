"use client";

import { useEffect } from "react";

export default function AppSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 py-12">
      <div className="max-w-md rounded-xl border border-slate-700/80 bg-slate-900/90 px-6 py-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-100">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-400">
          This part of the app hit an error. You can try again or go back to the dashboard.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-slate-400">Ref: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-[linear-gradient(135deg,_#0d9488_0%,_#059669_100%)] px-4 py-2 text-sm font-medium text-white hover:opacity-95"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-950/50"
          >
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
