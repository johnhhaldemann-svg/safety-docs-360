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
  const [errorMsg, setErrorMsg] = useState("");

const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();

  setLoading(true);
  setErrorMsg("");

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    setErrorMsg(error.message);
    setLoading(false);
    return;
  }

  router.push("/");
  router.refresh();
};
  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full rounded border p-2 text-black"
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full rounded border p-2 text-black"
      />

      <button
        type="submit"
        disabled={loading}
        className="rounded bg-white px-4 py-2 text-black border"
      >
        {loading ? "Logging in..." : "Login"}
      </button>

      {errorMsg && <p className="text-red-600">{errorMsg}</p>}
    </form>
  );
}