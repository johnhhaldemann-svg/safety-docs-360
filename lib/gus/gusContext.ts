import type { GusRiskLevel } from "@/lib/gus/gusTypes";

export type GusContext = {
  companyId?: string;
  jobsiteId?: string;
  userId?: string;
  currentPage: string;
  route: string;
  riskLevel?: GusRiskLevel;
  riskDrivers?: string[];
  missingPermitTypes?: string[];
  expiredTrainingCount?: number;
  upcomingTrainingExpirationCount?: number;
  incompleteJsaFields?: string[];
  recentObservationTypes?: string[];
  recentPositiveObservationCount?: number;
  recentNegativeObservationCount?: number;
  openCorrectiveActionCount?: number;
  openHighPriorityActionCount?: number;
  weatherRiskLevel?: GusRiskLevel;
  currentTaskType?: string;
  currentTrade?: string;
  scheduleUploadedToday?: boolean;
  voiceEnabled?: boolean;
  quietMode?: boolean;
};
