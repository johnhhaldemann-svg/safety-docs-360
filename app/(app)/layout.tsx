"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { getDefaultAgreementConfig, type AgreementConfig } from "@/lib/legal";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type NavItem = {
  href: string;
  label: string;
  short: string;
};

const userTopTabs: NavItem[] = [
  { href: "/", label: "Dashboard", short: "DB" },
  { href: "/submit", label: "Submit", short: "SB" },
  { href: "/library", label: "Library", short: "LI" },
  { href: "/purchases", label: "Purchases", short: "PU" },
  { href: "/search", label: "Search", short: "SR" },
  { href: "/upload", label: "Upload", short: "UP" },
  { href: "/peshep", label: "PESHEP", short: "PE" },
];

const adminTopTabs: NavItem[] = [
  { href: "/admin", label: "Admin Dashboard", short: "AD" },
  { href: "/admin/review-documents", label: "Review Queue", short: "RQ" },
  { href: "/admin/archive", label: "Archive", short: "AR" },
  { href: "/admin/marketplace", label: "Marketplace", short: "MP" },
  { href: "/admin/agreements", label: "Agreements", short: "AG" },
  { href: "/admin/transactions", label: "Transactions", short: "TX" },
  { href: "/admin/users", label: "Users", short: "US" },
  { href: "/admin/settings", label: "Settings", short: "ST" },
  { href: "/library", label: "Library", short: "LI" },
  { href: "/search", label: "Search", short: "SR" },
];

const userSideLinks: NavItem[] = [
  { href: "/", label: "Home", short: "HM" },
  { href: "/peshep", label: "PESHEP Builder", short: "PB" },
  { href: "/csep", label: "CSEP", short: "CS" },
  { href: "/submit", label: "Submit Request", short: "SB" },
  { href: "/library", label: "Library", short: "LB" },
  { href: "/purchases", label: "My Purchases", short: "MP" },
  { href: "/search", label: "Search", short: "SR" },
  { href: "/upload", label: "Upload", short: "UP" },
];

