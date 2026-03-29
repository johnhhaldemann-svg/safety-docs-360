"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getDefaultAgreementConfig, type AgreementConfig } from "@/lib/legal";
import type { PermissionMap } from "@/lib/rbac";

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

type ProfileSummary = {
  fullName?: string;
  preferredName?: string;
  jobTitle?: string;
  tradeSpecialty?: string;
  photoUrl?: string;
};

const userQuickLinks: NavItem[] = [
  { href: "/submit", label: "Submit Request", short: "SB" },
  { href: "/upload", label: "Upload", short: "UP" },
  { href: "/library", label: "Library", short: "LI" },
];

const adminQuickLinks: NavItem[] = [
  { href: "/admin/review-documents", label: "Review Queue", short: "RQ" },
  { href: "/admin/users", label: "Users", short: "US" },
  { href: "/admin/companies", label: "Companies", short: "CO" },
  { href: "/admin/agreements", label: "Agreements", short: "AG" },
];

const companyAdminQuickLinks: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", short: "DB" },
  { href: "/jobsites", label: "Jobsites", short: "JS" },
  { href: "/library", label: "Documents", short: "DC" },
  { href: "/peshep", label: "PESHEP", short: "PB" },
  { href: "/csep", label: "CSEP", short: "CS" },
  { href: "/company-users", label: "Users", short: "US" },
  { href: "/training-matrix", label: "Training matrix", short: "TM" },
  { href: "/field-id-exchange", label: "Corrective Actions", short: "CA" },
  { href: "/daps", label: "DAPs", short: "DP" },
  { href: "/permits", label: "Permits", short: "PM" },
  { href: "/incidents", label: "Incidents", short: "IN" },
  { href: "/analytics", label: "Analytics", short: "AN" },
  { href: "/reports", label: "Reports", short: "RP" },
];

const companyManagerQuickLinks: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", short: "DB" },
  { href: "/jobsites", label: "Jobsites", short: "JS" },
  { href: "/library", label: "Documents", short: "DC" },
  { href: "/peshep", label: "PESHEP", short: "PB" },
  { href: "/csep", label: "CSEP", short: "CS" },
  { href: "/training-matrix", label: "Training matrix", short: "TM" },
  { href: "/field-id-exchange", label: "Corrective Actions", short: "CA" },
  { href: "/daps", label: "DAPs", short: "DP" },
  { href: "/permits", label: "Permits", short: "PM" },
  { href: "/incidents", label: "Incidents", short: "IN" },
  { href: "/analytics", label: "Analytics", short: "AN" },
  { href: "/reports", label: "Reports", short: "RP" },
];

const companyUserQuickLinks: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", short: "DB" },
  { href: "/library", label: "Documents", short: "DC" },
  { href: "/submit", label: "Submit Document", short: "SD" },
  { href: "/upload", label: "Upload File", short: "UF" },
  { href: "/profile", label: "Construction Profile", short: "CP" },
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
    items: [
      { href: "/profile", label: "Construction Profile", short: "CP" },
      { href: "/purchases", label: "My Purchases", short: "MP" },
    ],
  },
];

const adminSideSections: NavSection[] = [
  {
    title: "Admin",
    items: [
      { href: "/admin", label: "Dashboard", short: "AH" },
      { href: "/admin/review-documents", label: "Review Queue", short: "RQ" },
      { href: "/admin/users", label: "Users", short: "US" },
      { href: "/admin/companies", label: "Companies", short: "CO" },
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
      { href: "/profile", label: "Construction Profile", short: "CP" },
    ],
  },
];

const companyAdminSideSections: NavSection[] = [
  {
    title: "Company Board",
    items: [
      { href: "/dashboard", label: "Dashboard", short: "HM" },
      { href: "/jobsites", label: "Jobsites", short: "JS" },
      { href: "/library", label: "Documents", short: "DC" },
      { href: "/company-users", label: "Users", short: "US" },
      { href: "/training-matrix", label: "Training matrix", short: "TM" },
      { href: "/field-id-exchange", label: "Corrective Actions", short: "CA" },
      { href: "/daps", label: "DAPs", short: "DP" },
      { href: "/permits", label: "Permits", short: "PM" },
      { href: "/incidents", label: "Incidents", short: "IN" },
      { href: "/analytics", label: "Analytics", short: "AN" },
      { href: "/reports", label: "Reports", short: "RP" },
    ],
  },
  {
    title: "Workflow",
    items: [
      { href: "/submit", label: "Submit Document", short: "SD" },
      { href: "/upload", label: "Upload File", short: "UF" },
      { href: "/peshep", label: "PESHEP Builder", short: "PB" },
      { href: "/csep", label: "CSEP Builder", short: "CS" },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/profile", label: "Construction Profile", short: "CP" },
    ],
  },
];

