"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import {
  buildSafePredictDataset,
  demoSafePredictDataset,
  nextActionStatus,
  normalizeLiveActions,
  safePredictStatusToApi,
  type SafePredictActionRecord,
  type SafePredictDataMode,
  type SafePredictDataset,
  type SafePredictHazardRecord,
  type SafePredictIncidentRecord,
  type SafePredictLiveJobsiteRow,
  type SafePredictLiveRecordRow,
  type SafePredictPermitRecord,
  type SafePredictJobsiteRecord,
  type SafePredictJobsiteStatus,
} from "@/lib/safePredictData";
import type { SafePredictActionStatus, SafePredictCorrectiveAction } from "@/lib/safePredictMockData";
import {
  SAFE_PREDICT_PERMIT_ACK_STATEMENT,
  defaultPermitChecklistItems,
  permitReadinessLabel,
  type SafePredictPermitForm,
} from "@/lib/safePredictPermitForms";

type SafePredictDataContextValue = {
  dataset: SafePredictDataset;
  loading: boolean;
  mode: SafePredictDataMode;
  selectedJobsiteId: string;
  setSelectedJobsiteId: (siteId: string) => void;
  setMode: (mode: SafePredictDataMode) => void;
  refreshLiveData: () => void;
  updateActionStatus: (id: string, status: SafePredictActionStatus) => void;
  closeActionWithPhoto: (id: string, file: File) => Promise<{ success: boolean; error?: string }>;
  advanceActionStatus: (id: string) => void;
  addDraftAction: (input: {
    title: string;
    linkedRiskId: string;
    linkedRisk: string;
    siteId: string;
    priority: SafePredictCorrectiveAction["priority"];
    createdFrom: SafePredictActionRecord["createdFrom"];
    description?: string;
    category?: string;
    assignedUserId?: string;
    dueAt?: string;
    observationType?: "positive" | "negative" | "near_miss";
    sifPotential?: boolean;
    sifCategory?: string;
    persistLive?: boolean;
    persistLocal?: boolean;
    status?: SafePredictActionStatus;
  }) => SafePredictActionRecord;
  createCorrectiveAction: (input: {
    title: string;
    linkedRiskId: string;
    linkedRisk: string;
    siteId: string;
    priority: SafePredictCorrectiveAction["priority"];
    createdFrom: SafePredictActionRecord["createdFrom"];
    description?: string;
    category?: string;
    assignedUserId?: string;
    dueAt?: string;
    observationType?: "positive" | "negative" | "near_miss";
    sifPotential?: boolean;
    sifCategory?: string;
    status?: SafePredictActionStatus;
  }) => Promise<{ success: boolean; action?: SafePredictActionRecord; error?: string }>;
  addDraftHazard: (input: {
    title: string;
    siteId: string;
    riskLevel: SafePredictHazardRecord["riskLevel"];
    controlStatus: SafePredictHazardRecord["controlStatus"];
    owner: string;
    dueDate: string;
    description?: string;
  }) => SafePredictHazardRecord;
  addDraftIncident: (input: {
    title: string;
    siteId: string;
    type: SafePredictIncidentRecord["type"];
    severity: SafePredictIncidentRecord["severity"];
    status?: SafePredictIncidentRecord["status"];
    reportedBy?: string;
    reportedAt?: string;
    detail?: string;
  }) => SafePredictIncidentRecord;
  addDraftPermit: (input: {
    title: string;
    siteId: string;
    type: string;
    status: SafePredictPermitRecord["status"];
    owner: string;
    expiresAt: string;
    riskLevel: SafePredictPermitRecord["riskLevel"];
    permitForm?: SafePredictPermitForm;
  }) => SafePredictPermitRecord;
  updatePermit: (permit: SafePredictPermitRecord) => void;
  addDraftJobsite: (input: {
    name: string;
    code: string;
    address: string;
    projectManager: string;
    safetyLead: string;
    customerName: string;
    customerReportEmail: string;
  }) => SafePredictJobsiteRecord;
  updateJobsite: (id: string, input: SafePredictJobsiteUpdateInput) => Promise<{ success: boolean; error?: string }>;
};

