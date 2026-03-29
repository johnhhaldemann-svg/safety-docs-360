"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
} from "@/components/WorkspacePrimitives";

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
};

type MatrixRow = {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  cells: Record<string, boolean>;
  unmatchedCertifications: string[];
  profileFields: {
    tradeSpecialty: string;
    jobTitle: string;
    readinessStatus: string;
  };
};

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
  const [newMatchFields, setNewMatchFields] = useState("certifications");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editKeywords, setEditKeywords] = useState("");
  const [editMatchFields, setEditMatchFields] = useState("");

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

      setRequirements(data?.requirements ?? []);
      setRows(data?.rows ?? []);
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
          matchFields: newMatchFields
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean),
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
      setNewMatchFields("certifications");
      await loadMatrix();
    } catch (e) {
      setMessageTone("error");
      setMessage(e instanceof Error ? e.message : "Failed to create requirement.");
    }
    setSaving(false);
  }, [loadMatrix, newKeywords, newMatchFields, newTitle]);

  const startEdit = useCallback((r: Requirement) => {
    setEditingId(r.id);
    setEditTitle(r.title);
    setEditKeywords(r.matchKeywords.join(", "));
    setEditMatchFields(r.matchFields.join(", "));
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
          matchFields: editMatchFields
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean),
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
  }, [editKeywords, editMatchFields, editTitle, editingId, loadMatrix]);

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
        description="Define required trainings for your company, then review coverage from each person’s construction profile (certifications and optional job title / trade fields). Profile data is per user account and is shared if someone belongs to more than one workspace."
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
          description="Add keywords that should match text in each person’s profile (usually certification names). Use commas or new lines. Match fields: certifications (default), job_title, trade_specialty."
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
              Match fields
              <input
                value={newMatchFields}
                onChange={(e) => setNewMatchFields(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="certifications"
              />
            </label>
          </div>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Keywords
            <textarea
              value={newKeywords}
              onChange={(e) => setNewKeywords(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="osha 30, osha30, 30-hour"
            />
          </label>
          <div className="mt-4">
            <button
              type="button"
              disabled={saving || !newTitle.trim() || !newKeywords.trim()}
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
                      <input
                        value={editMatchFields}
                        onChange={(e) => setEditMatchFields(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        placeholder="certifications, job_title"
                      />
                      <textarea
                        value={editKeywords}
                        onChange={(e) => setEditKeywords(e.target.value)}
                        rows={2}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSaveEdit()}
                          disabled={saving}
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
                          Fields: {r.matchFields.join(", ")}
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
        description="Each cell reflects whether profile text matches your requirement keywords. The last column lists certifications on the profile that did not match any requirement."
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
                      const ok = row.cells[r.id] === true;
                      return (
                        <td key={r.id} className="px-3 py-3 text-center align-middle">
                          {ok ? (
                            <span className="inline-flex justify-center text-emerald-600" title="Match">
                              <Check className="h-5 w-5" aria-hidden />
                              <span className="sr-only">Match</span>
                            </span>
                          ) : (
                            <span className="inline-flex justify-center text-slate-300" title="No match">
                              <X className="h-5 w-5" aria-hidden />
                              <span className="sr-only">No match</span>
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
