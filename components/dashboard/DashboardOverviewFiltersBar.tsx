"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { appNativeSelectClassName } from "@/components/WorkspacePrimitives";
import type { DashboardDataState } from "@/components/dashboard/types";
import { fetchWithTimeoutSafe } from "@/lib/fetchWithTimeout";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { userMaySelectAnyCompanyContractor } from "@/lib/dashboardOverviewAccess";
import { getPermissionMap } from "@/lib/rbac";

const supabase = getSupabaseBrowserClient();

type ContractorOpt = { id: string; name: string };

function mergeSearchParams(
  current: URLSearchParams,
  patch: Record<string, string | null | undefined>
): URLSearchParams {
  const n = new URLSearchParams(current.toString());
  for (const [key, val] of Object.entries(patch)) {
    if (val == null || val === "") n.delete(key);
    else n.set(key, val);
  }
  return n;
}

export function DashboardOverviewFiltersBar({ workspace }: { workspace: DashboardDataState }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [contractors, setContractors] = useState<ContractorOpt[]>([]);
  const [contractorsLoaded, setContractorsLoaded] = useState(false);

  const maySelectContractor = useMemo(
    () =>
      userMaySelectAnyCompanyContractor({
        role: workspace.userRole,
        permissionMap: workspace.permissionMap ?? getPermissionMap(workspace.userRole),
      }),
    [workspace.permissionMap, workspace.userRole]
  );

  const jobsites = useMemo(
    () =>
      (workspace.workspaceSummary.jobsites ?? [])
        .map((j) => ({
          id: typeof j.id === "string" ? j.id : "",
          name: (j.name ?? "Jobsite").trim() || "Jobsite",
        }))
        .filter((j) => j.id.length > 0),
    [workspace.workspaceSummary.jobsites]
  );

  const lockedContractorId = workspace.linkedContractorId;

  const loadContractors = useCallback(async () => {
    if (lockedContractorId || !maySelectContractor || workspace.loading || !workspace.companyWorkspaceLoaded) {
      setContractors([]);
      setContractorsLoaded(true);
      return;
    }
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      setContractors([]);
      setContractorsLoaded(true);
      return;
    }
    const res = await fetchWithTimeoutSafe(
      "/api/company/contractors",
      { headers: { Authorization: `Bearer ${token}` } },
      15000,
      "Contractors"
    );
    const data = (await res.json().catch(() => null)) as { contractors?: ContractorOpt[] } | null;
    setContractors(res.ok && data?.contractors ? data.contractors : []);
    setContractorsLoaded(true);
  }, [lockedContractorId, maySelectContractor, workspace.companyWorkspaceLoaded, workspace.loading]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async contractor directory for filter dropdown
    void loadContractors();
  }, [loadContractors]);

  const pushParams = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const next = mergeSearchParams(searchParams, patch);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    if (!lockedContractorId) return;
    if (searchParams.get("contractorId") === lockedContractorId) return;
    const next = mergeSearchParams(searchParams, { contractorId: lockedContractorId });
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [lockedContractorId, pathname, router, searchParams]);

  const rangeValue = searchParams.get("range")?.trim() || "";
  const effectiveRange =
    rangeValue === "7d" ||
    rangeValue === "30d" ||
    rangeValue === "90d" ||
    rangeValue === "ytd" ||
    rangeValue === "custom"
      ? rangeValue
      : "90d";

  const jobsiteValue = searchParams.get("jobsiteId")?.trim() || "";
  const contractorValue = lockedContractorId ?? searchParams.get("contractorId")?.trim() ?? "";
  const riskValue = (searchParams.get("riskLevel")?.trim().toLowerCase() || "all") as
    | "all"
    | "high"
    | "medium"
    | "low";
  const customStart = searchParams.get("startDate")?.trim() ?? "";
  const customEnd = searchParams.get("endDate")?.trim() ?? "";

  return (
    <section className="rounded-2xl border border-[var(--app-border-strong)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(241,247,255,0.95)_100%)] p-4 shadow-[var(--app-shadow-soft)] sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-[var(--app-text-strong)]">Prevention view scope</h2>
          <p className="text-xs text-[var(--app-muted)]">
            Filters narrow jobsite, contractor, risk band, and time window. They are saved in the URL and applied to the live
            overview API so leaders see the same prevention snapshot when sharing a link.
          </p>
        </div>
      </div>
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-[var(--app-text-strong)]">
          Jobsite
          <select
            className={appNativeSelectClassName}
            value={jobsiteValue}
            onChange={(e) => {
              const v = e.target.value.trim();
              pushParams({ jobsiteId: v || null });
            }}
          >
            <option value="">All accessible jobsites</option>
            {jobsites.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-[var(--app-text-strong)]">
          Contractor
          <select
            className={appNativeSelectClassName}
            value={contractorValue}
            disabled={Boolean(lockedContractorId) || !maySelectContractor}
            onChange={(e) => {
              const v = e.target.value.trim();
              pushParams({ contractorId: v || null });
            }}
          >
            <option value="">All contractors</option>
            {lockedContractorId ? (
              <option value={lockedContractorId}>Your contractor</option>
            ) : (
              contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))
            )}
          </select>
          {!contractorsLoaded && !lockedContractorId && maySelectContractor ? (
            <span className="text-[10px] font-normal text-[var(--app-muted)]">Loading contractors…</span>
          ) : null}
          {lockedContractorId ? (
            <span className="text-[10px] font-normal text-[var(--app-muted)]">Scoped to your linked contractor record.</span>
          ) : null}
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-[var(--app-text-strong)]">
          Date range
          <select
            className={appNativeSelectClassName}
            value={effectiveRange}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "custom") {
                pushParams({ range: "custom" });
              } else {
                pushParams({ range: v, startDate: null, endDate: null });
              }
            }}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="ytd">Year to date</option>
            <option value="custom">Custom range</option>
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-[var(--app-text-strong)]">
          Risk level
          <select
            className={appNativeSelectClassName}
            value={riskValue}
            onChange={(e) => pushParams({ riskLevel: e.target.value === "all" ? null : e.target.value })}
          >
            <option value="all">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
      </div>

      {effectiveRange === "custom" ? (
        <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-[var(--app-text-strong)]">
            Start (UTC date)
            <input
              type="date"
              className={appNativeSelectClassName}
              value={customStart}
              onChange={(e) => pushParams({ startDate: e.target.value || null, range: "custom" })}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-[var(--app-text-strong)]">
            End (UTC date)
            <input
              type="date"
              className={appNativeSelectClassName}
              value={customEnd}
              onChange={(e) => pushParams({ endDate: e.target.value || null, range: "custom" })}
            />
          </label>
        </div>
      ) : null}
    </section>
  );
}
