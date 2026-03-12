"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-sky-600">
          Anytime Safety
        </div>
        <h1 className="mt-2 text-3xl font-black text-slate-900">Login</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in to continue</p>

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

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full rounded-xl bg-sky-600 py-3 font-bold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </div>
      </div>
    </main>
  );
}