export type SafePredictJobsiteUpdateInput = {
  name: string;
  jobsiteNumber?: string;
  projectNumber?: string;
  location?: string;
  projectManager?: string;
  safetyLead?: string;
  customerCompanyName?: string;
  customerReportEmail?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  zipCode?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  status?: SafePredictJobsiteStatus;
};

const SafePredictDataContext = createContext<SafePredictDataContextValue | null>(null);

const actionStorageKey = "safe-predict-live-beta-actions-v1";
const hazardStorageKey = "safe-predict-live-beta-hazards-v1";
const incidentStorageKey = "safe-predict-live-beta-incidents-v1";
const permitStorageKey = "safe-predict-live-beta-permits-v1";
const jobsiteStorageKey = "safe-predict-live-beta-jobsites-v1";
const actionStatusStorageKey = "safe-predict-action-status-overrides-v1";
const selectedJobsiteStorageKey = "safe-predict-selected-jobsite-v1";
const modeStorageKey = "safe-predict-data-mode-v1";
const anonymousStorageScope = "anonymous";

function scopedStorageKey(key: string, scope: string) {
  return `${key}:${scope || anonymousStorageScope}`;
}

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

function normalizeHazardRows(value: unknown): SafePredictHazardRecord[] | null {
  if (!Array.isArray(value)) return null;
  const rows = value.filter((row): row is SafePredictHazardRecord => {
    if (!isRecord(row)) return false;
    return typeof row.id === "string" && typeof row.title === "string" && typeof row.siteId === "string";
  });
  return rows.length > 0 ? rows : null;
}

function normalizeIncidentRows(value: unknown): SafePredictIncidentRecord[] | null {
  if (!Array.isArray(value)) return null;
  const rows = value.filter((row): row is SafePredictIncidentRecord => {
    if (!isRecord(row)) return false;
    return typeof row.id === "string" && typeof row.title === "string" && typeof row.siteId === "string";
  });
  return rows.length > 0 ? rows : null;
}

function normalizePermitRows(value: unknown): SafePredictPermitRecord[] | null {
  if (!Array.isArray(value)) return null;
  const rows = value.filter((row): row is SafePredictPermitRecord => {
    if (!isRecord(row)) return false;
    return typeof row.id === "string" && typeof row.type === "string" && typeof row.siteId === "string";
  }).map(normalizePermitRecord);
  return rows.length > 0 ? rows : null;
}

function defaultPermitForm(type: string): SafePredictPermitForm {
  return {
    checklistItems: defaultPermitChecklistItems(type),
    acknowledgement: {
      acknowledged: false,
      name: "",
      acknowledgedAt: null,
      statement: SAFE_PREDICT_PERMIT_ACK_STATEMENT,
    },
    notes: "",
  };
}

function normalizePermitRecord(permit: SafePredictPermitRecord): SafePredictPermitRecord {
  const type = permit.type || permit.title || "Work Permit";
  const permitForm = permit.permitForm ?? defaultPermitForm(type);
  return {
    ...permit,
    type,
    title: permit.title || type,
    permitForm,
    readiness: permitReadinessLabel(permitForm),
  };
}

