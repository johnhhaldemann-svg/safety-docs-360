"use client";

import {
  APP_PERMISSIONS,
  type AppPermission,
  type PermissionOverrides,
  normalizePermissionOverrides,
  setPermissionOverride,
} from "@/lib/permissionOverrides";

type Props = {
  title: string;
  description?: string;
  value: PermissionOverrides;
  onChange: (value: PermissionOverrides) => void;
};

function formatPermissionLabel(permission: AppPermission) {
  const labels: Partial<Record<AppPermission, string>> = {
    can_access_document_library: "Documents Page",
    can_access_template_marketplace: "Template Marketplace Page",
    can_access_jobsites: "Job Sites Pages",
    can_access_field_audits: "Field Audits Page",
    can_access_field_work: "Field Work Pages",
    can_access_training: "Training Pages",
    can_access_safety_intelligence: "Safety Intelligence Pages",
    can_access_billing: "Billing & Purchases Pages",
  };

  return labels[permission] ?? permission
    .replace(/^can_/, "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPermissionHelp(permission: AppPermission) {
  const help: Partial<Record<AppPermission, string>> = {
    can_access_document_library: "Controls /documents and /search.",
    can_access_template_marketplace: "Controls marketplace tabs, purchases, and preview requests.",
    can_access_jobsites: "Controls /jobsites and jobsite detail pages.",
    can_access_field_audits: "Controls /field-audits.",
    can_access_field_work: "Controls issue log, JSA, permits, and incidents pages.",
    can_access_training: "Controls training matrix and contractor compliance pages.",
    can_access_safety_intelligence: "Controls Safety Intelligence, workflow activity, and risk memory pages.",
    can_access_billing: "Controls customer billing and purchases pages.",
  };

  return help[permission] ?? null;
}

export function PermissionOverridesEditor({ title, description, value, onChange }: Props) {
  const normalized = normalizePermissionOverrides(value);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
      </div>

      <div className="grid gap-3">
        {APP_PERMISSIONS.map((permission) => {
          const current = normalized.allow.includes(permission)
            ? "allow"
            : normalized.deny.includes(permission)
              ? "deny"
              : "inherit";

          return (
            <div
              key={permission}
              className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    {formatPermissionLabel(permission)}
                  </div>
                  <div className="text-xs text-slate-500">{permission}</div>
                  {formatPermissionHelp(permission) ? (
                    <div className="mt-1 text-xs text-slate-400">
                      {formatPermissionHelp(permission)}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["inherit", "allow", "deny"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onChange(setPermissionOverride(value, permission, mode))}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        current === mode
                          ? mode === "allow"
                            ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30"
                            : mode === "deny"
                              ? "bg-red-500/20 text-red-200 ring-1 ring-red-400/30"
                              : "bg-slate-500/20 text-slate-100 ring-1 ring-slate-400/30"
                          : "bg-slate-900 text-slate-400 hover:bg-slate-800"
                      }`}
                    >
                      {mode === "inherit" ? "Inherit" : mode === "allow" ? "Allow" : "Deny"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
