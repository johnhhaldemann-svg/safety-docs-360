import type { DashboardRole } from "@/lib/dashboardRole";
import type { PermissionMap } from "@/lib/rbac";
import type {
  DashboardAvailableBlock,
  DashboardBlockId,
} from "@/components/dashboard/types";

export const DASHBOARD_BLOCK_IDS: DashboardBlockId[] = [
  "metric_primary",
  "metric_secondary",
  "metric_tertiary",
  "metric_quaternary",
  "priority_queue",
  "next_actions",
  "recent_activity",
  "recent_documents",
  "recent_reports",
  "risk_ranking",
  "hazard_trends",
  "support_signals",
  "company_access",
  "training_signal",
  "permit_followups",
  "incident_followups",
  "graph_hazard_trends",
  "graph_jobsite_risk",
  "graph_observation_mix",
];

const DASHBOARD_BLOCK_META: Record<
  DashboardBlockId,
  Omit<DashboardAvailableBlock, "id">
> = {
  metric_primary: {
    title: "Primary metric",
    description: "The leading live metric for this role.",
  },
  metric_secondary: {
    title: "Secondary metric",
    description: "A supporting metric from the current dashboard summary.",
  },
  metric_tertiary: {
    title: "Tertiary metric",
    description: "An additional live metric from the dashboard header area.",
  },
  metric_quaternary: {
    title: "Quaternary metric",
    description: "The fourth KPI metric from the role dashboard.",
  },
  priority_queue: {
    title: "Priority queue",
    description: "The items that need attention first.",
  },
  next_actions: {
    title: "Next actions",
    description: "Recommended next steps for the current user.",
  },
  recent_activity: {
    title: "Recent activity",
    description: "Latest activity already shown on the dashboard.",
  },
  recent_documents: {
    title: "Recent documents",
    description: "Recent documents visible to this account.",
  },
  recent_reports: {
    title: "Recent reports",
    description: "Recent reports and submission signals.",
  },
  risk_ranking: {
    title: "Risk ranking",
    description: "Risk ranking or related workspace prioritization.",
  },
  hazard_trends: {
    title: "Hazard trends",
    description: "Recurring hazard and trend signals.",
  },
  support_signals: {
    title: "Support signals",
    description: "Helpful secondary dashboard context.",
  },
  company_access: {
    title: "Company access",
    description: "User, account, or access-related signals.",
  },
  training_signal: {
    title: "Training signal",
    description: "Training and readiness indicators.",
  },
  permit_followups: {
    title: "Permit follow-ups",
    description: "Open permit-related follow-up items.",
  },
  incident_followups: {
    title: "Incident follow-ups",
    description: "Open incident-related follow-up items.",
  },
  graph_hazard_trends: {
    title: "Hazard trend graph",
    description: "A bar graph of the top hazard categories in the current analytics window.",
  },
  graph_jobsite_risk: {
    title: "Jobsite risk graph",
    description: "A bar graph ranking jobsites by combined risk score.",
  },
  graph_observation_mix: {
    title: "Observation mix graph",
    description: "A bar graph of near misses, hazards, positives, inspections, and DAPs.",
  },
};

const ROLE_DEFAULT_LAYOUTS: Record<DashboardRole, DashboardBlockId[]> = {
  company_admin: [
    "metric_primary",
    "metric_secondary",
    "metric_tertiary",
    "metric_quaternary",
    "priority_queue",
    "next_actions",
    "recent_activity",
    "risk_ranking",
    "hazard_trends",
    "support_signals",
  ],
  safety_manager: [
    "metric_primary",
    "metric_secondary",
    "metric_tertiary",
    "metric_quaternary",
    "priority_queue",
    "next_actions",
    "recent_activity",
    "hazard_trends",
    "permit_followups",
    "incident_followups",
  ],
  field_supervisor: [
    "metric_primary",
    "metric_secondary",
    "metric_tertiary",
    "metric_quaternary",
    "priority_queue",
    "next_actions",
    "recent_activity",
    "permit_followups",
    "incident_followups",
    "support_signals",
  ],
  default: [
    "metric_primary",
    "metric_secondary",
    "metric_tertiary",
    "metric_quaternary",
    "priority_queue",
    "next_actions",
    "recent_activity",
    "recent_documents",
    "support_signals",
    "training_signal",
  ],
};

