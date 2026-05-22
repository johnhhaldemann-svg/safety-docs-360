import type { GusMessage } from "@/lib/gus/gusTypes";

export type GusAction = Pick<GusMessage, "actionLabel" | "actionHref" | "actionKey">;

export const gusDefaultActions = {
  openDashboard: {
    actionLabel: "Review dashboard",
    actionHref: "/dashboard",
    actionKey: "guide_to_dashboard",
  },
  openJobsites: {
    actionLabel: "Open jobsites",
    actionHref: "/jobsites",
    actionKey: "guide_to_jobsites",
  },
  openJsa: {
    actionLabel: "Review JSAs",
    actionHref: "/jsa",
    actionKey: "guide_to_jsa",
  },
  openPermits: {
    actionLabel: "Review permits",
    actionHref: "/permits",
    actionKey: "guide_to_permits",
  },
  openTraining: {
    actionLabel: "Check training",
    actionHref: "/training",
    actionKey: "guide_to_training",
  },
  openDocuments: {
    actionLabel: "Open documents",
    actionHref: "/documents",
    actionKey: "guide_to_documents",
  },
} as const satisfies Record<string, GusAction>;
