"use client";

import Link from "next/link";
import { Check, Minus, X } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
} from "@/components/WorkspacePrimitives";
import {
  CONSTRUCTION_POSITIONS,
  CONSTRUCTION_TRADES,
} from "@/lib/constructionProfileOptions";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Requirement = {
  id: string;
  title: string;
  sortOrder: number;
  matchKeywords: string[];
  matchFields: string[];
  applyTrades: string[];
  applyPositions: string[];
};

type MatrixCellState = "match" | "gap" | "na";

type MatrixRow = {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  cells: Record<string, MatrixCellState>;
  unmatchedCertifications: string[];
  profileFields: {
    tradeSpecialty: string;
    jobTitle: string;
    readinessStatus: string;
  };
};

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function normalizeCellState(v: unknown): MatrixCellState {
  if (v === true) return "match";
  if (v === false) return "gap";
  if (v === "match" || v === "gap" || v === "na") return v;
  return "gap";
}

async function getAccessToken() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error("You must be logged in.");
  }
  return session.access_token;
}

export default function TrainingMatrixPage() {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [canMutate, setCanMutate] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">(
    "neutral"
  );

  const [newTitle, setNewTitle] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [newApplyTrades, setNewApplyTrades] = useState<string[]>([]);
  const [newApplyPositions, setNewApplyPositions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editKeywords, setEditKeywords] = useState("");
  const [editApplyTrades, setEditApplyTrades] = useState<string[]>([]);
  const [editApplyPositions, setEditApplyPositions] = useState<string[]>([]);

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/company/training-matrix", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => null)) as
        | {
            error?: string;
            requirements?: Requirement[];
            rows?: MatrixRow[];
            warning?: string | null;
            capabilities?: { canMutate?: boolean };
          }
        | null;

      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to load training matrix.");
        setRequirements([]);
        setRows([]);
        setLoading(false);
        return;
      }

      setRequirements(
        (data?.requirements ?? []).map((r) => ({
          ...r,
          applyTrades: r.applyTrades ?? [],
          applyPositions: r.applyPositions ?? [],
        }))
      );
      setRows(
        (data?.rows ?? []).map((row) => ({
          ...row,
          cells: Object.fromEntries(
            Object.entries(row.cells ?? {}).map(([k, v]) => [k, normalizeCellState(v)])
          ),
        }))
      );
      setCanMutate(Boolean(data?.capabilities?.canMutate));
      setWarning(data?.warning ?? null);
    } catch (e) {
      setMessageTone("error");
      setMessage(e instanceof Error ? e.message : "Failed to load training matrix.");
      setRequirements([]);
      setRows([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadMatrix());
  }, [loadMatrix]);

  const handleCreate = useCallback(async () => {
    setSaving(true);
    setMessage("");
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/company/training-requirements", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          keywords: newKeywords,
          matchFields: ["certifications"],
          applyTrades: newApplyTrades,
          applyPositions: newApplyPositions,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to create requirement.");
        setSaving(false);
        return;
      }
      setMessageTone("success");
      setMessage("Requirement added.");
      setNewTitle("");
      setNewKeywords("");
      setNewApplyTrades([]);
      setNewApplyPositions([]);
      await loadMatrix();
    } catch (e) {
      setMessageTone("error");
      setMessage(e instanceof Error ? e.message : "Failed to create requirement.");
    }
    setSaving(false);
  }, [loadMatrix, newApplyPositions, newApplyTrades, newKeywords, newTitle]);

  const startEdit = useCallback((r: Requirement) => {
    setEditingId(r.id);
    setEditTitle(r.title);
    setEditKeywords(r.matchKeywords.join(", "));
    setEditApplyTrades([...(r.applyTrades ?? [])]);
    setEditApplyPositions([...(r.applyPositions ?? [])]);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    setSaving(true);
    setMessage("");
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/company/training-requirements/${editingId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          keywords: editKeywords,
          matchFields: ["certifications"],
          applyTrades: editApplyTrades,
          applyPositions: editApplyPositions,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to update requirement.");
        setSaving(false);
        return;
      }
      setMessageTone("success");
      setMessage("Requirement updated.");
      setEditingId(null);
      await loadMatrix();
    } catch (e) {
      setMessageTone("error");
      setMessage(e instanceof Error ? e.message : "Failed to update requirement.");
    }
    setSaving(false);
  }, [editApplyPositions, editApplyTrades, editKeywords, editTitle, editingId, loadMatrix]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this training requirement?")) return;
      setSaving(true);
      setMessage("");
      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/company/training-requirements/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          setMessageTone("error");
          setMessage(data?.error || "Failed to delete requirement.");
          setSaving(false);
          return;
        }
        setMessageTone("success");
        setMessage("Requirement removed.");
        await loadMatrix();
      } catch (e) {
        setMessageTone("error");
        setMessage(e instanceof Error ? e.message : "Failed to delete requirement.");
      }
      setSaving(false);
    },
    [loadMatrix]
  );

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Company workspace"
        title="Training matrix"
        description="Each requirement applies to selected trades and site positions (same lists as the construction profile). Keywords match certifications on the profile. Profile data is per user account and is shared across workspaces."
        actions={
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to dashboard
          </Link>
        }
      />

      {warning ? <InlineMessage tone="warning">{warning}</InlineMessage> : null}
      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

      {canMutate ? (
        <SectionCard
          title="Required trainings"
          description="Pick which trades and positions this training applies to (must match each person’s profile). Add certification keywords to check off when those credentials appear on their profile."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Title
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="e.g. OSHA 30"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Certification keywords
              <textarea
                value={newKeywords}
                onChange={(e) => setNewKeywords(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="osha 30, osha30, 30-hour"
              />
            </label>
          </div>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-slate-700">
                Applies to trades <span className="text-red-600">*</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">Must match primary trade on the profile.</p>
              <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
                <div className="grid gap-2 sm:grid-cols-1">
                  {CONSTRUCTION_TRADES.map((t) => (
                    <label
                      key={t}
                      className="flex cursor-pointer items-start gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={newApplyTrades.includes(t)}
                        onChange={() =>
                          setNewApplyTrades((prev) => toggleInList(prev, t))
                        }
                        className="mt-0.5 rounded border-slate-300 text-sky-600"
                      />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-700">
                Applies to positions <span className="text-red-600">*</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">Must match site position on the profile.</p>
              <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
                <div className="grid gap-2">
                  {CONSTRUCTION_POSITIONS.map((p) => (
                    <label
                      key={p}
                      className="flex cursor-pointer items-start gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={newApplyPositions.includes(p)}
                        onChange={() =>
                          setNewApplyPositions((prev) => toggleInList(prev, p))
                        }
                        className="mt-0.5 rounded border-slate-300 text-sky-600"
                      />
                      <span>{p}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <button
              type="button"
              disabled={
                saving ||
                !newTitle.trim() ||
                !newKeywords.trim() ||
                newApplyTrades.length === 0 ||
                newApplyPositions.length === 0
              }
              onClick={() => void handleCreate()}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add requirement"}
            </button>
          </div>

          {requirements.length > 0 ? (
            <ul className="mt-6 space-y-3 border-t border-slate-200 pt-6">
              {requirements.map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
                >
                  {editingId === r.id ? (
                    <div className="grid gap-3">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                      <textarea
                        value={editKeywords}
                        onChange={(e) => setEditKeywords(e.target.value)}
                        rows={2}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Certification keywords"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 p-2">
                          <div className="mb-1 text-xs font-semibold text-slate-600">Trades</div>
                          {CONSTRUCTION_TRADES.map((t) => (
                            <label key={t} className="flex gap-2 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={editApplyTrades.includes(t)}
                                onChange={() =>
                                  setEditApplyTrades((prev) => toggleInList(prev, t))
                                }
                              />
                              {t}
                            </label>
                          ))}
                        </div>
                        <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 p-2">
                          <div className="mb-1 text-xs font-semibold text-slate-600">Positions</div>
                          {CONSTRUCTION_POSITIONS.map((p) => (
                            <label key={p} className="flex gap-2 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={editApplyPositions.includes(p)}
                                onChange={() =>
                                  setEditApplyPositions((prev) => toggleInList(prev, p))
                                }
                              />
                              {p}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSaveEdit()}
                          disabled={
                            saving ||
                            !editTitle.trim() ||
                            !editKeywords.trim() ||
                            editApplyTrades.length === 0 ||
                            editApplyPositions.length === 0
                          }
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{r.title}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Trades: {(r.applyTrades ?? []).join(", ") || "—"}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          Positions: {(r.applyPositions ?? []).join(", ") || "—"}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {r.matchKeywords.join(" · ")}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(r)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-white"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(r.id)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              No requirements yet. Add at least one to populate matrix columns.
            </p>
          )}
        </SectionCard>
      ) : null}

      <SectionCard
        title="Coverage matrix"
        description="Checkmark when the person’s certifications match keywords for a requirement that applies to their trade and position. A dash means this requirement does not apply to them. The last column lists certifications that did not satisfy any applicable requirement."
      >
        {loading ? (
          <InlineMessage>Loading matrix…</InlineMessage>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No team members to show"
            description={
              warning
                ? "Fix the configuration warning above, or invite users to this workspace."
                : "Invite users and ensure they complete their construction profile certifications."
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="sticky left-0 z-10 min-w-[200px] bg-slate-50 px-4 py-3 font-semibold text-slate-800">
                    Person
                  </th>
                  {requirements.map((r) => (
                    <th
                      key={r.id}
                      className="min-w-[100px] px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600"
                      title={r.matchKeywords.join(", ")}
                    >
                      <span className="line-clamp-3">{r.title}</span>
                    </th>
                  ))}
                  <th className="min-w-[180px] px-4 py-3 font-semibold text-slate-800">
                    Other profile certifications
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.userId} className="border-b border-slate-100">
                    <td className="sticky left-0 z-10 bg-white px-4 py-3 align-top shadow-[1px_0_0_0_rgb(226_232_240)]">
                      <div className="font-semibold text-slate-900">{row.name}</div>
                      <div className="text-xs text-slate-500">{row.email || row.userId}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {row.role}
                        {row.profileFields.jobTitle ? ` · ${row.profileFields.jobTitle}` : ""}
                        {row.profileFields.tradeSpecialty
                          ? ` · ${row.profileFields.tradeSpecialty}`
                          : ""}
                      </div>
                      <Link
                        href={`/profile?userId=${encodeURIComponent(row.userId)}&returnTo=${encodeURIComponent("/training-matrix")}`}
                        className="mt-2 inline-block text-xs font-semibold text-sky-700 hover:underline"
                      >
                        Open profile
                      </Link>
                    </td>
                    {requirements.map((r) => {
                      const state = row.cells[r.id] ?? "gap";
                      return (
                        <td key={r.id} className="px-3 py-3 text-center align-middle">
                          {state === "match" ? (
                            <span className="inline-flex justify-center text-emerald-600" title="Met">
                              <Check className="h-5 w-5" aria-hidden />
                              <span className="sr-only">Met</span>
                            </span>
                          ) : state === "na" ? (
                            <span
                              className="inline-flex justify-center text-slate-300"
                              title="Not required for this trade / position"
                            >
                              <Minus className="h-5 w-5" aria-hidden />
                              <span className="sr-only">Not applicable</span>
                            </span>
                          ) : (
                            <span className="inline-flex justify-center text-amber-600" title="Required but not matched">
                              <X className="h-5 w-5" aria-hidden />
                              <span className="sr-only">Gap</span>
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 align-top text-slate-600">
                      {row.unmatchedCertifications.length ? (
                        <div className="flex flex-wrap gap-1">
                          {row.unmatchedCertifications.map((c) => (
                            <span
                              key={c}
                              className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-900 ring-1 ring-amber-200"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && rows.length > 0 ? (
          <p className="mt-3 text-xs text-slate-500">Showing {rows.length} people in this workspace.</p>
        ) : null}
      </SectionCard>
    </div>
  );
}