const adminSideLinks: NavItem[] = [
  { href: "/admin", label: "Admin Home", short: "AH" },
  { href: "/admin/review-documents", label: "Review Queue", short: "RQ" },
  { href: "/admin/archive", label: "Archive", short: "AR" },
  { href: "/admin/marketplace", label: "Marketplace", short: "MP" },
  { href: "/admin/agreements", label: "Agreements", short: "AG" },
  { href: "/admin/transactions", label: "Transactions", short: "TX" },
  { href: "/admin/users", label: "Users", short: "US" },
  { href: "/admin/settings", label: "Settings", short: "ST" },
  { href: "/library", label: "Library", short: "LB" },
  { href: "/search", label: "Search", short: "SR" },
  { href: "/upload", label: "Uploads", short: "UP" },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
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
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [userRole, setUserRole] = useState("viewer");
  const [accountStatus, setAccountStatus] = useState("active");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptingTerms, setAcceptingTerms] = useState(false);
  const [termsError, setTermsError] = useState("");
  const [agreementConfig, setAgreementConfig] = useState<AgreementConfig>(
    getDefaultAgreementConfig()
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdminArea = pathname.startsWith("/admin");
  const topTabs = useMemo(() => {
    const base = isAdminArea ? adminTopTabs : userTopTabs;

    if (!isAdminArea && isAdminUser) {
      return [...base, { href: "/admin", label: "Admin", short: "AD" }];
    }

    return base;
  }, [isAdminArea, isAdminUser]);
  const sideLinks = useMemo(() => {
    const base = isAdminArea ? adminSideLinks : userSideLinks;

    if (!isAdminArea && isAdminUser) {
      return [...base, { href: "/admin", label: "Admin Panel", short: "AD" }];
    }

    return base;
  }, [isAdminArea, isAdminUser]);

  useEffect(() => {
    let cancelled = false;

    async function loadAgreementConfig() {
      try {
        const res = await fetch("/api/legal/config");
        const data = (await res.json().catch(() => null)) as AgreementConfig | null;

        if (!cancelled && res.ok && data) {
          setAgreementConfig(data);
        }
      } catch (error) {
        console.error("Failed to load agreement config:", error);
      }
    }

    void loadAgreementConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function syncSession(session: Awaited<
      ReturnType<typeof supabase.auth.getSession>
    >["data"]["session"]) {
      if (!mounted) return;

      if (!session) {
        router.replace("/login");
        return;
      }

      try {
        const res = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const data = (await res.json().catch(() => null)) as
          | {
              user?: {
                email?: string;
                role?: string;
                isAdmin?: boolean;
                accountStatus?: string;
                acceptedTerms?: boolean;
                termsVersion?: string;
                agreementCurrent?: boolean;
                requiredTermsVersion?: string;
              };
            }
          | null;

        if (!mounted) return;

        const email = data?.user?.email ?? session.user.email ?? "";
        const admin = Boolean(data?.user?.isAdmin);

        setUserEmail(email);
        setIsAdminUser(admin);
        setUserRole(data?.user?.role ?? "viewer");
        setAccountStatus(data?.user?.accountStatus ?? "active");
        setAcceptedTerms(Boolean(data?.user?.acceptedTerms));
        setTermsError("");

        if (data?.user?.accountStatus === "suspended") {
          setLoading(false);
          return;
        }

        if (isAdminArea && !admin) {
          router.replace("/");
          return;
        }
      } catch (error) {
        console.error("Failed to load role context:", error);
        setUserEmail(session.user.email ?? "");
        setIsAdminUser(false);
        setUserRole("viewer");
        setAccountStatus("active");
        setAcceptedTerms(false);

        if (isAdminArea) {
          router.replace("/");
          return;
        }
      }

      setLoading(false);
    }

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      await syncSession(session);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
        return;
      }
      void syncSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [isAdminArea, router]);

  const sectionTitle = useMemo(() => {
    const found = topTabs.find((item) => isActivePath(pathname, item.href));
    return found?.label ?? (isAdminArea ? "Admin Workspace" : "Safety360Docs");
  }, [isAdminArea, pathname, topTabs]);

async function handleLogout() {
  try {
    setLoading(true);
    setUserEmail("");
    setIsAdminUser(false);
    setUserRole("viewer");
    setAccountStatus("active");
    setAcceptedTerms(false);
    setTermsError("");

    const { error } = await supabase.auth.signOut({ scope: "global" });

    if (error) {
      console.error("Logout error:", error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/login";
  } catch (err) {
    console.error("Unexpected logout error:", err);
    setLoading(false);
  }
}

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
        Checking login...
      </div>
    );
  }

  if (accountStatus === "suspended") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-600">
            Account Suspended
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            This account is currently suspended
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your access to the workspace has been temporarily disabled by an administrator. Contact your admin team if you believe this was done in error.
          </p>
          <button
            onClick={handleLogout}
            className="mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  async function handleAcceptTerms() {
    try {
      setAcceptingTerms(true);
      setTermsError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("You must be logged in to accept the agreement.");
      }

      const res = await fetch("/api/legal/accept", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to record agreement acceptance.");
      }

      setAcceptedTerms(true);
    } catch (error) {
      setTermsError(
        error instanceof Error ? error.message : "Failed to record agreement acceptance."
      );
    } finally {
      setAcceptingTerms(false);
    }
  }

  if (!acceptedTerms) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-10">
        <div className="w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
            Agreement Required
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            Accept the platform agreement before continuing
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            You must accept the Terms of Service, Liability Waiver, and Licensing Agreement before using Safety360Docs. Version {agreementConfig.version}.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            If the agreement version changes, you will be asked to review and accept the updated version before continuing.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-5">
              <h2 className="text-lg font-bold text-slate-900">
                {agreementConfig.termsOfService.title}
              </h2>
              <div className="mt-3 max-h-64 space-y-4 overflow-y-auto pr-2 text-sm text-slate-600">
                {agreementConfig.termsOfService.sections.map((section) => (
                  <div key={section.heading}>
                    <div className="font-semibold text-slate-900">{section.heading}</div>
                    <p className="mt-1 leading-6">{section.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-5">
              <h2 className="text-lg font-bold text-slate-900">
                {agreementConfig.liabilityWaiver.title}
              </h2>
              <div className="mt-3 max-h-64 space-y-4 overflow-y-auto pr-2 text-sm text-slate-600">
                {agreementConfig.liabilityWaiver.sections.map((section) => (
                  <div key={section.heading}>
                    <div className="font-semibold text-slate-900">{section.heading}</div>
                    <p className="mt-1 leading-6">{section.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {termsError ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {termsError}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/terms"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              View Terms
            </Link>
            <Link
              href="/liability-waiver"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              View Liability Waiver
            </Link>
            <button
              type="button"
              onClick={handleAcceptTerms}
              disabled={acceptingTerms}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              {acceptingTerms ? "Accepting..." : "Accept & Continue"}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        {mobileMenuOpen && (
          <button
            aria-label="Close menu overlay"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <aside
          className={cx(
            "fixed inset-y-0 left-0 z-50 w-72 shrink-0 border-r border-slate-200 bg-slate-900 text-white transition-transform duration-200 lg:static lg:translate-x-0 lg:flex lg:flex-col",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="border-b border-slate-800 px-6 py-6">
            <div className="text-3xl font-black tracking-tight text-white">
              Safety360Docs
            </div>
            <div className="mt-1 text-xs uppercase tracking-[0.2em] text-sky-400">
              {isAdminArea ? "Admin Control Center" : "Safety Management Platform"}
            </div>
          </div>

          <nav className="flex-1 px-4 py-5">
            <div className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Project Navigation
            </div>

            <div className="space-y-2">
              {sideLinks.map((item) => {
                const active = isActivePath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
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

              <div className="mt-2 truncate text-sm text-white">
                {userEmail}
              </div>
              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-sky-300">
                {userRole.replace(/_/g, " ")}
              </div>

              <button
                onClick={handleLogout}
                className="mt-4 w-full rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-600"
              >
                Logout
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(true)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden"
                  >
                    ☰
                  </button>

                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">
                      {isAdminArea ? "Admin Workspace" : "Project Workspace"}
                    </div>

                    <h1 className="mt-1 text-2xl font-black text-slate-900">
                      {sectionTitle}
                    </h1>
                  </div>
                </div>

                <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 md:block">
                  {isAdminArea ? "Admin Workspace" : "User Workspace"}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {topTabs.map((item) => {
                  const active = isActivePath(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
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