const companyManagerSideSections: NavSection[] = [
  {
    title: "Company Operations",
    items: [
      { href: "/dashboard", label: "Dashboard", short: "HM" },
      { href: "/jobsites", label: "Jobsites", short: "JS" },
      { href: "/library", label: "Documents", short: "DC" },
      { href: "/training-matrix", label: "Training matrix", short: "TM" },
      { href: "/field-id-exchange", label: "Corrective Actions", short: "CA" },
      { href: "/daps", label: "DAPs", short: "DP" },
      { href: "/permits", label: "Permits", short: "PM" },
      { href: "/incidents", label: "Incidents", short: "IN" },
      { href: "/analytics", label: "Analytics", short: "AN" },
      { href: "/reports", label: "Reports", short: "RP" },
    ],
  },
  {
    title: "Workflow",
    items: [
      { href: "/submit", label: "Submit Document", short: "SD" },
      { href: "/upload", label: "Upload File", short: "UF" },
      { href: "/peshep", label: "PESHEP Builder", short: "PB" },
      { href: "/csep", label: "CSEP Builder", short: "CS" },
    ],
  },
  {
    title: "Account",
    items: [{ href: "/profile", label: "Construction Profile", short: "CP" }],
  },
];

const companyUserSideSections: NavSection[] = [
  {
    title: "Company Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", short: "HM" },
      { href: "/library", label: "Documents", short: "DC" },
      { href: "/training-matrix", label: "Training matrix", short: "TM" },
      { href: "/submit", label: "Submit Document", short: "SD" },
      { href: "/upload", label: "Upload File", short: "UF" },
      { href: "/profile", label: "Construction Profile", short: "CP" },
    ],
  },
];

const accountSetupSideSections: NavSection[] = [
  {
    title: "Getting Started",
    items: [
      { href: "/profile", label: "Build Construction Profile", short: "CP" },
      { href: "/company-setup", label: "Create Company Workspace", short: "CO" },
    ],
  },
];

