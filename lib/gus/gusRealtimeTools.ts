import { gusFeatureFlags } from "@/components/gus/gusConfig";

export type GusRealtimeToolName =
  | "summarize_context"
  | "recommend_actions"
  | "create_draft_after_confirmation";

export type GusRealtimeToolDefinition = {
  name: GusRealtimeToolName;
  description: string;
  requiresConfirmation: boolean;
  canModifyOfficialRecords: false;
};

export const GUS_REALTIME_SYSTEM_NOTE =
  "Talk to Gus is disabled. Future live voice mode may summarize company/jobsite context and recommend draft actions, but it cannot modify official records without explicit user confirmation and human review.";

export const gusRealtimeTools: GusRealtimeToolDefinition[] = [
  {
    name: "summarize_context",
    description: "Summarize provided company or jobsite context for the current authenticated user.",
    requiresConfirmation: false,
    canModifyOfficialRecords: false,
  },
  {
    name: "recommend_actions",
    description: "Recommend draft safety planning actions based on provided context.",
    requiresConfirmation: false,
    canModifyOfficialRecords: false,
  },
  {
    name: "create_draft_after_confirmation",
    description: "Placeholder for future draft creation after explicit confirmation.",
    requiresConfirmation: true,
    canModifyOfficialRecords: false,
  },
] as const;

export function isGusRealtimeVoiceEnabled() {
  return gusFeatureFlags.gusRealtimeVoiceEnabled;
}

export function getDisabledGusRealtimeSessionResponse() {
  return {
    enabled: false,
    reason: "Gus realtime voice is not enabled yet.",
    futureBehavior: [
      "User clicks Talk to Gus.",
      "Browser asks microphone permission.",
      "Gus listens and answers with voice.",
      "User can interrupt.",
      "Gus can summarize company/jobsite context and recommend actions.",
      "Gus cannot modify official records without confirmation.",
    ],
  };
}
