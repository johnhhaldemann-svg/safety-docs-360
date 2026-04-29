"use client";

import * as Tabs from "@radix-ui/react-tabs";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Glasses,
  HardHat,
  Plus,
  Printer,
  Save,
  ScrollText,
  Send,
  Shield,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CompanyAiAssistPanel } from "@/components/company-ai/CompanyAiAssistPanel";
import { CompanyMemoryLessonPrompt } from "@/components/company-ai/CompanyMemoryLessonPrompt";
import { CompanyMemoryBankPanel } from "@/components/company-ai/CompanyMemoryBankPanel";

const supabase = getSupabaseBrowserClient();

const OVERLAY_KEY = "safety360docs:jsa-overlay:v1";

type JsaRecordRow = {
  id: string;
  title: string;
  status: string;
  severity: string;
  category: string;
  jobsite_id?: string | null;
  work_date?: string | null;
  updated_at: string;
};

type ActivityRow = {
  id: string;
  dap_id: string;
  activity_name: string;
  trade: string | null;
  area: string | null;
  status: string;
  hazard_category?: string | null;
  hazard_description?: string | null;
  mitigation?: string | null;
  permit_required?: boolean | null;
  permit_type?: string | null;
  planned_risk_level?: string | null;
  work_date?: string | null;
};

type JsaOverlay = {
  workArea: string;
  trade: string;
  supervisor: string;
  shiftPhase: string;
  /** Company user ids selected as crew for this JSA (local overlay; not a separate DB column). */
  crewUserIds: string[];
  crewAck: boolean;
  supervisorReview: boolean;
  signature: string;
  ppeByStep: Record<string, string[]>;
};

const defaultOverlay = (): JsaOverlay => ({
  workArea: "",
  trade: "",
  supervisor: "",
  shiftPhase: "",
  crewUserIds: [],
  crewAck: false,
  supervisorReview: false,
  signature: "",
  ppeByStep: {},
});

const HAZARD_PRESETS = [
  "Struck-by",
  "Electrical",
  "Fall",
  "Chemical",
  "Fire",
  "Pinch",
  "Noise",
  "Overhead",
] as const;

const PPE_PRESETS = [
  "Hard hat",
  "Safety glasses",
  "Gloves",
  "Hi-vis",
  "Harness",
  "Respirator",
  "Hearing protection",
  "Steel-toe boots",
] as const;

const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

function readAllOverlays(): Record<string, JsaOverlay> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(OVERLAY_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, unknown>;
    return typeof data === "object" && data !== null ? (data as Record<string, JsaOverlay>) : {};
  } catch {
    return {};
  }
}

function mergeOverlay(raw: unknown): JsaOverlay {
  const base = defaultOverlay();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const rawCrew = o.crewUserIds;
  let crewUserIds = base.crewUserIds;
  if (Array.isArray(rawCrew)) {
    crewUserIds = rawCrew.filter((id): id is string => typeof id === "string" && id.length > 0);
  }
  return {
    workArea: typeof o.workArea === "string" ? o.workArea : base.workArea,
    trade: typeof o.trade === "string" ? o.trade : base.trade,
    supervisor: typeof o.supervisor === "string" ? o.supervisor : base.supervisor,
    shiftPhase: typeof o.shiftPhase === "string" ? o.shiftPhase : base.shiftPhase,
    crewUserIds,
    crewAck: Boolean(o.crewAck),
    supervisorReview: Boolean(o.supervisorReview),
    signature: typeof o.signature === "string" ? o.signature : base.signature,
    ppeByStep:
      o.ppeByStep && typeof o.ppeByStep === "object" && o.ppeByStep !== null
        ? (o.ppeByStep as Record<string, string[]>)
        : {},
  };
}

function saveOverlayForDap(dapId: string, overlay: JsaOverlay) {
  const all = readAllOverlays();
  all[dapId] = overlay;
  window.localStorage.setItem(OVERLAY_KEY, JSON.stringify(all));
}

type StepForm = {
  id: string;
  activity_name: string;
  area: string;
  trade: string;
  hazard_category: string;
  hazard_description: string;
  mitigation: string;
  planned_risk_level: string;
  permit_required: boolean;
  permit_type: string;
  status: string;
  ppeTags: string[];
};

function activityToStep(a: ActivityRow, ppe: string[]): StepForm {
  return {
    id: a.id,
    activity_name: a.activity_name ?? "",
    area: a.area ?? "",
    trade: a.trade ?? "",
    hazard_category: a.hazard_category ?? "",
    hazard_description: a.hazard_description ?? "",
    mitigation: a.mitigation ?? "",
    planned_risk_level: (a.planned_risk_level ?? "").toLowerCase(),
    permit_required: Boolean(a.permit_required),
    permit_type: a.permit_type ?? "",
    status: a.status ?? "planned",
    ppeTags: ppe,
  };
}

function stepIsComplete(s: StepForm): boolean {
  return Boolean(
    s.activity_name.trim() &&
      s.hazard_description.trim() &&
      s.mitigation.trim() &&
      s.planned_risk_level.trim()
  );
}

function PpeGlyph({ label }: { label: string }) {
  const base =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-500/30 bg-sky-950/50 text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
  const t = label.toLowerCase();
  if (t.includes("hard hat")) {
    return (
      <span className={base} title={label}>
        <HardHat className="h-4 w-4" aria-hidden />
      </span>
    );
  }
  if (t.includes("glass")) {
    return (
      <span className={base} title={label}>
        <Glasses className="h-4 w-4" aria-hidden />
      </span>
    );
  }
  if (t.includes("glove")) {
    return (
      <span className={base} title={label}>
        <Shield className="h-4 w-4" aria-hidden />
      </span>
    );
  }
  if (t.includes("hi-vis") || t.includes("harness")) {
    return (
      <span className={base} title={label}>
        <AlertTriangle className="h-4 w-4" aria-hidden />
      </span>
    );
  }
  return (
    <span className={base} title={label}>
      <HardHat className="h-4 w-4 opacity-80" aria-hidden />
    </span>
  );
}

