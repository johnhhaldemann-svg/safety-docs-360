"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  ClipboardCheck,
  Eye,
  FileText,
  GraduationCap,
  HelpCircle,
  Home,
  LayoutGrid,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSafePredictData } from "@/components/safe-predict/SafePredictDataProvider";
import { canViewSafePredictPlatformActions } from "@/lib/safePredictPlatformActions";
import { summarizeSafePredictDataset } from "@/lib/safePredictData";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { APP_BRAND } from "@/lib/appBrand";

type NavChild = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavChild[];
};

const navGroups: NavGroup[] = [
  {
    id: "command-center",
    label: "Command Center",
    icon: Home,
    items: [{ href: "/safe-predict", label: "Executive Overview", icon: Home }],
  },
  {
    id: "sites-operations",
    label: "Sites & Operations",
    icon: Building2,
    items: [
      { href: "/safe-predict/jobsites", label: "Jobsites", icon: Building2 },
      { href: "/safe-predict/inspections", label: "Jobsite Audits", icon: Search },
    ],
  },
  {
    id: "risk-intelligence",
    label: "Risk Intelligence",
    icon: BarChart3,
    items: [
      { href: "/safe-predict/predictive-risk", label: "Predictive Risk", icon: BarChart3 },
      { href: "/safe-predict/risk-mitigation", label: "Risk Mitigation", icon: ShieldCheck },
      { href: "/safe-predict/hazards", label: "Hazards", icon: TriangleAlert },
    ],
  },
  {
    id: "safety-management",
    label: "Safety Management",
    icon: AlertTriangle,
    items: [
      { href: "/safe-predict/incidents", label: "Incidents", icon: AlertTriangle },
      { href: "/safe-predict/observations", label: "Observations", icon: Eye },
      { href: "/safe-predict/corrective-actions", label: "Corrective Actions", icon: ClipboardCheck },
    ],
  },
  {
    id: "compliance-assurance",
    label: "Compliance & Assurance",
    icon: ClipboardCheck,
    items: [
      { href: "/safe-predict/permits", label: "Permits", icon: FileText },
      { href: "/safe-predict/training", label: "Training", icon: GraduationCap },
      { href: "/safe-predict/training-tracker", label: "Training Tracker", icon: GraduationCap },
      { href: "/safe-predict/inductions", label: "Inductions", icon: ClipboardCheck },
      { href: "/safe-predict/safety-forms", label: "Safety Forms", icon: FileText },
    ],
  },
  {
    id: "document-control",
    label: "Document Control",
    icon: FileText,
    items: [
      { href: "/safe-predict/documents", label: "Documents", icon: FileText },
      { href: "/safe-predict/csep", label: "CSEP Build", icon: FileText },
      { href: "/safe-predict/peshep", label: "PESHEP Build", icon: FileText },
    ],
  },
  {
    id: "workforce-access",
    label: "Workforce & Access",
    icon: Users,
    items: [
      { href: "/safe-predict/workforce", label: "Workforce", icon: Users },
      { href: "/safe-predict/team-access", label: "Team Access", icon: Users },
      { href: "/safe-predict/onboarding-import", label: "Onboarding Import", icon: Users },
    ],
  },
  {
    id: "insights-reporting",
    label: "Insights & Reporting",
    icon: BarChart3,
    items: [
      { href: "/safe-predict/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/safe-predict/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    id: "platform-administration",
    label: "Platform Administration",
    icon: LayoutGrid,
    items: [
      { href: "/safe-predict/apps-integrations", label: "Apps & Integrations", icon: LayoutGrid },
      { href: "/safe-predict/risk-memory", label: "Risk Memory", icon: Settings },
      { href: "/safe-predict/billing", label: "Billing", icon: ClipboardCheck },
      { href: "/safe-predict/profile", label: "Profile", icon: Users },
      { href: "/safe-predict/settings", label: "Settings", icon: Settings },
    ],
  },
];

const todayShortcuts: NavChild[] = [
  { href: "/safe-predict", label: "Executive Overview", icon: Home },
  { href: "/safe-predict/jobsites", label: "Jobsites", icon: Building2 },
  { href: "/safe-predict/corrective-actions", label: "Corrective Actions", icon: ClipboardCheck },
  { href: "/safe-predict/permits", label: "Permits", icon: FileText },
  { href: "/safe-predict/workforce", label: "Workforce", icon: Users },
];

type AuthMeResponse = {
  user?: {
    email?: string | null;
    role?: string | null;
    roleLabel?: string | null;
    profile?: {
      fullName?: string | null;
      preferredName?: string | null;
      jobTitle?: string | null;
    } | null;
    permissionMap?: {
      can_access_internal_admin?: boolean | null;
    } | null;
  };
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isActive(pathname: string, href: string) {
  if (href === "/safe-predict") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initialsForName(value: string) {
  const parts = value
    .replace(/@.*/, "")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "WU";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getActiveNavGroupId(pathname: string, groups: NavGroup[]) {
  return groups.find((group) => group.items.some((item) => isActive(pathname, item.href)))?.id ?? null;
}

function riskBand(score: number, hasSignals: boolean) {
  if (!hasSignals) return "No Data";
  if (score >= 85) return "Critical";
  if (score >= 70) return "High";
  if (score >= 45) return "Moderate";
  return "Low";
}

function SafePredictLockup({
  className,
  compact = false,
}: {
  className: string;
  compact?: boolean;
}) {
  return (
    <span className={cx("relative block overflow-hidden rounded-lg bg-white", className)}>
      <Image
        src="/brand/safepredict-lockup.svg"
        alt={APP_BRAND.productName}
        fill
        priority
        sizes={compact ? "176px" : "212px"}
        className={cx("object-contain", compact ? "p-1.5" : "p-2")}
      />
    </span>
  );
}

export function SafePredictShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [canAccessInternalAdmin, setCanAccessInternalAdmin] = useState(false);
  const [viewerRole, setViewerRole] = useState("");
  const [viewerProfile, setViewerProfile] = useState({
    name: "Workspace User",
    title: "Workspace member",
    initials: "WU",
  });
  const [expandedNavState, setExpandedNavState] = useState(() => ({
    pathname,
    groupId: getActiveNavGroupId(pathname, navGroups) ?? "",
  }));
  const { dataset } = useSafePredictData();
  const summary = summarizeSafePredictDataset(dataset);
  const elevatedSiteCount = dataset.jobsites.filter((site) => site.riskLevel === "critical" || site.riskLevel === "high").length;
  const hasRiskSignals =
    dataset.jobsites.length > 0 ||
    dataset.actions.length > 0 ||
    dataset.incidents.length > 0 ||
    dataset.observations.length > 0;
  const currentRiskBand = riskBand(summary.riskScore, hasRiskSignals);

  const visibleNavGroups = useMemo(() => {
    const canViewPlatformActions = canViewSafePredictPlatformActions(viewerRole);
    const platformItems: NavChild[] = [
      ...(canViewPlatformActions
        ? [{ href: "/safe-predict/platform-actions", label: "Platform Actions", icon: LayoutGrid }]
        : []),
      ...(canAccessInternalAdmin ? [{ href: "/admin", label: "Admin", icon: ShieldCheck }] : []),
      ...(canViewPlatformActions ? [{ href: "/superadmin", label: "Superadmin", icon: LayoutGrid }] : []),
    ];

    if (platformItems.length === 0) {
      return navGroups;
    }

    return navGroups.map((group) =>
      group.id === "platform-administration"
        ? { ...group, items: [...group.items, ...platformItems] }
        : group
    );
  }, [canAccessInternalAdmin, viewerRole]);

  const activeGroupId = getActiveNavGroupId(pathname, visibleNavGroups);
  const expandedGroupId =
    expandedNavState.pathname === pathname
      ? expandedNavState.groupId
      : activeGroupId ?? "";

  useEffect(() => {
    let cancelled = false;

    async function loadViewerAccess() {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = (await response.json().catch(() => null)) as AuthMeResponse | null;
      if (cancelled || !response.ok) return;

      const user = data?.user;
      const displayName = user?.profile?.preferredName || user?.profile?.fullName || user?.email || "Workspace User";
      const displayTitle = user?.profile?.jobTitle || user?.roleLabel || "Workspace member";
      setViewerProfile({
        name: displayName,
        title: displayTitle,
        initials: initialsForName(displayName),
      });
      setViewerRole(data?.user?.role ?? "");
      setCanAccessInternalAdmin(Boolean(data?.user?.permissionMap?.can_access_internal_admin));
    }

    void loadViewerAccess();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setMobileMenuOpen(false);
    router.push("/login");
    router.refresh();
  }

  const todayShortcutList = (
    <div className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
      <p className="px-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-100/60">Today</p>
      <div className="mt-2 grid gap-1">
        {todayShortcuts.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={`today-${item.href}`}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cx(
                "flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-black leading-tight transition",
                active ? "bg-blue-600 text-white shadow-[0_10px_18px_rgba(37,99,235,0.22)]" : "text-slate-200/82 hover:bg-white/8 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );

  const navList = (
    <div className="space-y-1">
      {visibleNavGroups.map((group) => {
        const groupActive = group.items.some((item) => isActive(pathname, item.href));
        const groupExpanded = expandedGroupId === group.id;
        const GroupIcon = group.icon;
        const sectionContentId = `safe-predict-nav-section-${group.id}`;
        return (
          <div key={group.id}>
            <button
              type="button"
              aria-expanded={groupExpanded}
              aria-controls={sectionContentId}
              onClick={() =>
                setExpandedNavState((current) => ({
                  pathname,
                  groupId: current.pathname === pathname && current.groupId === group.id && !groupActive ? "" : group.id,
                }))
              }
              className={cx(
                "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-black leading-tight transition",
                groupActive
                  ? "bg-white/[0.095] text-white ring-1 ring-white/10"
                  : groupExpanded
                    ? "bg-white/[0.065] text-white"
                    : "text-slate-200/82 hover:bg-white/8 hover:text-white"
              )}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2.5">
                <span
                  className={cx(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.055] text-blue-100/76 transition",
                    groupActive && "border-blue-300/30 bg-blue-400/16 text-blue-100"
                  )}
                  aria-hidden
                >
                  <GroupIcon className="h-4 w-4" strokeWidth={2.3} />
                </span>
                <span className="min-w-0 flex-1 whitespace-normal break-words">{group.label}</span>
              </span>
              <ChevronDown
                className={cx("h-4 w-4 shrink-0 text-slate-300 transition-transform", groupExpanded && "rotate-180 text-white")}
                strokeWidth={2.4}
                aria-hidden
              />
            </button>
            <div
              id={sectionContentId}
              className={cx(
                "grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-200 ease-out",
                groupExpanded ? "mt-1 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="ml-6 space-y-0.5 border-l border-white/10 py-1 pl-2">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={`${group.id}-${item.href}`}
                        href={item.href}
                        onClick={() => {
                          setExpandedNavState({ pathname, groupId: group.id });
                          setMobileMenuOpen(false);
                        }}
                        className={cx(
                          "flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-bold leading-tight transition",
                          active
                            ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[0_10px_18px_rgba(37,99,235,0.22)]"
                            : "text-slate-200/76 hover:bg-white/8 hover:text-white"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
                        <span className="min-w-0 flex-1 whitespace-normal break-words">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7faff] text-[#0f172a]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col bg-[#061d35] text-white shadow-[18px_0_40px_rgba(5,24,44,0.16)] lg:flex">
        <div className="px-5 pb-4 pt-5">
          <Link href="/safe-predict" className="block" aria-label={`${APP_BRAND.productName} home`}>
            <SafePredictLockup
              className="h-[74px] w-full border border-blue-100/70 shadow-[0_12px_24px_rgba(5,24,44,0.24)]"
            />
          </Link>
        </div>

        <div className="safe-predict-sidebar-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3">
          <nav className="space-y-4">
            {todayShortcutList}
            {navList}
          </nav>

          <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
            <Link href="/safe-predict/risk-mitigation" className="block rounded-xl border border-white/10 bg-white/[0.045] p-4 transition hover:bg-white/[0.075]">
              <p className="mb-3 text-xs font-black uppercase tracking-wide text-blue-100/60">{dataset.company.name}</p>
              <p className="text-sm font-bold">Predictive Risk Today</p>
              <div
                className={cx(
                  "mt-4 h-20 rounded-t-full p-2",
                  hasRiskSignals
                    ? "bg-[conic-gradient(from_240deg,#22c55e_0_28%,#facc15_28%_58%,#f97316_58%_78%,#ef4444_78%_100%)]"
                    : "bg-slate-700"
                )}
              >
                <div className="flex h-full items-end justify-center rounded-t-full bg-[#061d35] pb-1 text-center">
                  <span>
                    <span className="block text-lg font-black text-amber-300">{currentRiskBand}</span>
                    <span className="text-xs text-slate-200">Score: {summary.riskScore} / 100</span>
                  </span>
                </div>
              </div>
              <span className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-white/12 px-3 py-2 text-xs font-bold text-blue-100">
                <BarChart3 className="h-4 w-4" aria-hidden />
                View Risk Heat Map
              </span>
            </Link>
            <Link href="/safe-predict/reports" className="block rounded-xl border border-white/10 bg-white/[0.045] p-4 text-sm transition hover:bg-white/[0.075]">
              <span className="block font-bold text-white">Workspace account</span>
              <span className="mt-1 block text-slate-200">{dataset.jobsites.length} jobsites, {dataset.employees.length} employees</span>
              <span className="mt-1 block text-xs font-bold uppercase tracking-wide text-blue-100/60">Workspace data</span>
            </Link>
            <Link href="/safe-predict/settings" className="flex min-h-14 items-center gap-3 border-t border-white/10 pt-4 text-sm text-slate-200 hover:text-white">
              <HelpCircle className="h-6 w-6" aria-hidden />
              <span>
                <span className="block font-bold text-white">Need help?</span>
                Visit our Help Center
              </span>
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex min-h-14 w-full items-center gap-3 border-t border-white/10 pt-4 text-left text-sm text-slate-200 transition hover:text-white disabled:cursor-wait disabled:opacity-60"
            >
              <LogOut className="h-6 w-6" aria-hidden />
              <span>
                <span className="block font-bold text-white">{signingOut ? "Signing out..." : "Log out"}</span>
                Return to secure access
              </span>
            </button>
          </div>
        </div>
      </aside>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/50 lg:hidden" role="dialog" aria-modal="true">
          <div className="flex h-full w-[290px] max-w-[82vw] flex-col bg-[#061d35] text-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-5">
              <Link href="/safe-predict" onClick={() => setMobileMenuOpen(false)} className="block" aria-label={`${APP_BRAND.productName} home`}>
                <SafePredictLockup
                  compact
                  className="h-12 w-[176px] border border-blue-100/70 shadow-[0_8px_18px_rgba(5,24,44,0.2)]"
                />
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-white"
                aria-label="Close SafePredict menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
              {todayShortcutList}
              {navList}
            </nav>
            <div className="border-t border-white/10 p-4">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-bold text-slate-200 transition hover:bg-white/8 hover:text-white disabled:cursor-wait disabled:opacity-60"
              >
                <LogOut className="h-5 w-5" aria-hidden />
                {signingOut ? "Signing out..." : "Log out"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/92 backdrop-blur">
          <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-7">
            <div className="flex min-w-0 items-center gap-4">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
                aria-label="Open SafePredict menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <Link href="/safe-predict" className="block lg:hidden" aria-label={`${APP_BRAND.productName} home`}>
                <SafePredictLockup
                  compact
                  className="h-11 w-[180px] border border-slate-200 shadow-sm"
                />
              </Link>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <Link href="/safe-predict/reports" className="hidden h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm md:inline-flex">
                {dataset.company.name}
              </Link>
              <Link href="/safe-predict/risk-mitigation" className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm" aria-label="Open SafePredict alerts">
                <Bell className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-[10px] font-black text-white">
                  {elevatedSiteCount}
                </span>
              </Link>
              <div className="hidden items-center gap-3 border-l border-slate-200 pl-3 sm:flex">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-slate-200 to-slate-100 text-sm font-black text-slate-700">
                  {viewerProfile.initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900">{viewerProfile.name}</p>
                  <p className="truncate text-xs text-slate-500">{viewerProfile.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                aria-label={signingOut ? "Signing out" : "Log out"}
                title={signingOut ? "Signing out" : "Log out"}
              >
                <LogOut className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>
        </header>
        <main id="main-content" className="app-page-transition">
          {children}
        </main>
      </div>
    </div>
  );
}
