import {
  buildAdoptionChecklist,
  type AdoptionChecklistInput,
  type AdoptionChecklistSummary,
} from "@/components/dashboard/onboardingChecklist";
import { normalizeCompanySubscriptionStatus } from "@/lib/companySeats";

export type RevenueReadinessCompanyProfile = AdoptionChecklistInput["companyProfile"] & {
  pilot_trial_ends_at?: string | null;
  pilot_converted_at?: string | null;
  status?: string | null;
};

export type RevenueReadinessSubscription = {
  status?: string | null;
  planName?: string | null;
  maxUserSeats?: number | null;
  seatsUsed?: number | null;
  subscriptionPriceCents?: number | null;
  seatPriceCents?: number | null;
  failedPaymentCount?: number | null;
};

export type RevenueReadinessInput = {
  companyProfile?: RevenueReadinessCompanyProfile | null;
  companyUsers?: Array<{ status?: string | null; last_sign_in_at?: string | null }>;
  companyInvites?: Array<{ status?: string | null }>;
  jobsites?: Array<{ status?: string | null }>;
  documents?: Array<{
    status?: string | null;
    final_file_path?: string | null;
    draft_file_path?: string | null;
  }>;
  onboarding?: {
    commandCenterViewed?: boolean;
    completedSteps?: string[];
  } | null;
  subscription?: RevenueReadinessSubscription | null;
  work?: {
    correctiveActions?: Array<{ status?: string | null; due_at?: string | null; closed_at?: string | null }>;
    incidents?: Array<{ status?: string | null }>;
    permits?: Array<{ status?: string | null; stop_work_status?: string | null }>;
    jsas?: Array<{ status?: string | null }>;
    reports?: Array<{ status?: string | null }>;
  };
  riskMemory?: {
    score?: number | null;
    previousScore?: number | null;
    recommendationCount?: number | null;
  } | null;
  now?: Date;
};

export type RevenueReadinessSignalTone = "success" | "warning" | "error" | "info" | "neutral";

export type RevenueReadinessSignal = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: RevenueReadinessSignalTone;
  href?: string;
};

export type RevenueReadinessAction = {
  id: string;
  label: string;
  detail: string;
  href: string;
  priority: "high" | "medium" | "low";
};

export type RevenueReadinessSummary = {
  score: number;
  band: "Ready to sell" | "Pilot healthy" | "Needs attention" | "At risk";
  adoption: AdoptionChecklistSummary;
  activationPercent: number;
  operationsPercent: number;
  billingPercent: number;
  retentionPercent: number;
  signals: RevenueReadinessSignal[];
  nextActions: RevenueReadinessAction[];
  counts: {
    activeUsers: number;
    invitedUsers: number;
    activeJobsites: number;
    documentsStarted: number;
    openWork: number;
    overdueWork: number;
    stopWorkItems: number;
  };
};

