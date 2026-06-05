"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { deferEffect } from "@/lib/deferredEffect";
import { getSupabaseAccessToken } from "@/lib/supabaseClientSession";
import type { SuperadminHealthScore } from "@/lib/superadmin/health/types";
import type { PlatformHelpTicketSummary } from "@/types/platform-support";

export type CommandActivityEntry = {
  id: string;
  summary: string;
  objectType: string;
  severity: string;
  createdAt: string | null;
};

export type CommandCenterMetrics = {
  findingsByType: {
    correctiveActions: number | null;
    incidents: number | null;
    observations: number | null;
    inspections: number | null;
  };
  inspectionsMtd: { current: number | null; previous: number | null };
  reviewBacklog: {
    predictionValidation: number;
    knowledgeCandidates: number;
    aiImprovements: number;
    ownerValidations: number;
  };
  approvalMemory: { total: number; approved: number; rejected: number };
  topOrgs: Array<{ companyId: string; name: string; openIncidents: number }>;
  deadlines: Array<{ title: string; dueDate: string; meta: string }>;
};

export type CommandCenterData = {
  /** Overall platform health score, used as "Platform Compliance". */
  healthScore: number | null;
  healthCategories: SuperadminHealthScore["categories"] | null;
  criticalAlerts: Array<Record<string, unknown>>;
  ticketSummary: PlatformHelpTicketSummary | null;
  openEscalations: number;
  unseenTickets: number;
  pendingOwners: number;
  totalOrganizations: number | null;
  pendingOnboard: number | null;
  activeUsers: number | null;
  activity: CommandActivityEntry[];
  metrics: CommandCenterMetrics | null;
};

type CommandCenterContextValue = {
  data: CommandCenterData | null;
  loading: boolean;
  error: boolean;
  refresh: () => void;
};

const EMPTY: CommandCenterData = {
  healthScore: null,
  healthCategories: null,
  criticalAlerts: [],
  ticketSummary: null,
  openEscalations: 0,
  unseenTickets: 0,
  pendingOwners: 0,
  totalOrganizations: null,
  pendingOnboard: null,
  activeUsers: null,
  activity: [],
  metrics: null,
};

const CommandCenterContext = createContext<CommandCenterContextValue>({
  data: null,
  loading: true,
  error: false,
  refresh: () => {},
});

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isActiveStatus(value: unknown): boolean {
  const v = str(value).trim().toLowerCase();
  return v === "" || v === "active";
}

export function CommandCenterDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getSupabaseAccessToken();
      if (!token) {
        setError(true);
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };

      const settle = async <T,>(p: Promise<Response>): Promise<T | null> => {
        try {
          const res = await p;
          if (!res.ok) return null;
          return (await res.json()) as T;
        } catch {
          return null;
        }
      };

      const [score, tickets, owners, events, companies, users, metricsResp] = await Promise.all([
        settle<SuperadminHealthScore>(fetch("/api/superadmin/health/score", { headers })),
        settle<{ summary?: PlatformHelpTicketSummary }>(
          fetch("/api/superadmin/help-tickets?limit=1", { headers })
        ),
        settle<{ owners?: Array<Record<string, unknown>> }>(
          fetch("/api/superadmin/health/owners?limit=100", { headers })
        ),
        settle<{ events?: Array<Record<string, unknown>> }>(
          fetch("/api/superadmin/health/events?limit=8", { headers })
        ),
        settle<{ companies?: unknown[]; signupRequests?: unknown[] }>(
          fetch("/api/admin/companies", { headers })
        ),
        settle<{ users?: Array<Record<string, unknown>> }>(
          fetch("/api/admin/users", { headers })
        ),
        settle<{ metrics?: CommandCenterMetrics }>(
          fetch("/api/superadmin/command-center/metrics", { headers })
        ),
      ]);

      const summary = tickets?.summary ?? null;
      const ownerRows = owners?.owners ?? [];
      const pendingOwners = ownerRows.filter(
        (o) => str(o.validation_status) !== "verified"
      ).length;

      const activity: CommandActivityEntry[] = (events?.events ?? [])
        .slice(0, 8)
        .map((row, i) => ({
          id: str(row.id) || `event-${i}`,
          summary:
            str(row.summary) ||
            str(row.description) ||
            str(row.object_type) ||
            "Platform event",
          objectType: str(row.object_type) || "event",
          severity: str(row.severity) || "low",
          createdAt: str(row.created_at) || str(row.createdAt) || null,
        }));

      const companyRows = companies?.companies ?? null;
      const userRows = users?.users ?? null;

      setData({
        healthScore: typeof score?.overallScore === "number" ? score.overallScore : null,
        healthCategories: score?.categories ?? null,
        criticalAlerts: score?.criticalAlerts ?? [],
        ticketSummary: summary,
        openEscalations:
          (summary?.open ?? 0) + (summary?.inProgress ?? 0) + (summary?.waitingOnUser ?? 0),
        unseenTickets: summary?.unseen ?? 0,
        pendingOwners,
        totalOrganizations: Array.isArray(companyRows) ? companyRows.length : null,
        pendingOnboard: Array.isArray(companies?.signupRequests)
          ? companies.signupRequests.length
          : null,
        activeUsers: Array.isArray(userRows)
          ? userRows.filter((u) => isActiveStatus(u.account_status ?? u.status)).length
          : null,
        activity,
        metrics: metricsResp?.metrics ?? null,
      });
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => deferEffect(() => void load()), [load]);

  const value = useMemo<CommandCenterContextValue>(
    () => ({ data, loading, error, refresh: () => void load() }),
    [data, loading, error, load]
  );

  return (
    <CommandCenterContext.Provider value={value}>{children}</CommandCenterContext.Provider>
  );
}

export function useCommandCenterData() {
  return useContext(CommandCenterContext);
}

export { EMPTY as EMPTY_COMMAND_CENTER_DATA };
