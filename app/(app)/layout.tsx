"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type NavItem = {
  href: string;
  label: string;
  short: string;
};

const topTabs: NavItem[] = [
  { href: "/", label: "Dashboard", short: "DB" },
  { href: "/peshep", label: "PESHEP", short: "PE" },
  { href: "/admin", label: "Admin", short: "AD" },
  { href: "/csep", label: "CSEP", short: "CS" },
  { href: "/library", label: "Library", short: "LI" },
  { href: "/search", label: "Search", short: "SR" },
  { href: "/upload", label: "Upload", short: "UP" },
];

const sideLinks: NavItem[] = [
  { href: "/", label: "Home", short: "HM" },
  { href: "/peshep", label: "PESHEP Builder", short: "PB" },
  { href: "/admin", label: "Admin Panel", short: "AD" },
  { href: "/csep", label: "CSEP", short: "CS" },
  { href: "/library", label: "Library", short: "LB" },
  { href: "/search", label: "Search", short: "SR" },
  { href: "/upload", label: "Upload", short: "UP" },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session) {
        router.replace("/login");
        return;
      }

      setUserEmail(session.user.email ?? "");
      setLoading(false);
    }

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
        return;
      }

      setUserEmail(session.user.email ?? "");
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const sectionTitle = useMemo(() => {
    const found = topTabs.find((item) => item.href === pathname);
    return found?.label ?? "Safety Docs 360";
  }, [pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
        Checking login...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-slate-900 text-white lg:flex lg:flex-col">
          <div className="border-b border-slate-800 px-6 py-5">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-300">
              Anytime Safety
            </div>
            <div className="mt-2 text-2xl font-black">Safety Docs 360</div>
            <div className="mt-2 text-sm text-slate-300">
              Procore-style project workspace
            </div>
          </div>

          <nav className="flex-1 px-4 py-5">
            <div className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Project Navigation
            </div>

            <div className="space-y-2">
              {sideLinks.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cx(
                      "flex items-center gap-3 rounded-xl px-3 py-3 transition",
                      active
                        ? "bg-sky-500 text-white shadow"
                        : "text-slate-200 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    <span
                      className={cx(
                        "inline-flex h-9 w-9 items-center justify-center rounded-lg text-xs font-black",
                        active
                          ? "bg-white/20 text-white"
                          : "bg-slate-800 text-sky-300"
                      )}
                    >
                      {item.short}
                    </span>
                    <span className="text-sm font-semibold">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-slate-800 px-4 py-4">
            <div className="rounded-2xl bg-slate-800 p-4">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                Logged In
              </div>
              <div className="mt-2 truncate text-sm text-white">{userEmail}</div>
              <button
                onClick={handleLogout}
                className="mt-4 w-full rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-600"
              >
                Logout
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white">
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">
                    Project Workspace
                  </div>
                  <h1 className="mt-1 text-2xl font-black text-slate-900">
                    {sectionTitle}
                  </h1>
                </div>

                <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 md:block">
                  SafetyDocs360 Internal App
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {topTabs.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cx(
                        "rounded-xl px-4 py-2.5 text-sm font-bold transition",
                        active
                          ? "bg-sky-600 text-white shadow"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}