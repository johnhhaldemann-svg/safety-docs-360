"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      setLoading(false);
    }

    checkAuth();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 text-black">
        Checking login...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-black">
      <header className="border-b border-zinc-300 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-black">Safety Docs 360</h1>
            <p className="text-sm text-zinc-600">Project document tools</p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-bold text-black hover:bg-zinc-100"
          >
            Logout
          </button>
        </div>
      </header>

      <nav className="border-b border-zinc-300 bg-white">
        <div className="mx-auto flex max-w-7xl gap-2 px-6 py-3">
          <Link
            href="/"
            className={`rounded-xl px-4 py-2 text-sm font-bold ${
              pathname === "/"
                ? "bg-black text-white"
                : "bg-white text-black border border-zinc-300 hover:bg-zinc-100"
            }`}
          >
            Home
          </Link>

          <Link
            href="/pshsep"
            className={`rounded-xl px-4 py-2 text-sm font-bold ${
              pathname === "/pshsep"
                ? "bg-black text-white"
                : "bg-white text-black border border-zinc-300 hover:bg-zinc-100"
            }`}
          >
            PSHSEP
          </Link>

          <Link
            href="/docs"
            className={`rounded-xl px-4 py-2 text-sm font-bold ${
              pathname === "/docs"
                ? "bg-black text-white"
                : "bg-white text-black border border-zinc-300 hover:bg-zinc-100"
            }`}
          >
            Docs
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}