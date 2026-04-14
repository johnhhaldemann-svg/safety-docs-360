export const CHECKLIST_SOURCE_DISCLAIMER =
  "The HSE checklist is a required coverage baseline and gap-detection aid, not the sole compliance authority.";

export const CHECKLIST_SOURCE_PRIORITY = [
  "explicit_user_input",
  "uploaded_company_documents",
  "project_form_structured_fields",
  "derived_scope_hazard_signals",
  "hse_checklist_baseline",
] as const;

export type ChecklistSourcePriority = (typeof CHECKLIST_SOURCE_PRIORITY)[number];

export function buildChecklistSourcePolicyNote() {
  return [
    CHECKLIST_SOURCE_DISCLAIMER,
    "When required evidence is missing, return needs_user_input and ask for the exact missing fields.",
    "Do not invent policy statements, procedures, or regulatory claims.",
    `Source priority: ${CHECKLIST_SOURCE_PRIORITY.join(" > ")}.`,
  ].join(" ");
}
