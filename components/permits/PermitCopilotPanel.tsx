"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const supabase = getSupabaseBrowserClient();

type PermitDraftSnapshot = {
  title: string;
  permitType: string;
  severity: string;
  category: string;
  escalationLevel: string;
  escalationReason: string;
  stopWorkStatus: string;
  stopWorkReason: string;
  dueAt: string;
  ownerUserId: string;
  jsaActivityId: string;
  observationId: string;
};

type PermitCopilotActivity = {
  id: string;
  activity_name: string;
  trade: string | null;
  area: string | null;
  permit_type: string | null;
  planned_risk_level: string | null;
  permit_required: boolean | null;
  hazard_category?: string | null;
  hazard_description?: string | null;
  mitigation?: string | null;
  work_date?: string | null;
};

type PermitAiSuggestion = {
  title?: string | null;
  permitType?: string | null;
  severity?: string | null;
  category?: string | null;
  escalationLevel?: string | null;
  escalationReason?: string | null;
  stopWorkStatus?: string | null;
  stopWorkReason?: string | null;
  rationale?: string | null;
  controls?: string[] | null;
  missingInfo?: string[] | null;
};

type Props = {
  selectedActivity: PermitCopilotActivity | null;
  selectedJobsiteName: string | null;
  currentDraft: PermitDraftSnapshot;
  onApply: (patch: Partial<PermitDraftSnapshot>) => void;
};

