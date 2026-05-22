import type { GusPlanModule } from "@/lib/gus/plans/basePlanningTypes";

export const electrical: GusPlanModule = {
  moduleId: "electrical",
  displayName: "Electrical work",
  description: "Electrical installation, troubleshooting, testing, and energized-work planning.",
  triggerKeywords: ["electrical", "energized", "arc flash", "panel", "voltage", "breaker"],
  requiredQuestions: [
    "What electrical source or equipment is involved?",
    "Can the work be de-energized?",
    "Who is the qualified person?",
    "What boundaries and PPE are needed?",
  ],
  hazardCategories: ["Shock", "Arc flash", "Stored energy", "Unexpected energization"],
  commonControls: ["De-energize where practical", "Qualified person review", "Boundary control", "PPE inspection"],
  possiblePermits: ["Energized electrical work permit", "LOTO checklist"],
  possibleTrainingRequirements: ["Electrical qualified person", "Arc flash awareness", "Lockout/tagout"],
  requiredReviewRoles: ["Qualified person", "Supervisor"],
  stopWorkTriggers: ["Unknown energy source", "Missing qualified person", "Damaged electrical equipment", "Boundary not controlled"],
  draftPlanSections: ["Electrical scope", "Energy state", "Boundaries", "PPE and tools"],
  validationRules: [
    {
      id: "electrical_qualified_person",
      description: "Electrical drafts must identify qualified-person review when electrical hazards are present.",
      severity: "critical",
    },
  ],
};

