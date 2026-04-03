"use client";

import Link from "next/link";
import { Check, Minus, X } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ComplianceCommandCenter } from "@/components/training-matrix/ComplianceCommandCenter";
import { InlineMessage, SectionCard } from "@/components/WorkspacePrimitives";
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
  renewalMonths?: number | null;
};

type MatrixCellState = "match" | "gap" | "na";

type MatrixCellDetail = {
  state: MatrixCellState;
  matchSource?: string;
  matchedLabel?: string;
  expiresOn?: string | null;
  daysUntilExpiry?: number | null;
  expiryStatus?: "none" | "ok" | "soon" | "expired";
  gapKeywords?: string[];
};

type CertificationInventoryItem = {
  name: string;
  expiresOn: string | null;
  daysUntilExpiry: number | null;
  expiryStatus: "none" | "ok" | "soon" | "expired";
};

type MatrixRow = {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  cells: Record<string, MatrixCellState>;
  cellDetails?: Record<string, MatrixCellDetail>;
  unmatchedCertifications: string[];
  certificationInventory?: CertificationInventoryItem[];
  profileFields: {
    tradeSpecialty: string;
    jobTitle: string;
    readinessStatus: string;
    yearsExperience: number | null;
  };
};

function normalizeCellState(v: unknown): MatrixCellState {
  if (v === true) return "match";
  if (v === false) return "gap";
  if (v === "match" || v === "gap" || v === "na") return v;
  return "gap";
}

const positionOptionSet = new Set<string>(CONSTRUCTION_POSITIONS);

function parseRenewalMonthsInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 1 || n > 600) return null;
  return n;
}

function requirementHeaderTitle(r: Requirement): string {
  const kw = r.matchKeywords.join(", ");
  if (r.renewalMonths != null && r.renewalMonths > 0) {
    return `${kw}\nTypical renewal: ${r.renewalMonths} mo (hint only; profile expiration dates control the matrix).`;
  }
  return kw;
}

function readinessLabel(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s === "travel_ready") return "Travel ready";
  if (s === "limited") return "Limited availability";
  if (s === "ready") return "Ready for site";
  return raw || "—";
}

function ledgerChipToneDark(
  status: CertificationInventoryItem["expiryStatus"]
): { wrap: string; dot: string } {
  switch (status) {
    case "expired":
      return { wrap: "bg-rose-500/15 text-rose-100 ring-rose-500/40", dot: "bg-rose-400" };
    case "soon":
      return { wrap: "bg-amber-500/15 text-amber-100 ring-amber-500/35", dot: "bg-amber-400" };
    case "ok":
      return { wrap: "bg-emerald-500/15 text-emerald-100 ring-emerald-500/35", dot: "bg-emerald-400" };
    default:
      return { wrap: "bg-zinc-800/80 text-zinc-300 ring-zinc-600", dot: "bg-zinc-500" };
  }
}

function cellExpiryCaption(d: MatrixCellDetail | undefined): string {
  if (!d || d.state !== "match") return "";
  if (d.expiryStatus === "none" || d.expiryStatus === undefined) {
    return "No expiry on file";
  }
  if (d.expiresOn && d.daysUntilExpiry !== null && d.daysUntilExpiry !== undefined) {
    if (d.daysUntilExpiry < 0) return `Expired ${d.expiresOn}`;
    if (d.daysUntilExpiry === 0) return `Expires today (${d.expiresOn})`;
    return `Expires ${d.expiresOn} · ${d.daysUntilExpiry}d`;
  }
  if (d.expiresOn) return `Expires ${d.expiresOn}`;
  return "";
}

function requirementCellTitle(r: Requirement, d: MatrixCellDetail | undefined, state: MatrixCellState): string {
  if (state === "na") return "Not required for this trade / position";
  if (state === "gap") {
    const kw = d?.gapKeywords?.length ? d.gapKeywords.join(", ") : r.matchKeywords.slice(0, 3).join(", ");
    return `Gap — profile should include training matching: ${kw || "see requirement keywords"}`;
  }
  if (d?.matchSource === "job_title") {
    return `Met via job title (“${d.matchedLabel ?? ""}”), not a certification line item`;
  }
  if (d?.matchSource === "trade_specialty") {
    return `Met via trade (“${d.matchedLabel ?? ""}”), not a certification line item`;
  }
  const cap = cellExpiryCaption(d);
  return [d?.matchedLabel ? `Matched: ${d.matchedLabel}` : "Met", cap].filter(Boolean).join("\n");
}