const VALUE_ALIASES: Record<string, string> = {
  hotwork: "hot_work",
  "hot-work": "hot_work",
  "hot work": "hot_work",
  hot_work: "hot_work",
  confinedspace: "confined_space",
  "confined-space": "confined_space",
  "confined space": "confined_space",
  confined_space: "confined_space",
  electrical: "electrical",
  excavation: "excavation",
  "work at heights": "work_at_heights",
  workatheights: "work_at_heights",
  work_at_heights: "work_at_heights",
  "lockout tagout": "lockout_tagout",
  lockouttagout: "lockout_tagout",
  lockout_tagout: "lockout_tagout",
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical",
  none: "none",
  monitor: "monitor",
  urgent: "urgent",
  "stop work requested": "stop_work_requested",
  stopworkrequested: "stop_work_requested",
  stop_work_requested: "stop_work_requested",
  "stop work active": "stop_work_active",
  stopworkactive: "stop_work_active",
  stop_work_active: "stop_work_active",
  cleared: "cleared",
  correctiveaction: "corrective_action",
  corrective_action: "corrective_action",
  safety: "safety",
  operations: "operations",
  maintenance: "maintenance",
  environmental: "environmental",
};

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function resolveChoice(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const direct = VALUE_ALIASES[normalizeToken(raw)] ?? VALUE_ALIASES[raw.toLowerCase()];
  if (direct) return direct;
  return raw;
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildAutoApplyPatch(
  nextSuggestion: PermitAiSuggestion,
  currentDraft: PermitDraftSnapshot
) {
  const patch: Partial<PermitDraftSnapshot> = {};
  const title = nextSuggestion.title?.trim();
  const permitType = nextSuggestion.permitType?.trim();
  const severity = nextSuggestion.severity?.trim();
  const category = nextSuggestion.category?.trim();
  const escalationLevel = nextSuggestion.escalationLevel?.trim();
  const escalationReason = nextSuggestion.escalationReason?.trim();
  const stopWorkStatus = nextSuggestion.stopWorkStatus?.trim();
  const stopWorkReason = nextSuggestion.stopWorkReason?.trim();

  if (title && !currentDraft.title.trim()) patch.title = title;
  if (permitType && !currentDraft.permitType.trim()) patch.permitType = resolveChoice(permitType);
  if (severity && !currentDraft.severity.trim()) patch.severity = resolveChoice(severity);
  if (category && !currentDraft.category.trim()) patch.category = resolveChoice(category);
  if (escalationLevel && !currentDraft.escalationLevel.trim()) patch.escalationLevel = resolveChoice(escalationLevel);
  if (escalationReason && !currentDraft.escalationReason.trim()) patch.escalationReason = escalationReason;
  if (stopWorkStatus && !currentDraft.stopWorkStatus.trim()) patch.stopWorkStatus = resolveChoice(stopWorkStatus);
  if (stopWorkReason && !currentDraft.stopWorkReason.trim()) patch.stopWorkReason = stopWorkReason;

  return patch;
}

export function PermitCopilotPanel({
  selectedActivity,
  selectedJobsiteName,
  currentDraft,
  onApply,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [disclaimer, setDisclaimer] = useState("");
  const [suggestion, setSuggestion] = useState<PermitAiSuggestion | null>(null);
  const [retrieval, setRetrieval] = useState<string | null>(null);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const lastAutoGeneratedActivityId = useRef("");
  const lastAutoAppliedSnapshot = useRef<PermitDraftSnapshot | null>(null);

  function clearUndoState() {
    lastAutoAppliedSnapshot.current = null;
  }

  const promptSeed = useMemo(() => {
    if (!selectedActivity) return "Help me fill out this permit from the linked JSA step.";
    const parts = [selectedActivity.activity_name];
    if (selectedActivity.trade) parts.push(selectedActivity.trade);
    if (selectedActivity.area) parts.push(selectedActivity.area);
    return `Help me fill out this permit from the linked JSA step: ${parts.join(" - ")}.`;
  }, [selectedActivity]);

  const submit = useCallback(async () => {
    if (!selectedActivity) {
      setError("Select a JSA step first.");
      return;
    }

    setLoading(true);
    setError("");
    setStatus("");
    setSuggestion(null);
    setRetrieval(null);
    setFallbackUsed(false);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sign in to use the permit copilot.");
      }

      const requestMessage = prompt.trim() || promptSeed;
      const structuredContext = {
        currentDraft,
        selectedActivity,
        selectedJobsiteName,
        instructions: [
          "Return only valid JSON.",
          "Suggest permit-ready field values that help fill the form.",
          "Do not invent due dates or owners.",
          "Keep permit type aligned with the linked JSA step if it is already defined.",
          "Include controls, rationale, and missing_info when helpful.",
        ],
      };

      const res = await fetch("/api/company/permits/copilot", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: requestMessage,
          context: JSON.stringify(structuredContext),
          currentDraft,
          selectedActivity,
          selectedJobsiteName,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        error?: string;
        suggestion?: PermitAiSuggestion;
        disclaimer?: string;
        retrieval?: string;
        fallbackUsed?: boolean;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }

      setDisclaimer(data?.disclaimer ?? "");
      setRetrieval(data?.retrieval ?? null);
      setFallbackUsed(Boolean(data?.fallbackUsed));
      if (!data?.suggestion) {
        throw new Error("The permit copilot did not return a draft.");
      }
      setSuggestion(data.suggestion);

      const patch = buildAutoApplyPatch(data.suggestion, currentDraft);
      if (Object.keys(patch).length > 0) {
        lastAutoAppliedSnapshot.current = currentDraft;
        onApply(patch);
        setStatus("Draft generated and blank permit fields were filled. Use Undo if needed.");
      } else {
        clearUndoState();
        setStatus("Draft generated. No blank permit fields needed autofill.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }, [currentDraft, onApply, prompt, promptSeed, selectedActivity, selectedJobsiteName]);

  useEffect(() => {
    if (!selectedActivity?.id) return;
    if (prompt.trim()) return;
    if (lastAutoGeneratedActivityId.current === selectedActivity.id) return;
    lastAutoGeneratedActivityId.current = selectedActivity.id;
    const timeout = window.setTimeout(() => {
      void submit();
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [prompt, selectedActivity?.id, submit]);

  useEffect(() => {
    if (!selectedActivity?.id) {
      clearUndoState();
      return;
    }
    if (lastAutoGeneratedActivityId.current !== selectedActivity.id) {
      clearUndoState();
    }
  }, [selectedActivity?.id]);

  const applySuggestion = useCallback(() => {
    if (!suggestion) return;
    const patch = buildAutoApplyPatch(suggestion, currentDraft);
    if (Object.keys(patch).length < 1) {
      setStatus("No blank fields were available to fill.");
      return;
    }
    lastAutoAppliedSnapshot.current = currentDraft;
    onApply(patch);
    setStatus("Applied suggestions to the blank permit fields.");
  }, [currentDraft, onApply, suggestion]);

  const undoAutoFill = useCallback(() => {
    if (!lastAutoAppliedSnapshot.current) return;
    onApply(lastAutoAppliedSnapshot.current);
    clearUndoState();
    setStatus("Restored the permit fields to their previous values.");
  }, [onApply]);

  const controlItems = useMemo(() => suggestion?.controls?.filter(Boolean).slice(0, 6) ?? [], [suggestion?.controls]);
  const missingItems = useMemo(() => suggestion?.missingInfo?.filter(Boolean).slice(0, 4) ?? [], [suggestion?.missingInfo]);

  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--app-accent-primary)]">Permit copilot</div>
          <h3 className="mt-1 text-base font-bold text-[var(--app-text-strong)]">Suggest values from the linked JSA</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--app-text)]">
            Draft permit-ready values from the linked JSA step, then apply them back into the form.
          </p>
        </div>
        <div className="rounded-full border border-[var(--app-border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--app-text)]">
          {selectedActivity ? "JSA-linked" : "Select a JSA step"}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-3">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={2}
            placeholder={promptSeed}
            className="w-full rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 text-sm text-[var(--app-text-strong)] outline-none placeholder:text-slate-400 focus:border-[var(--app-accent-primary)]"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={loading || !selectedActivity}
              className="app-btn-primary rounded-xl px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Thinking..." : "Generate and fill permit"}
            </button>
            <button
              type="button"
              onClick={lastAutoAppliedSnapshot.current ? undoAutoFill : applySuggestion}
              disabled={!suggestion && !lastAutoAppliedSnapshot.current}
              className="app-btn-secondary rounded-xl px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {lastAutoAppliedSnapshot.current ? "Undo auto-fill" : "Apply suggestions"}
            </button>
            {selectedActivity ? (
              <div className="text-xs text-[var(--app-muted)]">
                {selectedActivity.permit_required ? "Permit required by JSA step." : "Permit optional on this JSA step."}
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="app-warning-panel rounded-xl px-4 py-3 text-sm" role="alert">
              {error}
            </p>
          ) : null}
          {status ? <p className="text-sm text-emerald-700">{status}</p> : null}
          {retrieval ? <p className="text-xs text-[var(--app-muted)]">Memory retrieval: {retrieval}</p> : null}
          {fallbackUsed ? <p className="text-xs text-amber-700">Using a fallback draft because the smart response needed normalization.</p> : null}

          {suggestion ? (
            <div className="rounded-2xl border border-[var(--app-border)] bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-muted)]">Suggested draft</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  ["Title", suggestion.title?.trim() || "No change"],
                  ["Severity", suggestion.severity?.trim() ? formatLabel(resolveChoice(suggestion.severity.trim())) : "No change"],
                  ["Category", suggestion.category?.trim() ? formatLabel(resolveChoice(suggestion.category.trim())) : "No change"],
                  ["Escalation", suggestion.escalationLevel?.trim() ? formatLabel(resolveChoice(suggestion.escalationLevel.trim())) : "No change"],
                  ["Stop work", suggestion.stopWorkStatus?.trim() ? formatLabel(resolveChoice(suggestion.stopWorkStatus.trim())) : "No change"],
                  ["Jobsite", selectedJobsiteName ?? "Not selected"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-3">
                    <div className="text-xs text-[var(--app-muted)]">{label}</div>
                    <div className="mt-1 text-sm font-semibold text-[var(--app-text-strong)]">{value}</div>
                  </div>
                ))}
              </div>

              {suggestion.rationale ? (
                <div className="mt-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-3">
                  <div className="text-xs text-[var(--app-muted)]">Why this helps</div>
                  <p className="mt-1 text-sm leading-6 text-[var(--app-text)]">{suggestion.rationale}</p>
                </div>
              ) : null}

              {controlItems.length > 0 ? (
                <div className="mt-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-3">
                  <div className="text-xs text-[var(--app-muted)]">Suggested controls</div>
                  <ul className="mt-2 space-y-1 text-sm text-[var(--app-text)]">
                    {controlItems.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--app-accent-primary)]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {missingItems.length > 0 ? (
                <div className="app-warning-panel mt-3 rounded-xl p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em]">Still need to confirm</div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {missingItems.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[var(--app-border)] bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-muted)]">Copilot context</div>
          <div className="mt-3 space-y-3 text-sm text-[var(--app-text)]">
            <div>
              <div className="text-xs text-[var(--app-muted)]">Selected JSA step</div>
              <div className="mt-1 font-semibold text-[var(--app-text-strong)]">{selectedActivity ? selectedActivity.activity_name : "No step selected"}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--app-muted)]">Trade / area</div>
              <div className="mt-1">{selectedActivity?.trade || selectedActivity?.area ? [selectedActivity?.trade, selectedActivity?.area].filter(Boolean).join(" / ") : "Not listed"}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--app-muted)]">Linked jobsite</div>
              <div className="mt-1">{selectedJobsiteName ?? "Not selected"}</div>
            </div>
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-3 text-xs leading-5 text-[var(--app-text)]">
              <div>Title: {currentDraft.title.trim() || "blank"}</div>
              <div>Type: {currentDraft.permitType || "blank"}</div>
              <div>Severity: {currentDraft.severity || "blank"}</div>
              <div>Category: {currentDraft.category || "blank"}</div>
              <div>Escalation: {currentDraft.escalationLevel || "blank"}</div>
              <div>Stop work: {currentDraft.stopWorkStatus || "blank"}</div>
            </div>
          </div>
          {disclaimer ? <p className="mt-3 text-xs leading-5 text-[var(--app-muted)]">{disclaimer}</p> : null}
        </div>
      </div>
    </div>
  );
}
