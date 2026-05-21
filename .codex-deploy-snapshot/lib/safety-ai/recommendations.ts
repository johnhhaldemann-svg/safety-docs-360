import type {
  RiskDriver,
  SafetyAiInput,
  SafetyRecommendation,
  SafetyRiskLevel,
} from "@/lib/safety-ai/types";

function priorityForLevel(level: SafetyRiskLevel): SafetyRecommendation["priority"] {
  if (level === "critical") return "urgent";
  if (level === "high") return "high";
  if (level === "moderate") return "medium";
  return "low";
}

function hasDriver(drivers: RiskDriver[], label: string) {
  return drivers.some((driver) => driver.label.toLowerCase().includes(label));
}

export function buildSafetyRecommendations(params: {
  input: SafetyAiInput;
  level: SafetyRiskLevel;
  drivers: RiskDriver[];
  stopWorkReviewRecommended: boolean;
}): SafetyRecommendation[] {
  const { input, level, drivers, stopWorkReviewRecommended } = params;
  const priority = priorityForLevel(level);
  const highOrCritical = level === "high" || level === "critical";
  const recommendations: SafetyRecommendation[] = [];

  if (highOrCritical || hasDriver(drivers, "fatal") || hasDriver(drivers, "imminent")) {
    recommendations.push({
      title: stopWorkReviewRecommended
        ? "Pause affected work for review"
        : "Separate people from the highest-risk task before release",
      priority,
      controlType: "elimination",
      reason: "Human life comes first; remove workers from potential exposure while the condition is reviewed.",
      suggestedOwnerRole: "field_supervisor",
    });
  }

  if (hasDriver(drivers, "high-risk") || input.highRiskWorkCategories?.length) {
    recommendations.push({
      title: "Use a lower-risk method where practical",
      priority,
      controlType: "substitution",
      reason: "Review whether the task sequence, material, equipment, or work method can be changed to reduce exposure.",
      suggestedOwnerRole: "safety_manager",
    });
  }

  if (hasDriver(drivers, "control") || highOrCritical) {
    recommendations.push({
      title: "Verify physical controls before work continues",
      priority,
      controlType: "engineering",
      reason: "Guardrails, barricades, isolation, ventilation, or other physical controls should be verified before relying on reminders or PPE.",
      suggestedOwnerRole: "competent_person",
    });
  }

  recommendations.push({
    title:
      level === "low"
        ? "Continue monitoring and documenting field conditions"
        : "Create or update the corrective action plan",
    priority,
    controlType: "administrative",
    reason:
      level === "low"
        ? "Based on available data, risk appears controlled; continued documentation helps catch changes early."
        : "Assign owners, due dates, and field verification so the control gap does not remain open.",
    suggestedOwnerRole: level === "low" ? "field_supervisor" : "safety_manager",
  });

  if (hasDriver(drivers, "training")) {
    recommendations.push({
      title: "Confirm task-specific training before assignment",
      priority: highOrCritical ? "high" : "medium",
      controlType: "administrative",
      reason: "Missing or expired training is a readiness gap for high-risk work and should be cleared before the task proceeds.",
      suggestedOwnerRole: "safety_manager",
    });
  }

  if (hasDriver(drivers, "permit")) {
    recommendations.push({
      title: "Resolve permit coverage before releasing the work",
      priority: highOrCritical ? "high" : "medium",
      controlType: "administrative",
      reason: "Permit gaps can hide required planning, authorization, and field verification steps.",
      suggestedOwnerRole: "field_supervisor",
    });
  }

  if (!recommendations.some((item) => item.controlType === "ppe")) {
    recommendations.push({
      title: "Confirm PPE is task-specific and available",
      priority: level === "low" ? "low" : "medium",
      controlType: "ppe",
      reason: "PPE is the last layer of defense and should support, not replace, stronger controls.",
      suggestedOwnerRole: "field_supervisor",
    });
  }

  if (level === "critical") {
    recommendations.push({
      title: "Competent-person or safety-manager review recommended",
      priority: "urgent",
      controlType: "competent_person_review",
      reason: "Critical or uncertain findings should be escalated to qualified safety judgment before the affected work continues.",
      suggestedOwnerRole: "competent_person",
    });
  } else if (level === "high") {
    recommendations.push({
      title: "Supervisor and safety-manager review recommended",
      priority: "high",
      controlType: "competent_person_review",
      reason: "High findings need field review and documented follow-through before risk is treated as controlled.",
      suggestedOwnerRole: "safety_manager",
    });
  }

  const seen = new Set<string>();
  return recommendations.filter((recommendation) => {
    const key = `${recommendation.controlType}:${recommendation.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