function normalized(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function isActiveStatus(status?: string | null) {
  const value = normalized(status);
  return value !== "inactive" && value !== "archived" && value !== "closed";
}

function isClosedWorkStatus(status?: string | null) {
  return ["closed", "complete", "completed", "verified_closed", "approved", "resolved"].includes(
    normalized(status)
  );
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function daysUntil(dateIso: string | null | undefined, now: Date) {
  if (!dateIso) return null;
  const ms = new Date(dateIso).getTime() - now.getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.ceil(ms / 86400000);
}

function daysSince(dateIso: string | null | undefined, now: Date) {
  if (!dateIso) return null;
  const ms = now.getTime() - new Date(dateIso).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 86400000);
}

function formatPercent(value: number) {
  return `${clampPercent(value)}%`;
}

function scoreBand(score: number): RevenueReadinessSummary["band"] {
  if (score >= 82) return "Ready to sell";
  if (score >= 65) return "Pilot healthy";
  if (score >= 42) return "Needs attention";
  return "At risk";
}

function firstIncompleteAction(adoption: AdoptionChecklistSummary): RevenueReadinessAction | null {
  const next = adoption.nextItem;
  if (!next) return null;
  return {
    id: `onboarding-${next.id}`,
    label: next.label,
    detail: next.note,
    href: next.href,
    priority: "high",
  };
}

export function buildRevenueReadinessSummary(
  input: RevenueReadinessInput
): RevenueReadinessSummary {
  const now = input.now ?? new Date();
  const companyUsers = input.companyUsers ?? [];
  const companyInvites = input.companyInvites ?? [];
  const jobsites = input.jobsites ?? [];
  const documents = input.documents ?? [];
  const correctiveActions = input.work?.correctiveActions ?? [];
  const incidents = input.work?.incidents ?? [];
  const permits = input.work?.permits ?? [];
  const jsas = input.work?.jsas ?? [];
  const reports = input.work?.reports ?? [];
  const commandCenterViewed =
    Boolean(input.onboarding?.commandCenterViewed) ||
    Boolean(input.onboarding?.completedSteps?.includes("command_center"));

  const adoption = buildAdoptionChecklist({
    companyProfile: input.companyProfile,
    companyUsers,
    companyInvites,
    jobsites,
    documents,
    commandCenterViewed,
  });

  const activeUsers = companyUsers.filter((user) => isActiveStatus(user.status)).length;
  const invitedUsers = companyInvites.filter((invite) => isActiveStatus(invite.status)).length;
  const activeJobsites = jobsites.filter((jobsite) => isActiveStatus(jobsite.status)).length;
  const documentsStarted = documents.filter(
    (document) =>
      Boolean((document.final_file_path ?? "").trim()) ||
      Boolean((document.draft_file_path ?? "").trim()) ||
      Boolean((document.status ?? "").trim())
  ).length;

  const workRows = [
    ...correctiveActions,
    ...incidents,
    ...permits,
    ...jsas,
    ...reports,
  ];
  const openWork = workRows.filter((row) => !isClosedWorkStatus(row.status)).length;
  const closedWork = workRows.length - openWork;
  const overdueWork = correctiveActions.filter(
    (row) =>
      !isClosedWorkStatus(row.status) &&
      Boolean(row.due_at) &&
      new Date(row.due_at as string).getTime() < now.getTime()
  ).length;
  const stopWorkItems = permits.filter(
    (permit) => normalized(permit.stop_work_status) === "stop_work_active"
  ).length;

  const adoptionPercent =
    adoption.totalCount > 0 ? (adoption.completedCount / adoption.totalCount) * 100 : 0;
  const activationPercent = clampPercent(
    (activeUsers > 0 ? 25 : 0) +
      (activeUsers + invitedUsers > 1 ? 20 : 0) +
      (activeJobsites > 0 ? 25 : 0) +
      (documentsStarted > 0 ? 20 : 0) +
      (commandCenterViewed ? 10 : 0)
  );
  const operationsPercent = clampPercent(
    workRows.length === 0
      ? activeJobsites > 0
        ? 55
        : 25
      : (closedWork / workRows.length) * 70 +
          (overdueWork === 0 ? 20 : 0) +
          (stopWorkItems === 0 ? 10 : 0)
  );

  const subscriptionStatus = normalizeCompanySubscriptionStatus(input.subscription?.status ?? null);
  const maxSeats = input.subscription?.maxUserSeats ?? null;
  const seatsUsed = input.subscription?.seatsUsed ?? activeUsers + invitedUsers;
  const hasPricing =
    input.subscription?.subscriptionPriceCents != null || input.subscription?.seatPriceCents != null;
  const failedPaymentCount = input.subscription?.failedPaymentCount ?? 0;
  const billingPercent = clampPercent(
    (subscriptionStatus === "active" ? 45 : 0) +
      (maxSeats == null || seatsUsed <= maxSeats ? 20 : 0) +
      (hasPricing ? 20 : 8) +
      (failedPaymentCount === 0 ? 15 : 0)
  );

  const recentActiveUsers = companyUsers.filter((user) => {
    const seen = daysSince(user.last_sign_in_at, now);
    return seen != null && seen <= 14;
  }).length;
  const trialDaysRemaining = daysUntil(input.companyProfile?.pilot_trial_ends_at, now);
  const converted = Boolean(input.companyProfile?.pilot_converted_at);
  const retentionPercent = clampPercent(
    (recentActiveUsers > 0 ? 35 : activeUsers > 0 ? 18 : 0) +
      (converted
        ? 35
        : trialDaysRemaining == null
          ? 18
          : trialDaysRemaining >= 14
            ? 24
            : trialDaysRemaining >= 0
              ? 12
              : 0) +
      (input.riskMemory?.recommendationCount ? 15 : 5) +
      (adoption.completedCount >= Math.ceil(adoption.totalCount * 0.6) ? 15 : 0)
  );

  const score = clampPercent(
    adoptionPercent * 0.25 +
      activationPercent * 0.25 +
      operationsPercent * 0.18 +
      billingPercent * 0.18 +
      retentionPercent * 0.14
  );

  const signals: RevenueReadinessSignal[] = [
    {
      id: "adoption",
      label: "Launch progress",
      value: `${adoption.completedCount}/${adoption.totalCount}`,
      detail: adoption.nextItem ? `Next: ${adoption.nextItem.label}` : "Launch checklist is complete.",
      tone: adoption.nextItem ? "warning" : "success",
      href: adoption.nextItem?.href,
    },
    {
      id: "activation",
      label: "Activation",
      value: formatPercent(activationPercent),
      detail: `${activeUsers} active users, ${activeJobsites} active jobsites, ${documentsStarted} documents started.`,
      tone: activationPercent >= 70 ? "success" : activationPercent >= 40 ? "warning" : "error",
    },
    {
      id: "operations",
      label: "Open work",
      value: String(openWork),
      detail:
        overdueWork > 0
          ? `${overdueWork} overdue items need attention.`
          : stopWorkItems > 0
            ? `${stopWorkItems} stop-work items are active.`
            : `${closedWork} closed items across the workspace.`,
      tone: overdueWork > 0 || stopWorkItems > 0 ? "warning" : "success",
      href: "/command-center",
    },
    {
      id: "billing",
      label: "Billing readiness",
      value: formatPercent(billingPercent),
      detail:
        subscriptionStatus === "active"
          ? maxSeats != null
            ? `${seatsUsed}/${maxSeats} seats used on ${input.subscription?.planName ?? "current"} plan.`
            : `${seatsUsed} seats used on ${input.subscription?.planName ?? "current"} plan.`
          : "Subscription is not active yet.",
      tone: billingPercent >= 75 ? "success" : subscriptionStatus === "active" ? "warning" : "error",
      href: "/billing",
    },
    {
      id: "retention",
      label: "Renewal signal",
      value: formatPercent(retentionPercent),
      detail:
        trialDaysRemaining != null && !converted
          ? trialDaysRemaining >= 0
            ? `${trialDaysRemaining} trial days remaining.`
            : `Trial ended ${Math.abs(trialDaysRemaining)} days ago.`
          : converted
            ? "Pilot has converted."
            : `${recentActiveUsers} users active in the last 14 days.`,
      tone: retentionPercent >= 70 ? "success" : retentionPercent >= 40 ? "warning" : "error",
    },
  ];

  const nextActions: RevenueReadinessAction[] = [
    firstIncompleteAction(adoption),
    subscriptionStatus !== "active"
      ? {
          id: "activate-subscription",
          label: "Activate billing access",
          detail: "Set the company subscription active before inviting and expanding the team.",
          href: "/admin/companies",
          priority: "high" as const,
        }
      : null,
    maxSeats != null && seatsUsed > maxSeats
      ? {
          id: "raise-seat-cap",
          label: "Resolve seat overage",
          detail: `${seatsUsed} seats are in use against a ${maxSeats}-seat cap.`,
          href: "/company-users",
          priority: "high" as const,
        }
      : null,
    overdueWork > 0
      ? {
          id: "clear-overdue-work",
          label: "Clear overdue work",
          detail: `${overdueWork} corrective actions are overdue.`,
          href: "/command-center",
          priority: "medium" as const,
        }
      : null,
    input.riskMemory?.recommendationCount
      ? {
          id: "review-risk-memory",
          label: "Review Risk Memory recommendations",
          detail: `${input.riskMemory.recommendationCount} recommendations can be converted into follow-up work.`,
          href: "/command-center",
          priority: "medium" as const,
        }
      : null,
  ].filter((action): action is RevenueReadinessAction => Boolean(action));

  return {
    score,
    band: scoreBand(score),
    adoption,
    activationPercent,
    operationsPercent,
    billingPercent,
    retentionPercent,
    signals,
    nextActions: nextActions.slice(0, 5),
    counts: {
      activeUsers,
      invitedUsers,
      activeJobsites,
      documentsStarted,
      openWork,
      overdueWork,
      stopWorkItems,
    },
  };
}
