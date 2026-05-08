"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import {
  buildSafePredictDataset,
  demoSafePredictDataset,
  nextActionStatus,
  safePredictStatusToApi,
  type SafePredictActionRecord,
  type SafePredictDataMode,
  type SafePredictDataset,
  type SafePredictLiveJobsiteRow,
  type SafePredictLiveRecordRow,
  type SafePredictJobsiteRecord,
} from "@/lib/safePredictData";
import type { SafePredictActionStatus, SafePredictCorrectiveAction } from "@/lib/safePredictMockData";

type SafePredictDataContextValue = {
  dataset: SafePredictDataset;
  loading: boolean;
  mode: SafePredictDataMode;
  selectedJobsiteId: string;
  setSelectedJobsiteId: (siteId: string) => void;
  setMode: (mode: SafePredictDataMode) => void;
  updateActionStatus: (id: string, status: SafePredictActionStatus) => void;
  advanceActionStatus: (id: string) => void;
  addDraftAction: (input: {
    title: string;
    linkedRiskId: string;
    linkedRisk: string;
    siteId: string;
    priority: SafePredictCorrectiveAction["priority"];
    createdFrom: SafePredictActionRecord["createdFrom"];
  }) => SafePredictActionRecord;
  addDraftJobsite: (input: {
    name: string;
    code: string;
    address: string;
    projectManager: string;
    safetyLead: string;
    customerName: string;
    customerReportEmail: string;
  }) => SafePredictJobsiteRecord;
};

const SafePredictDataContext = createContext<SafePredictDataContextValue | null>(null);

const actionStorageKey = "safe-predict-live-beta-actions-v1";
const jobsiteStorageKey = "safe-predict-live-beta-jobsites-v1";
const actionStatusStorageKey = "safe-predict-action-status-overrides-v1";
const selectedJobsiteStorageKey = "safe-predict-selected-jobsite-v1";
const modeStorageKey = "safe-predict-data-mode-v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalizeActionRows(value: unknown): SafePredictActionRecord[] | null {
  if (!Array.isArray(value)) return null;
  const rows = value.filter((row): row is SafePredictActionRecord => {
    if (!isRecord(row)) return false;
    return typeof row.id === "string" && typeof row.title === "string" && typeof row.status === "string" && typeof row.siteId === "string";
  });
  return rows.length > 0 ? rows : null;
}

function normalizeStatusOverrides(value: unknown): Record<string, SafePredictActionStatus> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, SafePredictActionStatus] =>
      typeof entry[0] === "string" &&
      (entry[1] === "New" || entry[1] === "In Progress" || entry[1] === "Awaiting Verification" || entry[1] === "Closed")
    )
  );
}

function normalizeJobsiteRows(value: unknown): SafePredictJobsiteRecord[] | null {
  if (!Array.isArray(value)) return null;
  const rows = value.filter((row): row is SafePredictJobsiteRecord => {
    if (!isRecord(row)) return false;
    return typeof row.id === "string" && typeof row.name === "string" && typeof row.riskScore === "number";
  });
  return rows.length > 0 ? rows : null;
}

async function fetchJsonWithToken(path: string, token?: string | null) {
  const response = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) return null;
  return (await response.json().catch(() => null)) as Record<string, unknown> | null;
}

function extractRows(payload: Record<string, unknown> | null, keys: string[]) {
  if (!payload) return [];
  for (const key of keys) {
    const rows = payload[key];
    if (Array.isArray(rows)) return rows;
  }
  return [];
}

function loadInitialMode(): SafePredictDataMode {
  return window.localStorage.getItem(modeStorageKey) === "live" ? "live" : "demo";
}

function loadInitialSelectedJobsite() {
  return window.localStorage.getItem(selectedJobsiteStorageKey) || "all";
}

function loadInitialActions() {
  try {
    return normalizeActionRows(JSON.parse(window.localStorage.getItem(actionStorageKey) || "null"))?.filter((action) => action.id.startsWith("draft-")) ?? [];
  } catch {
    return [];
  }
}

function loadInitialJobsites() {
  try {
    return normalizeJobsiteRows(JSON.parse(window.localStorage.getItem(jobsiteStorageKey) || "null"))?.filter((jobsite) => jobsite.id.startsWith("draft-site-")) ?? [];
  } catch {
    return [];
  }
}

function loadInitialActionStatuses() {
  try {
    return normalizeStatusOverrides(JSON.parse(window.localStorage.getItem(actionStatusStorageKey) || "null"));
  } catch {
    return {};
  }
}

