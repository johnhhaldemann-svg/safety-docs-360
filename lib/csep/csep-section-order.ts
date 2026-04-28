export type CanonicalCsepSectionDefinition = {
  key: string;
  title: string;
  kind: "front_matter" | "main";
  descriptor: string;
};

export const CANONICAL_CSEP_SECTION_ORDER: CanonicalCsepSectionDefinition[] = [
  {
    key: "owner_message",
    kind: "front_matter",
    title: "Owner Message",
    descriptor: "Project leadership commitment and safety expectations for this CSEP issue.",
  },
  {
    key: "sign_off_page",
    kind: "front_matter",
    title: "Sign-Off Page",
    descriptor: "Required review and signature confirmations before field use.",
  },
  {
    key: "table_of_contents",
    kind: "front_matter",
    title: "Table of Contents",
    descriptor: "Document navigation for the issued CSEP package.",
  },
  {
    key: "purpose",
    kind: "main",
    title: "Purpose",
    descriptor: "Why the CSEP exists and how it governs project work.",
  },
  {
    key: "project_and_contractor_information",
    kind: "main",
    title: "Project and Contractor Information",
    descriptor: "Project identity, owner, GC / CM, jurisdiction, and contractor contacts.",
  },
  {
    key: "scope_of_work_section",
    kind: "main",
    title: "Scope of Work",
    descriptor: "Trade, sub-trade, tasks, scope summary, assumptions, exclusions, and work sequence.",
  },
  {
    key: "regulatory_basis_and_references",
    kind: "main",
    title: "Regulatory Basis and References",
    descriptor: "Jurisdiction profile, authority references, and clean OSHA / CFR citation list.",
  },
  {
    key: "top_10_critical_risks",
    kind: "main",
    title: "Top 10 Critical Risks",
    descriptor: "Highest project and steel erection exposures requiring leadership attention.",
  },
  {
    key: "roles_and_responsibilities",
    kind: "main",
    title: "Roles and Responsibilities",
    descriptor: "Role duties, authority, and key definitions for the project team.",
  },
  {
    key: "trade_interaction_and_coordination",
    kind: "main",
    title: "Trade Interaction and Coordination",
    descriptor: "Overlap planning, shared-area coordination, access handoffs, and conflict response.",
  },
  {
    key: "site_access_security_laydown_traffic_control",
    kind: "main",
    title: "Site Access, Security, Laydown, and Traffic Control",
    descriptor: "Worker access, visitors, deliveries, truck routing, staging, traffic, and restricted areas.",
  },
  {
    key: "hazard_communication_and_environmental_protection",
    kind: "main",
    title: "Hazard Communication and Environmental Protection",
    descriptor: "SDS, labels, chemical inventory, spill tie-ins, waste, stormwater, dust, and nuisance controls.",
  },
  {
    key: "emergency_response_and_rescue",
    kind: "main",
    title: "Emergency Response and Rescue",
    descriptor: "Emergency notifications, 911 response, rescue, EMS access, fire response, and sheltering.",
  },
  {
    key: "iipp_incident_reporting_corrective_action",
    kind: "main",
    title: "IIPP / Incident Reporting / Corrective Action",
    descriptor: "Incident and near-miss reporting, investigations, corrective actions, trends, and restart expectations.",
  },
  {
    key: "worker_conduct_fit_for_duty_disciplinary_program",
    kind: "main",
    title: "Worker Conduct, Fit-for-Duty, and Disciplinary Program",
    descriptor: "Unsafe-act response, stop-work enforcement, impairment, fatigue, wellness, and discipline.",
  },
  {
    key: "training_competency_and_certifications",
    kind: "main",
    title: "Training, Competency, and Certifications",
    descriptor: "Training records, certifications, qualified roles, and active-scope training requirements.",
  },
  {
    key: "required_permits_and_hold_points",
    kind: "main",
    title: "Required Permits and Hold Points",
    descriptor: "Permit triggers, hold points, verification, and closeout requirements.",
  },
  {
    key: "high_risk_steel_erection_programs",
    kind: "main",
    title: "High-Risk Steel Erection Programs",
    descriptor: "Steel erection program modules for leading edge, decking, hoisting, stability, bracing, and weather.",
  },
  {
    key: "hazard_control_modules",
    kind: "main",
    title: "Hazard Control Modules",
    descriptor: "Hazard-specific controls only, separated from task execution and project-wide policy.",
  },
  {
    key: "task_execution_modules",
    kind: "main",
    title: "Task Execution Modules",
    descriptor: "Task-specific work execution steps for structural steel and decking activities.",
  },
  {
    key: "ppe_and_work_attire",
    kind: "main",
    title: "PPE and Work Attire",
    descriptor: "Base PPE, task-specific PPE, welding PPE, fall protection equipment, and attire requirements.",
  },
  {
    key: "inspections_audits_and_records",
    kind: "main",
    title: "Inspections, Audits, and Records",
    descriptor: "JHA / pre-task review, inspections, audits, permits, corrective action tracking, and records.",
  },
  {
    key: "project_closeout",
    kind: "main",
    title: "Project Closeout",
    descriptor: "Corrective action closeout, permit closeout, turnover, lessons learned, and final documentation review.",
  },
  {
    key: "document_control_and_revision_history",
    kind: "main",
    title: "Document Control and Revision History",
    descriptor: "Issue control, revision status, and approval record for this CSEP package.",
  },
];