const accountSetupQuickLinks: NavItem[] = [
  { href: "/profile", label: "Build Construction Profile", short: "CP" },
  { href: "/company-setup", label: "Create Company Workspace", short: "CO" },
];

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
      className={`${sizeClass} inline-flex items-center justify-center rounded-2xl bg-sky-400/18 font-black text-sky-100 ${textClass}`}
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
  const [companyName, setCompanyName] = useState("");
  const [profileComplete, setProfileComplete] = useState(false);
  const [profileSummary, setProfileSummary] = useState<ProfileSummary | null>(null);
  const [agreementConfig, setAgreementConfig] = useState<AgreementConfig>(
    getDefaultAgreementConfig()
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bootError, setBootError] = useState("");
  const isAdminArea = pathname.startsWith("/admin");
  const isCompanyAdminUser = userRole === "company_admin";
  const isCompanyManagerUser = userRole === "manager" || userRole === "safety_manager";
  const isCompanyUser =
    userRole === "company_user" ||
    userRole === "project_manager" ||
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

  const sideSections = useMemo(() => {
    if (needsCompanySetup) {
      return accountSetupSideSections;
    }
    if (!isAdminArea && isCompanyAdminUser) {
      return companyAdminSideSections;
    }
    if (!isAdminArea && isCompanyManagerUser) {
      return companyManagerSideSections;
    }
    if (!isAdminArea && isCompanyUser) {
      return companyUserSideSections;
    }
    const base = isAdminArea ? adminSideSections : userSideSections;
    if (!isAdminArea && canAccessInternalAdmin) {
      return [
        ...base,
        {
          title: "Admin",
          items: [{ href: "/admin", label: "Admin Panel", short: "AD" }],
        },
      ];
    }
    return base;
  }, [
    canAccessInternalAdmin,
    isAdminArea,
    isCompanyAdminUser,
    isCompanyManagerUser,
    isCompanyUser,
    needsCompanySetup,
  ]);

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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      await syncSession(session);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session) {
        router.replace("/login");
        return;
      }
      void syncSession(session);
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

    if (isCompanyScopedUser) {
      if (userRole === "read_only") {
        const readOnlyAllowedRoutes = ["/dashboard", "/reports"];
        const inReadOnlyRoute = readOnlyAllowedRoutes.some(
          (route) => pathname === route || pathname.startsWith(`${route}/`)
        );
        if (!inReadOnlyRoute) {
          router.replace("/dashboard");
        }
        return;
      }

      const companyAllowedRoutes = ["/dashboard", "/library", "/profile"];

      if (
        userRole === "project_manager" ||
        userRole === "foreman" ||
        userRole === "field_user"
      ) {
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
          "/daps",
          "/permits",
          "/incidents",
          "/analytics",
          "/reports"
        );
      }

      const canOpenTrainingMatrix =
        Boolean(permissionMap?.can_view_analytics) ||
        Boolean(permissionMap?.can_manage_company_users) ||
        userRole === "company_admin" ||
        userRole === "manager" ||
        userRole === "safety_manager" ||
        userRole === "project_manager";

      if (canOpenTrainingMatrix) {
        companyAllowedRoutes.push("/training-matrix");
      }

      if (
        permissionMap?.can_create_documents ||
        permissionMap?.can_edit_documents ||
        permissionMap?.can_submit_documents
      ) {
        companyAllowedRoutes.push("/submit", "/safety-submit", "/upload", "/peshep", "/csep");
      }

      if (permissionMap?.can_manage_company_users) {
        companyAllowedRoutes.push("/company-users");
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
    isAdminArea,
    isCompanyScopedUser,
    loading,
    needsCompanySetup,
    needsProfileSetup,
    pathname,
    permissionMap,
    router,
    userRole,
  ]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const workspaceLabel = isAdminArea
    ? "Admin Workspace"
    : needsProfileSetup
      ? "Profile Setup"
    : needsCompanySetup
      ? "Workspace Setup"
      : isCompanyScopedUser
        ? "Company Workspace"
        : "User Workspace";
  const workspaceDescriptor = isAdminArea
    ? "Safety management controls"
    : needsProfileSetup
      ? "Build your construction profile first"
    : needsCompanySetup
      ? "Finish company setup before inviting users"
      : isCompanyScopedUser
        ? isCompanyLeadershipUser
          ? "Jobsites, documents, and field operations"
          : "Company documents, uploads, and assigned work"
        : "Project document workspace";

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
                      {section.items
                        .filter((item) => {
                          if (item.href !== "/training-matrix") return true;
                          return (
                            userRole === "company_admin" ||
                            userRole === "manager" ||
                            userRole === "safety_manager" ||
                            userRole === "project_manager"
                          );
                        })
                        .map((item) => {
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
                <div className="mt-3 flex items-center gap-3">
                  <ProfileAvatar profile={profileSummary} email={userEmail} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      {getDisplayName(profileSummary, userEmail)}
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-300">
                      {profileSummary?.jobTitle || formatRole(userRole)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs uppercase tracking-[0.16em] text-sky-200">
                  {profileSummary?.tradeSpecialty || formatRole(userRole)}
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
                              : needsProfileSetup
                                ? "Complete your construction profile before opening company setup or workspace tools"
                              : needsCompanySetup
                                ? "Create your company workspace before inviting employees or opening company tools"
                                : isCompanyScopedUser
                                  ? isCompanyLeadershipUser
                                    ? "Run company operations with documents, jobsites, and field tools scoped to your own company"
                                    : "Open company documents, upload records, and work inside your assigned company workspace"
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
                      <div className="mt-2 flex items-center gap-3">
                        <ProfileAvatar
                          profile={profileSummary}
                          email={userEmail}
                          sizeClass="h-10 w-10"
                          textClass="text-xs"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">
                            {getDisplayName(profileSummary, userEmail)}
                          </div>
                          <div className="mt-1 truncate text-xs text-slate-500">
                            {profileSummary?.jobTitle || userEmail}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
                      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                        Workspace
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{workspaceLabel}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {needsProfileSetup
                          ? "Construction profile required"
                          : needsCompanySetup
                          ? companyName || workspaceDescriptor
                          : workspaceDescriptor}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 sm:px-6 xl:px-8">
            <div className="mx-auto w-full max-w-[1600px] space-y-5">
              {bootError ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
                  {bootError}
                </div>
              ) : null}
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
