"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Toaster } from "sonner";
import { AppCommandPalette } from "@/components/AppCommandPalette";
import { appButtonQuietClassName, appNativeSelectClassName } from "@/components/WorkspacePrimitives";
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
import {
  getWorkspaceNavItemMeta,
  type WorkspaceNavSection,
  groupCompanyWorkspaceSections,
} from "@/lib/workspaceNavigationModel";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const supabase = getSupabaseBrowserClient();

type ProfileSummary = {
  fullName?: string;
  preferredName?: string;
  jobTitle?: string;
  tradeSpecialty?: string;
  photoUrl?: string;
};

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

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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
  if (normalized === "safety_manager") {
    return "Safety Manager";
  }
  if (normalized === "project_manager") {
    return "Project Manager";
  }
  if (normalized === "field_supervisor") {
    return "Field Supervisor";
  }
  if (normalized === "foreman") {
    return "Foreman";
  }
  if (normalized === "field_user") {
    return "Field User";
  }
  if (normalized === "read_only") {
    return "Read Only";
  }
  if (normalized === "platform_admin") {
    return "Platform Admin";
  }
  if (normalized === "super_admin") {
    return "Super Admin";
  }
  return role.replace(/_/g, " ");
}

function getDisplayName(profile: ProfileSummary | null, email: string) {
  const candidate = profile?.preferredName || profile?.fullName || email.split("@")[0] || "User";
  return candidate.trim() || "User";
}

function getAvatarInitials(label: string) {
  const parts = label
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return (parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? "");
}

