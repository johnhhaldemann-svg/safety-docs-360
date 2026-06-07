"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, ChevronRight, Download, FileText, Loader2, Plus, Send, ShieldCheck, User, X } from "lucide-react";
import { toast } from "sonner";
import { getStepLabel, getMethodLabel, getStepsForMethod, type RcaMethod, type RcaStepKey } from "@/lib/rcaAi";

type RcaMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  step_key: string | null;
  created_at: string;
};

type RcaSession = {
  id: string;
  rca_method: RcaMethod;
  status: "in_progress" | "pending_review" | "approved" | "closed";
  current_step: RcaStepKey;
  hse_notified_at: string | null;
  hse_notified_user_ids: string[];
  summary: string | null;
  approved_at: string | null;
};

type CapaItem = {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "completed" | "cancelled";
  assigned_to: string | null;
  due_at: string | null;
  completed_at: string | null;
};

type CorrectiveActionBasic = {
  id: string;
  title: string;
  category: string;
  severity: string;
  rca_session_id: string | null;
};

type RcaPanelProps = {
  action: CorrectiveActionBasic;
  onClose: () => void;
  authHeaders: Record<string, string>;
};

const PRIORITY_COLORS: Record<CapaItem["priority"], string> = {
  low: "border-slate-600 bg-slate-800/60 text-slate-300",
  medium: "border-amber-700/60 bg-amber-950/40 text-amber-200",
  high: "border-orange-700/60 bg-orange-950/40 text-orange-200",
  critical: "border-rose-700/60 bg-rose-950/40 text-rose-200",
};

const STATUS_COLORS: Record<CapaItem["status"], string> = {
  open: "text-slate-400",
  in_progress: "text-sky-400",
  completed: "text-emerald-400",
  cancelled: "text-slate-600 line-through",
};

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
}

