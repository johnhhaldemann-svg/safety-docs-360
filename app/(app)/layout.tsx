"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster } from "sonner";
import { AppCommandPalette } from "@/components/AppCommandPalette";
import {
  accountSetupSideSections,
  adminSideSections,
  companyAdminSideSections,
  companyManagerSideSections,
  companyUserSideSections,
  flattenNavItemsFromSections,
  internalAdminAppendedSection,
  userSideSections,
} from "@/lib/appNavigation";
import {
  canAccessCompanyJobsites,
  canAccessCompanyWorkspaceHref,
  canBuildCompanyDocuments,
  canManageCompanyIncidents,
  canManageCompanyJsa,
  canManageCompanyPermits,
  canSubmitCompanyDocuments,
  canViewCompanyTrainingMatrix,
} from "@/lib/companyFeatureAccess";
import { getDefaultAgreementConfig, type AgreementConfig } from "@/lib/legal";
import type { PermissionMap } from "@/lib/rbac";
import { getCsepNavSectionsForRole, type WorkspaceProduct } from "@/lib/workspaceProduct";
import { groupCompanyWorkspaceSections } from "@/lib/workspaceNavigationModel";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { isWorkspaceNavActive } from "@/lib/workspaceNavActive";
import { AppLoading } from "@/components/app-shell/AppLoading";
import { AppShellHeader } from "@/components/app-shell/AppShellHeader";
import { AppShellSidebar } from "@/components/app-shell/AppShellSidebar";
import type { ProfileSummary } from "@/components/app-shell/ProfileAvatar";

const supabase = getSupabaseBrowserClient();

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = 15000
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

/** Supabase JS persists the session under localStorage keys like `sb-<ref>-auth-token`. */
function hasPersistedSupabaseAuthKeys() {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.includes("-auth-token")) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

const AGREEMENT_CACHE_PREFIX = "safety360docs:accepted-terms:";

function getAgreementCacheKey(email: string, version: string) {
  return `${AGREEMENT_CACHE_PREFIX}${email.trim().toLowerCase()}:${version}`;
}

function readAcceptedTermsCache(email: string, version: string) {
  if (typeof window === "undefined" || !email.trim()) {
    return false;
  }

  try {
    return window.localStorage.getItem(getAgreementCacheKey(email, version)) === "true";
  } catch {
    return false;
  }
}

