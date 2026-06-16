"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "error">("neutral");
  const [saving, setSaving] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseBrowserClient();

    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSessionReady(Boolean(data.session));
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setSessionReady(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setMessageTone("neutral");

    if (password.length < 12) {
      setMessageTone("error");
      setMessage("Password must be at least 12 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessageTone("error");
      setMessage("Password confirmation does not match.");
      return;
    }

    setSaving(true);
    const { error } = await getSupabaseBrowserClient().auth.updateUser({ password });
    setSaving(false);

    if (error) {
      setMessageTone("error");
      setMessage(error.message || "Unable to update password.");
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setMessageTone("success");
    setMessage("Password updated.");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-xl items-center">
        <section className="w-full rounded-3xl border border-slate-800 bg-slate-900/85 p-8 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
            Account Access
          </p>
          <h1 className="mt-3 text-3xl font-bold">Reset password</h1>

          <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              New password
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500"
              />
            </label>

            {message ? (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  messageTone === "success"
                    ? "border-emerald-700 bg-emerald-950/40 text-emerald-100"
                    : messageTone === "error"
                      ? "border-red-700 bg-red-950/40 text-red-100"
                      : "border-slate-700 bg-slate-950/50 text-slate-200"
                }`}
              >
                {message}
              </div>
            ) : null}

            {!sessionReady ? (
              <div className="rounded-xl border border-amber-700 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
                Open this page from the reset email link.
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Link
                href="/login"
                className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                Back to Login
              </Link>
              <button
                type="submit"
                disabled={saving || !sessionReady}
                className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Update Password"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