export function SafePredictDataProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<SafePredictDataMode>("demo");
  const [loading, setLoading] = useState(false);
  const [baseDataset, setBaseDataset] = useState<SafePredictDataset>(demoSafePredictDataset);
  const [draftActions, setDraftActions] = useState<SafePredictActionRecord[]>([]);
  const [draftJobsites, setDraftJobsites] = useState<SafePredictJobsiteRecord[]>([]);
  const [actionStatuses, setActionStatuses] = useState<Record<string, SafePredictActionStatus>>({});
  const [selectedJobsiteId, setSelectedJobsiteIdState] = useState("all");
  const [liveToken, setLiveToken] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setModeState(loadInitialMode());
      setDraftActions(loadInitialActions());
      setDraftJobsites(loadInitialJobsites());
      setActionStatuses(loadInitialActionStatuses());
      setSelectedJobsiteIdState(loadInitialSelectedJobsite());
    }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLiveData() {
      if (mode !== "live") {
        setLiveToken(null);
        setBaseDataset(demoSafePredictDataset);
        return;
      }

      setLoading(true);
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token ?? null;
        const [
          jobsitesPayload,
          incidentsPayload,
          observationsPayload,
          actionsPayload,
          permitsPayload,
          trainingPayload,
          inspectionsPayload,
          reportsPayload,
          documentsPayload,
          usersPayload,
        ] = await Promise.all([
          fetchJsonWithToken("/api/company/jobsites", token),
          fetchJsonWithToken("/api/company/incidents", token),
          fetchJsonWithToken("/api/company/observations", token),
          fetchJsonWithToken("/api/company/corrective-actions", token),
          fetchJsonWithToken("/api/company/permits", token),
          fetchJsonWithToken("/api/company/training-matrix", token),
          fetchJsonWithToken("/api/company/field-audits", token),
          fetchJsonWithToken("/api/company/reports", token),
          fetchJsonWithToken("/api/workspace/documents", token),
          fetchJsonWithToken("/api/company/users", token),
        ]);
        const liveJobsites = extractRows(jobsitesPayload, ["jobsites"]) as SafePredictLiveJobsiteRow[];
        const liveIncidents = extractRows(incidentsPayload, ["incidents"]) as SafePredictLiveRecordRow[];
        const liveObservations = extractRows(observationsPayload, ["observations"]) as SafePredictLiveRecordRow[];
        const liveActions = extractRows(actionsPayload, ["actions"]) as SafePredictLiveRecordRow[];
        const livePermits = extractRows(permitsPayload, ["permits"]) as SafePredictLiveRecordRow[];
        const liveEmployees = extractRows(trainingPayload, ["rows"]) as SafePredictLiveRecordRow[];
        const liveInspections = extractRows(inspectionsPayload, ["audits", "inspections"]) as SafePredictLiveRecordRow[];
        const liveReports = extractRows(reportsPayload, ["reports"]) as SafePredictLiveRecordRow[];
        const liveDocuments = extractRows(documentsPayload, ["documents"]) as SafePredictLiveRecordRow[];
        const liveUsers = extractRows(usersPayload, ["users"]) as SafePredictLiveRecordRow[];
        if (!cancelled) {
          setLiveToken(token);
          setBaseDataset(buildSafePredictDataset({ mode: "live", liveJobsites, liveIncidents, liveObservations, liveActions, livePermits, liveEmployees, liveInspections, liveReports, liveDocuments, liveUsers }));
        }
      } catch {
        if (!cancelled) {
          setLiveToken(null);
          setBaseDataset(demoSafePredictDataset);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadLiveData();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const dataset = useMemo<SafePredictDataset>(
    () => ({
      ...baseDataset,
      jobsites: [...draftJobsites, ...baseDataset.jobsites],
      actions: [
        ...draftActions,
        ...baseDataset.actions.map((action) => {
          const status = actionStatuses[action.id] ?? action.status;
          return {
            ...action,
            status,
            progress: status === "Closed" ? 100 : status === "Awaiting Verification" ? Math.max(action.progress, 85) : status === "In Progress" ? Math.max(action.progress, 45) : action.progress,
          };
        }),
      ],
    }),
    [actionStatuses, baseDataset, draftActions, draftJobsites]
  );

  const setMode = useCallback((nextMode: SafePredictDataMode) => {
    setModeState(nextMode);
    window.localStorage.setItem(modeStorageKey, nextMode);
  }, []);

  const setSelectedJobsiteId = useCallback((siteId: string) => {
    setSelectedJobsiteIdState(siteId);
    window.localStorage.setItem(selectedJobsiteStorageKey, siteId);
  }, []);

  const persistDraftActions = useCallback((nextActions: SafePredictActionRecord[]) => {
    setDraftActions(nextActions);
    window.localStorage.setItem(actionStorageKey, JSON.stringify(nextActions));
  }, []);

  const persistDraftJobsites = useCallback((nextJobsites: SafePredictJobsiteRecord[]) => {
    setDraftJobsites(nextJobsites);
    window.localStorage.setItem(jobsiteStorageKey, JSON.stringify(nextJobsites));
  }, []);

  const persistActionStatuses = useCallback((nextStatuses: Record<string, SafePredictActionStatus>) => {
    setActionStatuses(nextStatuses);
    window.localStorage.setItem(actionStatusStorageKey, JSON.stringify(nextStatuses));
  }, []);

  const updateActionStatus = useCallback(
    (id: string, status: SafePredictActionStatus) => {
      if (draftActions.some((action) => action.id === id)) {
        persistDraftActions(
          draftActions.map((action) =>
            action.id === id
              ? {
                  ...action,
                  status,
                  progress: status === "Closed" ? 100 : status === "Awaiting Verification" ? 85 : status === "In Progress" ? Math.max(action.progress, 45) : action.progress,
                }
              : action
          )
        );
        return;
      }

      persistActionStatuses({ ...actionStatuses, [id]: status });
      if (mode === "live" && liveToken) {
        const existing = baseDataset.actions.find((action) => action.id === id);
        void fetch(`/api/company/corrective-actions/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${liveToken}`,
          },
          body: JSON.stringify({
            title: existing?.title,
            status: safePredictStatusToApi(status),
            severity: existing?.priority ?? "medium",
            category: existing?.linkedRisk ?? "corrective_action",
            jobsiteId: existing?.siteId,
          }),
        }).catch(() => undefined);
      }
    },
    [actionStatuses, baseDataset.actions, draftActions, liveToken, mode, persistActionStatuses, persistDraftActions]
  );

  const advanceActionStatus = useCallback(
    (id: string) => {
      const action = dataset.actions.find((candidate) => candidate.id === id);
      if (action) updateActionStatus(id, nextActionStatus(action.status));
    },
    [dataset.actions, updateActionStatus]
  );

  const addDraftAction = useCallback(
    (input: {
      title: string;
      linkedRiskId: string;
      linkedRisk: string;
      siteId: string;
      priority: SafePredictCorrectiveAction["priority"];
      createdFrom: SafePredictActionRecord["createdFrom"];
    }) => {
      const draft: SafePredictActionRecord = {
        id: `draft-${Date.now()}`,
        title: input.title,
        linkedRiskId: input.linkedRiskId,
        linkedRisk: input.linkedRisk,
        assignee: "Alex Morgan",
        dueDate: "May 30",
        status: "New",
        priority: input.priority,
        progress: 0,
        aiRecommended: true,
        siteId: input.siteId,
        createdFrom: input.createdFrom,
        sourceHref: `/safe-predict/jobsites/${encodeURIComponent(input.siteId)}#actions`,
      };
      persistDraftActions([draft, ...draftActions]);
      if (mode === "live" && liveToken) {
        void fetch("/api/company/corrective-actions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${liveToken}`,
          },
          body: JSON.stringify({
            title: input.title,
            description: `Created from SafetyDoc360 ${input.createdFrom}: ${input.linkedRisk}`,
            severity: input.priority,
            category: "corrective_action",
            status: "open",
            jobsiteId: input.siteId,
          }),
        }).catch(() => undefined);
      }
      return draft;
    },
    [draftActions, liveToken, mode, persistDraftActions]
  );

  const addDraftJobsite = useCallback(
    (input: {
      name: string;
      code: string;
      address: string;
      projectManager: string;
      safetyLead: string;
      customerName: string;
      customerReportEmail: string;
    }) => {
      const id = `draft-site-${Date.now()}`;
      const draft: SafePredictJobsiteRecord = {
        id,
        name: input.name,
        code: input.code || "DRAFT",
        address: input.address || "Address pending",
        cityState: input.address || "Location pending",
        projectType: "Construction",
        phase: "Planning",
        riskScore: 52,
        riskLevel: "medium",
        workforceCount: 0,
        openActions: 0,
        activePermits: 0,
        siteLead: input.safetyLead || "Unassigned",
        status: "planned",
        projectManager: input.projectManager || "Unassigned",
        customerName: input.customerName || "Customer pending",
        customerReportEmail: input.customerReportEmail || "Not set",
        startDate: "",
        endDate: "",
        inspectionGaps: 0,
        incidentCount: 0,
        observationCount: 0,
      };
      persistDraftJobsites([draft, ...draftJobsites]);
      if (mode === "live" && liveToken) {
        void fetch("/api/company/jobsites", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${liveToken}`,
          },
          body: JSON.stringify({
            name: input.name,
            projectNumber: input.code,
            location: input.address,
            projectManager: input.projectManager,
            safetyLead: input.safetyLead,
            customerCompanyName: input.customerName,
            customerReportEmail: input.customerReportEmail,
            status: "planned",
          }),
        }).catch(() => undefined);
      }
      return draft;
    },
    [draftJobsites, liveToken, mode, persistDraftJobsites]
  );

  return (
    <SafePredictDataContext.Provider
      value={{
        dataset,
        loading,
        mode,
        selectedJobsiteId,
        setSelectedJobsiteId,
        setMode,
        updateActionStatus,
        advanceActionStatus,
        addDraftAction,
        addDraftJobsite,
      }}
    >
      {children}
    </SafePredictDataContext.Provider>
  );
}

export function useSafePredictData() {
  const context = useContext(SafePredictDataContext);
  if (!context) {
    throw new Error("useSafePredictData must be used within SafePredictDataProvider");
  }
  return context;
}