type PositionRollup = {
  missing: Requirement[];
  met: Requirement[];
  metExpiringSoon: Array<{ req: Requirement; detail: MatrixCellDetail }>;
  notRequired: Requirement[];
  expiredProfileCerts: CertificationInventoryItem[];
  soonProfileCerts: CertificationInventoryItem[];
};

function buildPositionRollup(row: MatrixRow, requirements: Requirement[]): PositionRollup {
  const missing: Requirement[] = [];
  const met: Requirement[] = [];
  const metExpiringSoon: Array<{ req: Requirement; detail: MatrixCellDetail }> = [];
  const notRequired: Requirement[] = [];

  for (const r of requirements) {
    const s = row.cells[r.id] ?? "gap";
    const d = row.cellDetails?.[r.id];
    if (s === "gap") {
      missing.push(r);
    } else if (s === "match") {
      met.push(r);
      if (d?.expiryStatus === "soon") {
        metExpiringSoon.push({ req: r, detail: d });
      }
    } else {
      notRequired.push(r);
    }
  }

  const inv = row.certificationInventory ?? [];
  const expiredProfileCerts = inv.filter((c) => c.expiryStatus === "expired");
  const soonProfileCerts = inv.filter((c) => c.expiryStatus === "soon");

  return { missing, met, metExpiringSoon, notRequired, expiredProfileCerts, soonProfileCerts };
}

