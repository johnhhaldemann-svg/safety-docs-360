export type SafetyWorkspaceStage = {
  label: string;
  detail: string;
  active: boolean;
  complete: boolean;
};

export function buildSafetyWorkspaceStages(params: {
  hasDraft: boolean;
  hasIntake: boolean;
  hasGenerated: boolean;
}): SafetyWorkspaceStage[] {
  return [
    {
      label: "Intake",
      detail: "Capture the work package in a normalized format before rules or AI run.",
      active: !params.hasDraft,
      complete: params.hasDraft,
    },
    {
      label: "Rules & conflicts",
      detail: "Evaluate permit triggers, hazard controls, and simultaneous-operation risk.",
      active: params.hasDraft && !params.hasGenerated,
      complete: params.hasIntake,
    },
    {
      label: "Generate",
      detail: "Draft risk outputs and safety documents from reviewed context.",
      active: params.hasIntake && !params.hasGenerated,
      complete: params.hasGenerated,
    },
    {
      label: "Review queue",
      detail: "Hand the generated draft into company review and publication workflows.",
      active: params.hasGenerated,
      complete: params.hasGenerated,
    },
  ];
}

export function getSafetyWorkspaceStatus(params: {
  loading: boolean;
  message: string;
  messageTone: "neutral" | "success" | "warning" | "error";
}) {
  if (params.message) {
    return { tone: params.messageTone, message: params.message };
  }
  if (params.loading) {
    return { tone: "neutral" as const, message: "Loading current Safety Intelligence state..." };
  }
  return null;
}