function writeAcceptedTermsCache(email: string, version: string) {
  if (typeof window === "undefined" || !email.trim()) {
    return;
  }

  try {
    window.localStorage.setItem(getAgreementCacheKey(email, version), "true");
  } catch {
    // Ignore storage failures; the server still remains the source of truth.
  }
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
  const [userRole, setUserRole] = useState("viewer");
  const [accountStatus, setAccountStatus] = useState("active");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptingTerms, setAcceptingTerms] = useState(false);
  const [termsError, setTermsError] = useState("");
  const [permissionMap, setPermissionMap] = useState<PermissionMap | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [, setCompanyName] = useState("");
  const [workspaceProduct, setWorkspaceProduct] = useState<WorkspaceProduct>("full");
  const [profileComplete, setProfileComplete] = useState(false);
  const [profileSummary, setProfileSummary] = useState<ProfileSummary | null>(null);
  const [agreementConfig, setAgreementConfig] = useState<AgreementConfig>(
    getDefaultAgreementConfig()
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [bootError, setBootError] = useState("");
  const [expandedSectionKey, setExpandedSectionKey] = useState<string | null>(null);
  const lastSidebarSyncPathRef = useRef<string | null>(null);
  const isAdminArea = pathname.startsWith("/admin");
  const isSuperadminRoute = pathname.startsWith("/superadmin");
  /** Platform admin sidebar: /admin/* or superadmin-only analytics (Injury Weather, OSHA IPA lab). */
  const showPlatformAdminShell =
    isAdminArea || (isSuperadminRoute && userRole === "super_admin");
  const isCompanyAdminUser = userRole === "company_admin";
  const isCompanyManagerUser = userRole === "manager" || userRole === "safety_manager";
  const isSalesDemoUser = userRole === "sales_demo";
  const isCompanyAdminShellUser = isCompanyAdminUser || isSalesDemoUser;
  const isCompanyUser =
    userRole === "company_user" ||
    userRole === "project_manager" ||
    userRole === "field_supervisor" ||
    userRole === "foreman" ||
    userRole === "field_user" ||
    userRole === "read_only";
  const isCompanyLeadershipUser = isCompanyAdminShellUser || isCompanyManagerUser;
  const isCompanyScopedUser = isCompanyLeadershipUser || isCompanyUser;
  const canAccessInternalAdmin = Boolean(permissionMap?.can_access_internal_admin);
  const needsProfileSetup =
    !canAccessInternalAdmin && !isSalesDemoUser && !profileComplete;
  const inCompanySetupFlow =
    pathname === "/company-setup" || pathname.startsWith("/company-setup/");
  const needsCompanySetup =
    !needsProfileSetup &&
    !canAccessInternalAdmin &&
    !isCompanyScopedUser &&
    !companyId &&
    inCompanySetupFlow;

  const rawSideSections = useMemo(() => {
    if (needsCompanySetup) {
      return accountSetupSideSections;
    }
    if (!showPlatformAdminShell && isCompanyScopedUser && workspaceProduct === "csep") {
      return getCsepNavSectionsForRole(userRole);
    }
    if (!showPlatformAdminShell && isCompanyAdminShellUser) {
      return companyAdminSideSections;
    }
    if (!showPlatformAdminShell && isCompanyManagerUser) {
      return companyManagerSideSections;
    }
    if (!showPlatformAdminShell && isCompanyUser) {
      return companyUserSideSections;
    }
    const base = showPlatformAdminShell ? adminSideSections : userSideSections;
    if (!showPlatformAdminShell && canAccessInternalAdmin) {
      return [...base, internalAdminAppendedSection];
    }
    return base;
  }, [
    canAccessInternalAdmin,
    showPlatformAdminShell,
    isCompanyAdminShellUser,
    isCompanyManagerUser,
    isCompanyScopedUser,
    isCompanyUser,
    needsCompanySetup,
    userRole,
    workspaceProduct,
  ]);

  const presentedSideSections = useMemo(() => {
    if (!showPlatformAdminShell && isCompanyScopedUser && workspaceProduct !== "csep") {
      return groupCompanyWorkspaceSections(rawSideSections);
    }
    return rawSideSections;
  }, [
    isCompanyScopedUser,
    rawSideSections,
    showPlatformAdminShell,
    workspaceProduct,
  ]);

  const sideSections = useMemo(
    () =>
      presentedSideSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => {
            return canAccessCompanyWorkspaceHref(item.href, userRole, permissionMap);
          }),
        }))
        .filter((section) => section.items.length > 0),
    [permissionMap, presentedSideSections, userRole]
  );

  const keyedSideSections = useMemo(
    () =>
      sideSections.map((section, index) => ({
        ...section,
        key: `${section.title}-${index}`,
      })),
    [sideSections]
  );

  const commandPaletteItems = useMemo(
    () => flattenNavItemsFromSections(keyedSideSections),
    [keyedSideSections]
  );

  const currentNavItem = useMemo(() => {
    for (const section of keyedSideSections) {
      for (const item of section.items) {
        if (isWorkspaceNavActive(pathname, item.href)) {
          return item;
        }
      }
    }

    return {
      href: pathname,
      label: showPlatformAdminShell ? "Admin Workspace" : "Workspace",
      short: showPlatformAdminShell ? "AD" : "WS",
    };
  }, [keyedSideSections, pathname, showPlatformAdminShell]);

  const currentNavSection = useMemo(() => {
    return keyedSideSections.find((section) =>
      section.items.some((item) => isWorkspaceNavActive(pathname, item.href))
    );
  }, [keyedSideSections, pathname]);

  useEffect(() => {
    const nextKey = currentNavSection?.key ?? keyedSideSections[0]?.key ?? null;
    const hasRouteChanged = lastSidebarSyncPathRef.current !== pathname;

    if (!hasRouteChanged) {
      return;
    }

    lastSidebarSyncPathRef.current = pathname;
    setExpandedSectionKey(nextKey);
  }, [currentNavSection?.key, pathname, keyedSideSections]);

  useEffect(() => {
    if (
      expandedSectionKey != null &&
      keyedSideSections.some((section) => section.key === expandedSectionKey)
    ) {
      return;
    }

    setExpandedSectionKey(currentNavSection?.key ?? keyedSideSections[0]?.key ?? null);
  }, [currentNavSection?.key, expandedSectionKey, keyedSideSections]);

  useEffect(() => {
    let cancelled = false;

    async function loadAgreementConfig() {
      try {
        const res = await fetchWithTimeout("/api/legal/config", {}, 10000);
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
    if (!userEmail.trim() || acceptedTerms) {
      return;
    }

    if (readAcceptedTermsCache(userEmail, agreementConfig.version)) {
      setAcceptedTerms(true);
    }
  }, [acceptedTerms, agreementConfig.version, userEmail]);

  const syncSession = useCallback(
    async (
      session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]
    ) => {
      if (!session) {
        setLoading(false);
        router.replace("/login");
        return;
      }

      try {
        const res = await fetchWithTimeout(
          "/api/auth/me",
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          },
          10000
        );

        const data = (await res.json().catch(() => null)) as
          | {
              user?: {
                email?: string;
                role?: string;
                isAdmin?: boolean;
                permissionMap?: PermissionMap;
                accountStatus?: string;
                acceptedTerms?: boolean;
                companyId?: string | null;
                companyName?: string | null;
                workspaceProduct?: WorkspaceProduct;
                profileComplete?: boolean;
                profile?: ProfileSummary | null;
                pendingCompanySignupRequest?: { id?: string; companyName?: string } | null;
              };
          }
          | null;

        const email = data?.user?.email ?? session.user.email ?? "";
        const hasPendingCompanySignupRequest = Boolean(
          data?.user?.pendingCompanySignupRequest
        );
        const serverAcceptedTerms = Boolean(data?.user?.acceptedTerms);
        const cachedAcceptedTerms = readAcceptedTermsCache(email, agreementConfig.version);
        const nextAccountStatus = hasPendingCompanySignupRequest
          ? "pending"
          : data?.user?.accountStatus ?? "active";

        setUserEmail(email);
        setUserRole(data?.user?.role ?? "viewer");
        setPermissionMap(data?.user?.permissionMap ?? null);
        setCompanyId(data?.user?.companyId ?? null);
        setCompanyName(data?.user?.companyName ?? "");
        setWorkspaceProduct(data?.user?.workspaceProduct === "csep" ? "csep" : "full");
        setProfileComplete(Boolean(data?.user?.profileComplete));
        setProfileSummary(data?.user?.profile ?? null);
        setAccountStatus(nextAccountStatus);
        setAcceptedTerms(serverAcceptedTerms || cachedAcceptedTerms);
        if (email && (serverAcceptedTerms || cachedAcceptedTerms)) {
          writeAcceptedTermsCache(email, agreementConfig.version);
        }
        setTermsError("");
        setBootError("");
      } catch (error) {
        console.error("Failed to load role context:", error);
        const fallbackEmail = session.user.email ?? "";
        setUserEmail(session.user.email ?? "");
        setUserRole("viewer");
        setPermissionMap(null);
        setCompanyId(null);
        setCompanyName("");
        setWorkspaceProduct("full");
        setProfileComplete(false);
        setProfileSummary(null);
        setAccountStatus("active");
        setAcceptedTerms(
          fallbackEmail ? readAcceptedTermsCache(fallbackEmail, agreementConfig.version) : false
        );
        if (!(error instanceof Error && error.name === "AbortError")) {
          setBootError("Workspace session could not be fully loaded. Showing a limited session view.");
        }
      } finally {
        setLoading(false);
      }
    },
    [agreementConfig.version, router]
  );

  useEffect(() => {
    let mounted = true;
    const bootstrapFallback = window.setTimeout(() => {
      if (!mounted) return;
      setLoading(false);
    }, 12000);

    void (async () => {
      let {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session && hasPersistedSupabaseAuthKeys()) {
        await new Promise((r) => window.setTimeout(r, 100));
        ({
          data: { session },
        } = await supabase.auth.getSession());
      }
      if (!mounted) return;
      await syncSession(session);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT") {
        void syncSession(null);
        return;
      }
      if (session) {
        void syncSession(session);
      }
    });

    return () => {
      mounted = false;
      window.clearTimeout(bootstrapFallback);
      subscription.unsubscribe();
    };
  }, [router, syncSession]);

  useEffect(() => {
    if (loading) return;

    if (accountStatus === "pending" || accountStatus === "suspended" || !acceptedTerms) {
      return;
    }

    if (needsProfileSetup) {
      if (pathname !== "/profile") {
        router.replace("/profile");
      }
      return;
    }

    if (!needsCompanySetup && pathname === "/company-setup") {
      router.replace("/dashboard");
      return;
    }

    if (isSuperadminRoute && userRole !== "super_admin") {
      router.replace("/dashboard");
      return;
    }

    if (isCompanyScopedUser) {
      if (userRole === "read_only") {
        if (workspaceProduct === "csep") {
          const readOnlyCsepRoutes = ["/dashboard", "/profile", "/library", "/search", "/customer/billing"];
          const inReadOnlyCsep = readOnlyCsepRoutes.some(
            (route) => pathname === route || pathname.startsWith(`${route}/`)
          );
          if (!inReadOnlyCsep) {
            router.replace("/dashboard");
          }
          return;
        }
        const readOnlyAllowedRoutes = [
          "/dashboard",
          "/reports",
          "/companies",
          "/jobsites",
          "/analytics",
          "/command-center",
        ];
        const inReadOnlyRoute = readOnlyAllowedRoutes.some(
          (route) => pathname === route || pathname.startsWith(`${route}/`)
        );
        if (!inReadOnlyRoute) {
          router.replace("/dashboard");
        }
        return;
      }

      if (workspaceProduct === "csep") {
        const csepRoutes = [
          "/dashboard",
          "/profile",
          "/library",
          "/search",
          "/customer/billing",
          "/marketplace-preview-approvals",
        ];
        const canOpenCsep =
          Boolean(permissionMap?.can_create_documents) ||
          Boolean(permissionMap?.can_edit_documents) ||
          Boolean(permissionMap?.can_submit_documents);
        if (canOpenCsep) {
          csepRoutes.push("/csep");
        }
        const inCsepRoute = csepRoutes.some(
          (route) => pathname === route || pathname.startsWith(`${route}/`)
        );
        if (!inCsepRoute) {
          router.replace("/dashboard");
        }
        return;
      }

      const companyAllowedRoutes = ["/dashboard", "/library", "/search", "/profile"];

      if (companyId) {
        companyAllowedRoutes.push("/customer/billing");
      }

      if (canAccessInternalAdmin) {
        companyAllowedRoutes.push("/billing");
      }

      if (canAccessCompanyJobsites(userRole, permissionMap)) {
        companyAllowedRoutes.push("/jobsites");
      }

      if (
        userRole === "company_admin" ||
        userRole === "manager" ||
        userRole === "safety_manager"
      ) {
        companyAllowedRoutes.push(
          "/companies",
          "/jobsites",
          "/field-id-exchange",
          "/safety-submit",
          "/analytics",
          "/command-center",
          "/settings/risk-memory",
          "/reports"
        );
      }

      if (canManageCompanyJsa(userRole, permissionMap)) {
        companyAllowedRoutes.push("/jsa");
      }

      if (canManageCompanyPermits(userRole, permissionMap)) {
        companyAllowedRoutes.push("/permits");
      }

      if (canManageCompanyIncidents(userRole, permissionMap)) {
        companyAllowedRoutes.push("/incidents");
      }

      if (canViewCompanyTrainingMatrix(userRole, permissionMap)) {
        companyAllowedRoutes.push("/training-matrix");
      }

      if (canSubmitCompanyDocuments(permissionMap)) {
        companyAllowedRoutes.push("/submit", "/safety-submit");
      }

      if (canBuildCompanyDocuments(permissionMap)) {
        companyAllowedRoutes.push("/upload", "/peshep", "/csep");
      }

      if (permissionMap?.can_manage_company_users) {
        companyAllowedRoutes.push("/company-users");
      }

      // All company users may open My Purchases to see unlocked docs and history; only
      // can_manage_billing can buy credits or unlock on /purchases (enforced in UI + APIs).
      companyAllowedRoutes.push("/purchases");
      companyAllowedRoutes.push("/marketplace-preview-approvals");

      if (
        permissionMap?.can_view_dashboards &&
        userRole !== "company_admin" &&
        userRole !== "manager" &&
        userRole !== "safety_manager"
      ) {
        for (const route of ["/companies", "/analytics", "/command-center", "/settings/risk-memory"] as const) {
          if (!companyAllowedRoutes.includes(route)) {
            companyAllowedRoutes.push(route);
          }
        }
      }

      const inAllowedRoute = companyAllowedRoutes.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`)
      );

      if (!inAllowedRoute) {
        router.replace("/dashboard");
      }
      return;
    }

    if (isAdminArea && !canAccessInternalAdmin) {
      router.replace("/dashboard");
    }
  }, [
    acceptedTerms,
    accountStatus,
    canAccessInternalAdmin,
    companyId,
    isAdminArea,
    isCompanyScopedUser,
    isSuperadminRoute,
    loading,
    needsCompanySetup,
    needsProfileSetup,
    pathname,
    permissionMap,
    router,
    userRole,
    workspaceProduct,
  ]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const workspaceChromeReady =
    !loading && accountStatus === "active" && acceptedTerms;

  useEffect(() => {
    if (!workspaceChromeReady) {
      return;
    }
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [workspaceChromeReady]);

  const handleHeaderSearchSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nextQuery = searchQuery.trim();
      router.push(nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : "/search");
    },
    [router, searchQuery]
  );

  const workspaceLabel = showPlatformAdminShell
    ? "Admin Workspace"
    : needsProfileSetup
      ? "Profile Setup"
    : needsCompanySetup
      ? "Workspace Setup"
      : isCompanyScopedUser
        ? "Company Workspace"
        : "User Workspace";
  async function handleLogout() {
    try {
      setLoading(true);
      setUserEmail("");
      setUserRole("viewer");
      setPermissionMap(null);
      setAccountStatus("active");
      setAcceptedTerms(false);
      setProfileComplete(false);
      setProfileSummary(null);
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

      if (session.user.email) {
        writeAcceptedTermsCache(session.user.email, agreementConfig.version);
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
      <div className="app-shell-light min-h-screen bg-app-canvas text-[var(--app-text)]">
        <AppLoading className="min-h-screen" label="Loading workspace…" />
      </div>
    );
  }

  if (accountStatus === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-canvas px-6 py-10">
        <div className="w-full max-w-xl rounded-[1.9rem] border border-slate-700/80 bg-slate-900/90 p-8 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
            Approval Required
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white">
            Your account is waiting for administrator approval
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Your account has been created successfully, but access to the workspace will
            remain locked until an administrator reviews and activates it.
          </p>
          <div className="mt-6 rounded-2xl border border-amber-500/35 bg-amber-950/50 px-4 py-3 text-sm text-amber-100/95">
            {
              "We'll open the full workspace as soon as your account status is changed from pending to active."
            }
          </div>
          <button
            onClick={handleLogout}
            className="app-btn-primary mt-6 px-5 py-3 text-sm app-shadow-action transition"
          >
            Log out
          </button>
        </div>
      </div>
    );
  }

  if (accountStatus === "suspended") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-canvas px-6 py-10">
        <div className="w-full max-w-xl rounded-[1.9rem] border border-slate-700/80 bg-slate-900/90 p-8 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-300">
            Account Suspended
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white">
            This account is currently suspended
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Your access to the workspace has been temporarily disabled by an administrator.
          </p>
          <button
            onClick={handleLogout}
            className="app-btn-primary mt-6 px-5 py-3 text-sm app-shadow-action transition"
          >
            Log out
          </button>
        </div>
      </div>
    );
  }

  if (!acceptedTerms) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-canvas px-6 py-10">
        <div className="w-full max-w-5xl rounded-[2rem] border border-[var(--app-border)] bg-[rgba(248,251,255,0.96)] p-8 shadow-[var(--app-shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--app-accent-primary)]">
            Agreement Required
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-[var(--app-text-strong)]">
            Accept the platform agreement before continuing
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--app-text)]">
            You must accept the Terms of Service, Liability Waiver, and Licensing Agreement before using Safety360Docs. Version {agreementConfig.version}.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-panel)] p-5">
              <h2 className="text-lg font-bold text-[var(--app-text-strong)]">
                {agreementConfig.termsOfService.title}
              </h2>
              <div className="mt-3 max-h-64 space-y-4 overflow-y-auto pr-2 text-sm text-[var(--app-text)]">
                {agreementConfig.termsOfService.sections.map((section) => (
                  <div key={section.heading}>
                    <div className="font-semibold text-[var(--app-text-strong)]">{section.heading}</div>
                    <p className="mt-1 leading-6">{section.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-panel)] p-5">
              <h2 className="text-lg font-bold text-[var(--app-text-strong)]">
                {agreementConfig.liabilityWaiver.title}
              </h2>
              <div className="mt-3 max-h-64 space-y-4 overflow-y-auto pr-2 text-sm text-[var(--app-text)]">
                {agreementConfig.liabilityWaiver.sections.map((section) => (
                  <div key={section.heading}>
                    <div className="font-semibold text-[var(--app-text-strong)]">{section.heading}</div>
                    <p className="mt-1 leading-6">{section.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {termsError ? (
            <div className="mt-6 rounded-2xl border border-[rgba(217,83,79,0.28)] bg-[var(--semantic-danger-bg)] px-4 py-3 text-sm text-[var(--semantic-danger)]">
              {termsError}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/terms" className="app-btn-secondary px-4 py-3 text-sm transition">
              View Terms
            </Link>
            <Link href="/privacy" className="app-btn-secondary px-4 py-3 text-sm transition">
              Privacy
            </Link>
            <Link href="/liability-waiver" className="app-btn-secondary px-4 py-3 text-sm transition">
              View Liability Waiver
            </Link>
            <button
              type="button"
              onClick={handleAcceptTerms}
              disabled={acceptingTerms}
              className="app-btn-primary px-5 py-3 text-sm app-shadow-action transition disabled:opacity-60"
            >
              {acceptingTerms ? "Accepting..." : "Accept & Continue"}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="app-btn-secondary px-5 py-3 text-sm transition"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell-light min-h-screen bg-app-canvas text-[var(--app-text)]">
      <div className="flex min-h-screen">
        {mobileMenuOpen ? (
          <button
            aria-label="Close menu overlay"
            className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        ) : null}

        <AppShellSidebar
          pathname={pathname}
          mobileMenuOpen={mobileMenuOpen}
          onNavLinkActivate={() => setMobileMenuOpen(false)}
          keyedSideSections={keyedSideSections}
          expandedSectionKey={expandedSectionKey}
          onToggleSection={(key) =>
            setExpandedSectionKey((current) => (current === key ? null : key))
          }
          profileSummary={profileSummary}
          userEmail={userEmail}
          userRole={userRole}
          workspaceLabel={workspaceLabel}
          accountStatus={accountStatus}
          onLogout={handleLogout}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <AppShellHeader
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onSearchSubmit={handleHeaderSearchSubmit}
            showPlatformAdminShell={showPlatformAdminShell}
            workspaceLabel={workspaceLabel}
            needsProfileSetup={needsProfileSetup}
            needsCompanySetup={needsCompanySetup}
            isCompanyScopedUser={isCompanyScopedUser}
            currentNavSection={currentNavSection}
            currentNavItem={currentNavItem}
          />

          <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 sm:py-7 xl:px-8">
            <div className="mx-auto w-full max-w-[1600px] space-y-5">
              {bootError ? (
                <div className="rounded-2xl border border-[rgba(217,164,65,0.28)] bg-[var(--semantic-warning-bg)] px-4 py-3 text-sm text-[var(--semantic-warning)] shadow-sm">
                  {bootError}
                </div>
              ) : null}
              <div className="workspace-frame rounded-[1.6rem] p-3 sm:rounded-[2rem] sm:p-4">
                <div className="workspace-content">
                {children}
                </div>
              </div>
              <div className="app-radius-card bg-[linear-gradient(135deg,_var(--app-accent-primary)_0%,_#6ea0ff_100%)] px-4 py-4 text-center text-xl font-black tracking-tight text-white shadow-[var(--app-shadow-primary-hero)] sm:rounded-[1.6rem] sm:px-6 sm:py-5 sm:text-[1.85rem]">
                Systems live. Secure. Document. Stay Safe.
              </div>
            </div>
          </main>
        </div>
      </div>
      <Toaster richColors theme="light" position="top-center" closeButton />
      <AppCommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        items={commandPaletteItems}
      />
    </div>
  );
}
