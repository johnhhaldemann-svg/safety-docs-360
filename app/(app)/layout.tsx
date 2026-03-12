"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  const [checkedAuth, setCheckedAuth] = useState(false);

  useEffect(() => {
    async function checkUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      setCheckedAuth(true);
    }

    checkUser();
  }, [router]);

  if (!checkedAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 text-black">
        Checking login...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-black">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-black/15 bg-white font-black">
              SD
            </div>

            <div className="leading-tight">
              <div className="text-sm font-extrabold tracking-tight">
                SafetyDocs
              </div>
              <div className="text-xs font-semibold text-black/60">
                PESHEP • CSEP • Document Library
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-6 md:flex">
            <a href="/" className="text-sm font-bold text-black/70 hover:text-black">
              Home
            </a>
            <a href="/library" className="text-sm font-bold text-black/70 hover:text-black">
              Library
            </a>
            <a href="/peshep" className="text-sm font-bold text-black/70 hover:text-black">
              PESHEP
            </a>
            <a href="/csep" className="text-sm font-bold text-black/70 hover:text-black">
              CSEP
            </a>
            <a href="/admin" className="text-sm font-bold text-black/70 hover:text-black">
              Admin
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}