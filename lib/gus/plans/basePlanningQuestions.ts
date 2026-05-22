import type { GusPlanningQuestion } from "@/lib/gus/plans/basePlanningTypes";

export const gusPlanningDisclaimer =
  "Gus helps draft safe work plans. Final review and approval must be completed by the competent person, supervisor, qualified person, or authorized safety representative.";

export const basePlanningQuestions: GusPlanningQuestion[] = [
  {
    id: "work_performed",
    prompt: "What work is being performed?",
    required: true,
  },
  {
    id: "work_location",
    prompt: "Where is the work being performed?",
    required: true,
  },
  {
    id: "crew",
    prompt: "Who is performing the work?",
    required: true,
  },
  {
    id: "equipment_energy_sources",
    prompt: "What equipment, tools, chemicals, or energy sources are involved?",
    required: true,
  },
  {
    id: "hazards",
    prompt: "What hazards are present?",
    required: true,
  },
  {
    id: "controls",
    prompt: "What controls are required?",
    required: true,
  },
  {
    id: "permits",
    prompt: "What permits may be required?",
    required: false,
  },
  {
    id: "training",
    prompt: "What training may be required?",
    required: false,
  },
  {
    id: "inspections",
    prompt: "What inspections are required before work starts?",
    required: true,
  },
  {
    id: "site_conditions",
    prompt: "What environmental or site conditions could change risk?",
    required: false,
  },
  {
    id: "stop_work",
    prompt: "What stop-work triggers apply?",
    required: true,
  },
  {
    id: "emergency_response",
    prompt: "What emergency response considerations apply?",
    required: true,
  },
  {
    id: "missing_information",
    prompt: "What information is missing?",
    required: false,
  },
  {
    id: "required_reviewers",
    prompt: "Who must review the plan?",
    required: true,
  },
  {
    id: "draft_documents",
    prompt: "What draft documents should be created?",
    required: false,
  },
];