function uniq(ids: DashboardBlockId[]) {
  return [...new Set(ids)];
}

export function isDashboardBlockId(value: unknown): value is DashboardBlockId {
  return typeof value === "string" && DASHBOARD_BLOCK_IDS.includes(value as DashboardBlockId);
}

export function getDashboardBlockMeta(id: DashboardBlockId): DashboardAvailableBlock {
  return {
    id,
    ...DASHBOARD_BLOCK_META[id],
  };
}

export function getDashboardRoleDefaultLayout(role: DashboardRole): DashboardBlockId[] {
  return [...ROLE_DEFAULT_LAYOUTS[role]];
}

export function getAvailableDashboardBlockIds(params: {
  role: DashboardRole;
  permissionMap?: PermissionMap | null;
}): DashboardBlockId[] {
  const { role, permissionMap } = params;
  const ids = new Set<DashboardBlockId>(DASHBOARD_BLOCK_IDS);

  if (
    role !== "company_admin" &&
    !permissionMap?.can_manage_company_users &&
    !permissionMap?.can_manage_users
  ) {
    ids.delete("company_access");
  }

  if (
    !permissionMap?.can_view_analytics &&
    !permissionMap?.can_view_reports &&
    role === "default"
  ) {
    ids.delete("risk_ranking");
  }

  const available = [...ids];
  if (available.length >= 10) {
    return available;
  }

  return [...DASHBOARD_BLOCK_IDS];
}

export function getAvailableDashboardBlocks(params: {
  role: DashboardRole;
  permissionMap?: PermissionMap | null;
}): DashboardAvailableBlock[] {
  return getAvailableDashboardBlockIds(params).map(getDashboardBlockMeta);
}

export function normalizeDashboardLayout(params: {
  layout?: unknown;
  defaultLayout: DashboardBlockId[];
  availableBlockIds: DashboardBlockId[];
}) {
  const { layout, defaultLayout, availableBlockIds } = params;
  const allowed = new Set(availableBlockIds);

  const saved = Array.isArray(layout)
    ? uniq(layout.filter((item): item is DashboardBlockId => isDashboardBlockId(item) && allowed.has(item)))
    : [];
  const defaults = uniq(defaultLayout.filter((item) => allowed.has(item)));
  const fallbacks = uniq(availableBlockIds.filter((item) => allowed.has(item)));

  return uniq([...saved, ...defaults, ...fallbacks]).slice(0, 10);
}

export function validateDashboardLayout(params: {
  layout: unknown;
  availableBlockIds: DashboardBlockId[];
}):
  | { ok: true; layout: DashboardBlockId[] }
  | { ok: false; error: string } {
  const { layout, availableBlockIds } = params;
  if (!Array.isArray(layout)) {
    return { ok: false, error: "Dashboard layout must be an array of block ids." };
  }

  if (layout.length !== 10) {
    return { ok: false, error: "Dashboard layout must contain exactly 10 blocks." };
  }

  const allowed = new Set(availableBlockIds);
  const parsed: DashboardBlockId[] = [];

  for (const item of layout) {
    if (!isDashboardBlockId(item)) {
      return { ok: false, error: `Unknown dashboard block id: ${String(item)}` };
    }
    if (!allowed.has(item)) {
      return { ok: false, error: `Dashboard block is not available for this user: ${item}` };
    }
    parsed.push(item);
  }

  if (new Set(parsed).size !== parsed.length) {
    return { ok: false, error: "Dashboard layout cannot contain duplicate blocks." };
  }

  return { ok: true, layout: parsed };
}

export function areDashboardLayoutsEqual(
  left: readonly DashboardBlockId[] | null | undefined,
  right: readonly DashboardBlockId[] | null | undefined
) {
  if (!left || !right || left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

export function getDashboardSlotOptionIds(params: {
  layout: readonly DashboardBlockId[];
  availableBlockIds: readonly DashboardBlockId[];
  slotIndex: number;
}) {
  const { layout, availableBlockIds, slotIndex } = params;
  const current = layout[slotIndex];

  return availableBlockIds.filter((id) => {
    if (id === current) {
      return true;
    }

    return !layout.some((value, index) => index !== slotIndex && value === id);
  });
}
