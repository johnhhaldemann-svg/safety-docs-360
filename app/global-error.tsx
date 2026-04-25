"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        event: "global_error_boundary",
        message: error.message,
        digest: error.digest ?? null,
      })
    );
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f4f7fb] px-6 py-16 text-slate-900">
        <main id="main-content" className="mx-auto max-w-lg text-center">
          <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
          <p className="mt-3 text-slate-600">
            The application hit an unexpected error. You can try again or refresh the page.
          </p>
          <button
            type="button"
            className="mt-8 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
            onClick={reset}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
