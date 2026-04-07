"use client";

import type { AppPermission, PermissionOverrides } from "@/lib/rbac";
import { APP_PERMISSIONS, normalizePermissionOverrides, setPermissionOverride } from "@/lib/rbac";

type PermissionGroup = {
  title: string;
  description: string;
  permissions: AppPermission[];
};

const PERMISSION_LABELS: Record<
  AppPermission,
  {
    label: string;
    description: string;
  }
> = {
  can_create_documents: {
    label: "Create documents",
    description: "Start new company records and draft submissions.",
  },
  can_edit_documents: {
    label: "Edit documents",
    description: "Modify drafts and update in-progress records.",
  },
  can_submit_documents: {
    label: "Submit documents",
    description: "Send records forward for review or approval.",
  },
  can_review_documents: {
    label: "Review documents",
    description: "Check submissions and leave them in review.",
  },
  can_approve_documents: {
    label: "Approve documents",
    description: "Finalize documents and mark them approved.",
  },
  can_manage_users: {
    label: "Manage users",
    description: "Invite, edit, and maintain workspace accounts.",
  },
  can_manage_company_users: {
    label: "Manage company users",
    description: "Administer people inside a company workspace.",
  },
  can_manage_billing: {
    label: "Manage billing",
    description: "Update seats, subscriptions, and payment-related settings.",
  },
  can_view_analytics: {
    label: "View analytics",
    description: "Open charts, trends, and workspace reporting views.",
  },
  can_assign_roles: {
    label: "Assign roles",
    description: "Move users into higher or lower access levels.",
  },
  can_access_internal_admin: {
    label: "Access internal admin",
    description: "Open internal admin pages and controls.",
  },
  can_view_all_company_data: {
    label: "View all company data",
    description: "See full workspace records across the company.",
  },
  can_manage_global_templates: {
    label: "Manage global templates",
    description: "Change shared templates available across workspaces.",
  },
  can_override_system_controls: {
    label: "Override system controls",
    description: "Bypass selected system-level locks or safety defaults.",
  },
  can_manage_daps: {
    label: "Manage DAPs",
    description: "Work with daily activity and action planning tools.",
  },
  can_manage_observations: {
    label: "Manage observations",
    description: "Create and maintain safety observations.",
  },
  can_verify_closures: {
    label: "Verify closures",
    description: "Confirm corrective items are finished correctly.",
  },
  can_escalate_items: {
    label: "Escalate items",
    description: "Push urgent work or risks to higher review.",
  },
  can_view_dashboards: {
    label: "View dashboards",
    description: "Open dashboard and workspace overview pages.",
  },
  can_view_reports: {
    label: "View reports",
    description: "Access reporting and summary views.",
  },
};

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: "Documents",
    description: "Controls around creating, reviewing, and approving records.",
    permissions: [
      "can_create_documents",
      "can_edit_documents",
      "can_submit_documents",
      "can_review_documents",
      "can_approve_documents",
      "can_manage_global_templates",
    ],
  },
  {
    title: "People & access",
    description: "User, billing, and role-management functions.",
    permissions: [
      "can_manage_users",
      "can_manage_company_users",
      "can_manage_billing",
      "can_assign_roles",
      "can_access_internal_admin",
    ],
  },
  {
    title: "Safety operations",
    description: "Operational tools for safety workflows and follow-up.",
    permissions: [
      "can_manage_daps",
      "can_manage_observations",
      "can_verify_closures",
      "can_escalate_items",
      "can_override_system_controls",
    ],
  },
  {
    title: "Visibility",
    description: "Dashboards, analytics, and reporting access.",
    permissions: ["can_view_dashboards", "can_view_reports", "can_view_analytics", "can_view_all_company_data"],
  },
];

function getPermissionState(overrides: PermissionOverrides, permission: AppPermission) {
  if (overrides.allow.includes(permission)) return "allow";
  if (overrides.deny.includes(permission)) return "deny";
  return "inherit";
}

function toneClasses(state: "inherit" | "allow" | "deny") {
  if (state === "allow") {
    return "border-emerald-400/40 bg-emerald-500/15 text-emerald-100";
  }
  if (state === "deny") {
    return "border-red-400/40 bg-red-500/15 text-red-100";
  }
  return "border-slate-600 bg-slate-950/45 text-slate-300";
}

export function PermissionOverridesEditor({
  value,
  onChange,
  title = "Function access",
  description = "Choose which functions this scope explicitly allows or blocks. Leave an item as Inherit to keep the parent workspace or role setting.",
}: {
  value: PermissionOverrides | null | undefined;
  onChange: (next: PermissionOverrides) => void;
  title?: string;
  description?: string;
}) {
  const overrides = normalizePermissionOverrides(value ?? null);
  const allowCount = overrides.allow.length;
  const denyCount = overrides.deny.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-100">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5">
            {allowCount} allowed
          </span>
          <span className="rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1.5">
            {denyCount} blocked
          </span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {PERMISSION_GROUPS.map((group) => (
          <section
            key={group.title}
            className="rounded-2xl border border-slate-700/80 bg-slate-950/35 p-4"
          >
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">
                {group.title}
              </h4>
              <p className="mt-1 text-sm leading-6 text-slate-500">{group.description}</p>
            </div>

            <div className="mt-4 space-y-3">
              {group.permissions.map((permission) => {
                const state = getPermissionState(overrides, permission);
                const meta = PERMISSION_LABELS[permission];

                return (
                  <div
                    key={permission}
                    className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-xl">
                        <p className="text-sm font-semibold text-slate-100">{meta.label}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-400">{meta.description}</p>
                      </div>
                      <div className="inline-flex overflow-hidden rounded-xl border border-slate-600 bg-slate-950/70 p-1">
                        {(["inherit", "allow", "deny"] as const).map((mode) => {
                          const selected = state === mode;
                          const modeLabel =
                            mode === "inherit" ? "Inherit" : mode === "allow" ? "Allow" : "Block";
                          return (
                            <button
                              key={mode}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => onChange(setPermissionOverride(overrides, permission, mode))}
                              className={`min-w-[4.5rem] rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${
                                selected
                                  ? mode === "allow"
                                    ? "bg-emerald-500/20 text-emerald-100"
                                    : mode === "deny"
                                      ? "bg-red-500/20 text-red-100"
                                      : "bg-slate-700 text-slate-100"
                                  : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-200"
                              }`}
                            >
                              {modeLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${toneClasses(
                          state
                        )}`}
                      >
                        {state}
                      </span>
                      <span className="text-xs text-slate-500">
                        {state === "inherit"
                          ? "Uses parent workspace or role defaults."
                          : state === "allow"
                            ? "Explicitly enabled for this scope."
                            : "Explicitly blocked for this scope."}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
