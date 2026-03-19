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

function formatRole(role: string) {
  return role.replace(/_/g, " ");
}

function getSectionDescription(pathname: string, isAdminArea: boolean) {
  if (isAdminArea) {
    return "Manage users, reviews, agreements, and document operations.";
  }

  if (pathname.startsWith("/library")) {
    return "Browse records, unlock completed files, and open what you need quickly.";
  }

  if (pathname.startsWith("/upload")) {
    return "Add new records, attach files, and keep the library current.";
  }

  if (pathname.startsWith("/search")) {
    return "Search across projects, files, and document history.";
  }

  if (pathname.startsWith("/submit")) {
    return "Send new work requests and track intake from one place.";
  }

  if (pathname.startsWith("/purchases")) {
    return "Review unlocked documents and purchase activity.";
  }

  if (pathname.startsWith("/peshep")) {
    return "Build PESHEP content and keep project documentation organized.";
  }

  if (pathname.startsWith("/csep")) {
    return "Work through CSEP documentation with a clearer project workspace.";
  }

  return "Manage safety documents from a cleaner, more focused workspace.";
}

function MobileMenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    >
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
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

    async function syncSession(
      session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]
    ) {
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

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const sectionTitle = useMemo(() => {
    const found = topTabs.find((item) => isActivePath(pathname, item.href));
    return found?.label ?? (isAdminArea ? "Admin Workspace" : "Safety360Docs");
  }, [isAdminArea, pathname, topTabs]);

  const sectionDescription = useMemo(
    () => getSectionDescription(pathname, isAdminArea),
    [isAdminArea, pathname]
  );

  const workspaceLabel = isAdminArea ? "Admin Workspace" : "User Workspace";

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

      const data = (await res.json().catch(() => null)) as { error?: string } | null;

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_35%),linear-gradient(180deg,_#f8fbff_0%,_#eef4fb_100%)] px-6 text-slate-700">
        <div className="rounded-3xl border border-white/70 bg-white/80 px-8 py-6 text-sm font-semibold shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          Loading workspace...
        </div>
      </div>
    );
  }

  if (accountStatus === "suspended") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_35%),linear-gradient(180deg,_#f8fbff_0%,_#eef4fb_100%)] px-6 py-10">
        <div className="w-full max-w-xl rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-600">
            Account Suspended
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            This account is currently suspended
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your access to the workspace has been temporarily disabled by an
            administrator. Contact your admin team if you believe this was done in
            error.
          </p>
          <button
            onClick={handleLogout}
            className="mt-6 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  if (!acceptedTerms) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_35%),linear-gradient(180deg,_#f8fbff_0%,_#eef4fb_100%)] px-6 py-10">
        <div className="w-full max-w-5xl rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
            Agreement Required
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            Accept the platform agreement before continuing
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            You must accept the Terms of Service, Liability Waiver, and Licensing
            Agreement before using Safety360Docs. Version {agreementConfig.version}.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            If the agreement version changes, you will be asked to review and accept
            the updated version before continuing.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
              <h2 className="text-lg font-bold text-slate-950">
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

            <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
              <h2 className="text-lg font-bold text-slate-950">
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
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {termsError}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/terms"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              View Terms
            </Link>
            <Link
              href="/liability-waiver"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              View Liability Waiver
            </Link>
            <button
              type="button"
              onClick={handleAcceptTerms}
              disabled={acceptingTerms}
              className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {acceptingTerms ? "Accepting..." : "Accept & Continue"}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.10),_transparent_25%),linear-gradient(180deg,_#f7fbff_0%,_#eef4fb_100%)] text-slate-900">
      <div className="flex min-h-screen">
        {mobileMenuOpen ? (
          <button
            aria-label="Close menu overlay"
            className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px] lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        ) : null}

        <aside
          className={cx(
            "fixed inset-y-0 left-0 z-50 w-[248px] shrink-0 border-r border-white/10 bg-[linear-gradient(180deg,_#0f172a_0%,_#13233f_55%,_#0f172a_100%)] text-white transition-transform duration-200 lg:static lg:translate-x-0 lg:flex lg:flex-col",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-white/10 px-5 pb-4 pt-6">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-4 shadow-[0_18px_40px_rgba(2,8,23,0.28)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/20 text-sm font-black uppercase tracking-[0.2em] text-sky-200">
                    S3
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-[1.6rem] leading-[0.95] font-black tracking-tight text-white">
                      Safety360Docs
                    </div>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-sky-300">
                      {isAdminArea ? "Admin Control Center" : "Safety Management Platform"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <div className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                Navigation
              </div>

              <div className="space-y-2">
                {sideLinks.map((item) => {
                  const active = isActivePath(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cx(
                        "group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-150",
                        active
                          ? "bg-white text-slate-950 shadow-[0_14px_32px_rgba(15,23,42,0.16)]"
                          : "text-slate-200 hover:bg-white/8 hover:text-white"
                      )}
                    >
                      <span
                        className={cx(
                          "inline-flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black uppercase tracking-[0.12em] transition",
                          active
                            ? "bg-sky-100 text-sky-700"
                            : "bg-white/8 text-sky-200 group-hover:bg-white/12"
                        )}
                      >
                        {item.short}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-semibold">{item.label}</div>
                        <div
                          className={cx(
                            "mt-0.5 text-[11px]",
                            active ? "text-slate-500" : "text-slate-400"
                          )}
                        >
                          {active ? "Current section" : "Open section"}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </nav>

            <div className="border-t border-white/10 p-3">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-4 shadow-[0_18px_40px_rgba(2,8,23,0.22)]">
                <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                  Signed In
                </div>
                <div className="mt-3 truncate text-sm font-semibold text-white">
                  {userEmail}
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-sky-300">
                  {formatRole(userRole)}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-white/6 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                      Mode
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {isAdminArea ? "Admin" : "User"}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/6 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                      Access
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white capitalize">
                      {accountStatus}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="mt-4 w-full rounded-2xl bg-rose-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-rose-600"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/82 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-6 xl:px-8">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(true)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
                  >
                    <MobileMenuIcon />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold uppercase tracking-[0.28em] text-sky-700">
                      {workspaceLabel}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3">
                      <h1 className="text-2xl leading-tight font-black tracking-tight text-slate-950 sm:text-3xl xl:text-[2.3rem] xl:leading-none">
                        {sectionTitle}
                      </h1>
                      <span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm xl:inline-flex">
                        {isAdminArea ? "Controls & review" : "Workspace tools"}
                      </span>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      {sectionDescription}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:min-w-[420px]">
                  <div className="rounded-2xl border border-slate-200 bg-white/92 px-4 py-3 shadow-sm">
                    <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                      Signed in
                    </div>
                    <div className="mt-1 max-w-[220px] truncate text-sm font-semibold text-slate-900">
                      {userEmail}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-slate-900 shadow-sm">
                    <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700">
                      Workspace
                    </div>
                    <div className="mt-1 text-sm font-semibold">{workspaceLabel}</div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="inline-flex min-w-full gap-2 rounded-[1.25rem] border border-slate-200 bg-white/92 p-2 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                  {topTabs.map((item) => {
                    const active = isActivePath(pathname, item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cx(
                          "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition whitespace-nowrap",
                          active
                            ? "bg-sky-600 text-white shadow-[0_12px_24px_rgba(2,132,199,0.26)]"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                        )}
                      >
                        <span
                          className={cx(
                            "inline-flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-black uppercase",
                            active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                          )}
                        >
                          {item.short}
                        </span>
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1">
            <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 xl:px-8">
              <div className="rounded-[1.85rem] border border-white/70 bg-white/58 p-3 shadow-[0_24px_70px_rgba(15,23,42,0.05)] backdrop-blur-sm sm:p-4">
                <div className="rounded-[1.5rem] bg-transparent">{children}</div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