function PositionScopeSummary({
  rollup,
  requirementsCount,
  theme = "light",
}: {
  rollup: PositionRollup;
  requirementsCount: number;
  theme?: "light" | "dark";
}) {
  const d = theme === "dark";
  if (requirementsCount === 0) {
    return (
      <p className={`mt-2 text-[11px] ${d ? "text-zinc-500" : "text-slate-500"}`}>
        No company requirements yet — add rules above to track gaps by position and trade.
      </p>
    );
  }

  const scopedCount = rollup.missing.length + rollup.met.length;

  return (
    <div
      className={
        d
          ? "mt-3 space-y-2 rounded-xl border border-zinc-700 bg-zinc-900/70 p-2.5"
          : "mt-3 space-y-2 rounded-xl border border-slate-700/80 bg-slate-950/50/90 p-2.5"
      }
    >
      <p
        className={
          d
            ? "text-[10px] font-bold uppercase tracking-wide text-zinc-500"
            : "text-[10px] font-bold uppercase tracking-wide text-slate-400"
        }
      >
        For this position & trade
      </p>

      {rollup.missing.length > 0 ? (
        <div>
          <p className={`text-[10px] font-bold ${d ? "text-amber-300" : "text-amber-900"}`}>
            Missing ({rollup.missing.length})
          </p>
          <ul
            className={`mt-1 space-y-0.5 text-[11px] leading-snug ${d ? "text-amber-100" : "text-amber-950"}`}
          >
            {rollup.missing.map((r) => (
              <li
                key={r.id}
                className={`border-l-2 pl-1.5 ${d ? "border-amber-500" : "border-amber-400"}`}
              >
                <span className="line-clamp-2 font-medium">{r.title}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : scopedCount === 0 ? (
        <p className={`text-[11px] ${d ? "text-zinc-400" : "text-slate-400"}`}>
          No rules apply to this trade/position combination yet.
        </p>
      ) : (
        <p className={`text-[11px] font-semibold ${d ? "text-emerald-400" : "text-emerald-100"}`}>
          Every in-scope training rule satisfied ({rollup.met.length}).
        </p>
      )}

      {rollup.met.length > 0 ? (
        <div>
          <p className={`text-[10px] font-bold ${d ? "text-emerald-400" : "text-emerald-900"}`}>
            Covered for your role ({rollup.met.length})
          </p>
          <ul
            className={`mt-1 max-h-28 space-y-0.5 overflow-y-auto text-[11px] leading-snug ${d ? "text-emerald-100" : "text-emerald-950"}`}
          >
            {rollup.met.slice(0, 8).map((r) => (
              <li
                key={r.id}
                className={`line-clamp-2 border-l-2 pl-1.5 ${d ? "border-emerald-500" : "border-emerald-400"}`}
              >
                {r.title}
              </li>
            ))}
          </ul>
          {rollup.met.length > 8 ? (
            <p className={`mt-0.5 text-[10px] ${d ? "text-emerald-300" : "text-emerald-100"}`}>
              +{rollup.met.length - 8} more
            </p>
          ) : null}
        </div>
      ) : null}

      {rollup.metExpiringSoon.length > 0 ? (
        <div>
          <p className={`text-[10px] font-bold ${d ? "text-amber-300" : "text-amber-900"}`}>
            Met — expiring soon ({rollup.metExpiringSoon.length})
          </p>
          <ul className={`mt-1 space-y-1 text-[11px] leading-snug ${d ? "text-amber-100" : "text-amber-950"}`}>
            {rollup.metExpiringSoon.map(({ req, detail }) => (
              <li
                key={req.id}
                className={
                  d
                    ? "rounded-md bg-amber-500/15 px-1.5 py-1 ring-1 ring-amber-500/30"
                    : "rounded-md bg-amber-100/80 px-1.5 py-1"
                }
              >
                <div className="font-semibold line-clamp-2">{req.title}</div>
                <div className={`text-[10px] ${d ? "text-amber-200/90" : "text-amber-900/90"}`}>
                  {detail.matchedLabel ? `${detail.matchedLabel} · ` : ""}
                  {cellExpiryCaption(detail)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rollup.expiredProfileCerts.length > 0 ? (
        <div>
          <p className={`text-[10px] font-bold ${d ? "text-rose-400" : "text-red-900"}`}>
            Expired on profile ({rollup.expiredProfileCerts.length})
          </p>
          <ul className={`mt-1 space-y-0.5 text-[11px] leading-snug ${d ? "text-rose-100" : "text-red-950"}`}>
            {rollup.expiredProfileCerts.map((c) => (
              <li key={c.name} className={`border-l-2 pl-1.5 ${d ? "border-rose-500" : "border-red-400"}`}>
                <span className="font-medium">{c.name}</span>
                {c.expiresOn ? (
                  <span className={d ? "text-rose-200/90" : "text-red-100/90"}> · ended {c.expiresOn}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rollup.soonProfileCerts.length > 0 ? (
        <div>
          <p className={`text-[10px] font-bold ${d ? "text-amber-300" : "text-amber-900"}`}>
            Credential expiring soon ({rollup.soonProfileCerts.length})
          </p>
          <ul className={`mt-1 space-y-0.5 text-[11px] leading-snug ${d ? "text-amber-100" : "text-amber-950"}`}>
            {rollup.soonProfileCerts.map((c) => (
              <li key={c.name} className={`border-l-2 pl-1.5 ${d ? "border-amber-400" : "border-amber-500"}`}>
                <span className="font-medium">{c.name}</span>
                {c.expiresOn ? (
                  <span className={d ? "text-amber-200/85" : "text-amber-900/85"}>
                    {" "}
                    · {c.expiresOn}
                    {c.daysUntilExpiry != null ? ` (${c.daysUntilExpiry}d)` : ""}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rollup.notRequired.length > 0 ? (
        <p className={`text-[10px] ${d ? "text-zinc-500" : "text-slate-500"}`}>
          <span className={`font-semibold ${d ? "text-zinc-400" : "text-slate-400"}`}>
            {rollup.notRequired.length}
          </span>{" "}
          other company rule{rollup.notRequired.length === 1 ? "" : "s"} do not apply to this position/trade
          (see “Out of scope” in the grid).
        </p>
      ) : null}
    </div>
  );
}

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

function sanitizeApiErrorMessage(raw: string): string {
  const t = raw.trim();
  if (
    t.startsWith("<!DOCTYPE") ||
    t.startsWith("<html") ||
    t.includes("<title>500") ||
    t.includes("Internal Server Error</h1>")
  ) {
    return "The server returned an error while loading the training matrix. Please try again. If it continues, confirm your Supabase migrations are applied (training requirements + profile columns).";
  }
  return t;
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
      ? "mt-1 w-full rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
      : "mt-2 w-full rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-500";

  const chipClass =
    variant === "compact"
      ? "inline-flex items-center gap-1 rounded-md border border-slate-700/80 bg-slate-950/50 px-2 py-0.5 text-xs font-medium text-slate-200"
      : "inline-flex max-w-full items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-950/50 px-2.5 py-1 text-sm font-medium text-slate-200";

  const availableTrades = CONSTRUCTION_TRADES.filter((t) => !trades.includes(t));
  const availablePositions = CONSTRUCTION_POSITIONS.filter((p) => !positions.includes(p));

  const headingClass =
    variant === "compact"
      ? "text-xs font-semibold text-slate-400"
      : "text-sm font-medium text-slate-300";

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
                  className="shrink-0 rounded px-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-100"
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
                  className="shrink-0 rounded px-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-100"
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
const DIRECTORY_NOTICE_DISMISSED_KEY = "sd360_dismiss_training_matrix_directory_notice_v1";

function SchemaMigrationBanner({ onDismiss }: { onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  const copySql = () => {
    void navigator.clipboard.writeText(TRAINING_REQUIREMENTS_MIGRATION_SQL).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-2xl border border-amber-500/35 bg-amber-950/40 p-4 shadow-sm">
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
          className="shrink-0 rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-950/60"
        >
          Dismiss
        </button>
      </div>
      <details className="mt-3 rounded-xl border border-amber-500/40 bg-amber-950/25 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-amber-100">
          Show SQL to copy
        </summary>
        <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-900/5 p-3 font-mono text-xs leading-relaxed text-slate-200">
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
  const [directoryNoticeDismissed, setDirectoryNoticeDismissed] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [directoryNotice, setDirectoryNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [workspaceDataLoaded, setWorkspaceDataLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">(
    "neutral"
  );

  const [newProfileCertSelect, setNewProfileCertSelect] = useState("");
  const [newProfileCertCustom, setNewProfileCertCustom] = useState("");
  const [newApplyTrades, setNewApplyTrades] = useState<string[]>([]);
  const [newApplyPositions, setNewApplyPositions] = useState<string[]>([]);
  const [newRenewalMonths, setNewRenewalMonths] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProfileCertSelect, setEditProfileCertSelect] = useState("");
  const [editProfileCertCustom, setEditProfileCertCustom] = useState("");
  const [editApplyTrades, setEditApplyTrades] = useState<string[]>([]);
  const [editApplyPositions, setEditApplyPositions] = useState<string[]>([]);
  const [editRenewalMonths, setEditRenewalMonths] = useState("");

  useEffect(() => {
    try {
      if (
        typeof window !== "undefined" &&
        window.localStorage.getItem(SCHEMA_MIGRATION_BANNER_DISMISSED_KEY) === "1"
      ) {
        setSchemaMigrationBannerDismissed(true);
      }
      if (
        typeof window !== "undefined" &&
        window.localStorage.getItem(DIRECTORY_NOTICE_DISMISSED_KEY) === "1"
      ) {
        setDirectoryNoticeDismissed(true);
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

  const dismissDirectoryNotice = useCallback(() => {
    setDirectoryNoticeDismissed(true);
    try {
      window.localStorage.setItem(DIRECTORY_NOTICE_DISMISSED_KEY, "1");
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
            directoryNotice?: string | null;
            schemaMigrationNeeded?: boolean;
            capabilities?: { canMutate?: boolean };
          }
        | null;

      if (!res.ok) {
        setMessageTone("error");
        setMessage(sanitizeApiErrorMessage(data?.error || "Failed to load training matrix."));
        setRequirements([]);
        setRows([]);
        setSchemaMigrationNeeded(false);
        setWarning(null);
        setDirectoryNotice(null);
        return;
      }

      setSchemaMigrationNeeded(Boolean(data?.schemaMigrationNeeded));

      setRequirements(
        (data?.requirements ?? []).map((r) => ({
          ...r,
          applyTrades: r.applyTrades ?? [],
          applyPositions: r.applyPositions ?? [],
          renewalMonths: r.renewalMonths ?? null,
        }))
      );
      setRows(
        (data?.rows ?? []).map((row) => ({
          ...row,
          cells: Object.fromEntries(
            Object.entries(row.cells ?? {}).map(([k, v]) => [k, normalizeCellState(v)])
          ),
          cellDetails: (row.cellDetails ?? {}) as Record<string, MatrixCellDetail>,
          certificationInventory: (row.certificationInventory ?? []) as CertificationInventoryItem[],
          profileFields: {
            tradeSpecialty: row.profileFields?.tradeSpecialty ?? "",
            jobTitle: row.profileFields?.jobTitle ?? "",
            readinessStatus: row.profileFields?.readinessStatus ?? "",
            yearsExperience:
              row.profileFields?.yearsExperience !== undefined &&
              row.profileFields?.yearsExperience !== null
                ? row.profileFields.yearsExperience
                : null,
          },
        }))
      );
      setCanMutate(Boolean(data?.capabilities?.canMutate));
      setWarning(data?.warning ?? null);
      setDirectoryNotice(data?.directoryNotice ?? null);
    } catch (e) {
      setMessageTone("error");
      setMessage(
        sanitizeApiErrorMessage(
          e instanceof Error ? e.message : "Failed to load training matrix."
        )
      );
      setRequirements([]);
      setRows([]);
      setSchemaMigrationNeeded(false);
      setWarning(null);
      setDirectoryNotice(null);
    } finally {
      setLoading(false);
      setWorkspaceDataLoaded(true);
    }
  }, []);

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
          renewalMonths: parseRenewalMonthsInput(newRenewalMonths),
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
      setNewRenewalMonths("");
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
    newRenewalMonths,
  ]);

  const startEdit = useCallback((r: Requirement) => {
    setEditingId(r.id);
    const parsed = parseRequirementTitleForEdit(r.title, r.applyPositions ?? []);
    const certUi = certPickerStateFromTrainingLine(parsed.trainingLine);
    setEditProfileCertSelect(certUi.select);
    setEditProfileCertCustom(certUi.custom);
    setEditApplyTrades([...(r.applyTrades ?? [])]);
    setEditApplyPositions(parsed.positions);
    setEditRenewalMonths(
      r.renewalMonths != null && r.renewalMonths > 0 ? String(r.renewalMonths) : ""
    );
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
          renewalMonths: parseRenewalMonthsInput(editRenewalMonths),
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
    editRenewalMonths,
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

  const trackerStats = useMemo(() => {
    if (!rows.length || !requirements.length) return null;
    let met = 0;
    let gap = 0;
    let na = 0;
    for (const row of rows) {
      for (const r of requirements) {
        const s = row.cells[r.id] ?? "gap";
        if (s === "match") met++;
        else if (s === "na") na++;
        else gap++;
      }
    }
    return { met, gap, na, total: met + gap + na };
  }, [rows, requirements]);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-6 shadow-xl ring-1 ring-zinc-700/50 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-400">
              Company workspace
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Training matrix
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Requirements use the same certification list as the construction profile. Configure rules
              below; the command center shows KPIs, charts, and the credential ledger. Load data on demand
              — nothing refreshes in the background.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadMatrix()}
              disabled={loading}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-5 py-3 text-sm font-bold text-zinc-950 shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? workspaceDataLoaded
                  ? "Refreshing…"
                  : "Loading…"
                : workspaceDataLoaded
                  ? "Refresh data"
                  : "Load data"}
            </button>
            <Link
              href="/dashboard"
              className="rounded-xl border border-zinc-600 bg-zinc-900/60 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </section>

      {schemaMigrationNeeded && !schemaMigrationBannerDismissed ? (
        <SchemaMigrationBanner onDismiss={dismissSchemaMigrationBanner} />
      ) : null}
      {directoryNotice && !directoryNoticeDismissed ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
          <div className="min-w-0 flex-1">
            <InlineMessage tone="neutral">{directoryNotice}</InlineMessage>
          </div>
          <button
            type="button"
            onClick={dismissDirectoryNotice}
            className="shrink-0 self-end rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-300 shadow-sm hover:bg-slate-800/70 sm:mt-2 sm:self-start"
          >
            Dismiss
          </button>
        </div>
      ) : null}
      {warning ? <InlineMessage tone="warning">{warning}</InlineMessage> : null}
      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

      {canMutate ? (
        <SectionCard
          title="Required trainings"
          description="Pick a certification from the same list workers use on their construction profile, then choose trades and positions. The saved title adds positions in parentheses."
        >
          <label className="block text-sm font-medium text-slate-300">
            Training requirement
            <select
              value={newProfileCertSelect}
              onChange={(e) => {
                const v = e.target.value;
                setNewProfileCertSelect(v);
                if (v !== CUSTOM_PROFILE_CERT_VALUE) setNewProfileCertCustom("");
              }}
              className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
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
                className="mt-2 w-full rounded-xl border border-slate-600 px-4 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
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
          <label className="mt-4 block text-sm font-medium text-slate-300">
            Typical renewal (months, optional)
            <input
              type="number"
              min={1}
              max={600}
              value={newRenewalMonths}
              onChange={(e) => setNewRenewalMonths(e.target.value)}
              placeholder="e.g. 36"
              className="mt-1 w-full max-w-[200px] rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Policy hint for your team. Actual compliance still uses each worker’s expiration dates on their
              construction profile.
            </span>
          </label>
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
            <ul className="mt-6 space-y-3 border-t border-slate-700/80 pt-6">
              {requirements.map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4"
                >
                  {editingId === r.id ? (
                    <div className="grid gap-3">
                      <label className="block text-xs font-semibold text-slate-400">
                        Training requirement
                        <select
                          value={editProfileCertSelect}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEditProfileCertSelect(v);
                            if (v !== CUSTOM_PROFILE_CERT_VALUE) setEditProfileCertCustom("");
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900/90 px-3 py-2 text-sm font-normal text-slate-100"
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
                            className="mt-2 w-full rounded-xl border border-slate-600 px-3 py-2 text-sm font-normal"
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
                      <label className="block text-xs font-semibold text-slate-400">
                        Typical renewal (months, optional)
                        <input
                          type="number"
                          min={1}
                          max={600}
                          value={editRenewalMonths}
                          onChange={(e) => setEditRenewalMonths(e.target.value)}
                          placeholder="Clear to remove"
                          className="mt-1 w-full max-w-[180px] rounded-xl border border-slate-600 bg-slate-900/90 px-3 py-2 text-sm font-normal text-slate-100"
                        />
                      </label>
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
                          className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm font-semibold text-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-100">{r.title}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Trades: {(r.applyTrades ?? []).join(", ") || "—"}
                        </div>
                        {r.renewalMonths != null && r.renewalMonths > 0 ? (
                          <div className="mt-1 text-xs font-medium text-sky-100">
                            Typical renewal: {r.renewalMonths} mo
                          </div>
                        ) : null}
                        <div className="mt-1 text-sm text-slate-400">
                          {r.matchKeywords.join(" · ")}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(r)}
                          className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-slate-900/90"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(r.id)}
                          className="rounded-lg border border-red-500/35 px-3 py-1.5 text-sm font-semibold text-red-200 hover:bg-red-950/40"
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
              {workspaceDataLoaded
                ? "No requirements yet. Add at least one to populate matrix columns."
                : "Load workspace data (header) to see existing requirements, or add one below — the list refreshes after save."}
            </p>
          )}
        </SectionCard>
      ) : null}

      <ComplianceCommandCenter
        rows={rows}
        requirements={requirements}
        loading={loading}
        workspaceDataLoaded={workspaceDataLoaded}
        warning={warning}
        onRefresh={() => void loadMatrix()}
        footer={
          !loading && rows.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
              <span>
                <span className="font-semibold text-zinc-300">{rows.length}</span> people in this workspace
              </span>
              {trackerStats ? (
                <>
                  <span className="hidden sm:inline text-zinc-600" aria-hidden>
                    ·
                  </span>
                  <span>
                    <span className="font-semibold text-emerald-400">{trackerStats.met}</span> met ·{" "}
                    <span className="font-semibold text-fuchsia-400">{trackerStats.gap}</span> gaps ·{" "}
                    <span className="font-semibold text-zinc-500">{trackerStats.na}</span> not applicable
                  </span>
                  <span className="hidden sm:inline text-zinc-600" aria-hidden>
                    ·
                  </span>
                  <span>{trackerStats.total} requirement checks total</span>
                </>
              ) : null}
            </div>
          ) : null
        }
      >
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/50">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/90">
                <th className="sticky left-0 z-10 min-w-[260px] max-w-[320px] bg-zinc-900 px-4 py-3 font-semibold text-zinc-200 shadow-[1px_0_0_0_rgb(63_63_70)]">
                  Person & field profile
                </th>
                {requirements.map((r) => (
                  <th
                    key={r.id}
                    className="min-w-[156px] border-l border-zinc-800 px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-400"
                    title={requirementHeaderTitle(r)}
                  >
                    <span className="line-clamp-3">{r.title}</span>
                  </th>
                ))}
                <th className="min-w-[300px] border-l border-zinc-800 px-3 py-3 font-semibold text-zinc-200">
                  On-profile certs
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const positionRollup = buildPositionRollup(row, requirements);
                return (
                  <tr key={row.userId} className="border-b border-zinc-800/80 bg-zinc-950/30">
                    <td className="sticky left-0 z-10 min-w-[260px] max-w-[320px] bg-zinc-950 px-4 py-3 align-top shadow-[1px_0_0_0_rgb(63_63_70)]">
                      <div className="font-semibold text-white">{row.name}</div>
                      <div className="text-xs text-zinc-500">{row.email || row.userId}</div>
                      <dl className="mt-2 space-y-1 text-xs text-zinc-300">
                        <div className="flex gap-1">
                          <dt className="shrink-0 font-semibold text-zinc-500">Position</dt>
                          <dd className="min-w-0">{row.profileFields.jobTitle || "—"}</dd>
                        </div>
                        <div className="flex gap-1">
                          <dt className="shrink-0 font-semibold text-zinc-500">Trade</dt>
                          <dd className="min-w-0">{row.profileFields.tradeSpecialty || "—"}</dd>
                        </div>
                        <div className="flex gap-1">
                          <dt className="shrink-0 font-semibold text-zinc-500">Readiness</dt>
                          <dd>{readinessLabel(row.profileFields.readinessStatus)}</dd>
                        </div>
                        {row.profileFields.yearsExperience != null ? (
                          <div className="flex gap-1">
                            <dt className="shrink-0 font-semibold text-zinc-500">Experience</dt>
                            <dd>{row.profileFields.yearsExperience} yr</dd>
                          </div>
                        ) : null}
                      </dl>
                      <PositionScopeSummary
                        rollup={positionRollup}
                        requirementsCount={requirements.length}
                        theme="dark"
                      />
                      <div className="mt-2 text-[11px] text-zinc-600">Workspace access: {row.role}</div>
                      <Link
                        href={`/profile?userId=${encodeURIComponent(row.userId)}&returnTo=${encodeURIComponent("/training-matrix")}`}
                        className="mt-2 inline-block text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:underline"
                      >
                        Update profile & dates
                      </Link>
                    </td>
                    {requirements.map((r) => {
                      const state = row.cells[r.id] ?? "gap";
                      const d = row.cellDetails?.[r.id];
                      const tip = requirementCellTitle(r, d, state);
                      return (
                        <td
                          key={r.id}
                          className="border-l border-zinc-800/80 px-2 py-2 align-top text-center"
                          title={tip}
                        >
                          <div className="flex flex-col items-center gap-1">
                            {state === "match" ? (
                              <span className="inline-flex text-emerald-400">
                                <Check className="h-5 w-5 shrink-0" aria-hidden />
                                <span className="sr-only">Met</span>
                              </span>
                            ) : state === "na" ? (
                              <span className="inline-flex text-zinc-600">
                                <Minus className="h-5 w-5 shrink-0" aria-hidden />
                                <span className="sr-only">Not applicable</span>
                              </span>
                            ) : (
                              <span className="inline-flex text-fuchsia-400">
                                <X className="h-5 w-5 shrink-0" aria-hidden />
                                <span className="sr-only">Gap</span>
                              </span>
                            )}
                            {state === "match" ? (
                              <>
                                {d?.matchSource === "certifications" && d.matchedLabel ? (
                                  <p className="line-clamp-3 w-full text-[10px] font-medium leading-snug text-zinc-200">
                                    {d.matchedLabel}
                                  </p>
                                ) : d?.matchSource === "job_title" || d?.matchSource === "trade_specialty" ? (
                                  <p className="text-[10px] font-semibold leading-snug text-cyan-300">
                                    Via {d.matchSource === "job_title" ? "position" : "trade"} match
                                  </p>
                                ) : null}
                                {d?.expiryStatus === "soon" ? (
                                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200 ring-1 ring-amber-500/40">
                                    Expiring soon
                                  </span>
                                ) : null}
                                {(d?.expiryStatus === "soon" || d?.expiryStatus === "ok") && d.expiresOn ? (
                                  <span className="text-[10px] leading-tight text-zinc-500">
                                    {cellExpiryCaption(d)}
                                  </span>
                                ) : null}
                                {d?.matchSource === "certifications" && d.expiryStatus === "none" ? (
                                  <span className="text-[10px] text-zinc-500">No expiry on file</span>
                                ) : null}
                              </>
                            ) : null}
                            {state === "gap" ? (
                              <div className="w-full text-left">
                                <p className="text-[10px] font-bold text-amber-300">Missing</p>
                                {d?.gapKeywords?.length ? (
                                  <p className="mt-0.5 line-clamp-4 text-[10px] leading-snug text-zinc-400">
                                    {d.gapKeywords.join(" · ")}
                                  </p>
                                ) : (
                                  <p className="mt-0.5 text-[10px] text-zinc-500">Add matching training</p>
                                )}
                              </div>
                            ) : null}
                            {state === "na" ? (
                              <p className="text-[10px] text-zinc-600">Out of scope</p>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                    <td className="border-l border-zinc-800/80 px-3 py-3 align-top">
                      <div className="space-y-2">
                        {row.certificationInventory && row.certificationInventory.length > 0 ? (
                          <ul className="space-y-1.5">
                            {row.certificationInventory.map((item) => {
                              const t = ledgerChipToneDark(item.expiryStatus);
                              return (
                                <li
                                  key={item.name}
                                  className={`rounded-lg px-2 py-1.5 text-xs ring-1 ${t.wrap}`}
                                >
                                  <div className="flex items-start gap-2">
                                    <span
                                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`}
                                      aria-hidden
                                    />
                                    <div className="min-w-0">
                                      <div className="font-semibold leading-snug text-white">{item.name}</div>
                                      <div className="mt-0.5 text-[11px] opacity-90">
                                        {item.expiryStatus === "expired" && item.expiresOn
                                          ? `Expired ${item.expiresOn}`
                                          : item.expiryStatus === "soon" && item.expiresOn
                                            ? `Expires ${item.expiresOn} · ${item.daysUntilExpiry}d left`
                                            : item.expiryStatus === "ok" && item.expiresOn
                                              ? `Good through ${item.expiresOn}`
                                              : "No expiration date on file"}
                                      </div>
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <span className="text-sm text-zinc-600">No certifications on profile.</span>
                        )}
                        {row.unmatchedCertifications.length > 0 ? (
                          <div className="border-t border-dashed border-zinc-700 pt-2">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-violet-300">
                              Not applied to any requirement
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {row.unmatchedCertifications.map((c) => (
                                <span
                                  key={c}
                                  className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-200 ring-1 ring-violet-500/40"
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ComplianceCommandCenter>
    </div>
  );
}
