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
import { TRAINING_REQUIREMENTS_MIGRATION_SQL } from "@/lib/companyTrainingRequirementsDb";
import {
  PROFILE_CERTIFICATION_GROUPS,
  PROFILE_CERTIFICATION_SET,
} from "@/lib/constructionProfileCertifications";
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

function normalizeCellState(v: unknown): MatrixCellState {
  if (v === true) return "match";
  if (v === false) return "gap";
  if (v === "match" || v === "gap" || v === "na") return v;
  return "gap";
}

const positionOptionSet = new Set<string>(CONSTRUCTION_POSITIONS);

/** Dropdown sentinel for a certification not in the profile catalog. */
const CUSTOM_PROFILE_CERT_VALUE = "__custom_cert__";

function resolvedTrainingFromCertPicker(select: string, custom: string): string {
  if (select === CUSTOM_PROFILE_CERT_VALUE) return custom.trim();
  return select.trim();
}

function certPickerStateFromTrainingLine(trainingLine: string): { select: string; custom: string } {
  const t = trainingLine.trim();
  if (!t) return { select: "", custom: "" };
  if (PROFILE_CERTIFICATION_SET.has(t)) return { select: t, custom: "" };
  return { select: CUSTOM_PROFILE_CERT_VALUE, custom: t };
}

/** Stored title: `Training name (Position A, Position B)` for matrix / lists. */
function composeRequirementTitle(trainingLine: string, positions: string[]): string {
  const t = trainingLine.trim();
  const pos = positions.filter(Boolean);
  if (!t) return "";
  if (pos.length === 0) return t;
  return `${t} (${pos.join(", ")})`;
}

/** Split stored title for editing; falls back to API positions when title is legacy plain text. */
function parseRequirementTitleForEdit(
  storedTitle: string,
  apiPositions: string[]
): { trainingLine: string; positions: string[] } {
  const m = storedTitle.trim().match(/^(.+)\s+\(([^)]+)\)\s*$/);
  if (!m) {
    return { trainingLine: storedTitle.trim(), positions: [...apiPositions] };
  }
  const trainingLine = m[1].trim();
  const candidates = m[2]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const matched = candidates.filter((p) => positionOptionSet.has(p));
  if (matched.length > 0) {
    return { trainingLine, positions: matched };
  }
  return { trainingLine: storedTitle.trim(), positions: [...apiPositions] };
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

