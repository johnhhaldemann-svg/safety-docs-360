"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
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
import { useSafePredictData } from "@/components/safe-predict/SafePredictDataProvider";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const navItems = [
  { href: "/safe-predict", label: "Dashboard", icon: Home },
  { href: "/safe-predict/jobsites", label: "Jobsites", icon: Building2 },
  { href: "/safe-predict/predictive-risk", label: "Predictive Risk", icon: BarChart3 },
  { href: "/safe-predict/risk-mitigation", label: "Risk Mitigation", icon: ShieldCheck },
  { href: "/safe-predict/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/safe-predict/observations", label: "Observations", icon: Eye },
  { href: "/safe-predict/corrective-actions", label: "Corrective Actions", icon: ClipboardCheck },
  { href: "/safe-predict/inspections", label: "Jobsite Audits", icon: Search },
  { href: "/safe-predict/hazards", label: "Hazards", icon: TriangleAlert },
  { href: "/safe-predict/team-access", label: "Team Access", icon: Users },
  { href: "/safe-predict/workforce", label: "Workforce", icon: Users },
  { href: "/safe-predict/training", label: "Training", icon: GraduationCap },
  { href: "/safe-predict/permits", label: "Permits", icon: FileText },
  { href: "/safe-predict/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/safe-predict/reports", label: "Reports", icon: BarChart3 },
  { href: "/safe-predict/apps-integrations", label: "Apps", icon: LayoutGrid },
  { href: "/safe-predict/platform-actions", label: "Platform Actions", icon: LayoutGrid },
  { href: "/safe-predict/settings", label: "Settings", icon: Settings },
] as const;

type AuthMeResponse = {
  user?: {
    role?: string | null;
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

function Safety360DocsLockup({
  className,
  compact = false,
  sizes,
}: {
  className: string;
  compact?: boolean;
  sizes: string;
}) {
  return (
    <span className={cx("flex items-center overflow-hidden rounded-xl bg-white", compact ? "gap-2 px-2 py-1.5" : "gap-2 px-3 py-2", className)}>
      <span className={cx("relative shrink-0", compact ? "h-8 w-8" : "h-10 w-10")}>
        <Image
          src="/brand/safety360docs-reliance-icon.png"
          alt=""
          fill
          priority
          sizes={sizes}
          className="object-contain"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cx("flex items-baseline leading-none", compact ? "text-[14px]" : "text-[16px]")}
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          <span className="font-black italic text-[#1977cf]">Safety</span>
          <span className="font-black italic text-[#73b83b]">360</span>
          <span className="font-black italic text-[#1977cf]">Docs</span>
        </span>
        <span
          className={cx("block italic leading-none text-[#6e7683]", compact ? "mt-0 text-[6px]" : "mt-0.5 text-[8px]")}
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          by Reliance EHS
        </span>
        <span className={cx("block bg-[#c52828]", compact ? "mt-1 h-px" : "mt-1.5 h-[2px]")} />
        <span className={cx("block truncate font-bold leading-none tracking-[0.02em] text-[#c52828]", compact ? "mt-1 text-[5px]" : "mt-1 text-[6.5px]")}>
          ENVIRONMENT - HEALTH - SAFETY
        </span>
      </span>
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
  const { dataset } = useSafePredictData();
  const elevatedSiteCount = dataset.jobsites.filter((site) => site.riskLevel === "critical" || site.riskLevel === "high").length;

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

  const navList = (
    <div className="space-y-1">
      {[...navItems, ...(canAccessInternalAdmin ? [{ href: "/admin", label: "Admin", icon: ShieldCheck } as const] : []), ...(viewerRole === "super_admin" ? [{ href: "/superadmin/system-health", label: "Superadmin", icon: LayoutGrid } as const] : [])].map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileMenuOpen(false)}
            className={cx(
              "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-bold transition",
              active
                ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[0_12px_22px_rgba(37,99,235,0.28)]"
                : "text-slate-200/86 hover:bg-white/8 hover:text-white"
            )}
          >
            <Icon className="h-5 w-5 shrink-0" strokeWidth={2.2} aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7faff] text-[#0f172a]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col bg-[#061d35] text-white shadow-[18px_0_40px_rgba(5,24,44,0.16)] lg:flex">
        <div className="px-5 pb-4 pt-5">
          <Link href="/safe-predict" className="block" aria-label="Safety360Docs home">
            <Safety360DocsLockup
              className="h-[74px] w-full border border-blue-100/70 shadow-[0_12px_24px_rgba(5,24,44,0.24)]"
              sizes="48px"
            />
          </Link>
        </div>

        <div className="safe-predict-sidebar-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3">
          <nav>
            {navList}
          </nav>

          <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
            <Link href="/safe-predict/risk-mitigation" className="block rounded-xl border border-white/10 bg-white/[0.045] p-4 transition hover:bg-white/[0.075]">
              <p className="mb-3 text-xs font-black uppercase tracking-wide text-blue-100/60">{dataset.company.name}</p>
              <p className="text-sm font-bold">Predictive Risk Today</p>
              <div className="mt-4 h-20 rounded-t-full bg-[conic-gradient(from_240deg,#22c55e_0_28%,#facc15_28%_58%,#f97316_58%_78%,#ef4444_78%_100%)] p-2">
                <div className="flex h-full items-end justify-center rounded-t-full bg-[#061d35] pb-1 text-center">
                  <span>
                    <span className="block text-lg font-black text-amber-300">Moderate</span>
                    <span className="text-xs text-slate-200">Score: 56 / 100</span>
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
              <span className="mt-1 block text-slate-200">{dataset.jobsites.length} jobsites, {dataset.employees.length} shell employees</span>
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
              <Link href="/safe-predict" onClick={() => setMobileMenuOpen(false)} className="block" aria-label="Safety360Docs home">
                <Safety360DocsLockup
                  compact
                  className="h-12 w-[176px] border border-blue-100/70 shadow-[0_8px_18px_rgba(5,24,44,0.2)]"
                  sizes="32px"
                />
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-white"
                aria-label="Close SafetyDoc360 menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">{navList}</nav>
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
                aria-label="Open SafetyDoc360 menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <Link href="/safe-predict" className="flex min-w-0 items-center gap-2 lg:hidden">
                <span className="relative h-7 w-7 overflow-hidden rounded-md bg-white">
                  <Image
                    src="/brand/safety360docs-reliance-icon.png"
                    alt="Safety360Docs by Reliance EHS"
                    fill
                    priority
                    sizes="28px"
                    className="object-contain p-0.5"
                  />
                </span>
                <span className="truncate text-base font-black sm:text-lg">Safety360Docs</span>
              </Link>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <Link href="/safe-predict/reports" className="hidden h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm md:inline-flex">
                {dataset.company.name}
              </Link>
              <Link href="/safe-predict/risk-mitigation" className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm" aria-label="Open SafetyDoc360 alerts">
                <Bell className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-[10px] font-black text-white">
                  {elevatedSiteCount}
                </span>
              </Link>
              <div className="hidden items-center gap-3 border-l border-slate-200 pl-3 sm:flex">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-slate-200 to-slate-100 text-sm font-black text-slate-700">
                  AM
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900">Alex Morgan</p>
                  <p className="text-xs text-slate-500">Safety Manager</p>
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
