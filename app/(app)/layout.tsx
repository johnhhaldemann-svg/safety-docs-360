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

type NavSection = {
  title: string;
  items: NavItem[];
};

const userQuickLinks: NavItem[] = [
  { href: "/submit", label: "Submit Request", short: "SB" },
  { href: "/upload", label: "Upload", short: "UP" },
  { href: "/library", label: "Library", short: "LI" },
];

const adminQuickLinks: NavItem[] = [
  { href: "/admin/review-documents", label: "Review Queue", short: "RQ" },
  { href: "/admin/users", label: "Users", short: "US" },
  { href: "/admin/agreements", label: "Agreements", short: "AG" },
];

const companyQuickLinks: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", short: "DB" },
  { href: "/library", label: "Completed Docs", short: "LB" },
  { href: "/company-users", label: "Company Users", short: "CU" },
];

const userSideSections: NavSection[] = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", short: "HM" },
      { href: "/submit", label: "Submit Request", short: "SB" },
      { href: "/library", label: "Library", short: "LB" },
      { href: "/upload", label: "Upload", short: "UP" },
      { href: "/search", label: "Search", short: "SR" },
    ],
  },
  {
    title: "Builders",
    items: [
      { href: "/peshep", label: "PESHEP Builder", short: "PB" },
      { href: "/csep", label: "CSEP Builder", short: "CS" },
    ],
  },
  {
    title: "Account",
    items: [{ href: "/purchases", label: "My Purchases", short: "MP" }],
  },
];

const adminSideSections: NavSection[] = [
  {
    title: "Admin",
    items: [
      { href: "/admin", label: "Dashboard", short: "AH" },
      { href: "/admin/review-documents", label: "Review Queue", short: "RQ" },
      { href: "/admin/users", label: "Users", short: "US" },
      { href: "/admin/agreements", label: "Agreements", short: "AG" },
      { href: "/admin/marketplace", label: "Marketplace", short: "MP" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/archive", label: "Archive", short: "AR" },
      { href: "/admin/transactions", label: "Transactions", short: "TX" },
      { href: "/admin/settings", label: "Settings", short: "ST" },
    ],
  },
  {
    title: "Shared Tools",
    items: [
      { href: "/library", label: "Library", short: "LB" },
      { href: "/search", label: "Search", short: "SR" },
    ],
  },
];

const companyAdminSideSections: NavSection[] = [
  {
    title: "Company Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", short: "HM" },
      { href: "/library", label: "Completed Docs", short: "LB" },
    ],
  },
  {
    title: "Company Access",
    items: [{ href: "/company-users", label: "Company Users", short: "CU" }],
  },
];

const companyUserSideSections: NavSection[] = [
  {
    title: "Company Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", short: "HM" },
      { href: "/library", label: "Completed Docs", short: "LB" },
    ],
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatRole(role: string) {
  const normalized = role.trim().toLowerCase().replace(/\s+/g, "_");
  if (normalized === "manager" || normalized === "operations_manager") {
    return "Operations Manager";
  }
  if (normalized === "company_admin") {
    return "Company Admin";
  }
  if (normalized === "company_user") {
    return "Company User";
  }
  if (normalized === "super_admin") {
    return "Super Admin";
  }
  return role.replace(/_/g, " ");
}

function MobileMenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
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
  const isCompanyAdminUser = userRole === "company_admin";
  const isCompanyUser = userRole === "company_user";
  const isCompanyScopedUser = isCompanyAdminUser || isCompanyUser;

  const sideSections = useMemo(() => {
    if (!isAdminArea && isCompanyAdminUser) {
      return companyAdminSideSections;
    }
    if (!isAdminArea && isCompanyUser) {
      return companyUserSideSections;
    }
    const base = isAdminArea ? adminSideSections : userSideSections;
    if (!isAdminArea && isAdminUser) {
      return [
        ...base,
        {
          title: "Admin",
          items: [{ href: "/admin", label: "Admin Panel", short: "AD" }],
        },
      ];
    }
    return base;
  }, [isAdminArea, isAdminUser, isCompanyAdminUser, isCompanyUser]);

  const currentNavItem = useMemo(() => {
    for (const section of sideSections) {
      for (const item of section.items) {
        if (isActivePath(pathname, item.href)) {
          return item;
        }
      }
    }

    return {
      href: pathname,
      label: isAdminArea ? "Admin Workspace" : "Workspace",
      short: isAdminArea ? "AD" : "WS",
    };
  }, [isAdminArea, pathname, sideSections]);

  const quickLinks = useMemo(() => {
    if (!isAdminArea && isCompanyAdminUser) {
      return companyQuickLinks;
    }
    if (!isAdminArea && isCompanyUser) {
      return companyQuickLinks.filter((item) => item.href !== "/company-users");
    }
    const base = isAdminArea ? adminQuickLinks : userQuickLinks;
    if (!isAdminArea && isAdminUser) {
      return [...base, { href: "/admin", label: "Admin Panel", short: "AD" }];
    }
    return base;
  }, [isAdminArea, isAdminUser, isCompanyAdminUser, isCompanyUser]);

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

        const nextRole = data?.user?.role ?? "viewer";

        if (nextRole === "company_admin" || nextRole === "company_user") {
          const companyAllowedRoutes =
            nextRole === "company_admin"
              ? ["/dashboard", "/library", "/company-users"]
              : ["/dashboard", "/library"];
          const inAllowedRoute = companyAllowedRoutes.some(
            (route) => pathname === route || pathname.startsWith(`${route}/`)
          );

          if (!inAllowedRoute) {
            router.replace("/dashboard");
            return;
          }
        }

        if (isAdminArea && !admin) {
          router.replace("/dashboard");
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
          router.replace("/dashboard");
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
  }, [isAdminArea, pathname, router]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const workspaceLabel = isAdminArea
    ? "Admin Workspace"
    : isCompanyScopedUser
      ? "Company Workspace"
      : "User Workspace";
  const workspaceDescriptor = isAdminArea
    ? "Safety management controls"
    : isCompanyScopedUser
      ? "Completed documents and company access"
      : "Project document workspace";

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
      <div className="flex min-h-screen items-center justify-center bg-[#f3f8ff] text-slate-700">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-6 text-sm font-semibold shadow-sm">
          Loading workspace...
        </div>
      </div>
    );
  }

  if (accountStatus === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f8ff] px-6 py-10">
        <div className="w-full max-w-xl rounded-[1.9rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-600">
            Approval Required
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            Your account is waiting for administrator approval
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your account has been created successfully, but access to the workspace stays
            locked until an administrator reviews and activates it.
          </p>
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            We&apos;ll open the full workspace as soon as your account status is changed
            from pending to active.
          </div>
          <button
            onClick={handleLogout}
            className="mt-6 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  if (accountStatus === "suspended") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f8ff] px-6 py-10">
        <div className="w-full max-w-xl rounded-[1.9rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-600">
            Account Suspended
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            This account is currently suspended
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your access to the workspace has been temporarily disabled by an administrator.
          </p>
          <button
            onClick={handleLogout}
            className="mt-6 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  if (!acceptedTerms) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f8ff] px-6 py-10">
        <div className="w-full max-w-5xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
            Agreement Required
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            Accept the platform agreement before continuing
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            You must accept the Terms of Service, Liability Waiver, and Licensing Agreement before using Safety360Docs. Version {agreementConfig.version}.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
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

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
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
            <Link href="/terms" className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
              View Terms
            </Link>
            <Link href="/liability-waiver" className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
              View Liability Waiver
            </Link>
            <button
              type="button"
              onClick={handleAcceptTerms}
              disabled={acceptingTerms}
              className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {acceptingTerms ? "Accepting..." : "Accept & Continue"}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f8ff] text-slate-900">
      <div className="flex min-h-screen">
        {mobileMenuOpen ? (
          <button
            aria-label="Close menu overlay"
            className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        ) : null}

        <aside
          className={cx(
            "fixed inset-y-0 left-0 z-50 w-[280px] max-w-[84vw] border-r border-slate-800 bg-[linear-gradient(180deg,_#0d1830_0%,_#13284b_60%,_#0c1730_100%)] text-white transition-transform duration-200 lg:static lg:w-[248px] lg:max-w-none lg:translate-x-0",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-full flex-col">
            <div className="p-4">
              <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4 shadow-[0_16px_30px_rgba(2,8,23,0.22)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-400/18 text-sm font-black text-sky-100">
                    S3
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-black leading-tight text-white">
                      Safety360
                      <br />
                      Docs
                    </div>
                    <div className="mt-1 text-[9px] uppercase tracking-[0.24em] text-sky-200">
                      Safety Management Platform
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-3">
              <div className="px-3 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                Navigation
              </div>
              <div className="mt-4 space-y-5">
                {sideSections.map((section) => (
                  <div key={section.title}>
                    <div className="px-3 text-[10px] font-bold uppercase tracking-[0.26em] text-slate-500">
                      {section.title}
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {section.items.map((item) => {
                        const active = isActivePath(pathname, item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cx(
                              "flex items-center gap-3 rounded-2xl border px-3 py-3 transition",
                              active
                                ? "border-sky-200 bg-[linear-gradient(135deg,_rgba(255,255,255,0.96)_0%,_rgba(232,243,255,0.96)_100%)] text-slate-950 shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
                                : "border-transparent text-slate-200 hover:bg-white/8 hover:text-white"
                            )}
                          >
                            <span
                              className={cx(
                                "inline-flex h-8 w-8 items-center justify-center rounded-xl text-[11px] font-black",
                                active
                                  ? "bg-[linear-gradient(135deg,_#dbeafe_0%,_#bfdbfe_100%)] text-sky-700"
                                  : "bg-white/8 text-sky-200"
                              )}
                            >
                              {item.short}
                            </span>
                            <div className="min-w-0">
                            <div
                                className={cx(
                                  "truncate text-sm font-semibold",
                                  active ? "text-slate-950" : "text-white"
                                )}
                              >
                                {item.label}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </nav>

            <div className="border-t border-white/10 p-3">
              <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                  Signed In
                </div>
                <div className="mt-2 truncate text-sm font-semibold text-white">{userEmail}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-sky-200">
                  {formatRole(userRole)}
                </div>
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/6 px-3 py-2 text-xs text-slate-200">
                  <span>{workspaceLabel}</span>
                  <span className="capitalize">{accountStatus}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="mt-4 w-full rounded-2xl bg-[linear-gradient(135deg,_#5b6cff_0%,_#4f7cff_100%)] px-4 py-3 text-sm font-bold text-white shadow-[0_12px_24px_rgba(79,124,255,0.28)]"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6 xl:px-8">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setMobileMenuOpen(true)}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
                    >
                      <MobileMenuIcon />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">
                        {workspaceLabel}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-[11px] font-black text-slate-600">
                          {currentNavItem.short}
                        </span>
                        <div>
                          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                            {currentNavItem.label}
                          </h1>
                          <p className="mt-1 text-sm text-slate-500">
                            {isAdminArea
                              ? "Administrative tools and audit controls"
                              : isCompanyScopedUser
                                ? isCompanyAdminUser
                                  ? "Completed document access and company user management"
                                  : "Completed document access for your company workspace"
                                : "Safety document workspace and active project tools"}
                          </p>
                        </div>
                      </div>
                      <p className="mt-1 max-w-3xl text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500 sm:text-sm">
                        Enterprise Safety Management Platform
                      </p>
                    </div>
                  </div>

                  <div className="hidden gap-3 sm:grid sm:grid-cols-2 xl:min-w-[420px]">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                        Signed In
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold text-slate-900">
                        {userEmail}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
                      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                        Workspace
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{workspaceLabel}</div>
                      <div className="mt-1 text-xs text-slate-500">{workspaceDescriptor}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.35rem] border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                        Current Section
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {currentNavItem.label}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="inline-flex min-w-max gap-2">
                        {quickLinks.map((item) => {
                          const active = isActivePath(pathname, item.href);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cx(
                                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition",
                                active
                                  ? "bg-[linear-gradient(135deg,_#4f7cff_0%,_#5b6cff_100%)] text-white shadow-[0_12px_24px_rgba(91,108,255,0.22)]"
                                  : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                              )}
                            >
                              <span
                                className={cx(
                                  "inline-flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-black",
                                  active
                                    ? "bg-white/20 text-white"
                                    : "bg-white text-slate-500"
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
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 sm:px-6 xl:px-8">
            <div className="mx-auto w-full max-w-[1600px] space-y-5">
              <div className="rounded-[1.6rem] border border-[#dbe9ff] bg-[linear-gradient(180deg,_#f7fbff_0%,_#eef5ff_100%)] p-3 shadow-[0_18px_40px_rgba(148,163,184,0.14)] sm:rounded-[2rem] sm:p-4">
                {children}
              </div>
              <div className="rounded-[1.3rem] bg-[linear-gradient(135deg,_#10213f_0%,_#13284b_100%)] px-4 py-4 text-center text-xl font-black tracking-tight text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)] sm:rounded-[1.6rem] sm:px-6 sm:py-5 sm:text-[1.85rem]">
                Systems live. Secure. Document. Stay Safe.
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
