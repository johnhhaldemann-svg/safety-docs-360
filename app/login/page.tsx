"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { LegalAcceptanceBlock } from "@/components/LegalAcceptanceBlock";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleCreateAccount() {
    if (!agreed) {
      alert("You must accept the agreement before creating an account.");
      return;
    }

    if (!email.trim() || !password.trim()) {
      alert("Email and password are required.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      alert(error.message);
      return;
    }

    const session = data.session;

    if (session?.access_token) {
      await fetch("/api/legal/accept", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
    }

    setLoading(false);
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-sky-600">
         
        </div>
        <h1 className="mt-2 text-3xl font-black text-slate-900">
          {mode === "login" ? "Login" : "Create Account"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {mode === "login" ? "Sign in to continue" : "Create an account to continue"}
        </p>

        <div className="mt-6 flex gap-2 rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={[
              "flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition",
              mode === "login"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900",
            ].join(" ")}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={[
              "flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition",
              mode === "signup"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900",
            ].join(" ")}
          >
            Create Account
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-black outline-none focus:border-sky-500"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-black outline-none focus:border-sky-500"
          />

          {mode === "signup" ? (
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-black outline-none focus:border-sky-500"
            />
          ) : null}

          {mode === "signup" ? (
            <LegalAcceptanceBlock checked={agreed} onChange={setAgreed} compact />
          ) : null}

          <button
            onClick={mode === "login" ? handleLogin : handleCreateAccount}
            disabled={loading || (mode === "signup" && !agreed)}
            className="w-full rounded-xl bg-sky-600 py-3 font-bold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {loading
              ? mode === "login"
                ? "Logging in..."
                : "Creating Account..."
              : mode === "login"
                ? "Login"
                : "Create Account"}
          </button>
        </div>
      </div>
    </main>
  );
}
