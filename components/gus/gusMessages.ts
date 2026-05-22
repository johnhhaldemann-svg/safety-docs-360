import type { GusMessage } from "@/lib/gus/gusTypes";
import { gusDefaultActions } from "@/components/gus/gusActions";

type RouteMessage = {
  route: string;
  message: GusMessage;
};

export const gusFallbackMessage: GusMessage = {
  messageId: "gus-default-safety-tip",
  category: "safety_tip",
  priority: 3,
  message: "I can help spot missing safety items, draft planning notes, and point you to the right workspace.",
  reason: "Gus is in draft-assist mode and will not approve work or submit official records.",
  ...gusDefaultActions.openDashboard,
};

export const gusRouteMessages: RouteMessage[] = [
  {
    route: "/dashboard",
    message: {
      messageId: "gus-dashboard-review",
      category: "greeting",
      priority: 2,
      message: "Good place to start. Review the highest-risk signals before crews begin field work.",
      reason: "Dashboard checks can surface overdue training, open permits, observations, and risk trends.",
      ...gusDefaultActions.openDashboard,
    },
  },
  {
    route: "/companies",
    message: {
      messageId: "gus-company-context",
      category: "learning",
      priority: 2,
      message: "Company patterns matter. I can use company context later to highlight repeated safety themes.",
      reason: "Repeated observations and training gaps are often better predictors than one-off events.",
      ...gusDefaultActions.openJobsites,
    },
  },
  {
    route: "/jobsites",
    message: {
      messageId: "gus-jobsite-focus",
      category: "risk_alert",
      priority: 1,
      message: "Before work starts, check jobsite-specific permits, JSAs, training, and recent observations.",
      reason: "Jobsite pages are the right place to connect risk signals to the actual work area.",
      ...gusDefaultActions.openJobsites,
    },
  },
  {
    route: "/jsa",
    message: {
      messageId: "gus-jsa-draft-reminder",
      category: "planning",
      priority: 1,
      message: "JSAs should stay draft-only until a supervisor or required reviewer checks the work plan.",
      reason: "Gus can help find missing fields, but cannot submit or approve a JSA.",
      ...gusDefaultActions.openJsa,
    },
  },
  {
    route: "/permits",
    message: {
      messageId: "gus-permit-review",
      category: "permit_alert",
      priority: 1,
      message: "Permit work needs human review. I can help identify missing permit details before review.",
      reason: "Gus cannot approve permits or release work.",
      ...gusDefaultActions.openPermits,
    },
  },
  {
    route: "/training",
    message: {
      messageId: "gus-training-check",
      category: "training_alert",
      priority: 2,
      message: "Training gaps are easier to fix before assignment. Check upcoming expirations and missing records.",
      reason: "Gus can point out training concerns, but cannot change training status.",
      ...gusDefaultActions.openTraining,
    },
  },
  {
    route: "/documents",
    message: {
      messageId: "gus-document-tip",
      category: "document_tip",
      priority: 3,
      message: "Keep official documents under human control. I can help draft notes without modifying final records.",
      reason: "Gus should assist review, not change official documents.",
      ...gusDefaultActions.openDocuments,
    },
  },
  {
    route: "/risk",
    message: {
      messageId: "gus-risk-explain",
      category: "risk_alert",
      priority: 1,
      message: "High-risk signals deserve a clear next action and human review before work proceeds.",
      reason: "Critical or severe risk should trigger review and possible stop-work evaluation.",
      ...gusDefaultActions.openDashboard,
    },
  },
  {
    route: "/observations",
    message: {
      messageId: "gus-observation-balance",
      category: "compliment",
      priority: 3,
      message: "Positive observations matter too. Use them to reinforce safe behavior, not just track misses.",
      reason: "Balanced feedback helps teams repeat the controls that are working.",
      ...gusDefaultActions.openDashboard,
    },
  },
  {
    route: "/audits",
    message: {
      messageId: "gus-audit-reminder",
      category: "reminder",
      priority: 2,
      message: "Audit findings should connect to owners, due dates, and verification steps.",
      reason: "A finding without ownership can drift into unresolved risk.",
      ...gusDefaultActions.openDashboard,
    },
  },
  {
    route: "/schedule-upload",
    message: {
      messageId: "gus-schedule-upload",
      category: "safety_tip",
      priority: 2,
      message: "After uploading a schedule, look for high-risk activities that need permits, JSAs, or briefings.",
      reason: "Schedule changes can introduce new workface hazards.",
      ...gusDefaultActions.openDashboard,
    },
  },
];