function mergePermitRecords(basePermits: SafePredictPermitRecord[], localPermits: SafePredictPermitRecord[]) {
  const localById = new Map(localPermits.map((permit) => [permit.id, normalizePermitRecord(permit)]));
  const mergedBase = basePermits.map((permit) => localById.get(permit.id) ?? normalizePermitRecord(permit));
  const baseIds = new Set(basePermits.map((permit) => permit.id));
  const localOnly = localPermits.filter((permit) => !baseIds.has(permit.id)).map(normalizePermitRecord);
  return [...localOnly, ...mergedBase];
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
  try {
    const response = await fetch(path, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) return null;
    return (await response.json().catch(() => null)) as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

function extractRows(payload: Record<string, unknown> | null, keys: string[]) {
  if (!payload) return [];
  for (const key of keys) {
    const rows = payload[key];
    if (Array.isArray(rows)) return rows;
  }
  return [];
}

function textPayloadValue(payload: Record<string, unknown> | null, keys: string[]) {
  if (!payload) return "";
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function objectPayloadValue(payload: Record<string, unknown> | null, keys: string[]) {
  if (!payload) return null;
  for (const key of keys) {
    const value = payload[key];
    if (isRecord(value)) return value;
  }
  return null;
}

function loadInitialSelectedJobsite(scope: string) {
  return window.localStorage.getItem(scopedStorageKey(selectedJobsiteStorageKey, scope)) || "all";
}

function loadInitialActions(scope: string) {
  try {
    return normalizeActionRows(JSON.parse(window.localStorage.getItem(scopedStorageKey(actionStorageKey, scope)) || "null"))?.filter((action) => action.id.startsWith("draft-")) ?? [];
  } catch {
    return [];
  }
}

function loadInitialHazards(scope: string) {
  try {
    return normalizeHazardRows(JSON.parse(window.localStorage.getItem(scopedStorageKey(hazardStorageKey, scope)) || "null"))?.filter((hazard) => hazard.id.startsWith("draft-hazard-")) ?? [];
  } catch {
    return [];
  }
}

function loadInitialIncidents(scope: string) {
  try {
    return normalizeIncidentRows(JSON.parse(window.localStorage.getItem(scopedStorageKey(incidentStorageKey, scope)) || "null"))?.filter((incident) => incident.id.startsWith("draft-incident-")) ?? [];
  } catch {
    return [];
  }
}

function loadInitialPermits(scope: string) {
  try {
    return normalizePermitRows(JSON.parse(window.localStorage.getItem(scopedStorageKey(permitStorageKey, scope)) || "null")) ?? [];
  } catch {
    return [];
  }
}

function loadInitialJobsites(scope: string) {
  try {
    return normalizeJobsiteRows(JSON.parse(window.localStorage.getItem(scopedStorageKey(jobsiteStorageKey, scope)) || "null"))?.filter((jobsite) => jobsite.id.startsWith("draft-site-")) ?? [];
  } catch {
    return [];
  }
}

function loadInitialActionStatuses(scope: string) {
  try {
    return normalizeStatusOverrides(JSON.parse(window.localStorage.getItem(scopedStorageKey(actionStatusStorageKey, scope)) || "null"));
  } catch {
    return {};
  }
}

function storageScopeFromAuthUser(authUser: Record<string, unknown> | null) {
  const companyId = textPayloadValue(authUser, ["companyId"]);
  const userId = textPayloadValue(authUser, ["id"]);
  if (companyId) return `company:${companyId}`;
  if (userId) return `user:${userId}`;
  return anonymousStorageScope;
}

export function SafePredictDataProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<SafePredictDataMode>("live");
  const [loading, setLoading] = useState(true);
  const [baseDataset, setBaseDataset] = useState<SafePredictDataset>(() => buildSafePredictDataset({ mode: "live" }));
  const [draftActions, setDraftActions] = useState<SafePredictActionRecord[]>([]);
  const [draftHazards, setDraftHazards] = useState<SafePredictHazardRecord[]>([]);
  const [draftIncidents, setDraftIncidents] = useState<SafePredictIncidentRecord[]>([]);
  const [draftPermits, setDraftPermits] = useState<SafePredictPermitRecord[]>([]);
  const [draftJobsites, setDraftJobsites] = useState<SafePredictJobsiteRecord[]>([]);
  const [actionStatuses, setActionStatuses] = useState<Record<string, SafePredictActionStatus>>({});
  const [selectedJobsiteId, setSelectedJobsiteIdState] = useState("all");
  const [liveToken, setLiveToken] = useState<string | null>(null);
  const [storageScope, setStorageScope] = useState(anonymousStorageScope);
  const [storageReady, setStorageReady] = useState(false);
  const [demoModeAllowed, setDemoModeAllowed] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void (async () => {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const mePayload = await fetchJsonWithToken("/api/auth/me", session?.access_token ?? null);
        const authUser = objectPayloadValue(mePayload, ["user"]);
        const scope = storageScopeFromAuthUser(authUser);
        if (cancelled) return;

        setStorageScope(scope);
        setDraftActions(loadInitialActions(scope));
        setDraftHazards(loadInitialHazards(scope));
        setDraftIncidents(loadInitialIncidents(scope));
        setDraftPermits(loadInitialPermits(scope));
        setDraftJobsites(loadInitialJobsites(scope));
        setActionStatuses(loadInitialActionStatuses(scope));
        setSelectedJobsiteIdState(loadInitialSelectedJobsite(scope));
        const isSalesDemo = textPayloadValue(authUser, ["role"]) === "sales_demo";
        setDemoModeAllowed(isSalesDemo);
        setModeState(isSalesDemo ? "demo" : "live");
        if (!isSalesDemo) {
          window.localStorage.setItem(scopedStorageKey(modeStorageKey, scope), "live");
        }
        setStorageReady(true);
      })().catch(() => {
        if (cancelled) return;
        setStorageScope(anonymousStorageScope);
        setDemoModeAllowed(false);
        setModeState("live");
        setStorageReady(true);
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLiveData() {
      if (!storageReady) return;

      if (mode !== "live") {
        setLiveToken(null);
        setBaseDataset(demoSafePredictDataset);
        setLoading(false);
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
          mePayload,
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
          fetchJsonWithToken("/api/auth/me", token),
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
        const authUser = objectPayloadValue(mePayload, ["user"]);
        if (textPayloadValue(authUser, ["role"]) === "sales_demo") {
          if (!cancelled) {
            setDemoModeAllowed(true);
            setLiveToken(null);
            setModeState("demo");
            setBaseDataset(demoSafePredictDataset);
          }
          return;
        }

        const liveCompanyProfile = objectPayloadValue(authUser, ["companyProfile"]);
        const liveCompanyName =
          textPayloadValue(liveCompanyProfile, ["name"]) ||
          textPayloadValue(usersPayload, ["scopeCompanyName", "scopeTeam"]) ||
          textPayloadValue(jobsitesPayload, ["scopeCompanyName", "scopeTeam"]);
        const logoDataUrl = textPayloadValue(liveCompanyProfile, ["logo_data_url", "logoDataUrl"]);
        const logoFileName = textPayloadValue(liveCompanyProfile, ["logo_file_name", "logoFileName"]);
        if (!cancelled) {
          setLiveToken(token);
          setBaseDataset(buildSafePredictDataset({
            mode: "live",
            liveCompany: liveCompanyName
              ? {
                  name: liveCompanyName,
                  accountType: "Live workspace",
                  logoDataUrl: logoDataUrl || null,
                  logoFileName: logoFileName || null,
                }
              : null,
            liveJobsites,
            liveIncidents,
            liveObservations,
            liveActions,
            livePermits,
            liveEmployees,
            liveInspections,
            liveReports,
            liveDocuments,
            liveUsers,
            liveTrainingMatrix: trainingPayload,
          }));
        }
      } catch {
        if (!cancelled) {
          setLiveToken(null);
          setBaseDataset(buildSafePredictDataset({ mode: "live" }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadLiveData();
    return () => {
      cancelled = true;
    };
  }, [mode, refreshNonce, storageReady]);

  const dataset = useMemo<SafePredictDataset>(
    () => ({
      ...baseDataset,
      jobsites: [...draftJobsites, ...baseDataset.jobsites],
      hazards: [...draftHazards, ...baseDataset.hazards],
      incidents: [...draftIncidents, ...baseDataset.incidents],
      permits: mergePermitRecords(baseDataset.permits, draftPermits),
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
    [actionStatuses, baseDataset, draftActions, draftHazards, draftIncidents, draftJobsites, draftPermits]
  );

  const refreshLiveData = useCallback(() => {
    setRefreshNonce((current) => current + 1);
  }, []);

  const setMode = useCallback((nextMode: SafePredictDataMode) => {
    if (nextMode === "demo" && !demoModeAllowed) {
      setModeState("live");
      window.localStorage.setItem(scopedStorageKey(modeStorageKey, storageScope), "live");
      return;
    }
    setModeState(nextMode);
    window.localStorage.setItem(scopedStorageKey(modeStorageKey, storageScope), nextMode);
  }, [demoModeAllowed, storageScope]);

  const setSelectedJobsiteId = useCallback((siteId: string) => {
    setSelectedJobsiteIdState(siteId);
    window.localStorage.setItem(scopedStorageKey(selectedJobsiteStorageKey, storageScope), siteId);
  }, [storageScope]);

  const persistDraftActions = useCallback((nextActions: SafePredictActionRecord[]) => {
    setDraftActions(nextActions);
    window.localStorage.setItem(scopedStorageKey(actionStorageKey, storageScope), JSON.stringify(nextActions));
  }, [storageScope]);

  const persistDraftJobsites = useCallback((nextJobsites: SafePredictJobsiteRecord[]) => {
    setDraftJobsites(nextJobsites);
    window.localStorage.setItem(scopedStorageKey(jobsiteStorageKey, storageScope), JSON.stringify(nextJobsites));
  }, [storageScope]);

  const persistActionStatuses = useCallback((nextStatuses: Record<string, SafePredictActionStatus>) => {
    setActionStatuses(nextStatuses);
    window.localStorage.setItem(scopedStorageKey(actionStatusStorageKey, storageScope), JSON.stringify(nextStatuses));
  }, [storageScope]);

  const persistDraftHazards = useCallback((nextHazards: SafePredictHazardRecord[]) => {
    setDraftHazards(nextHazards);
    window.localStorage.setItem(scopedStorageKey(hazardStorageKey, storageScope), JSON.stringify(nextHazards));
  }, [storageScope]);

  const persistDraftIncidents = useCallback((nextIncidents: SafePredictIncidentRecord[]) => {
    setDraftIncidents(nextIncidents);
    window.localStorage.setItem(scopedStorageKey(incidentStorageKey, storageScope), JSON.stringify(nextIncidents));
  }, [storageScope]);

  const persistDraftPermits = useCallback((nextPermits: SafePredictPermitRecord[]) => {
    setDraftPermits(nextPermits);
    window.localStorage.setItem(scopedStorageKey(permitStorageKey, storageScope), JSON.stringify(nextPermits));
  }, [storageScope]);

  const setActionStatusLocal = useCallback(
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
    },
    [actionStatuses, draftActions, persistActionStatuses, persistDraftActions]
  );

  const updateActionStatus = useCallback(
    (id: string, status: SafePredictActionStatus) => {
      setActionStatusLocal(id, status);
      if (draftActions.some((action) => action.id === id)) {
        return;
      }

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
    [baseDataset.actions, draftActions, liveToken, mode, setActionStatusLocal]
  );

  const closeActionWithPhoto = useCallback(
    async (id: string, file: File) => {
      if (!file.type.startsWith("image/")) {
        return { success: false, error: "Choose a photo before closing this action." };
      }

      if (draftActions.some((action) => action.id === id) || mode !== "live" || !liveToken) {
        setActionStatusLocal(id, "Closed");
        return { success: true };
      }

      try {
        const uploadUrlResponse = await fetch(`/api/company/corrective-actions/${encodeURIComponent(id)}/upload-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${liveToken}`,
          },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || "image/jpeg",
          }),
        });
        const uploadUrlPayload = (await uploadUrlResponse.json().catch(() => null)) as
          | { bucket?: string; path?: string; token?: string; error?: string }
          | null;
        if (!uploadUrlResponse.ok || !uploadUrlPayload?.bucket || !uploadUrlPayload.path || !uploadUrlPayload.token) {
          return {
            success: false,
            error: uploadUrlPayload?.error || "Could not prepare the completion photo upload.",
          };
        }

        if (uploadUrlPayload.token !== "offline-demo-token") {
          const supabase = getSupabaseBrowserClient();
          const { error: uploadError } = await supabase.storage
            .from(uploadUrlPayload.bucket)
            .uploadToSignedUrl(uploadUrlPayload.path, uploadUrlPayload.token, file, {
              contentType: file.type || "image/jpeg",
            });
          if (uploadError) {
            return { success: false, error: uploadError.message || "Photo upload failed." };
          }
        }

        const evidenceResponse = await fetch(`/api/company/corrective-actions/${encodeURIComponent(id)}/evidence`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${liveToken}`,
          },
          body: JSON.stringify({
            filePath: uploadUrlPayload.path,
            fileName: file.name,
            mimeType: file.type || "image/jpeg",
          }),
        });
        const evidencePayload = (await evidenceResponse.json().catch(() => null)) as { error?: string } | null;
        if (!evidenceResponse.ok) {
          return {
            success: false,
            error: evidencePayload?.error || "Photo was uploaded, but could not be attached as proof.",
          };
        }

        const closeResponse = await fetch(`/api/company/corrective-actions/${encodeURIComponent(id)}/close`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${liveToken}`,
          },
          body: JSON.stringify({
            closureNote: `Closed with completion photo: ${file.name}`,
          }),
        });
        const closePayload = (await closeResponse.json().catch(() => null)) as { error?: string } | null;
        if (!closeResponse.ok) {
          return {
            success: false,
            error: closePayload?.error || "Photo proof was attached, but the action could not be closed.",
          };
        }

        setActionStatusLocal(id, "Closed");
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Could not close this action with photo proof.",
        };
      }
    },
    [draftActions, liveToken, mode, setActionStatusLocal]
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
      description?: string;
      category?: string;
      assignedUserId?: string;
      dueAt?: string;
      observationType?: "positive" | "negative" | "near_miss";
      sifPotential?: boolean;
      sifCategory?: string;
      persistLive?: boolean;
      persistLocal?: boolean;
      status?: SafePredictActionStatus;
    }) => {
      const status = input.status ?? "New";
      const assignedUser = input.assignedUserId
        ? dataset.assignableUsers.find((user) => user.id === input.assignedUserId)
        : null;
      const draft: SafePredictActionRecord = {
        id: `draft-${Date.now()}`,
        title: input.title,
        linkedRiskId: input.linkedRiskId,
        linkedRisk: input.linkedRisk,
        assignee: assignedUser?.name ?? input.assignedUserId ?? "Unassigned",
        dueDate: input.dueAt ? new Date(input.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "May 30",
        status,
        priority: input.priority,
        progress: status === "Closed" ? 100 : status === "Awaiting Verification" ? 85 : status === "In Progress" ? 45 : 0,
        aiRecommended: true,
        siteId: input.siteId,
        createdFrom: input.createdFrom,
        sourceHref: `/safe-predict/jobsites/${encodeURIComponent(input.siteId)}#actions`,
      };
      if (input.persistLocal === false) {
        setDraftActions([draft, ...draftActions]);
      } else {
        persistDraftActions([draft, ...draftActions]);
      }
      if (input.persistLive !== false && mode === "live" && liveToken) {
        void fetch("/api/company/corrective-actions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${liveToken}`,
          },
          body: JSON.stringify({
            title: input.title,
            description: input.description || `Created from SafePredict ${input.createdFrom}: ${input.linkedRisk}`,
            severity: input.priority,
            category: input.category || "corrective_action",
            status: safePredictStatusToApi(status),
            jobsiteId: input.siteId,
            assignedUserId: input.assignedUserId || null,
            dueAt: input.dueAt || null,
            observationType: input.observationType || "negative",
            sifPotential: input.sifPotential ?? false,
            sifCategory: input.sifCategory || null,
          }),
        }).catch(() => undefined);
      }
      return draft;
    },
    [dataset.assignableUsers, draftActions, liveToken, mode, persistDraftActions]
  );

  const addDraftHazard = useCallback(
    (input: {
      title: string;
      siteId: string;
      riskLevel: SafePredictHazardRecord["riskLevel"];
      controlStatus: SafePredictHazardRecord["controlStatus"];
      owner: string;
      dueDate: string;
      description?: string;
    }) => {
      const draft: SafePredictHazardRecord = {
        id: `draft-hazard-${Date.now()}`,
        siteId: input.siteId,
        title: input.title,
        driverId: input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "field-hazard",
        controlStatus: input.controlStatus,
        riskLevel: input.riskLevel,
        owner: input.owner || "Unassigned",
        dueDate: input.dueDate || "No due date",
      };
      persistDraftHazards([draft, ...draftHazards]);
      if (mode === "live" && liveToken) {
        void fetch("/api/company/safety-submissions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${liveToken}`,
          },
          body: JSON.stringify({
            title: input.title,
            description: input.description || `SafePredict hazard logged for ${input.owner || "field review"}.`,
            severity: input.riskLevel,
            category: "hazard",
            jobsiteId: input.siteId,
          }),
        }).catch(() => undefined);
      }
      return draft;
    },
    [draftHazards, liveToken, mode, persistDraftHazards]
  );

  const addDraftIncident = useCallback(
    (input: {
      title: string;
      siteId: string;
      type: SafePredictIncidentRecord["type"];
      severity: SafePredictIncidentRecord["severity"];
      status?: SafePredictIncidentRecord["status"];
      reportedBy?: string;
      reportedAt?: string;
      detail?: string;
    }) => {
      const draft: SafePredictIncidentRecord = {
        id: `draft-incident-${Date.now()}`,
        siteId: input.siteId,
        title: input.title,
        type: input.type,
        severity: input.severity,
        status: input.status ?? "Open Review",
        reportedBy: input.reportedBy || "Field Team",
        reportedAt: input.reportedAt || "Just now",
        detail: input.detail || "Incident queued from the SafePredict workspace.",
      };
      persistDraftIncidents([draft, ...draftIncidents]);
      return draft;
    },
    [draftIncidents, persistDraftIncidents]
  );

  const addDraftPermit = useCallback(
    (input: {
      title: string;
      siteId: string;
      type: string;
      status: SafePredictPermitRecord["status"];
      owner: string;
      expiresAt: string;
      riskLevel: SafePredictPermitRecord["riskLevel"];
      permitForm?: SafePredictPermitForm;
    }) => {
      const type = input.type || input.title || "Work Permit";
      const permitForm = input.permitForm ?? defaultPermitForm(type);
      const draft: SafePredictPermitRecord = {
        id: `draft-permit-${Date.now()}`,
        siteId: input.siteId,
        type,
        title: input.title || type,
        status: input.status,
        owner: input.owner || "Unassigned",
        expiresAt: input.expiresAt || "No expiration set",
        riskLevel: input.riskLevel,
        permitForm,
        readiness: permitReadinessLabel(permitForm),
      };
      persistDraftPermits([draft, ...draftPermits]);
      return draft;
    },
    [draftPermits, persistDraftPermits]
  );

  const createCorrectiveAction = useCallback(
    async (input: {
      title: string;
      linkedRiskId: string;
      linkedRisk: string;
      siteId: string;
      priority: SafePredictCorrectiveAction["priority"];
      createdFrom: SafePredictActionRecord["createdFrom"];
      description?: string;
      category?: string;
      assignedUserId?: string;
      dueAt?: string;
      observationType?: "positive" | "negative" | "near_miss";
      sifPotential?: boolean;
      sifCategory?: string;
      status?: SafePredictActionStatus;
    }) => {
      const status = input.status ?? "New";
      if (mode === "live" && liveToken) {
        try {
          const response = await fetch("/api/company/corrective-actions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${liveToken}`,
            },
            body: JSON.stringify({
              title: input.title,
              description: input.description || `Created from SafePredict ${input.createdFrom}: ${input.linkedRisk}`,
              severity: input.priority,
              category: input.category || "corrective_action",
              status: safePredictStatusToApi(status),
              jobsiteId: input.siteId,
              assignedUserId: input.assignedUserId || null,
              dueAt: input.dueAt || null,
              observationType: input.observationType || "negative",
              sifPotential: input.sifPotential ?? false,
              sifCategory: input.sifCategory || null,
            }),
          });
          const payload = (await response.json().catch(() => null)) as
            | { action?: SafePredictLiveRecordRow; error?: string }
            | null;
          if (!response.ok || !payload?.action) {
            return { success: false, error: payload?.error || "Could not create the corrective action." };
          }
          const savedAction = normalizeLiveActions([payload.action], baseDataset.jobsites, baseDataset.assignableUsers)[0];
          if (!savedAction) {
            return { success: false, error: "Corrective action was saved, but could not be added to this board." };
          }
          setBaseDataset((current) => ({
            ...current,
            actions: [savedAction, ...current.actions.filter((action) => action.id !== savedAction.id)],
          }));
          return { success: true, action: savedAction };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Could not create the corrective action.",
          };
        }
      }

      const action = addDraftAction({ ...input, status, persistLive: false });
      return { success: true, action };
    },
    [addDraftAction, baseDataset.assignableUsers, baseDataset.jobsites, liveToken, mode]
  );

  const updatePermit = useCallback(
    (permit: SafePredictPermitRecord) => {
      const nextPermit = normalizePermitRecord(permit);
      const nextPermits = draftPermits.some((candidate) => candidate.id === nextPermit.id)
        ? draftPermits.map((candidate) => (candidate.id === nextPermit.id ? nextPermit : candidate))
        : [nextPermit, ...draftPermits];
      persistDraftPermits(nextPermits);
    },
    [draftPermits, persistDraftPermits]
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

  const updateJobsite = useCallback(
    async (id: string, input: SafePredictJobsiteUpdateInput) => {
      const nextSite = (site: SafePredictJobsiteRecord): SafePredictJobsiteRecord => ({
        ...site,
        name: input.name || site.name,
        code: input.jobsiteNumber || input.projectNumber || site.code,
        jobsiteNumber: input.jobsiteNumber ?? site.jobsiteNumber ?? null,
        projectNumber: input.projectNumber ?? site.projectNumber ?? null,
        address: input.addressLine1 || input.location || site.address,
        cityState: [input.city, input.state].filter(Boolean).join(", ") || input.location || site.cityState,
        phase: input.status === "planned" ? "Planning" : input.status === "completed" ? "Closeout" : site.phase,
        siteLead: input.safetyLead || site.siteLead,
        projectManager: input.projectManager || site.projectManager,
        customerName: input.customerCompanyName || site.customerName,
        customerReportEmail: input.customerReportEmail || site.customerReportEmail,
        startDate: input.startDate ?? site.startDate,
        endDate: input.endDate ?? site.endDate,
        status: input.status ?? site.status,
        addressLine1: input.addressLine1 ?? site.addressLine1 ?? null,
        addressLine2: input.addressLine2 ?? site.addressLine2 ?? null,
        city: input.city ?? site.city ?? null,
        state: input.state ?? site.state ?? null,
        country: input.country ?? site.country ?? null,
        notes: input.notes ?? site.notes ?? null,
        zipCode: input.zipCode ?? site.zipCode ?? null,
      });

      const isDraft = draftJobsites.some((site) => site.id === id);
      if (isDraft || mode !== "live" || !liveToken) {
        if (isDraft) {
          persistDraftJobsites(draftJobsites.map((site) => (site.id === id ? nextSite(site) : site)));
        } else {
          setBaseDataset((current) => ({
            ...current,
            jobsites: current.jobsites.map((site) => (site.id === id ? nextSite(site) : site)),
          }));
        }
        return { success: true };
      }

      try {
        const response = await fetch(`/api/company/jobsites/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${liveToken}`,
          },
          body: JSON.stringify(input),
        });
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) {
          return { success: false, error: payload?.error || "Could not update this jobsite." };
        }
        setBaseDataset((current) => ({
          ...current,
          jobsites: current.jobsites.map((site) => (site.id === id ? nextSite(site) : site)),
        }));
        refreshLiveData();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Could not update this jobsite.",
        };
      }
    },
    [draftJobsites, liveToken, mode, persistDraftJobsites, refreshLiveData]
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
        refreshLiveData,
        updateActionStatus,
        closeActionWithPhoto,
        advanceActionStatus,
        addDraftAction,
        createCorrectiveAction,
        addDraftHazard,
        addDraftIncident,
        addDraftPermit,
        updatePermit,
        addDraftJobsite,
        updateJobsite,
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