/** Single-select dropdowns + chips — works on mobile; native multi-select is often invisible there. */
function PickTradesAndPositions({
  trades,
  positions,
  onTradesChange,
  onPositionsChange,
  variant = "default",
}: {
  trades: string[];
  positions: string[];
  onTradesChange: (next: string[]) => void;
  onPositionsChange: (next: string[]) => void;
  variant?: "default" | "compact";
}) {
  const selectClass =
    variant === "compact"
      ? "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-500"
      : "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-500";

  const chipClass =
    variant === "compact"
      ? "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-800"
      : "inline-flex max-w-full items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm font-medium text-slate-800";

  const availableTrades = CONSTRUCTION_TRADES.filter((t) => !trades.includes(t));
  const availablePositions = CONSTRUCTION_POSITIONS.filter((p) => !positions.includes(p));

  const headingClass =
    variant === "compact"
      ? "text-xs font-semibold text-slate-600"
      : "text-sm font-medium text-slate-700";

  return (
    <div className={variant === "compact" ? "grid gap-3 sm:grid-cols-2" : "mt-4 grid gap-5 md:grid-cols-2"}>
      <div>
        <div className={headingClass}>
          Applies to trades <span className="text-red-600">*</span>
        </div>
        {variant === "default" ? (
          <p className="mt-0.5 text-xs text-slate-500">
            Same options as <strong>Primary trade</strong> on the construction profile. Choose from the
            dropdown; add several if needed.
          </p>
        ) : null}
        <select
          key={`trade-dd-${trades.join("|")}`}
          className={selectClass}
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            onTradesChange([...trades, v]);
          }}
        >
          <option value="">Add a trade…</option>
          {availableTrades.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {trades.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Selected trades">
            {trades.map((t) => (
              <li key={t} className={chipClass}>
                <span className="truncate">{t}</span>
                <button
                  type="button"
                  className="shrink-0 rounded px-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                  aria-label={`Remove ${t}`}
                  onClick={() => onTradesChange(trades.filter((x) => x !== t))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-400">No trades selected yet.</p>
        )}
      </div>
      <div>
        <div className={headingClass}>
          Applies to positions <span className="text-red-600">*</span>
        </div>
        {variant === "default" ? (
          <p className="mt-0.5 text-xs text-slate-500">
            Same options as <strong>Site position</strong> on the construction profile. Each pick is
            included in the saved title after your training name.
          </p>
        ) : null}
        <select
          key={`position-dd-${positions.join("|")}`}
          className={selectClass}
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            onPositionsChange([...positions, v]);
          }}
        >
          <option value="">Add a position…</option>
          {availablePositions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {positions.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Selected positions">
            {positions.map((p) => (
              <li key={p} className={chipClass}>
                <span className="truncate">{p}</span>
                <button
                  type="button"
                  className="shrink-0 rounded px-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                  aria-label={`Remove ${p}`}
                  onClick={() => onPositionsChange(positions.filter((x) => x !== p))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-400">No positions selected yet.</p>
        )}
      </div>
    </div>
  );
}

const SCHEMA_MIGRATION_BANNER_DISMISSED_KEY = "sd360_dismiss_training_schema_migration_v1";

function SchemaMigrationBanner({ onDismiss }: { onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  const copySql = () => {
    void navigator.clipboard.writeText(TRAINING_REQUIREMENTS_MIGRATION_SQL).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-950">Database: enable trade and position rules</p>
          <p className="mt-1 text-sm leading-6 text-amber-900/90">
            Run the SQL below in{" "}
            <strong className="font-semibold">Supabase → SQL Editor</strong> for this project. Until then,
            trade/position picks are not saved and requirements apply to everyone.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-100"
        >
          Dismiss
        </button>
      </div>
      <details className="mt-3 rounded-xl border border-amber-200/80 bg-white/60 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-amber-950">
          Show SQL to copy
        </summary>
        <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-900/5 p-3 font-mono text-xs leading-relaxed text-slate-800">
          {TRAINING_REQUIREMENTS_MIGRATION_SQL}
        </pre>
        <button
          type="button"
          onClick={() => copySql()}
          className="mt-2 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
        >
          {copied ? "Copied" : "Copy SQL"}
        </button>
      </details>
    </div>
  );
}

export default function TrainingMatrixPage() {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [canMutate, setCanMutate] = useState(false);
  const [schemaMigrationNeeded, setSchemaMigrationNeeded] = useState(false);
  const [schemaMigrationBannerDismissed, setSchemaMigrationBannerDismissed] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">(
    "neutral"
  );

  const [newProfileCertSelect, setNewProfileCertSelect] = useState("");
  const [newProfileCertCustom, setNewProfileCertCustom] = useState("");
  const [newApplyTrades, setNewApplyTrades] = useState<string[]>([]);
  const [newApplyPositions, setNewApplyPositions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProfileCertSelect, setEditProfileCertSelect] = useState("");
  const [editProfileCertCustom, setEditProfileCertCustom] = useState("");
  const [editApplyTrades, setEditApplyTrades] = useState<string[]>([]);
  const [editApplyPositions, setEditApplyPositions] = useState<string[]>([]);

  useEffect(() => {
    try {
      if (
        typeof window !== "undefined" &&
        window.localStorage.getItem(SCHEMA_MIGRATION_BANNER_DISMISSED_KEY) === "1"
      ) {
        setSchemaMigrationBannerDismissed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const dismissSchemaMigrationBanner = useCallback(() => {
    setSchemaMigrationBannerDismissed(true);
    try {
      window.localStorage.setItem(SCHEMA_MIGRATION_BANNER_DISMISSED_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

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
            schemaMigrationNeeded?: boolean;
            capabilities?: { canMutate?: boolean };
          }
        | null;

      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to load training matrix.");
        setRequirements([]);
        setRows([]);
        setSchemaMigrationNeeded(false);
        setLoading(false);
        return;
      }

      setSchemaMigrationNeeded(Boolean(data?.schemaMigrationNeeded));

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
      setSchemaMigrationNeeded(false);
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
          title: composeRequirementTitle(
            resolvedTrainingFromCertPicker(newProfileCertSelect, newProfileCertCustom),
            newApplyPositions
          ),
          keywords: resolvedTrainingFromCertPicker(newProfileCertSelect, newProfileCertCustom),
          matchFields: ["certifications"],
          applyTrades: newApplyTrades,
          applyPositions: newApplyPositions,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        schemaWarning?: string | null;
      } | null;
      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to create requirement.");
        setSaving(false);
        return;
      }
      if (data?.schemaWarning) {
        setMessageTone("warning");
        setMessage(`Requirement added. ${data.schemaWarning}`);
      } else {
        setMessageTone("success");
        setMessage("Requirement added.");
      }
      setNewProfileCertSelect("");
      setNewProfileCertCustom("");
      setNewApplyTrades([]);
      setNewApplyPositions([]);
      await loadMatrix();
    } catch (e) {
      setMessageTone("error");
      setMessage(e instanceof Error ? e.message : "Failed to create requirement.");
    }
    setSaving(false);
  }, [
    loadMatrix,
    newApplyPositions,
    newApplyTrades,
    newProfileCertCustom,
    newProfileCertSelect,
  ]);

  const startEdit = useCallback((r: Requirement) => {
    setEditingId(r.id);
    const parsed = parseRequirementTitleForEdit(r.title, r.applyPositions ?? []);
    const certUi = certPickerStateFromTrainingLine(parsed.trainingLine);
    setEditProfileCertSelect(certUi.select);
    setEditProfileCertCustom(certUi.custom);
    setEditApplyTrades([...(r.applyTrades ?? [])]);
    setEditApplyPositions(parsed.positions);
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
          title: composeRequirementTitle(
            resolvedTrainingFromCertPicker(editProfileCertSelect, editProfileCertCustom),
            editApplyPositions
          ),
          keywords: resolvedTrainingFromCertPicker(editProfileCertSelect, editProfileCertCustom),
          matchFields: ["certifications"],
          applyTrades: editApplyTrades,
          applyPositions: editApplyPositions,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        schemaWarning?: string | null;
      } | null;
      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to update requirement.");
        setSaving(false);
        return;
      }
      if (data?.schemaWarning) {
        setMessageTone("warning");
        setMessage(`Requirement updated. ${data.schemaWarning}`);
      } else {
        setMessageTone("success");
        setMessage("Requirement updated.");
      }
      setEditingId(null);
      await loadMatrix();
    } catch (e) {
      setMessageTone("error");
      setMessage(e instanceof Error ? e.message : "Failed to update requirement.");
    }
    setSaving(false);
  }, [
    editApplyPositions,
    editApplyTrades,
    editProfileCertCustom,
    editProfileCertSelect,
    editingId,
    loadMatrix,
  ]);

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
        description="Requirements use the same certification list as the construction profile. Pick one, then which trades and positions it applies to. The matrix checks profile certifications."
        actions={
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to dashboard
          </Link>
        }
      />

      {schemaMigrationNeeded && !schemaMigrationBannerDismissed ? (
        <SchemaMigrationBanner onDismiss={dismissSchemaMigrationBanner} />
      ) : null}
      {warning ? <InlineMessage tone="warning">{warning}</InlineMessage> : null}
      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

      {canMutate ? (
        <SectionCard
          title="Required trainings"
          description="Pick a certification from the same list workers use on their construction profile, then choose trades and positions. The saved title adds positions in parentheses."
        >
          <label className="block text-sm font-medium text-slate-700">
            Training requirement
            <select
              value={newProfileCertSelect}
              onChange={(e) => {
                const v = e.target.value;
                setNewProfileCertSelect(v);
                if (v !== CUSTOM_PROFILE_CERT_VALUE) setNewProfileCertCustom("");
              }}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Select from profile certifications…</option>
              {PROFILE_CERTIFICATION_GROUPS.map((group) => (
                <optgroup key={group.title} label={group.title}>
                  {group.items.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value={CUSTOM_PROFILE_CERT_VALUE}>Other (not in list)…</option>
            </select>
            {newProfileCertSelect === CUSTOM_PROFILE_CERT_VALUE ? (
              <input
                value={newProfileCertCustom}
                onChange={(e) => setNewProfileCertCustom(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Custom name — should match text on profiles"
              />
            ) : null}
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Matching uses this certification text against each person’s profile. Positions you add
              below are included in the column title.
            </span>
          </label>
          <PickTradesAndPositions
            trades={newApplyTrades}
            positions={newApplyPositions}
            onTradesChange={setNewApplyTrades}
            onPositionsChange={setNewApplyPositions}
            variant="default"
          />
          <div className="mt-4">
            <button
              type="button"
              disabled={
                saving ||
                !resolvedTrainingFromCertPicker(newProfileCertSelect, newProfileCertCustom).trim() ||
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
                      <label className="block text-xs font-semibold text-slate-600">
                        Training requirement
                        <select
                          value={editProfileCertSelect}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEditProfileCertSelect(v);
                            if (v !== CUSTOM_PROFILE_CERT_VALUE) setEditProfileCertCustom("");
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900"
                        >
                          <option value="">Select from profile certifications…</option>
                          {PROFILE_CERTIFICATION_GROUPS.map((group) => (
                            <optgroup key={group.title} label={group.title}>
                              {group.items.map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                          <option value={CUSTOM_PROFILE_CERT_VALUE}>Other (not in list)…</option>
                        </select>
                        {editProfileCertSelect === CUSTOM_PROFILE_CERT_VALUE ? (
                          <input
                            value={editProfileCertCustom}
                            onChange={(e) => setEditProfileCertCustom(e.target.value)}
                            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
                            placeholder="Custom certification name"
                          />
                        ) : null}
                      </label>
                      <PickTradesAndPositions
                        trades={editApplyTrades}
                        positions={editApplyPositions}
                        onTradesChange={setEditApplyTrades}
                        onPositionsChange={setEditApplyPositions}
                        variant="compact"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSaveEdit()}
                          disabled={
                            saving ||
                            !resolvedTrainingFromCertPicker(
                              editProfileCertSelect,
                              editProfileCertCustom
                            ).trim() ||
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