export function RcaPanel({ action, onClose, authHeaders }: RcaPanelProps) {
  const [session, setSession] = useState<RcaSession | null>(null);
  const [messages, setMessages] = useState<RcaMessage[]>([]);
  const [capaItems, setCapaItems] = useState<CapaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [advanceStep, setAdvanceStep] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "capa">("chat");
  const [showCapaForm, setShowCapaForm] = useState(false);
  const [capaForm, setCapaForm] = useState({ title: "", description: "", priority: "medium" as CapaItem["priority"], dueAt: "" });
  const [savingCapa, setSavingCapa] = useState(false);
  const [showSignOff, setShowSignOff] = useState(false);
  const [signOffForm, setSignOffForm] = useState({ rootCauseConfirmed: "", reviewNotes: "" });
  const [signingOff, setSigningOff] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/company/corrective-actions/${action.id}/rca`, {
        headers: authHeaders,
      });
      const data = (await res.json().catch(() => null)) as {
        session?: RcaSession | null;
        messages?: RcaMessage[];
        capaItems?: CapaItem[];
      } | null;
      if (res.ok && data) {
        setSession(data.session ?? null);
        setMessages(data.messages ?? []);
        setCapaItems(data.capaItems ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [action.id, authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function startSession() {
    setStarting(true);
    try {
      const res = await fetch(`/api/company/corrective-actions/${action.id}/rca`, {
        method: "POST",
        headers: authHeaders,
      });
      const data = (await res.json().catch(() => null)) as {
        sessionId?: string;
        openingMessage?: string;
        hseNotified?: number;
        error?: string;
      } | null;
      if (!res.ok || !data?.sessionId) {
        toast.error(data?.error ?? "Failed to start RCA session.");
        return;
      }
      if ((data.hseNotified ?? 0) > 0) {
        toast.success(`RCA started. ${data.hseNotified} HSE team member(s) notified.`);
      } else {
        toast.success("RCA session started.");
      }
      await load();
    } finally {
      setStarting(false);
    }
  }

  async function sendMessage() {
    const content = draft.trim();
    if (!content || sending) return;
    setDraft("");
    setSending(true);

    const optimistic: RcaMessage = {
      id: `opt-${Date.now()}`,
      role: "user",
      content,
      step_key: session?.current_step ?? null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/company/corrective-actions/${action.id}/rca/chat`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, advanceStep }),
      });
      const data = (await res.json().catch(() => null)) as {
        reply?: string;
        currentStep?: RcaStepKey;
        stepAdvanced?: boolean;
        error?: string;
      } | null;

      if (!res.ok || !data?.reply) {
        toast.error(data?.error ?? "Failed to get AI response.");
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setDraft(content);
        return;
      }

      const aiMessage: RcaMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        step_key: data.currentStep ?? null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev.filter((m) => m.id !== optimistic.id), optimistic, aiMessage]);

      if (data.stepAdvanced && data.currentStep) {
        setSession((prev) => prev ? { ...prev, current_step: data.currentStep! } : prev);
        setAdvanceStep(false);
        if (data.currentStep === "review") {
          setSession((prev) => prev ? { ...prev, status: "pending_review" } : prev);
        }
      }
    } finally {
      setSending(false);
    }
  }

  async function submitSignOff() {
    setSigningOff(true);
    try {
      const res = await fetch(`/api/company/corrective-actions/${action.id}/rca/approve`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          rootCauseConfirmed: signOffForm.rootCauseConfirmed || undefined,
          reviewNotes: signOffForm.reviewNotes || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        approved?: boolean;
        summary?: string;
        approvedAt?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.approved) {
        toast.error(data?.error ?? "Failed to sign off on RCA.");
        return;
      }
      setSession((prev) =>
        prev
          ? {
              ...prev,
              status: "approved",
              approved_at: data.approvedAt ?? new Date().toISOString(),
              summary: data.summary ?? prev.summary,
            }
          : prev
      );
      setShowSignOff(false);
      toast.success("RCA signed off and approved.");
    } finally {
      setSigningOff(false);
    }
  }

  async function downloadPdf() {
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/company/corrective-actions/${action.id}/rca/report-pdf`, {
        headers: authHeaders,
      });
      if (!res.ok) {
        toast.error("Failed to generate RCA report.");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "rca-report.pdf";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function saveCapa() {
    if (!capaForm.title.trim()) {
      toast.error("CAPA title is required.");
      return;
    }
    setSavingCapa(true);
    try {
      const res = await fetch(`/api/company/corrective-actions/${action.id}/rca/capa`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: capaForm.title,
          description: capaForm.description,
          priority: capaForm.priority,
          dueAt: capaForm.dueAt || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as { capaItem?: CapaItem; error?: string } | null;
      if (!res.ok || !data?.capaItem) {
        toast.error(data?.error ?? "Failed to save CAPA item.");
        return;
      }
      setCapaItems((prev) => [...prev, data.capaItem!]);
      setCapaForm({ title: "", description: "", priority: "medium", dueAt: "" });
      setShowCapaForm(false);
      toast.success("CAPA item added.");
    } finally {
      setSavingCapa(false);
    }
  }

  async function markCapaComplete(item: CapaItem) {
    const res = await fetch(`/api/company/corrective-actions/${action.id}/rca/capa`, {
      method: "PATCH",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ capaItemId: item.id, status: "completed" }),
    });
    if (res.ok) {
      setCapaItems((prev) => prev.map((c) => c.id === item.id ? { ...c, status: "completed", completed_at: new Date().toISOString() } : c));
    }
  }

  const steps = session ? getStepsForMethod(session.rca_method) : [];
  const currentStepIndex = session ? steps.indexOf(session.current_step) : -1;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-700/80 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 shrink-0 text-sky-400" />
            <span className="text-sm font-bold text-slate-100">Root Cause Analysis</span>
            {session && (
              <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {getMethodLabel(session.rca_method)}
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-xs text-slate-500">{action.title}</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close RCA panel"
          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Approved banner */}
      {session?.status === "approved" && (
        <div className="flex items-center justify-between gap-2 border-b border-emerald-900/40 bg-emerald-950/30 px-4 py-2">
          <div className="flex items-center gap-2 text-xs text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            RCA approved{session.approved_at ? ` · ${new Date(session.approved_at).toLocaleDateString()}` : ""}
          </div>
          <button
            onClick={downloadPdf}
            disabled={downloadingPdf}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-700/60 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-900/40 disabled:opacity-50"
          >
            {downloadingPdf ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            Download Report
          </button>
        </div>
      )}

      {/* Pending review banner — sign-off prompt */}
      {session?.status === "pending_review" && !showSignOff && (
        <div className="flex items-center justify-between gap-2 border-b border-amber-900/40 bg-amber-950/30 px-4 py-2">
          <div className="flex items-center gap-2 text-xs text-amber-300">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            Investigation complete — awaiting HSE sign-off
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSignOff(true)}
              className="flex items-center gap-1.5 rounded-lg border border-amber-700/60 px-2.5 py-1 text-[11px] font-semibold text-amber-300 transition-colors hover:bg-amber-900/40"
            >
              <ShieldCheck className="h-3 w-3" />
              Sign Off
            </button>
            <button
              onClick={downloadPdf}
              disabled={downloadingPdf}
              className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-2.5 py-1 text-[11px] font-semibold text-slate-400 transition-colors hover:text-slate-200 disabled:opacity-50"
            >
              {downloadingPdf ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              Preview PDF
            </button>
          </div>
        </div>
      )}

      {/* Sign-off form */}
      {showSignOff && (
        <div className="border-b border-slate-700/80 bg-slate-900/60 p-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">HSE Sign-off</div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Confirmed root cause (optional)</label>
            <input
              type="text"
              value={signOffForm.rootCauseConfirmed}
              onChange={(e) => setSignOffForm((p) => ({ ...p, rootCauseConfirmed: e.target.value }))}
              placeholder="Summarise the root cause in one sentence…"
              className="w-full rounded-xl border border-slate-600 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Review notes (optional)</label>
            <textarea
              rows={2}
              value={signOffForm.reviewNotes}
              onChange={(e) => setSignOffForm((p) => ({ ...p, reviewNotes: e.target.value }))}
              placeholder="Any additional notes for the record…"
              className="w-full resize-none rounded-xl border border-slate-600 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={submitSignOff}
              disabled={signingOff}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {signingOff ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {signingOff ? "Approving…" : "Approve & Sign Off"}
            </button>
            <button
              onClick={() => setShowSignOff(false)}
              className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* HSE notified banner */}
      {session?.hse_notified_at && session.status !== "approved" && (
        <div className="flex items-center gap-2 border-b border-emerald-900/40 bg-emerald-950/30 px-4 py-2 text-xs text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          HSE team notified on {new Date(session.hse_notified_at).toLocaleDateString()}
        </div>
      )}

      {!session ? (
        /* Start state */
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-400" />
          <div>
            <div className="text-sm font-semibold text-slate-100">Start Root Cause Analysis</div>
            <div className="mt-1 max-w-xs text-xs leading-relaxed text-slate-400">
              The AI will guide you through a structured investigation. HSE team members will be notified automatically.
            </div>
          </div>
          <button
            onClick={startSession}
            disabled={starting}
            className="flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-500 disabled:opacity-60"
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            {starting ? "Starting…" : "Start RCA Session"}
          </button>
        </div>
      ) : (
        <>
          {/* Step progress */}
          <div className="border-b border-slate-700/80 px-4 py-2">
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {steps.map((step, idx) => {
                const done = idx < currentStepIndex;
                const active = idx === currentStepIndex;
                return (
                  <div key={step} className="flex shrink-0 items-center gap-1">
                    <div
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                        done
                          ? "bg-emerald-900/60 text-emerald-300"
                          : active
                            ? "bg-sky-900/60 text-sky-300"
                            : "bg-slate-800 text-slate-500"
                      }`}
                    >
                      {getStepLabel(step)}
                    </div>
                    {idx < steps.length - 1 && (
                      <ChevronRight className="h-3 w-3 shrink-0 text-slate-700" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-700/80">
            {(["chat", "capa"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  activeTab === tab
                    ? "border-b-2 border-sky-500 text-sky-400"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab === "chat" ? "AI Conversation" : `CAPA Items (${capaItems.filter((c) => c.status !== "cancelled").length})`}
              </button>
            ))}
          </div>

          {activeTab === "chat" ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        msg.role === "user" ? "bg-slate-700" : "bg-sky-900/60"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <User className="h-3.5 w-3.5 text-slate-300" />
                      ) : (
                        <Bot className="h-3.5 w-3.5 text-sky-400" />
                      )}
                    </div>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-slate-700 text-slate-100"
                          : "bg-slate-900/80 text-slate-200 border border-slate-700/60"
                      }`}
                    >
                      <div
                        // eslint-disable-next-line react/no-danger
                        dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                      />
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex gap-2.5">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-900/60">
                      <Bot className="h-3.5 w-3.5 text-sky-400" />
                    </div>
                    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 px-3.5 py-2.5">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              {session.status !== "closed" && (
                <div className="border-t border-slate-700/80 p-3 space-y-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={advanceStep}
                      onChange={(e) => setAdvanceStep(e.target.checked)}
                      className="rounded border-slate-600 bg-slate-800"
                    />
                    I'm ready to move to the next step
                  </label>
                  <div className="flex gap-2">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendMessage();
                        }
                      }}
                      placeholder="Your response…"
                      rows={2}
                      disabled={sending}
                      className="flex-1 resize-none rounded-xl border border-slate-600 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none disabled:opacity-50"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={sending || !draft.trim()}
                      aria-label="Send message"
                      className="flex items-center justify-center rounded-xl bg-sky-600 px-3 py-2 text-white transition-colors hover:bg-sky-500 disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* CAPA tab */
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {capaItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-700/80 px-4 py-6 text-center text-sm text-slate-500">
                    No CAPA items yet. Add actions from the AI conversation or create them manually.
                  </div>
                ) : (
                  capaItems.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-xl border px-3 py-3 ${PRIORITY_COLORS[item.priority]}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className={`text-sm font-semibold ${STATUS_COLORS[item.status]}`}>
                            {item.title}
                          </div>
                          {item.description && (
                            <div className="mt-0.5 text-xs leading-relaxed opacity-70">{item.description}</div>
                          )}
                          <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wider opacity-60">
                            <span>{item.priority}</span>
                            {item.due_at && (
                              <span>Due {new Date(item.due_at).toLocaleDateString()}</span>
                            )}
                            {item.completed_at && (
                              <span className="text-emerald-400">Completed {new Date(item.completed_at).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        {item.status !== "completed" && item.status !== "cancelled" && (
                          <button
                            onClick={() => markCapaComplete(item)}
                            title="Mark complete"
                            className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-emerald-900/30 hover:text-emerald-400"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {showCapaForm ? (
                <div className="border-t border-slate-700/80 p-3 space-y-2">
                  <input
                    type="text"
                    value={capaForm.title}
                    onChange={(e) => setCapaForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Action title *"
                    className="w-full rounded-xl border border-slate-600 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
                  />
                  <textarea
                    value={capaForm.description}
                    onChange={(e) => setCapaForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full resize-none rounded-xl border border-slate-600 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <select
                      value={capaForm.priority}
                      onChange={(e) => setCapaForm((prev) => ({ ...prev, priority: e.target.value as CapaItem["priority"] }))}
                      className="rounded-xl border border-slate-600 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-sky-500 focus:outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                    <input
                      type="date"
                      value={capaForm.dueAt}
                      onChange={(e) => setCapaForm((prev) => ({ ...prev, dueAt: e.target.value }))}
                      className="flex-1 rounded-xl border border-slate-600 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={saveCapa}
                      disabled={savingCapa}
                      className="flex-1 rounded-xl bg-sky-600 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                    >
                      {savingCapa ? "Saving…" : "Save CAPA Item"}
                    </button>
                    <button
                      onClick={() => setShowCapaForm(false)}
                      className="rounded-xl border border-slate-600 px-3 py-2 text-sm text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-slate-700/80 p-3">
                  <button
                    onClick={() => setShowCapaForm(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 py-2.5 text-sm text-slate-400 transition-colors hover:border-sky-500 hover:text-sky-400"
                  >
                    <Plus className="h-4 w-4" />
                    Add CAPA Item
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