function riskRank(r: string): number {
  switch (r.toLowerCase()) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

/** Traffic-light risk labels aligned with premium JSA mock (red / amber / green). */
function riskTrafficBadge(level: string): { className: string; label: string } {
  const l = level.toLowerCase();
  if (l === "critical" || l === "high") {
    return {
      className:
        "border-red-500/70 bg-red-950/70 text-red-100 shadow-[0_0_14px_rgba(239,68,68,0.25)]",
      label: l === "critical" ? "CRITICAL" : "HIGH",
    };
  }
  if (l === "medium") {
    return {
      className: "border-amber-500/70 bg-amber-950/55 text-amber-100",
      label: "MEDIUM",
    };
  }
  if (l === "low") {
    return {
      className: "border-emerald-500/65 bg-emerald-950/50 text-emerald-100",
      label: "LOW",
    };
  }
  return {
    className: "border-slate-600/90 bg-slate-900/90 text-slate-400",
    label: "RISK",
  };
}

async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Missing auth token.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

type JobsitePickRow = { id: string; name: string };
type CompanyUserPickRow = { id: string; name: string; email: string };

function formatUserPickLabel(u: CompanyUserPickRow) {
  const n = (u.name ?? "").trim();
  const em = (u.email ?? "").trim();
  if (n && em) return `${n} (${em})`;
  return n || em || `User ${u.id.slice(0, 8)}…`;
}

export function JsaWorkspace({ jobsiteId }: { jobsiteId?: string }) {
  const [records, setRecords] = useState<JsaRecordRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newJobsiteId, setNewJobsiteId] = useState("");
  const [jobSiteName, setJobSiteName] = useState("");
  const [selectedJobsiteId, setSelectedJobsiteId] = useState("");
  const [jobsites, setJobsites] = useState<JobsitePickRow[]>([]);
  const [companyUsers, setCompanyUsers] = useState<CompanyUserPickRow[]>([]);
  const [directoryHint, setDirectoryHint] = useState("");
  const [auditDate, setAuditDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [overlay, setOverlay] = useState<JsaOverlay>(defaultOverlay);
  const [steps, setSteps] = useState<StepForm[]>([]);
  const [openStepId, setOpenStepId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [memoryLessonNudge, setMemoryLessonNudge] = useState(false);
  const [mainTab, setMainTab] = useState("setup");
  const [hazardSubTab, setHazardSubTab] = useState("steps");

  const selected = useMemo(
    () => records.find((r) => r.id === selectedId) ?? null,
    [records, selectedId]
  );

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/company/jsas", { headers });
      const data = (await response.json().catch(() => null)) as { jsas?: JsaRecordRow[]; error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to load JSAs.");
      const list = (data?.jsas ?? []).filter((record) => !jobsiteId || record.jobsite_id === jobsiteId);
      setRecords(list);
      setSelectedId((prev) => {
        if (prev && list.some((r) => r.id === prev)) return prev;
        return list[0]?.id ?? "";
      });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load.");
      setRecords([]);
    }
    setLoading(false);
  }, [jobsiteId]);

  const loadActivitiesForDap = useCallback(async (jsaId: string) => {
    if (!jsaId) {
      setSteps([]);
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/company/jsa-activities?jsaId=${encodeURIComponent(jsaId)}`, {
        headers,
      });
      const data = (await res.json().catch(() => null)) as { activities?: ActivityRow[] } | null;
      const acts = res.ok ? data?.activities ?? [] : [];
      const allOverlays = readAllOverlays();
      const ov = mergeOverlay(allOverlays[jsaId]);
      setOverlay(ov);
      setSteps(
        acts.map((a) => activityToStep(a, ov.ppeByStep[a.id] ?? []))
      );
      setOpenStepId((prev) => {
        if (prev && acts.some((a) => a.id === prev)) return prev;
        return acts[0]?.id ?? null;
      });
    } catch {
      setSteps([]);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (jobsiteId) {
      setNewJobsiteId(jobsiteId);
      setSelectedJobsiteId((current) => current || jobsiteId);
    }
  }, [jobsiteId]);

  const loadDirectoryLists = useCallback(async () => {
    setDirectoryHint("");
    try {
      const headers = await getAuthHeaders();
      const [jr, ur] = await Promise.all([
        fetch("/api/company/jobsites", { headers }),
        fetch("/api/company/users", { headers }),
      ]);
      const jBody = (await jr.json().catch(() => null)) as { jobsites?: unknown[]; error?: string } | null;
      const uBody = (await ur.json().catch(() => null)) as { users?: unknown[]; error?: string } | null;
      if (jr.ok) {
        const list = (jBody?.jobsites ?? []) as Record<string, unknown>[];
        setJobsites(
          list
            .map((row) => ({
              id: String(row.id ?? ""),
              name: String(row.name ?? "Jobsite").trim() || "Jobsite",
            }))
            .filter((x) => x.id.length > 0)
        );
      } else {
        setJobsites([]);
        if (jBody?.error) setDirectoryHint((h) => (h ? `${h} ` : "") + `Jobsites: ${jBody.error}`);
      }
      if (ur.ok) {
        const list = (uBody?.users ?? []) as Record<string, unknown>[];
        setCompanyUsers(
          list
            .map((row) => ({
              id: String(row.id ?? ""),
              name: String(row.name ?? "").trim(),
              email: String(row.email ?? "").trim(),
            }))
            .filter((x) => x.id.length > 0)
        );
      } else {
        setCompanyUsers([]);
        if (uBody?.error) setDirectoryHint((h) => (h ? `${h} ` : "") + `Team directory: ${uBody.error}`);
      }
    } catch {
      setJobsites([]);
      setCompanyUsers([]);
      setDirectoryHint("Could not load jobsites or team list.");
    }
  }, []);

  useEffect(() => {
    void loadDirectoryLists();
  }, [loadDirectoryLists]);

  useEffect(() => {
    const r = records.find((x) => x.id === selectedId);
    if (r) {
      setJobSiteName(r.title ?? "");
      setSelectedJobsiteId(r.jobsite_id ? String(r.jobsite_id) : "");
      setAuditDate(r.work_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    } else {
      setJobSiteName("");
      setSelectedJobsiteId(jobsiteId ?? "");
      setOverlay(defaultOverlay());
      setSteps([]);
    }
  }, [selectedId, records, jobsiteId]);

  useEffect(() => {
    if (selectedId) void loadActivitiesForDap(selectedId);
  }, [selectedId, loadActivitiesForDap]);

  useEffect(() => {
    if (selectedId) setMainTab("setup");
  }, [selectedId]);

  const hazardTagsForStep = (hazard_category: string) =>
    hazard_category
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const summary = useMemo(() => {
    const highRisk = steps.filter((s) => riskRank(s.planned_risk_level) >= 3).length;
    const ppeSet = new Set<string>();
    steps.forEach((s) => s.ppeTags.forEach((p) => ppeSet.add(p)));
    const permitSet = new Set<string>();
    steps.forEach((s) => {
      if (s.permit_required) {
        if (s.permit_type.trim()) permitSet.add(s.permit_type.trim());
        else permitSet.add("Permit required");
      }
    });
    let topRisk = "";
    let topRank = 0;
    steps.forEach((s) => {
      const rk = riskRank(s.planned_risk_level);
      if (rk > topRank) {
        topRank = rk;
        topRisk = s.planned_risk_level || "";
      }
    });
    const withMitigation = steps.filter((s) => s.mitigation.trim().length > 0).length;
    const completion =
      steps.length === 0 ? 0 : Math.round((withMitigation / steps.length) * 100);
    let highestCategory = topRisk ? topRisk.charAt(0).toUpperCase() + topRisk.slice(1) : "—";
    for (const s of steps) {
      const tags = (s.hazard_category ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      const electrical = tags.find((t) => /electrical/i.test(t));
      if (electrical) {
        highestCategory = electrical;
        break;
      }
      if (tags[0]) highestCategory = tags[0];
    }
    const ready =
      steps.length > 0 && completion === 100 && jobSiteName.trim().length > 0;
    return {
      totalSteps: steps.length,
      highRisk,
      ppe: [...ppeSet],
      permits: [...permitSet],
      topRisk: topRisk || "—",
      completion,
      highestCategory,
      ready,
    };
  }, [steps, jobSiteName]);

  const activeJsaHint = selectedId
    ? null
    : jobSiteName.trim() || newTitle.trim() || selectedJobsiteId.trim() || newJobsiteId.trim()
      ? "No active JSA is selected. Save draft or Submit JSA will create one from the current form."
      : "No active JSA is selected yet. Enter a title or choose a jobsite, then save a draft to begin.";

  async function createJsa() {
    const site =
      (newJobsiteId ? jobsites.find((j) => j.id === newJobsiteId) : null) ??
      (selectedJobsiteId ? jobsites.find((j) => j.id === selectedJobsiteId) : null);
    const title = newTitle.trim() || jobSiteName.trim() || site?.name?.trim() || "";
    const jobsiteId = newJobsiteId.trim() || selectedJobsiteId.trim() || null;
    if (!title) {
      setMessage("Select a jobsite from the list or enter a title next to New JSA, then try again.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/company/jsas", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title,
          status: "active",
          severity: "medium",
          category: "corrective_action",
          ...(jobsiteId ? { jobsiteId } : {}),
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; jsa?: { id?: string } }
        | null;
      if (!response.ok) throw new Error(data?.error || "Failed to create JSA.");
      const newId = typeof data?.jsa?.id === "string" ? data.jsa.id : "";
      setNewTitle("");
      setNewJobsiteId("");
      await loadRecords();
      if (newId) {
        setSelectedId(newId);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to create JSA.");
    }
    setSaving(false);
  }

  async function ensureSelectedJsa(): Promise<string | null> {
    if (selectedId) return selectedId;
    const site =
      (selectedJobsiteId ? jobsites.find((j) => j.id === selectedJobsiteId) : null) ??
      (newJobsiteId ? jobsites.find((j) => j.id === newJobsiteId) : null);
    const title = jobSiteName.trim() || newTitle.trim() || site?.name?.trim() || "";
    const jobsiteId = selectedJobsiteId.trim() || newJobsiteId.trim() || null;
    if (!title) {
      setMessage("Create a JSA first by entering a title or choosing a jobsite, then try again.");
      setMainTab("setup");
      return null;
    }
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/company/jsas", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title,
          status: "active",
          severity: "medium",
          category: "corrective_action",
          ...(jobsiteId ? { jobsiteId } : {}),
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string; jsa?: { id?: string } } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to create a draft JSA.");
      const newId = typeof data?.jsa?.id === "string" ? data.jsa.id : "";
      await loadRecords();
      if (newId) {
        setSelectedId(newId);
        return newId;
      }
      throw new Error("Created a draft JSA, but could not select it.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to create a draft JSA.");
      setMainTab("setup");
      return null;
    }
  }

  async function addStep() {
    if (!selectedId) return;
    setSaving(true);
    setMessage("");
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/company/jsa-activities", {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsaId: selectedId,
          activityName: `Work step ${steps.length + 1}`,
          status: "planned",
          workDate: auditDate,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to add step.");
      await loadActivitiesForDap(selectedId);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to add step.");
    }
    setSaving(false);
  }

  function updateStep(id: string, patch: Partial<StepForm>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function togglePpe(stepId: string, tag: string) {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id !== stepId) return s;
        const has = s.ppeTags.includes(tag);
        return {
          ...s,
          ppeTags: has ? s.ppeTags.filter((t) => t !== tag) : [...s.ppeTags, tag],
        };
      })
    );
  }

  function toggleHazardTag(stepId: string, tag: string) {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id !== stepId) return s;
        const current = hazardTagsForStep(s.hazard_category);
        const has = current.includes(tag);
        const next = has ? current.filter((t) => t !== tag) : [...current, tag];
        return { ...s, hazard_category: next.join(", ") };
      })
    );
  }

  async function persistHeaderAndOverlay(jsaId = selectedId) {
    if (!jsaId) return;
    const nextOverlay: JsaOverlay = {
      ...overlay,
      ppeByStep: Object.fromEntries(steps.map((s) => [s.id, s.ppeTags])),
    };
    saveOverlayForDap(jsaId, nextOverlay);
    setOverlay(nextOverlay);
    const headers = await getAuthHeaders();
    await fetch("/api/company/jsas", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        id: jsaId,
        title: jobSiteName.trim() || "Untitled JSA",
        jobsiteId: selectedJobsiteId.trim(),
      }),
    });
  }

  async function persistAllSteps(): Promise<void> {
    const headers = await getAuthHeaders();
    for (const s of steps) {
      const res = await fetch("/api/company/jsa-activities", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          id: s.id,
          activityName: s.activity_name,
          area: s.area,
          trade: s.trade,
          hazardCategory: s.hazard_category,
          hazardDescription: s.hazard_description,
          mitigation: s.mitigation,
          plannedRiskLevel: s.planned_risk_level,
          permitRequired: s.permit_required,
          permitType: s.permit_type,
          status: s.status,
          workDate: auditDate,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || "Failed to save a work step.");
      }
    }
  }

  async function saveDraft() {
    setSaving(true);
    setMessage("");
    try {
      const targetId = (selectedId && selected) ? selectedId : await ensureSelectedJsa();
      if (!targetId) return;
      await persistHeaderAndOverlay(targetId);
      await persistAllSteps();
      await loadRecords();
      await loadActivitiesForDap(targetId);
      setMessage(`Draft saved for ${selected?.title || jobSiteName.trim() || newTitle.trim() || "your JSA"}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function submitJsa() {
    setSaving(true);
    setMessage("");
    try {
      const targetId = (selectedId && selected) ? selectedId : await ensureSelectedJsa();
      if (!targetId) return;
      await persistHeaderAndOverlay(targetId);
      await persistAllSteps();
      const headers = await getAuthHeaders();
      const res = await fetch("/api/company/jsas", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: targetId, status: "active" }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Submit failed.");
      await loadRecords();
      setMemoryLessonNudge(true);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Submit failed.");
    } finally {
      setSaving(false);
    }
  }

  async function setRecordStatus(status: string) {
    if (!selected) return;
    try {
      const headers = await getAuthHeaders();
      await fetch("/api/company/jsas", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: selected.id, status }),
      });
      await loadRecords();
    } catch {
      /* ignore */
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-600/90 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 [color-scheme:dark] placeholder:text-slate-500 shadow-inner outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30";

  const tabTriggerClass =
    "relative whitespace-nowrap px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-400 transition-colors hover:text-slate-200 data-[state=active]:text-white sm:px-4 sm:text-[13px] sm:tracking-[0.12em] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-emerald-400 after:opacity-0 after:shadow-[0_0_14px_rgba(52,211,153,0.85)] data-[state=active]:after:opacity-100";

  const renderStepEditor = (s: StepForm, idx: number) => {
    const open = openStepId === s.id;
    const tags = hazardTagsForStep(s.hazard_category);
    const risk = riskTrafficBadge(s.planned_risk_level);
    const done = stepIsComplete(s);
    return (
      <article
        key={s.id}
        className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${
          open
            ? "border-emerald-500/40 bg-slate-900/95 shadow-[0_0_36px_-8px_rgba(52,211,153,0.45)]"
            : "border-sky-500/20 bg-slate-900/70 shadow-[0_0_24px_-12px_rgba(56,189,248,0.12)]"
        }`}
      >
        <div
          className="h-1 w-full bg-gradient-to-r from-emerald-400/90 via-emerald-500/70 to-teal-600/50 shadow-[0_0_16px_rgba(52,211,153,0.35)]"
          aria-hidden
        />
        <button
          type="button"
          onClick={() => setOpenStepId(open ? null : s.id)}
          className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left print:pointer-events-none"
        >
          <div className="flex min-w-0 flex-1 items-start gap-2">
            {open ? (
              <ChevronDown className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
            ) : (
              <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Step {String(idx + 1).padStart(2, "0")}
              </p>
              <p className="truncate font-semibold text-slate-50">{s.activity_name || "Untitled task"}</p>
              {!open && s.hazard_description ? (
                <p className="mt-1 line-clamp-2 text-xs text-slate-400">{s.hazard_description}</p>
              ) : null}
              {!open && tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-950/35 px-2 py-0.5 text-[11px] font-semibold text-amber-100"
                    >
                      <AlertTriangle className="h-3 w-3 text-amber-400" aria-hidden />
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              {!open && s.mitigation ? (
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{s.mitigation}</p>
              ) : null}
              {!open && s.ppeTags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {s.ppeTags.map((p) => (
                    <PpeGlyph key={p} label={p} />
                  ))}
                </div>
              ) : null}
              {s.permit_required && s.permit_type && !open ? (
                <p className="mt-2 inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-950/25 px-2 py-1 text-[11px] font-semibold text-amber-100">
                  <ScrollText className="h-3.5 w-3.5" aria-hidden />
                  {s.permit_type}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <CheckCircle2
              className={`h-6 w-6 ${done ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "text-slate-600"}`}
              aria-label={done ? "Step complete" : "Step incomplete"}
            />
            <span
              className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${risk.className}`}
            >
              {risk.label}
            </span>
          </div>
        </button>
        <div className={`border-t border-slate-700/60 px-4 pb-4 pt-3 print:block ${open ? "" : "hidden"}`}>
          <div className="space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-400">
              Step title
              <input
                value={s.activity_name}
                onChange={(e) => updateStep(s.id, { activity_name: e.target.value })}
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-400">
              Task description
              <textarea
                value={s.hazard_description}
                onChange={(e) => updateStep(s.id, { hazard_description: e.target.value })}
                rows={3}
                className={`${inputClass} mt-1 resize-y`}
              />
            </label>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Hazard tags</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {HAZARD_PRESETS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleHazardTag(s.id, tag)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                      tags.includes(tag)
                        ? "border-amber-500/50 bg-amber-950/40 text-amber-100"
                        : "border-slate-600/80 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Risk level
                <select
                  value={s.planned_risk_level || ""}
                  onChange={(e) => updateStep(s.id, { planned_risk_level: e.target.value })}
                  className={`${inputClass} mt-1`}
                >
                  <option value="">Select…</option>
                  {RISK_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Step status
                <select
                  value={s.status}
                  onChange={(e) => updateStep(s.id, { status: e.target.value })}
                  className={`${inputClass} mt-1`}
                >
                  <option value="planned">Planned</option>
                  <option value="not_started">Not started</option>
                  <option value="active">Active</option>
                  <option value="monitored">Monitored</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
            </div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-400">
              Controls / mitigation
              <textarea
                value={s.mitigation}
                onChange={(e) => updateStep(s.id, { mitigation: e.target.value })}
                rows={3}
                className={`${inputClass} mt-1 resize-y`}
              />
            </label>
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                <HardHat className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                Required PPE
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PPE_PRESETS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => togglePpe(s.id, tag)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                      s.ppeTags.includes(tag)
                        ? "border-sky-500/50 bg-sky-950/40 text-sky-100"
                        : "border-slate-600/80 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              {s.ppeTags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.ppeTags.map((p) => (
                    <PpeGlyph key={p} label={p} />
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-700/60 bg-slate-950/50 p-3">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={s.permit_required}
                  onChange={(e) => updateStep(s.id, { permit_required: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-500"
                />
                Permit required
              </label>
              <input
                value={s.permit_type}
                onChange={(e) => updateStep(s.id, { permit_type: e.target.value })}
                placeholder="Permit type (hot work, LOTO…)"
                className={`${inputClass} min-w-[200px] flex-1`}
              />
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <Link
                href={`/field-id-exchange?jsaActivityId=${encodeURIComponent(s.id)}`}
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-sky-500/40"
              >
                Log observation
              </Link>
              <Link
                href={`/permits?jsaActivityId=${encodeURIComponent(s.id)}`}
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-sky-500/40"
              >
                Create permit
              </Link>
            </div>
          </div>
        </div>
      </article>
    );
  };

  const renderRightRail = () => (
    <aside className="space-y-4 print:hidden">
      <div className="rounded-2xl border border-sky-500/25 bg-slate-900/95 p-4 shadow-[0_0_28px_-10px_rgba(56,189,248,0.2)]">
        <div className="flex items-center gap-2 border-b border-slate-700/80 pb-2">
          <Shield className="h-4 w-4 text-emerald-400" aria-hidden />
          <h3 className="text-sm font-bold text-slate-50">At a glance</h3>
        </div>
        <dl className="mt-3 space-y-3 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">Total steps</dt>
            <dd className="font-bold tabular-nums text-slate-100">{summary.totalSteps}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">High-risk steps</dt>
            <dd className="font-bold tabular-nums text-red-200">{summary.highRisk}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Required PPE</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {summary.ppe.length ? (
                summary.ppe.map((p) => <PpeGlyph key={p} label={p} />)
              ) : (
                <span className="text-xs text-slate-500">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Permits</dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {summary.permits.length ? (
                summary.permits.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 rounded-md border border-amber-500/35 bg-amber-950/25 px-2 py-0.5 text-xs font-semibold text-amber-100"
                  >
                    <FileText className="h-3 w-3" aria-hidden />
                    {p}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500">None flagged</span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/95 p-4 shadow-[0_0_32px_-8px_rgba(52,211,153,0.25)]">
        <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-2">
          <h3 className="text-sm font-bold text-slate-50">JSA status</h3>
          <span
            className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
              summary.ready
                ? "border-emerald-500/60 bg-emerald-950/50 text-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.35)]"
                : "border-slate-600 bg-slate-800/80 text-slate-300"
            }`}
          >
            {summary.ready ? "Ready" : "In progress"}
          </span>
        </div>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">Highest risk focus</dt>
            <dd className="max-w-[55%] text-right font-semibold text-slate-100">{summary.highestCategory}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Mitigation coverage</dt>
            <dd className="mt-2">
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all"
                  style={{ width: `${summary.completion}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">{summary.completion}% of steps documented</p>
            </dd>
          </div>
        </dl>
      </div>
    </aside>
  );

  const actionBar = (
    <div className="fixed bottom-4 left-4 right-4 z-50 rounded-2xl border border-slate-700/80 bg-slate-950/95 px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.32)] backdrop-blur-md print:hidden lg:bottom-5 lg:left-6 lg:right-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void saveDraft()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-600/90 bg-slate-900 px-3 py-2 text-sm font-bold text-slate-100 hover:border-slate-500 disabled:opacity-50"
          >
            <Save className="h-4 w-4 text-sky-400" aria-hidden />
            Save draft
          </button>
          <button
            type="button"
            onClick={() => {
              void persistHeaderAndOverlay().then(() => window.print());
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-600/90 bg-slate-900 px-3 py-2 text-sm font-bold text-slate-100 hover:border-slate-500"
          >
            <Printer className="h-4 w-4 text-slate-400" aria-hidden />
            Export PDF
          </button>
          <button
            type="button"
            onClick={() => void submitJsa()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            <Send className="h-4 w-4" aria-hidden />
            Submit
          </button>
        </div>
        <button
          type="button"
          onClick={() => void submitJsa()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-2.5 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_28px_rgba(52,211,153,0.45)] ring-1 ring-emerald-400/40 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50"
        >
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          Submit JSA
        </button>
      </div>
    </div>
  );

  return (
    <div className="jsa-workspace jsa-workspace-light relative min-h-full bg-[#eef5ff] pb-28 text-slate-100 antialiased print:bg-white print:text-black print:pb-0">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-15%,rgba(16,185,129,0.14),transparent_55%),radial-gradient(ellipse_70%_50%_at_100%_0%,rgba(56,189,248,0.06),transparent)] print:hidden"
        aria-hidden
      />

      <div className="relative space-y-6">
        <div className="rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-emerald-800 via-emerald-900 to-slate-950 px-5 py-5 text-white shadow-[0_0_40px_-12px_rgba(52,211,153,0.35)] print:hidden">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-100/90">Safety planning</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-white md:text-4xl">Job Safety Analysis</h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-emerald-50/95">
                Build task-specific hazard controls before work begins
              </p>
              <div className="mt-4">
                <Link
                  href={jobsiteId ? `/jobsites/${encodeURIComponent(jobsiteId)}` : "/dashboard"}
                  className="inline-flex rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  {jobsiteId ? "Back to jobsite" : "Back to dashboard"}
                </Link>
              </div>
            </div>
            <div className="flex shrink-0 justify-end gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/15 shadow-[0_0_20px_rgba(251,191,36,0.15)]">
                <HardHat className="h-7 w-7 text-amber-200" aria-hidden />
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/35 bg-red-950/40 shadow-[0_0_20px_rgba(248,113,113,0.12)]">
                <AlertTriangle className="h-7 w-7 text-amber-300" aria-hidden />
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/20 shadow-[0_0_22px_rgba(52,211,153,0.35)]">
                <ClipboardCheck className="h-7 w-7 text-emerald-100" aria-hidden />
              </div>
            </div>
          </div>
        </div>

        <div id="company-knowledge" className="grid scroll-mt-8 gap-4 lg:grid-cols-2 print:hidden">
          <CompanyAiAssistPanel
            surface="jsa"
            title="JSA assistant"
            structuredContext={JSON.stringify({
              jobsite: jobSiteName.trim() || undefined,
              activeJsaId: selectedId || undefined,
              steps: steps.length,
            })}
          />
          <CompanyMemoryBankPanel />
        </div>

        <div className="print:hidden">
          <CompanyMemoryLessonPrompt
            visible={memoryLessonNudge}
            onDismiss={() => setMemoryLessonNudge(false)}
            href="/jsa#company-knowledge"
          />
        </div>

        {message ? (
          <div
            className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100 print:hidden"
            role="alert"
          >
            {message}
          </div>
        ) : null}
        {activeJsaHint ? (
      <div className="rounded-xl border border-sky-500/30 bg-sky-950/35 px-4 py-3 text-sm text-sky-100 print:hidden">
        {activeJsaHint}
      </div>
        ) : null}

        <div className="flex flex-col gap-4 rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4 shadow-[0_0_40px_-12px_rgba(56,189,248,0.12)] print:hidden">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[200px] flex-1 text-xs font-bold uppercase tracking-wide text-slate-400">
              Active JSA
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className={`${inputClass} mt-1`}
                disabled={loading}
              >
                <option value="">Select saved JSA…</option>
                {records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} ({r.status})
                  </option>
                ))}
              </select>
            </label>
            <div className="flex min-w-[220px] flex-[1.2] flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="min-w-[160px] flex-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                Jobsite (optional)
                <select
                  value={newJobsiteId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNewJobsiteId(v);
                    const site = jobsites.find((j) => j.id === v);
                    if (site) setNewTitle((t) => (t.trim() ? t : site.name));
                  }}
                  className={`${inputClass} mt-1`}
                  disabled={Boolean(jobsiteId)}
                >
                  <option value="">Select jobsite…</option>
                  {jobsites.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name}
                    </option>
                  ))}
                </select>
              </label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="JSA title / job name"
                className={`${inputClass} min-w-[160px] flex-1`}
              />
              <button
                type="button"
                onClick={() => void createJsa()}
                disabled={saving || (!newTitle.trim() && !newJobsiteId.trim())}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white shadow-md disabled:opacity-50"
              >
                <Plus className="h-4 w-4" aria-hidden />
                New JSA
              </button>
            </div>
          </div>
          {directoryHint ? (
            <p className="text-xs text-amber-200/90 print:hidden">{directoryHint}</p>
          ) : null}
          {selected ? (
            <div className="flex flex-wrap gap-2 border-t border-slate-700/80 pt-3 text-xs">
              <span className="rounded-full border border-slate-600/80 px-2 py-0.5 text-slate-300">
                Status: {selected.status}
              </span>
              <button
                type="button"
                onClick={() => void setRecordStatus("active")}
                className="rounded-lg border border-slate-600 px-2 py-0.5 font-semibold text-slate-200 hover:border-sky-500/40"
              >
                Set active
              </button>
              <button
                type="button"
                onClick={() => void setRecordStatus("closed")}
                className="rounded-lg border border-slate-600 px-2 py-0.5 font-semibold text-slate-200 hover:border-slate-400"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void setRecordStatus("draft")}
                className="rounded-lg border border-slate-600 px-2 py-0.5 font-semibold text-slate-200"
              >
                Reopen draft
              </button>
            </div>
          ) : null}
        </div>

        {selectedId ? (
          <Tabs.Root value={mainTab} onValueChange={setMainTab} className="space-y-5">
            <Tabs.List className="flex flex-wrap gap-0 overflow-x-auto border-b border-slate-700/70 bg-slate-950/40 print:hidden">
              {(
                [
                  ["setup", "Setup"],
                  ["hazards", "Hazards"],
                  ["ppe", "PPE & Permits"],
                  ["signoff", "Sign-off"],
                ] as const
              ).map(([value, label]) => (
                <Tabs.Trigger key={value} value={value} className={tabTriggerClass}>
                  {label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            <Tabs.Content value="setup" className="outline-none">
              <section className="rounded-2xl border border-sky-500/25 bg-slate-900/95 p-5 shadow-[0_0_32px_-8px_rgba(14,165,233,0.15)]">
                <div className="mb-4 flex items-center gap-2 border-b border-slate-700/80 pb-3">
                  <ClipboardCheck className="h-5 w-5 text-sky-400" aria-hidden />
                  <h2 className="text-lg font-bold text-slate-50">JSA header</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="md:col-span-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                    Jobsite
                    <select
                      value={selectedJobsiteId}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSelectedJobsiteId(v);
                        if (!v) return;
                        const site = jobsites.find((j) => j.id === v);
                        if (site) setJobSiteName((t) => (t.trim() ? t : site.name));
                      }}
                      className={`${inputClass} mt-1`}
                      disabled={Boolean(jobsiteId)}
                    >
                      <option value="">None — custom title only</option>
                      {jobsites.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.name}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-[11px] font-normal text-slate-500">
                      Links this JSA to a company jobsite record. Saving updates the jobsite on the server.
                    </span>
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    JSA title / job name
                    <input
                      value={jobSiteName}
                      onChange={(e) => setJobSiteName(e.target.value)}
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Supervisor
                    <input
                      value={overlay.supervisor}
                      onChange={(e) => setOverlay((o) => ({ ...o, supervisor: e.target.value }))}
                      list="jsa-supervisor-datalist"
                      autoComplete="off"
                      className={`${inputClass} mt-1`}
                      placeholder="Type or pick from team list"
                    />
                    <datalist id="jsa-supervisor-datalist">
                      {companyUsers.map((u) => (
                        <option key={u.id} value={formatUserPickLabel(u)} />
                      ))}
                    </datalist>
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Trade
                    <input
                      value={overlay.trade}
                      onChange={(e) => setOverlay((o) => ({ ...o, trade: e.target.value }))}
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Shift / phase
                    <input
                      value={overlay.shiftPhase}
                      onChange={(e) => setOverlay((o) => ({ ...o, shiftPhase: e.target.value }))}
                      className={`${inputClass} mt-1`}
                      placeholder="e.g. Day shift"
                    />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Date
                    <input
                      type="date"
                      value={auditDate}
                      onChange={(e) => setAuditDate(e.target.value)}
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Work area
                    <input
                      value={overlay.workArea}
                      onChange={(e) => setOverlay((o) => ({ ...o, workArea: e.target.value }))}
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                  <div className="md:col-span-2 space-y-2 rounded-xl border border-slate-700/60 bg-slate-950/30 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Crew</p>
                    <select
                      value=""
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        setOverlay((o) =>
                          o.crewUserIds.includes(v) ? o : { ...o, crewUserIds: [...o.crewUserIds, v] }
                        );
                        e.target.value = "";
                      }}
                      className={inputClass}
                      aria-label="Add crew member"
                    >
                      <option value="">Add crew member…</option>
                      {companyUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {formatUserPickLabel(u)}
                        </option>
                      ))}
                    </select>
                    {overlay.crewUserIds.length === 0 ? (
                      <p className="text-[11px] text-slate-500">No crew members selected.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {overlay.crewUserIds.map((id) => {
                          const u = companyUsers.find((x) => x.id === id);
                          const label = u ? formatUserPickLabel(u) : `User ${id.slice(0, 8)}…`;
                          return (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-950/80 px-2.5 py-1 text-xs text-slate-200"
                            >
                              {label}
                              <button
                                type="button"
                                className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                                aria-label={`Remove ${label}`}
                                onClick={() =>
                                  setOverlay((o) => ({
                                    ...o,
                                    crewUserIds: o.crewUserIds.filter((x) => x !== id),
                                  }))
                                }
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      Picks come from your company user list. Crew is saved with this JSA when you use Save draft (header data is stored in your browser overlay until then).
                    </p>
                  </div>
                </div>
              </section>
            </Tabs.Content>

            <Tabs.Content value="hazards" className="outline-none">
              <Tabs.Root value={hazardSubTab} onValueChange={setHazardSubTab} className="space-y-4">
                <Tabs.List className="flex flex-wrap gap-2 print:hidden">
                  {(
                    [
                      ["steps", "Steps"],
                      ["hazard_detail", "Hazards"],
                      ["controls", "Controls"],
                    ] as const
                  ).map(([value, label]) => (
                    <Tabs.Trigger
                      key={value}
                      value={value}
                      className="rounded-full border border-slate-600/80 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-300 data-[state=active]:border-sky-500/50 data-[state=active]:bg-sky-950/50 data-[state=active]:text-sky-100"
                    >
                      {label}
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>

                <Tabs.Content value="steps" className="outline-none">
              <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,320px)]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between print:hidden">
                    <h2 className="text-lg font-bold text-slate-50">Work steps</h2>
                    <button
                      type="button"
                      onClick={() => void addStep()}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-950/50 disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      Add step
                    </button>
                  </div>
                  {steps.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-600/80 bg-slate-900/50 p-10 text-center text-sm text-slate-400">
                      No work steps yet. Add a step to document tasks, hazards, and controls.
                    </div>
                  ) : (
                    steps.map((s, idx) => renderStepEditor(s, idx))
                  )}
                </div>
                {renderRightRail()}
              </div>
                </Tabs.Content>

                <Tabs.Content value="hazard_detail" className="outline-none">
              <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,320px)]">
                <div className="space-y-4">
                  {steps.length === 0 ? (
                    <p className="text-sm text-slate-500">Add steps first.</p>
                  ) : (
                    steps.map((s, idx) => {
                      const tags = hazardTagsForStep(s.hazard_category);
                      const risk = riskTrafficBadge(s.planned_risk_level);
                      return (
                        <div
                          key={s.id}
                          className="rounded-2xl border border-sky-500/20 bg-slate-900/80 p-4 shadow-sm"
                        >
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-semibold text-slate-100">
                              Step {idx + 1}: {s.activity_name || "Untitled"}
                            </h3>
                            <span
                              className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${risk.className}`}
                            >
                              {risk.label}
                            </span>
                          </div>
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Hazard tags</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {HAZARD_PRESETS.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => toggleHazardTag(s.id, tag)}
                                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                                  tags.includes(tag)
                                    ? "border-amber-500/50 bg-amber-950/40 text-amber-100"
                                    : "border-slate-600/80 text-slate-400 hover:border-slate-500"
                                }`}
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                          <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-400">
                            Risk level
                            <select
                              value={s.planned_risk_level || ""}
                              onChange={(e) => updateStep(s.id, { planned_risk_level: e.target.value })}
                              className={`${inputClass} mt-1`}
                            >
                              <option value="">Select…</option>
                              {RISK_LEVELS.map((lvl) => (
                                <option key={lvl} value={lvl}>
                                  {lvl}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      );
                    })
                  )}
                </div>
                {renderRightRail()}
              </div>
                </Tabs.Content>

                <Tabs.Content value="controls" className="outline-none">
              <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,320px)]">
                <div className="space-y-4">
                  {steps.length === 0 ? (
                    <p className="text-sm text-slate-500">Add steps first.</p>
                  ) : (
                    steps.map((s, idx) => (
                      <div
                        key={s.id}
                        className="rounded-2xl border border-sky-500/20 bg-slate-900/80 p-4 shadow-sm"
                      >
                        <h3 className="mb-2 font-semibold text-slate-100">
                          Step {idx + 1}: {s.activity_name || "Untitled"}
                        </h3>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          Controls / mitigation
                          <textarea
                            value={s.mitigation}
                            onChange={(e) => updateStep(s.id, { mitigation: e.target.value })}
                            rows={4}
                            className={`${inputClass} mt-1 resize-y`}
                          />
                        </label>
                      </div>
                    ))
                  )}
                </div>
                {renderRightRail()}
              </div>
                </Tabs.Content>
              </Tabs.Root>
            </Tabs.Content>

            <Tabs.Content value="ppe" className="outline-none">
              <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,320px)]">
                <div className="space-y-4">
                  {steps.length === 0 ? (
                    <p className="text-sm text-slate-500">Add steps first.</p>
                  ) : (
                    steps.map((s, idx) => (
                      <div
                        key={s.id}
                        className="rounded-2xl border border-sky-500/20 bg-slate-900/80 p-4 shadow-sm"
                      >
                        <h3 className="mb-3 font-semibold text-slate-100">
                          Step {idx + 1}: {s.activity_name || "Untitled"}
                        </h3>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Required PPE</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {PPE_PRESETS.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => togglePpe(s.id, tag)}
                              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                                s.ppeTags.includes(tag)
                                  ? "border-sky-500/50 bg-sky-950/40 text-sky-100"
                                  : "border-slate-600/80 text-slate-400 hover:border-slate-500"
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-slate-700/60 bg-slate-950/50 p-3">
                          <label className="flex items-center gap-2 text-sm text-slate-300">
                            <input
                              type="checkbox"
                              checked={s.permit_required}
                              onChange={(e) => updateStep(s.id, { permit_required: e.target.checked })}
                              className="h-4 w-4 rounded border-slate-500"
                            />
                            Permit required
                          </label>
                          <input
                            value={s.permit_type}
                            onChange={(e) => updateStep(s.id, { permit_type: e.target.value })}
                            placeholder="Permit type"
                            className={`${inputClass} min-w-[200px] flex-1`}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {renderRightRail()}
              </div>
            </Tabs.Content>

            <Tabs.Content value="signoff" className="outline-none space-y-6">
              <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,320px)]">
                <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5">
                  <h2 className="text-lg font-bold text-slate-50">Pre-job review</h2>
                  <ul className="mt-4 space-y-2 text-sm text-slate-300">
                    <li className="flex gap-2">
                      <span className={jobSiteName.trim() ? "text-emerald-400" : "text-slate-600"}>✓</span>
                      JSA title / job name captured
                    </li>
                    <li className="flex gap-2">
                      <span
                        className={
                          overlay.crewUserIds.length > 0 ? "text-emerald-400" : "text-slate-600"
                        }
                      >
                        ✓
                      </span>
                      Crew roster ({overlay.crewUserIds.length} selected on Setup tab)
                    </li>
                    <li className="flex gap-2">
                      <span className={steps.length > 0 ? "text-emerald-400" : "text-slate-600"}>✓</span>
                      At least one work step defined
                    </li>
                    <li className="flex gap-2">
                      <span className={summary.completion === 100 && steps.length > 0 ? "text-emerald-400" : "text-slate-600"}>
                        ✓
                      </span>
                      All steps have mitigation text ({summary.completion}%)
                    </li>
                    <li className="flex gap-2">
                      <span className={summary.highRisk > 0 ? "text-amber-400" : "text-slate-600"}>!</span>
                      {summary.highRisk} high or critical risk step(s) — verify controls before work
                    </li>
                  </ul>
                </div>
                {renderRightRail()}
              </div>
              <section className="rounded-2xl border border-emerald-500/25 bg-slate-900/95 p-5 shadow-[0_0_28px_-8px_rgba(52,211,153,0.2)]">
                <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" aria-hidden />
              <h2 className="text-lg font-bold text-slate-50">Review & sign-off</h2>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700/60 bg-slate-950/40 p-4 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={overlay.crewAck}
                      onChange={(e) => setOverlay((o) => ({ ...o, crewAck: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 rounded border-slate-500"
                    />
                    <span>
                      <span className="font-bold text-slate-50">Crew acknowledgment</span>
                      <span className="mt-1 block text-xs text-slate-400">
                        On-site briefing complete; workers understand hazards and controls.
                      </span>
                    </span>
                  </label>
                  <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Supervisor / foreman review</p>
                    <label className="mt-2 flex items-center gap-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={overlay.supervisorReview}
                        onChange={(e) => setOverlay((o) => ({ ...o, supervisorReview: e.target.checked }))}
                        className="h-4 w-4 rounded border-slate-500"
                      />
                      Review complete
                    </label>
                    <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-slate-400">
                      Digital signature reference
                      <input
                        value={overlay.signature}
                        onChange={(e) => setOverlay((o) => ({ ...o, signature: e.target.value }))}
                        className={`${inputClass} mt-1`}
                        placeholder="Printed name (e.g. J. Smith)"
                      />
                    </label>
                  </div>
                </div>
                <p className="mt-4 text-xs text-slate-500 print:hidden">
                  Use the bar below to save, export, or submit. Primary submit applies a green highlight for final
                  sign-off.
                </p>
                <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-slate-950/55 p-4 print:hidden">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
                        Final actions
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        Save a draft first, export for a paper trail, or submit when the sign-off box is complete.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void saveDraft()}
                        disabled={saving || !selectedId}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-600/90 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-100 hover:border-slate-500 disabled:opacity-50"
                      >
                        <Save className="h-4 w-4 text-sky-400" aria-hidden />
                        Save draft
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void persistHeaderAndOverlay().then(() => window.print());
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-600/90 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-100 hover:border-slate-500"
                      >
                        <Printer className="h-4 w-4 text-slate-400" aria-hidden />
                        Export PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => void submitJsa()}
                        disabled={saving || !selectedId}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_28px_rgba(52,211,153,0.45)] ring-1 ring-emerald-400/40 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-5 w-5" aria-hidden />
                        Submit JSA
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </Tabs.Content>
          </Tabs.Root>
        ) : (
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-10 text-center text-slate-400 print:hidden">
            {loading ? "Loading JSAs…" : "Select an existing JSA or create one to begin."}
          </div>
        )}
      </div>

      {actionBar}
    </div>
  );
}