function ProfileAvatar({
  profile,
  email,
  sizeClass = "h-12 w-12",
  textClass = "text-sm",
}: {
  profile: ProfileSummary | null;
  email: string;
  sizeClass?: string;
  textClass?: string;
}) {
  const displayName = getDisplayName(profile, email);

  if (profile?.photoUrl) {
    return (
      <Image
        src={profile.photoUrl}
        alt={displayName}
        width={48}
        height={48}
        className={`${sizeClass} rounded-2xl object-cover`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} inline-flex items-center justify-center rounded-2xl bg-[rgba(79,125,243,0.14)] font-black text-[var(--app-accent-primary)] ${textClass}`}
    >
      {getAvatarInitials(displayName)}
    </span>
  );
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

function QuickJumpIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function DashboardBrandIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-8 w-8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 5 6v5c0 4.8 3.1 9.2 7 10 3.9-.8 7-5.2 7-10V6l-7-3Z" />
      <path d="m9.25 12 2 2 4.25-5" />
    </svg>
  );
}

function DashboardBellIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 17H5.5l1.6-1.8c.6-.7.9-1.6.9-2.5v-1.4c0-2.6 1.8-4.8 4.2-5.4" />
      <path d="M15 17h3.5l-1.6-1.8c-.6-.7-.9-1.6-.9-2.5v-1.4c0-2.9-2.2-5.3-5-5.7" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

function DashboardSearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function DashboardChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}

function DashboardWorkspaceIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h6V4H4v3Zm10 0h6V4h-6v3ZM4 20h6v-9H4v9Zm10 0h6v-9h-6v9Z" />
    </svg>
  );
}

function DashboardRouteIcon({ href }: { href: string }) {
  const normalized = href.toLowerCase();

  if (normalized.includes("project") || normalized.includes("jobsite")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 20h18" />
        <path d="M6 20v-7" />
        <path d="M12 20V9" />
        <path d="M18 20v-4" />
      </svg>
    );
  }
  if (normalized.includes("document") || normalized.includes("library") || normalized.includes("report")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 3h7l5 5v13H7z" />
        <path d="M14 3v5h5" />
        <path d="M10 13h6" />
        <path d="M10 17h6" />
      </svg>
    );
  }
  if (normalized.includes("task") || normalized.includes("training")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11 11 13 15 9" />
        <path d="M20 12a8 8 0 1 1-3.2-6.4" />
      </svg>
    );
  }
  if (normalized.includes("incident") || normalized.includes("observation") || normalized.includes("issue")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4 3 20h18L12 4Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }
  if (normalized.includes("analytic")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19V8" />
        <path d="M10 19V5" />
        <path d="M16 19v-9" />
        <path d="M22 19v-4" />
      </svg>
    );
  }
  if (normalized.includes("user") || normalized.includes("team")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
        <circle cx="9.5" cy="7" r="3" />
        <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16.5 4.1a3 3 0 0 1 0 5.8" />
      </svg>
    );
  }
  if (normalized.includes("setting")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5Z" />
        <path d="m19.4 15 .6 1.1-1.6 2.8-1.2-.1a7.8 7.8 0 0 1-1.8 1l-.5 1.1H9.1l-.5-1.1a7.8 7.8 0 0 1-1.8-1l-1.2.1L4 16.1 4.6 15a7.5 7.5 0 0 1 0-2l-.6-1.1 1.6-2.8 1.2.1a7.8 7.8 0 0 1 1.8-1l.5-1.1h3.8l.5 1.1a7.8 7.8 0 0 1 1.8 1l1.2-.1 1.6 2.8-.6 1.1a7.5 7.5 0 0 1 0 2Z" />
      </svg>
    );
  }

  return <DashboardWorkspaceIcon />;
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
  const isAdminArea = pathname.startsWith("/admin");
  const isSuperadminRoute = pathname.startsWith("/superadmin");
  /** Platform admin sidebar: /admin/* or superadmin-only analytics (Injury Weather, OSHA IPA lab). */
  const showPlatformAdminShell =
    isAdminArea || (isSuperadminRoute && userRole === "super_admin");
  const isCompanyAdminUser = userRole === "company_admin";
  const isCompanyManagerUser = userRole === "manager" || userRole === "safety_manager";
  const isCompanyUser =
    userRole === "company_user" ||
    userRole === "project_manager" ||
    userRole === "field_supervisor" ||
    userRole === "foreman" ||
    userRole === "field_user" ||
    userRole === "read_only";
  const isCompanyLeadershipUser = isCompanyAdminUser || isCompanyManagerUser;
  const isCompanyScopedUser = isCompanyLeadershipUser || isCompanyUser;
  const canAccessInternalAdmin = Boolean(permissionMap?.can_access_internal_admin);
  const needsProfileSetup = !canAccessInternalAdmin && !profileComplete;
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
    if (!showPlatformAdminShell && isCompanyAdminUser) {
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
    isCompanyAdminUser,
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
          items: section.items.filter((item) =>
            canAccessCompanyWorkspaceHref(item.href, userRole, permissionMap)
          ),
        }))
        .filter((section) => section.items.length > 0),
    [permissionMap, presentedSideSections, userRole]
  );

  const commandPaletteItems = useMemo(
    () => flattenNavItemsFromSections(sideSections),
    [sideSections]
  );

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
      label: showPlatformAdminShell ? "Admin Workspace" : "Workspace",
      short: showPlatformAdminShell ? "AD" : "WS",
    };
  }, [pathname, showPlatformAdminShell, sideSections]);

  const currentNavMeta = useMemo(() => getWorkspaceNavItemMeta(currentNavItem), [currentNavItem]);

  const currentNavSection = useMemo(() => {
    return sideSections.find((section) =>
      section.items.some((item) => isActivePath(pathname, item.href))
    );
  }, [pathname, sideSections]);

  const useCompanyHeaderDropdown =
    !showPlatformAdminShell && isCompanyScopedUser && workspaceProduct !== "csep";
  const isDashboardRoute = pathname === "/dashboard";
  const companyDropdownSections = useMemo(
    () =>
      useCompanyHeaderDropdown
        ? (sideSections as WorkspaceNavSection[])
        : ([] as WorkspaceNavSection[]),
    [sideSections, useCompanyHeaderDropdown]
  );
  const dashboardSideItems = useMemo(
    () => sideSections.flatMap((section) => section.items).slice(0, 12),
    [sideSections]
  );

  const handleWorkspaceDropdownChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const nextHref = event.target.value.trim();
      if (!nextHref || nextHref === currentNavItem.href) {
        return;
      }
      router.push(nextHref);
    },
    [currentNavItem.href, router]
  );

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
  const displayName = getDisplayName(profileSummary, userEmail);
  const profileJobTitle = profileSummary?.jobTitle || formatRole(userRole);
  const profileSpecialty = profileSummary?.tradeSpecialty || formatRole(userRole);
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
      <div className="flex min-h-screen items-center justify-center bg-app-canvas text-slate-300">
        <div className="rounded-3xl border border-slate-700/80 bg-slate-900/80 px-8 py-6 text-sm font-semibold text-slate-200 shadow-lg">
          Loading workspace...
        </div>
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
            Your account has been created successfully, but access to the workspace stays
            locked until an administrator reviews and activates it.
          </p>
          <div className="mt-6 rounded-2xl border border-amber-500/35 bg-amber-950/50 px-4 py-3 text-sm text-amber-100/95">
            {
              "We'll open the full workspace as soon as your account status is changed from pending to active."
            }
          </div>
          <button
            onClick={handleLogout}
            className="mt-6 rounded-xl bg-[var(--app-accent-primary)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(79,125,243,0.22)] transition hover:bg-[var(--app-accent-primary-hover)] active:bg-[var(--app-accent-primary-active)]"
          >
            Logout
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
            className="mt-6 rounded-xl bg-[var(--app-accent-primary)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(79,125,243,0.22)] transition hover:bg-[var(--app-accent-primary-hover)] active:bg-[var(--app-accent-primary-active)]"
          >
            Logout
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
            <Link href="/terms" className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-accent-primary-soft)]">
              View Terms
            </Link>
            <Link href="/privacy" className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-accent-primary-soft)]">
              Privacy
            </Link>
            <Link href="/liability-waiver" className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-accent-primary-soft)]">
              View Liability Waiver
            </Link>
            <button
              type="button"
              onClick={handleAcceptTerms}
              disabled={acceptingTerms}
              className="rounded-xl bg-[var(--app-accent-primary)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(79,125,243,0.22)] transition hover:bg-[var(--app-accent-primary-hover)] active:bg-[var(--app-accent-primary-active)] disabled:opacity-60"
            >
              {acceptingTerms ? "Accepting..." : "Accept & Continue"}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-[var(--app-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-accent-primary-soft)]"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cx(
        isDashboardRoute
          ? "app-shell-dashboard min-h-screen bg-[#f4f7fb] text-slate-900"
          : "app-shell-light min-h-screen bg-app-canvas text-[var(--app-text)]"
      )}
    >
      <div className="flex min-h-screen">
        {mobileMenuOpen ? (
          <button
            aria-label="Close menu overlay"
            className={cx(
              "fixed inset-0 z-40 lg:hidden",
              isDashboardRoute ? "bg-slate-950/65" : "bg-slate-950/35"
            )}
            onClick={() => setMobileMenuOpen(false)}
          />
        ) : null}

        <aside
          className={cx(
            "fixed inset-y-0 left-0 z-50 w-[280px] max-w-[84vw] transition-transform duration-200",
            isDashboardRoute
              ? "border-r border-[#22324d] bg-[#0f1a2c] text-[#d7e4f7]"
              : "border-r border-[var(--app-border)] bg-[linear-gradient(180deg,_#f7fbff_0%,_#edf4ff_55%,_#e7f0fb_100%)] text-[var(--app-text-strong)]",
            useCompanyHeaderDropdown && !isDashboardRoute
              ? "lg:hidden"
              : "lg:static lg:w-[248px] lg:max-w-none lg:translate-x-0",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-full flex-col">
            <div className={cx("p-4", isDashboardRoute ? "border-b border-[#22324d]" : "pb-1")}>
              {isDashboardRoute ? (
                <div className="flex items-center gap-3 rounded-2xl bg-[#13223a] px-3 py-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1d4ed8] text-white shadow-[0_12px_24px_rgba(37,99,235,0.35)]">
                    <DashboardBrandIcon />
                  </div>
                  <div>
                    <div className="text-xl font-semibold tracking-tight text-white">SafetyDocs360</div>
                    <div className="text-xs text-[#8ea4c3]">Enterprise safety workspace</div>
                  </div>
                </div>
              ) : (
                <div className="relative h-[5.8rem] w-full">
                  <Image
                    src="/brand/safety360docs-reference-neon-tight.png"
                    alt="Safety360Docs by Reliance EHS"
                    fill
                    priority
                    sizes="248px"
                    className="object-contain object-left"
                  />
                </div>
              )}
            </div>

            <nav className={cx("flex-1 overflow-y-auto px-3 py-3", isDashboardRoute ? "pt-5" : "")}>
              {isDashboardRoute ? (
                <div className="space-y-1.5">
                  <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7f94b2]">
                    Navigation
                  </div>
                  {dashboardSideItems.map((item) => {
                    const active = isActivePath(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cx(
                          "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                          active
                            ? "bg-[#1f488f] text-white shadow-[0_12px_22px_rgba(31,72,143,0.32)]"
                            : "text-[#d7e4f7] hover:bg-[#14233b] hover:text-white"
                        )}
                      >
                        <span
                          className={cx(
                            "inline-flex h-9 w-9 items-center justify-center rounded-xl",
                            active ? "bg-white/12 text-white" : "bg-white/6 text-[#9eb2cf]"
                          )}
                        >
                          <DashboardRouteIcon href={item.href} />
                        </span>
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <>
                  <div className="px-3 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                    Menu
                  </div>
                  <div className="mt-4 space-y-0">
                    {sideSections.map((section, sectionIndex) => (
                      (() => {
                        const sectionDescription =
                          (section as { description?: string }).description ?? "";
                        return (
                          <div
                            key={`nav-section-${sectionIndex}-${section.title}`}
                            className={sectionIndex > 0 ? "mt-5 border-t border-[var(--app-border)] pt-5" : ""}
                          >
                            <div className="px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                              {section.title}
                            </div>
                            {sectionDescription ? (
                              <div className="mt-1 px-3 text-[11px] leading-5 text-[var(--app-muted)]">
                                {sectionDescription}
                              </div>
                            ) : null}
                            <div className="mt-2 space-y-1.5">
                              {section.items.map((item) => {
                                const active = isActivePath(pathname, item.href);
                                const navMeta = getWorkspaceNavItemMeta(item);
                                return (
                                  <Link
                                    key={`${section.title}-${item.href}`}
                                    href={item.href}
                                    className={cx(
                                      "flex items-center rounded-2xl border px-4 py-3 transition",
                                      active
                                        ? "border-[rgba(79,125,243,0.24)] bg-[linear-gradient(135deg,_rgba(79,125,243,0.14)_0%,_rgba(79,125,243,0.08)_100%)] text-[var(--app-text-strong)] shadow-[0_12px_24px_rgba(79,125,243,0.08)]"
                                        : "border-transparent text-[var(--app-text)] hover:bg-white/70 hover:text-[var(--app-text-strong)]"
                                    )}
                                  >
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-semibold text-[var(--app-text-strong)]">
                                        {item.label}
                                      </div>
                                      {!active ? (
                                        <div className="mt-0.5 truncate text-[11px] text-[var(--app-muted)]">
                                          {navMeta.description}
                                        </div>
                                      ) : null}
                                    </div>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()
                    ))}
                  </div>
                </>
              )}
            </nav>

            <div className={cx("p-3", isDashboardRoute ? "border-t border-[#22324d]" : "border-t border-white/10")}>
              {isDashboardRoute ? (
                <div className="rounded-[1.5rem] border border-[#243754] bg-[#13223a] p-4 text-[#d7e4f7]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7f94b2]">
                    Signed In
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <ProfileAvatar profile={profileSummary} email={userEmail} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{displayName}</div>
                      <div className="mt-1 truncate text-xs text-[#9eb2cf]">{profileJobTitle}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs uppercase tracking-[0.16em] text-[#7ea9ff]">
                    {profileSpecialty}
                  </div>
                  <div className="mt-4 grid gap-2">
                    <button
                      type="button"
                      onClick={() => setCommandPaletteOpen(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#2b4160] bg-[#172a45] px-4 py-3 text-sm font-semibold text-white transition hover:border-[#3d5f90]"
                    >
                      <QuickJumpIcon />
                      Quick Jump
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="rounded-2xl bg-[#2f6cf6] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(47,108,246,0.35)] transition hover:bg-[#205eea]"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-[1.6rem] border border-[var(--app-border)] bg-white/80 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                    Signed In
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <ProfileAvatar profile={profileSummary} email={userEmail} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[var(--app-text-strong)]">
                        {displayName}
                      </div>
                      <div className="mt-1 truncate text-xs text-[var(--app-text)]">
                        {profileJobTitle}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--app-accent-primary)]">
                    {profileSpecialty}
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-xs text-[var(--app-text)]">
                    <span>{workspaceLabel}</span>
                    <span className="capitalize">{accountStatus}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="mt-4 w-full rounded-2xl bg-[var(--app-accent-primary)] px-4 py-3 text-sm font-bold text-white shadow-[0_12px_24px_rgba(79,125,243,0.24)] transition hover:bg-[var(--app-accent-primary-hover)] active:bg-[var(--app-accent-primary-active)]"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {isDashboardRoute ? (
            <header className="border-b border-[#22324d] bg-[#0f1a2c] text-white">
              <div className="mx-auto w-full max-w-[1680px] px-4 py-4 sm:px-6 xl:px-8">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setMobileMenuOpen(true)}
                      aria-label="Open navigation menu"
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#2a3d5b] bg-[#13223a] text-white shadow-sm lg:hidden"
                    >
                      <MobileMenuIcon />
                    </button>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#91a7c6]">
                        {currentNavSection?.title || workspaceLabel}
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-[#13223a] text-[#8fb0ff] sm:inline-flex">
                          <DashboardWorkspaceIcon />
                        </span>
                        <div>
                          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">
                            {currentNavItem.label}
                          </h1>
                          <p className="mt-1 text-sm text-[#adc1db]">
                            {showPlatformAdminShell
                              ? "Administrative tools and audit controls"
                              : needsProfileSetup
                                ? "Complete your profile to unlock the full company workspace."
                                : needsCompanySetup
                                  ? "Create your company workspace before inviting employees or opening company tools."
                                  : currentNavMeta.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <form onSubmit={handleHeaderSearchSubmit} className="w-full sm:min-w-[360px]">
                      <div className="flex items-center gap-3 rounded-2xl border border-[#2b3f5d] bg-[#13223a] px-4 py-3">
                        <span className="text-[#93a9c7]">
                          <DashboardSearchIcon />
                        </span>
                        <input
                          type="search"
                          value={searchQuery}
                          onChange={(event) => setSearchQuery(event.target.value)}
                          placeholder="Search projects, documents, reports..."
                          aria-label="Search workspace"
                          className="w-full border-0 bg-transparent text-sm text-white outline-none placeholder:text-[#8da3c1]"
                        />
                        <span className="text-[#93a9c7]">
                          <DashboardChevronIcon />
                        </span>
                      </div>
                    </form>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#2b3f5d] bg-[#13223a] text-white"
                      >
                        <DashboardBellIcon />
                        <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff5a52] px-1 text-[10px] font-semibold text-white">
                          3
                        </span>
                      </button>

                      <div className="flex items-center gap-3 rounded-2xl border border-[#2b3f5d] bg-[#13223a] px-3 py-2.5">
                        <ProfileAvatar profile={profileSummary} email={userEmail} />
                        <div className="hidden min-w-0 sm:block">
                          <div className="truncate text-sm font-semibold text-white">{displayName}</div>
                          <div className="mt-0.5 truncate text-xs text-[#9eb2cf]">{profileJobTitle}</div>
                        </div>
                        <span className="text-[#8da3c1]">
                          <DashboardChevronIcon />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </header>
          ) : (
            <header className="border-b border-[var(--app-border)] bg-[rgba(248,251,255,0.88)] backdrop-blur">
              <div className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6 xl:px-8">
                <div className="flex flex-col gap-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setMobileMenuOpen(true)}
                      aria-label="Open navigation menu"
                      className="inline-flex h-11 min-h-11 w-11 min-w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-white text-[var(--app-text)] shadow-sm lg:hidden"
                    >
                      <MobileMenuIcon />
                    </button>
                    <div className="min-w-0 flex-1">
                      <form onSubmit={handleHeaderSearchSubmit} className="mb-3 max-w-xl">
                        <div className="flex items-center gap-2 rounded-2xl border border-[var(--app-border-strong)] bg-white px-3 py-2.5 shadow-sm">
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="h-4 w-4 shrink-0 text-[var(--app-muted)]"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="11" cy="11" r="7" />
                            <path d="m20 20-3.5-3.5" />
                          </svg>
                          <input
                            type="search"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search documents, records, projects, or pages"
                            aria-label="Search workspace"
                            className="w-full border-0 bg-transparent text-sm text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-muted)]"
                          />
                          <button
                            type="submit"
                            className="inline-flex shrink-0 rounded-xl bg-[var(--app-accent-primary)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--app-accent-primary-hover)] active:bg-[var(--app-accent-primary-active)]"
                          >
                            Search
                          </button>
                        </div>
                      </form>
                      <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--app-muted)]">
                        {showPlatformAdminShell
                          ? workspaceLabel
                          : currentNavSection?.title || workspaceLabel}
                      </div>
                      {useCompanyHeaderDropdown ? (
                        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="w-full max-w-2xl">
                            <label
                              htmlFor="workspace-nav-dropdown"
                              className="mb-1 block text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--app-muted)]"
                            >
                              Workspace
                            </label>
                            <select
                              id="workspace-nav-dropdown"
                              aria-label="Workspace navigation"
                              value={currentNavItem.href}
                              onChange={handleWorkspaceDropdownChange}
                              className={cx(appNativeSelectClassName, "w-full")}
                            >
                              {companyDropdownSections.map((section) => (
                                <optgroup
                                  key={section.group}
                                  label={`${section.title} - ${section.description}`}
                                >
                                  {section.items.map((item) => {
                                    const navMeta = getWorkspaceNavItemMeta(item);
                                    return (
                                      <option key={item.href} value={item.href}>
                                        {item.label} - {navMeta.description}
                                      </option>
                                    );
                                  })}
                                </optgroup>
                              ))}
                            </select>
                            <p className="mt-2 text-xs text-[var(--app-muted)]">
                              Jump to another workspace area without losing screen space.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCommandPaletteOpen(true)}
                            className={cx(
                              appButtonQuietClassName,
                              "w-full shrink-0 gap-2 px-4 py-3 lg:mt-6 lg:w-auto"
                            )}
                            aria-label="Open quick jump"
                          >
                            <QuickJumpIcon />
                            Quick jump
                          </button>
                        </div>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <div>
                          <h1 className="text-2xl font-black tracking-tight text-[var(--app-text-strong)] sm:text-3xl">
                            {currentNavItem.label}
                          </h1>
                          <p className="mt-1 text-sm text-[var(--app-text)]">
                            {showPlatformAdminShell
                              ? "Administrative tools and audit controls"
                              : needsProfileSetup
                                ? "Complete your construction profile before opening company setup or workspace tools"
                                : needsCompanySetup
                                  ? "Create your company workspace before inviting employees or opening company tools"
                                  : isCompanyScopedUser
                                    ? currentNavMeta.description
                                    : "Safety document workspace and active project tools"}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2 max-w-3xl text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--app-muted)] sm:text-sm">
                        Enterprise Safety Management Platform
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </header>
          )}

          <main
            className={cx(
              "flex-1",
              isDashboardRoute ? "bg-[#f4f7fb] px-4 py-5 sm:px-6 xl:px-8" : "px-4 py-6 sm:px-6 sm:py-7 xl:px-8"
            )}
          >
            <div className={cx("mx-auto w-full space-y-5", isDashboardRoute ? "max-w-[1680px]" : "max-w-[1600px]")}>
              {bootError ? (
                <div className="rounded-2xl border border-[rgba(217,164,65,0.28)] bg-[var(--semantic-warning-bg)] px-4 py-3 text-sm text-[var(--semantic-warning)] shadow-sm">
                  {bootError}
                </div>
              ) : null}
              {isDashboardRoute ? (
                children
              ) : (
                <>
                  <div className="workspace-frame rounded-[1.6rem] p-3 sm:rounded-[2rem] sm:p-4">
                    <div className="workspace-content">{children}</div>
                  </div>
                  <div className="rounded-[1.3rem] bg-[linear-gradient(135deg,_#4f7df3_0%,_#6ea0ff_100%)] px-4 py-4 text-center text-xl font-black tracking-tight text-white shadow-[0_16px_30px_rgba(79,125,243,0.2)] sm:rounded-[1.6rem] sm:px-6 sm:py-5 sm:text-[1.85rem]">
                    Systems live. Secure. Document. Stay Safe.
                  </div>
                </>
              )}
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
