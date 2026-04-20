// src/app/api/pshsep/export/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  ShadingType,
  ImageRun,
} from "docx";
import { DOCUMENT_DISCLAIMER_LINES } from "@/lib/legal";
import { getDocumentBuilderSection } from "@/lib/documentBuilderText";
import { getDocumentBuilderTextConfig } from "@/lib/documentBuilderTextSettings";
import {
  collectPshsepCatalogOshaRefs,
  derivePshsepExportProgramIds,
  normalizePshsepBuilderFormData,
} from "@/lib/pshsepCatalog";
import type { PshsepExportProgramId } from "@/lib/pshsepCatalog";
import { authorizeRequest } from "@/lib/rbac";
import { createSafetyPlanDocument } from "@/lib/safetyPlanDocxTheme";
import {
  SITE_SAFETY_BLUEPRINT_TITLE,
  getSafetyBlueprintDraftFilename,
} from "@/lib/safetyBlueprintLabels";
import { loadGeneratedDocumentDraft } from "@/lib/safety-intelligence/repository";
import { renderSafetyPlanDocx } from "@/lib/safety-intelligence/documents/render";
import type { DocumentBuilderTextConfig } from "@/types/document-builder-text";
import type { GeneratedSafetyPlanDraft } from "@/types/safety-intelligence";

type DocChild = Paragraph | Table;

function getSiteBuilderSection(
  config: DocumentBuilderTextConfig | null | undefined,
  key: string
) {
  return getDocumentBuilderSection(config, "site_builder", key);
}

function getSiteBuilderChild(
  config: DocumentBuilderTextConfig | null | undefined,
  sectionKey: string,
  childKey: string
) {
  return getSiteBuilderSection(config, sectionKey)?.children.find(
    (child) => child.key === childKey
  ) ?? null;
}

/* ------------------------------------------------ */
/* TYPES */
/* ------------------------------------------------ */

export type PSHSEPInput = Record<string, unknown> & {
  // Admin / cover inputs (expand as you like)
  company_name?: string;

  project_name?: string;
  project_number?: string;
  project_address?: string;

  owner_client?: string;
  gc_cm?: string;
  gc_safety_contact?: string;

  contractor_company?: string;
  contractor_phone?: string;
  contractor_email?: string;

  plan_author?: string;
  approval_name?: string;
  approval_date?: string;
  assumed_trades_index?: string[];
  disciplinary_policy_text?: string;
  owner_letter_text?: string;
  incident_reporting_process_text?: string;
  special_conditions_permit_text?: string;

  // Program toggles (add more later)
  include_fall_protection?: boolean;
  include_excavation?: boolean;
  include_crane_rigging?: boolean;
  include_confined_space?: boolean;
  include_electrical_loto?: boolean;
  include_hot_work?: boolean;
};

function spacerParagraph(lines = 1) {
  return new Paragraph({
    spacing: { after: 180 * lines },
    children: [
      new TextRun({
        text: " ",
        size: 22,
      }),
    ],
  });
} 

function infoTable(rows: Array<[string, string, string, string]>): Table {
  const outer = {
    top: { style: BorderStyle.SINGLE, size: 8, color: "2F5597" },
    bottom: { style: BorderStyle.SINGLE, size: 8, color: "2F5597" },
    left: { style: BorderStyle.SINGLE, size: 8, color: "2F5597" },
    right: { style: BorderStyle.SINGLE, size: 8, color: "2F5597" },
  };

  const inner = {
    top: { style: BorderStyle.SINGLE, size: 2, color: "B7C9E2" },
    bottom: { style: BorderStyle.SINGLE, size: 2, color: "B7C9E2" },
    left: { style: BorderStyle.SINGLE, size: 2, color: "B7C9E2" },
    right: { style: BorderStyle.SINGLE, size: 2, color: "B7C9E2" },
  };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((row, rowIndex) =>
      new TableRow({
        children: row.map((cell, cellIndex) => {
          const isLabel = cellIndex % 2 === 0;
          return new TableCell({
            borders: {
              top: rowIndex === 0 ? outer.top : inner.top,
              bottom: rowIndex === rows.length - 1 ? outer.bottom : inner.bottom,
              left: cellIndex === 0 ? outer.left : inner.left,
              right: cellIndex === row.length - 1 ? outer.right : inner.right,
            },
            shading: isLabel
              ? {
                  type: ShadingType.CLEAR,
                  color: "auto",
                  fill: "D9EAF7",
                }
              : undefined,
            margins: {
              top: 100,
              bottom: 100,
              left: 120,
              right: 120,
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: cell || " ",
                    bold: isLabel,
                    size: 22,
                    color: "1F1F1F",
                  }),
                ],
              }),
            ],
          });
        }),
      })
    ),
  });
}

/* ------------------------------------------------ */
/* UTILITY FUNCTIONS */
/* ------------------------------------------------ */

function safeFilePart(input: string) {
  return (input || "PSHSEP")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function include(flag: unknown, fallback = true): boolean {
  return typeof flag === "boolean" ? flag : fallback;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function getPshsepExportProfile(form: PSHSEPInput) {
  const normalizedForm = normalizePshsepBuilderFormData(form) as PSHSEPInput;
  return {
    normalizedForm,
    includedPrograms: new Set(derivePshsepExportProgramIds(normalizedForm)),
  };
}

function pageBreak() {
  return new Paragraph({
    children: [new PageBreak()],
  });
}

function titleCenter(text: string) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 40,
      }),
    ],
  });
}

function h1(text: string) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 200, after: 200 },
  });
}

function h2(text: string) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 120, after: 120 },
  });
}

function p(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    spacing: { after: 120 },
  });
}

function numberedParagraph(prefix: string, text: string) {
  return new Paragraph({
    children: [new TextRun({ text: `${prefix} ${text}`, size: 22 })],
    spacing: { after: 80 },
  });
}

function appendNumberedParagraphs(prefix: string, items: string[]) {
  return items.map((item, index) => numberedParagraph(`${prefix}.${index + 1}`, item));
}

function parseBase64Image(dataUrl: string) {
  const [header, base64] = dataUrl.split(",");

  let type: "png" | "jpg" | "gif" = "png";

  if (header.includes("image/jpeg") || header.includes("image/jpg")) {
    type = "jpg";
  } else if (header.includes("image/gif")) {
    type = "gif";
  }

  return {
    type,
    buffer: Buffer.from(base64, "base64"),
  };
}

let activeProgramSectionNumber = "";
let activeProgramSubsectionIndex = 0;

function setActiveProgramSection(number: string) {
  activeProgramSectionNumber = number;
  activeProgramSubsectionIndex = 0;
}

function clearActiveProgramSection() {
  activeProgramSectionNumber = "";
  activeProgramSubsectionIndex = 0;
}

function programSection(title: string, paragraphs: string[], bullets: string[] = []) {
  const content: Paragraph[] = [];
  const subsectionIndex = activeProgramSectionNumber ? ++activeProgramSubsectionIndex : 0;
  const subsectionPrefix =
    activeProgramSectionNumber && subsectionIndex > 0
      ? `${activeProgramSectionNumber}.${subsectionIndex}`
      : "";

  content.push(h2(subsectionPrefix ? `${subsectionPrefix} ${title}` : title));

  paragraphs.forEach((t) => {
    content.push(
      new Paragraph({
        children: [new TextRun({ text: t, size: 22 })],
        spacing: { after: 160 },
      })
    );
  });

  if (subsectionPrefix) {
    content.push(...appendNumberedParagraphs(subsectionPrefix, bullets));
  } else {
    bullets.forEach((b, index) => {
      content.push(numberedParagraph(String(index + 1), b));
    });
  }

  return content;
}

function twoColTable(rows: Array<[string, string]>) {
  const cellBorders = {
    top: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
    bottom: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
    left: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
    right: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
  };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([a, b]) => {
      return new TableRow({
        children: [
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            borders: cellBorders,
            children: [
              new Paragraph({
                children: [new TextRun({ text: a, bold: true, size: 22 })],
                spacing: { after: 80 },
              }),
            ],
          }),
          new TableCell({
            width: { size: 65, type: WidthType.PERCENTAGE },
            borders: cellBorders,
            children: [
              new Paragraph({
                children: [new TextRun({ text: b || "", size: 22 })],
                spacing: { after: 80 },
              }),
            ],
          }),
        ],
      });
    }),
  });
}

/* ------------------------------------------------ */
/* PROGRAM SECTIONS */
/* ------------------------------------------------ */

function program_FallProtection(
  builderTextConfig: DocumentBuilderTextConfig | null | undefined
) {
  const sectionKey = "fall_protection";
  const purpose = getSiteBuilderChild(builderTextConfig, sectionKey, "purpose");
  const scope = getSiteBuilderChild(builderTextConfig, sectionKey, "scope");
  const responsibilities = getSiteBuilderChild(builderTextConfig, sectionKey, "responsibilities");
  const hazardIdentification = getSiteBuilderChild(
    builderTextConfig,
    sectionKey,
    "hazard_identification"
  );
  const controlMeasures = getSiteBuilderChild(builderTextConfig, sectionKey, "control_measures");
  const inspectionRequirements = getSiteBuilderChild(
    builderTextConfig,
    sectionKey,
    "inspection_requirements"
  );
  const rescuePlanning = getSiteBuilderChild(builderTextConfig, sectionKey, "rescue_planning");

  return [
    h2("Fall Protection Program"),

    ...programSection(
      purpose?.title ?? "Purpose",
      purpose?.paragraphs ?? [
        "This section establishes requirements for identifying and controlling fall hazards associated with construction activities on the project.",
        "The objective of this program is to eliminate or minimize fall exposures through engineering controls, safe work practices, and personal protective equipment.",
      ]
    ),

    ...programSection(
      scope?.title ?? "Scope",
      scope?.paragraphs ?? [
        "This program applies to all personnel working at heights or exposed to fall hazards on the project.",
        "Fall protection requirements apply whenever workers are exposed to a fall hazard of six feet or greater unless site-specific rules require additional protection.",
      ]
    ),

    ...programSection(
      responsibilities?.title ?? "Responsibilities",
      responsibilities?.paragraphs ?? [
        "Project management is responsible for ensuring fall hazards are identified and controlled prior to beginning work.",
        "Supervisors must ensure workers understand and comply with fall protection requirements.",
        "Employees must inspect fall protection equipment before each use.",
      ]
    ),

    ...programSection(
      hazardIdentification?.title ?? "Hazard Identification",
      hazardIdentification?.paragraphs ?? [
        "Common fall hazards include leading edges, roof work, scaffolds, ladders, floor openings, and elevated platforms.",
      ],
      hazardIdentification?.bullets ?? [
        "Unprotected edges",
        "Floor openings",
        "Roof work",
        "Scaffolding",
        "Aerial lift operations",
      ]
    ),

    ...programSection(
      controlMeasures?.title ?? "Control Measures",
      controlMeasures?.paragraphs ?? ["Engineering controls will be implemented whenever feasible."],
      controlMeasures?.bullets ?? [
        "Guardrail systems",
        "Personal fall arrest systems",
        "Safety nets",
        "Controlled access zones",
      ]
    ),

    ...programSection(
      inspectionRequirements?.title ?? "Inspection Requirements",
      inspectionRequirements?.paragraphs ?? [
        "All fall protection equipment must be inspected before each use.",
      ],
      inspectionRequirements?.bullets ?? [
        "Harness inspected daily",
        "Lanyards inspected prior to use",
        "Anchorage verified prior to tie-off",
      ]
    ),

    ...programSection(
      rescuePlanning?.title ?? "Rescue Planning",
      rescuePlanning?.paragraphs ?? [
        "A rescue plan must be developed before workers use fall arrest systems.",
      ]
    ),
  ];
}

function program_Excavation() {
  return [
    h2("Excavation and Trenching Safety Program"),

    ...programSection("Purpose", [
      "This section establishes safety procedures for excavation and trenching operations.",
    ]),

    ...programSection("Scope", [
      "This program applies to all excavation and trenching activities performed on the project.",
    ]),

    ...programSection("Hazards", ["Excavation work exposes workers to serious hazards."], [
      "Cave-ins",
      "Struck-by hazards",
      "Hazardous atmospheres",
      "Underground utilities",
    ]),

    ...programSection("Protective Systems", [
      "Protective systems will be used when trenches exceed 5 feet in depth unless a competent person determines otherwise per applicable standards.",
    ], ["Sloping", "Benching", "Shoring", "Trench boxes"]),

    ...programSection("Inspection Requirements", [
      "A competent person must inspect excavations daily and as conditions change.",
    ], ["Daily inspections", "Post-storm inspections", "Inspections after vibrations"]),
  ];
}

function program_CranesRiggingCriticalLifts(form: PSHSEPInput) {
  return [
    h2("Crane, Rigging & Critical Lift Program"),

    ...programSection("Purpose", [
      "This program establishes requirements for crane and rigging activities in accordance with OSHA 29 CFR 1926 Subpart CC and applicable site requirements."
    ]),

    ...programSection("Scope", [
      "Applies to all crane lifts, hoisting operations, rigging activities, and designated critical lifts."
    ]),

    ...programSection("Personnel Qualifications", [
      "Only qualified operators, riggers, and signal persons may perform lifting activities.",
      "Required qualifications/certifications must be available upon request."
    ]),

    ...programSection("Lift Planning", [
      "Lift planning is required prior to lifting operations."
    ], [
      "Pre-lift meeting conducted",
      "Load weight confirmed",
      "Rigging selection verified",
      "Travel path and landing area verified",
      "Exclusion zones established"
    ]),

    ...programSection("Critical Lifts", [
      "Critical lifts require additional planning, approvals, and controls as defined by site requirements."
    ], [
      "Written lift plan approved before execution",
      "Dedicated signal person assigned",
      "Expanded exclusion zone enforced",
      "Weather limits evaluated"
    ]),

...programSection("Project Lift Planning Requirements", [
  form.lift_plans_required
    ? "All crane operations on this project shall require a documented lift plan prior to execution."
    : "All crane and hoisting operations shall be planned prior to execution. Where required by project policy, site conditions, owner requirements, or work complexity, contractors shall prepare a documented lift plan before the lift begins.",

  form.critical_lift_review_required
    ? "Critical lifts shall be reviewed and approved by GC Safety prior to execution."
    : "Critical lift review by GC Safety is not universally required unless specified by project management, owner requirements, or site conditions.",

  "Lift plans shall address, at a minimum, load weight, rigging configuration, crane capacity verification, lift path, exclusion zones, ground conditions, travel path, landing area, and overhead or adjacent hazards."
]),

    ...programSection("Operational Controls", [
      "Safe operating procedures will be enforced during lifting operations."
    ], [
      "No personnel under suspended loads",
      "Maintain swing radius controls",
      "Use tag lines when appropriate",
      "Stop work if conditions change"
    ]),
  ];
}

function program_ConfinedSpace() {
  return [
    h2("Confined Space Program"),

    ...programSection("Purpose", [
      "This program establishes requirements for confined space evaluation and entry to prevent injury from atmospheric and physical hazards.",
    ]),

    ...programSection("Scope", [
      "Applies to all activities involving entry into spaces that may meet confined space criteria.",
    ]),

    ...programSection("Hazard Assessment", [
      "Spaces will be evaluated for atmospheric and physical hazards prior to entry.",
    ], [
      "Oxygen deficiency/enrichment",
      "Toxic/flammable atmospheres",
      "Engulfment hazards",
      "Mechanical hazards and energy sources",
    ]),

    ...programSection("Entry Controls", [
      "Entry will follow permit requirements where applicable.",
    ], [
      "Atmospheric testing prior to entry",
      "Ventilation provided as needed",
      "Attendant stationed outside entry",
      "Communication maintained at all times",
      "Rescue plan established before entry",
    ]),

    ...programSection("Rescue Planning", [
      "Rescue services and equipment must be identified and available prior to entry.",
    ], [
      "Non-entry rescue preferred where feasible",
      "Tripods/winches used where applicable",
      "Emergency response contacts verified",
    ]),
  ];
}

function program_ElectricalLOTO() {
  return [
    h2("Electrical Safety & Lockout/Tagout (LOTO) Program"),

    ...programSection("Purpose", [
      "This program establishes requirements for controlling hazardous energy and preventing electrical shock, arc flash, and other electrical hazards.",
    ]),

    ...programSection("Scope", [
      "Applies to all electrical work, temporary power, and servicing/maintenance activities where unexpected energization could occur.",
    ]),

    ...programSection("Qualified Persons", [
      "Only qualified persons may perform electrical work beyond basic plug-and-play tasks.",
      "Arc flash and energized work restrictions will follow applicable standards and site rules.",
    ]),

    ...programSection("LOTO Requirements", [
      "Hazardous energy must be isolated, locked, and verified before work begins when feasible.",
    ], [
      "Identify all energy sources",
      "Apply locks/tags per site procedure",
      "Verify zero energy state",
      "Maintain control of keys at all times",
    ]),

    ...programSection("Temporary Power & Tools", [
      "Temporary power must be installed and maintained safely.",
    ], [
      "Use GFCI protection where required",
      "Inspect cords/tools daily",
      "Remove damaged cords immediately",
      "Maintain clear panel access",
    ]),
  ];
}

function program_HotWorkFirePrevention() {
  return [
    h2("Hot Work & Fire Prevention Program"),

    ...programSection("Purpose", [
      "This program establishes requirements for hot work operations and fire prevention controls to prevent ignition of combustible materials.",
    ]),

    ...programSection("Scope", [
      "Applies to welding, cutting, brazing, torch use, grinding, soldering, and other spark-producing activities.",
    ]),

    ...programSection("Permit Requirements", [
      "Hot work permits must be obtained prior to starting hot work when required by site rules.",
    ], [
      "Permit posted at the work area",
      "Permit identifies work location, time, and controls",
      "Permit closed out at completion",
    ]),

    ...programSection("Pre-Work Controls", [
      "Controls must be in place before hot work begins.",
    ], [
      "Combustibles removed or protected (35 ft rule unless otherwise specified)",
      "Fire extinguisher staged and inspected",
      "Fire watch assigned when required",
      "Spark containment used (blankets, screens, barriers)",
      "Area inspected above/below/adjacent spaces",
    ]),

    ...programSection("Fire Watch Requirements", [
      "A fire watch will be used as required by permit conditions or site rules.",
    ], [
      "Fire watch remains during hot work and for the required post-work period",
      "Fire watch is trained and has extinguisher access",
      "Fire watch documents monitoring when required",
    ]),

    ...programSection("Completion & Closeout", [
      "At the end of hot work, the area must be inspected and the permit closed out per site procedure.",
    ], [
      "Confirm no smoldering materials remain",
      "Remove slag/sparks and restore housekeeping",
      "Maintain required post-work fire watch duration (if applicable)",
      "Return permit to issuing authority (if required)",
    ]),
  ];
}

function program_SafetyOrientationTraining() {
  return [
    h2("Safety Orientation, Training & Competency"),

    ...programSection("Purpose", [
      "This section defines orientation, training, and competency expectations for all personnel working on the project."
    ]),

    ...programSection("Orientation", [
      "All personnel must complete required site orientation before beginning work, unless specifically exempted by the project."
    ], [
      "Project rules and expectations",
      "Emergency procedures",
      "Site access and restricted areas",
      "Reporting requirements",
      "Permit and authorization systems"
    ]),

    ...programSection("Training Requirements", [
      "Each employer is responsible for ensuring employees are trained for the tasks they perform and the hazards to which they are exposed."
    ], [
      "Hazard communication",
      "Fall protection",
      "Ladders and scaffolds",
      "MEWP / aerial lift use",
      "Forklift / industrial truck operation",
      "LOTO / hazardous energy control",
      "Confined space awareness or entry",
      "Respiratory protection where applicable"
    ]),

    ...programSection("Competent / Qualified Persons", [
      "Where regulations or project rules require a competent person or qualified person, the employer must designate such personnel and make documentation available upon request."
    ]),

    ...programSection("Toolbox Talks", [
      "Supervisors should conduct routine toolbox talks related to current work activities, incidents, trends, seasonal conditions, and changing hazards."
    ]),

    ...programSection("Documentation", [
      "Training records, certifications, licenses, and qualification documents must be maintained and furnished to the project upon request."
    ])
  ];
}

function program_ResponsibilitiesAccountability() {
  return [
    h2("Roles, Responsibilities & Accountability"),

    ...programSection("Purpose", [
      "This section defines the primary safety responsibilities of project leadership, supervisors, workers, and supporting personnel."
    ]),

    ...programSection("Owner / Client", [
      "The Owner or client may establish site-specific rules, restricted areas, permit requirements, operational constraints, and additional safety expectations beyond minimum regulatory requirements."
    ]),

    ...programSection("General Contractor / Construction Manager", [
      "The GC/CM is responsible for coordinating the project, establishing site rules, managing logistics, monitoring compliance, and ensuring subcontractors are aware of applicable safety requirements."
    ], [
      "Conduct coordination and planning meetings",
      "Manage site access and logistics",
      "Review safety documentation",
      "Monitor compliance through inspections and observations",
      "Require correction of unsafe conditions"
    ]),

    ...programSection("Project Superintendent", [
      "Superintendents are responsible for field execution, sequencing of work, trade coordination, and immediate response to safety concerns observed in the field."
    ], [
      "Coordinate daily work activities",
      "Stop unsafe work when needed",
      "Verify corrective actions are completed",
      "Support pre-task planning and communication"
    ]),

    ...programSection("Site Safety Representative", [
      "The site safety representative supports hazard identification, audits, investigations, safety coaching, and communication of project expectations."
    ], [
      "Perform routine inspections and walkthroughs",
      "Review high-risk work activities",
      "Participate in incident investigations",
      "Track trends and recurring issues",
      "Communicate lessons learned"
    ]),

    ...programSection("Subcontractor Management", [
      "Each subcontractor must provide competent supervision and remain directly accountable for the conduct, training, equipment, and safety performance of its employees and lower-tier subcontractors."
    ]),

    ...programSection("Employees", [
      "Employees are responsible for following training, using required PPE, inspecting equipment prior to use, reporting hazards, and stopping work when conditions are not safe."
    ], [
      "Work only within authorization and training",
      "Inspect tools and equipment before use",
      "Follow permits and procedures",
      "Maintain good housekeeping",
      "Report incidents, near misses, and hazards promptly"
    ])
  ];
}

function program_ProjectAdministration() {
  return [
    h2("Project Administration & Safety Management"),

    ...programSection("Purpose", [
      "This section establishes the overall project safety management framework for the site. It defines how the project will administer safety expectations, communicate requirements, assign responsibilities, and enforce compliance.",
      "The intent is to ensure all contractors, subcontractors, vendors, and visitors understand that safety performance is a core condition of working on the project."
    ]),

    ...programSection("Scope", [
      "This section applies to all personnel entering or working on the project, including the Owner, General Contractor/Construction Manager, subcontractors, temporary labor, delivery personnel, and authorized visitors."
    ]),

    ...programSection("Project Safety Expectations", [
      "All employers onsite are responsible for conducting their work in a manner that protects their employees, other trades, project property, the public, and the environment.",
      "Compliance with OSHA, applicable state and local regulations, owner requirements, and project-specific safety rules is mandatory at all times."
    ], [
      "Stop work when unsafe conditions exist",
      "Report hazards immediately",
      "Correct deficiencies in a timely manner",
      "Participate in project safety meetings and inspections",
      "Follow all permit, access, and authorization requirements"
    ]),

    ...programSection("Safety Oversight Structure", [
      "The project will maintain a defined safety oversight structure. The Owner and GC/CM reserve the authority to inspect work, require corrective action, and remove personnel or contractors who fail to comply with project safety requirements."
    ], [
      "Project Manager provides overall project leadership",
      "Superintendents coordinate field execution and enforcement",
      "Site Safety personnel provide audits, coaching, and hazard oversight",
      "Subcontractor supervisors remain responsible for their own crews",
      "Each employer is accountable for employee training and compliance"
    ]),

    ...programSection("Contractor Responsibilities", [
      "Each contractor and subcontractor is responsible for planning its work, identifying hazards, training employees, providing competent supervision, and implementing effective controls before work begins.",
      "Submission of project safety documentation does not relieve any employer of its legal obligation to provide a safe workplace."
    ], [
      "Provide activity hazard analyses / task planning",
      "Submit required training and qualification records",
      "Inspect tools, equipment, and work areas",
      "Provide required PPE and enforce its use",
      "Coordinate with adjacent trades before starting work"
    ]),

    ...programSection("Enforcement", [
      "Project safety rules will be enforced consistently. Unsafe acts, unsafe conditions, repeated noncompliance, or serious violations may result in stop work, removal from site, disciplinary action, or contract-related consequences."
    ], [
      "Verbal coaching",
      "Written corrective action",
      "Removal of employee from work area",
      "Stop work order",
      "Escalation to contractor management"
    ])
  ];
}

function program_CommunicationCoordination() {
  return [
    h2("Communication, Coordination & Pre-Task Planning"),

    ...programSection(
      "Purpose",
      [
        "This section establishes communication and coordination requirements to ensure all trades understand work scope, associated hazards, and required control measures before beginning work."
      ]
    ),

    ...programSection(
      "Daily Planning",
      [
        "Work activities will be reviewed prior to the start of each shift through pre-task planning, Daily Activity Plans (DAPs), Job Hazard Analyses (JHAs), or equivalent documented planning tools."
      ],
      [
        "Define work scope",
        "Identify hazards",
        "Establish mitigation measures",
        "Verify permits and authorizations",
        "Discuss changes in conditions"
      ]
    ),

    ...programSection(
      "Coordination Between Trades",
      [
        "Subcontractors must coordinate with adjacent trades and project supervision before beginning work that may impact access, overhead activities, utility systems, energized areas, or shared work zones."
      ],
      [
        "Coordinate overlapping activities",
        "Address line-of-fire concerns",
        "Control simultaneous operations",
        "Communicate restricted areas and access routes"
      ]
    ),

    ...programSection(
      "Meetings",
      [
        "Project safety communication may include superintendent meetings, subcontractor coordination meetings, toolbox talks, pre-lift meetings, permit briefings, and incident reviews."
      ]
    ),

    ...programSection(
      "Change Management",
      [
        "If site conditions, work scope, or environmental factors change, work must be reevaluated and the pre-task plan updated before continuing."
      ],
      [
        "Stop and reassess when conditions change",
        "Notify supervision of changes",
        "Revise controls before restarting work"
      ]
    )
  ];
}

function program_IncidentReportingInvestigation() {
  return [
    h2("Incident Reporting, Investigation & Corrective Action"),

    ...programSection("Purpose", [
      "This section establishes requirements for reporting, investigating, documenting, and correcting incidents, injuries, property damage, near misses, and unsafe conditions."
    ]),

    ...programSection("Immediate Reporting", [
      "All incidents, injuries, near misses, fires, spills, property damage events, and significant unsafe conditions must be reported immediately to project supervision."
    ], [
      "Medical events",
      "First aid cases",
      "Near misses",
      "Dropped objects",
      "Equipment contact events",
      "Utility strikes",
      "Environmental releases"
    ]),

    ...programSection("Initial Response", [
      "The scene must be stabilized, injured personnel assisted, and additional exposure prevented before normal operations resume."
    ], [
      "Secure the area",
      "Protect personnel from secondary hazards",
      "Preserve the scene when appropriate",
      "Notify required project contacts"
    ]),

    ...programSection("Investigation", [
      "Incidents will be investigated to identify root causes, contributing factors, and corrective actions. The purpose is prevention, not blame."
    ], [
      "Gather statements",
      "Review equipment and conditions",
      "Document sequence of events",
      "Identify failed controls",
      "Establish corrective and preventive actions"
    ]),

    ...programSection("Corrective Action", [
      "Corrective actions must be assigned, tracked, and completed in a timely manner. Lessons learned should be communicated to affected personnel and trades."
    ]),

    ...programSection("Records", [
      "Incident records, investigation findings, and corrective action logs must be maintained in accordance with regulatory and project requirements."
    ])
  ];
}

function program_InspectionsAudits() {
  return [
    h2("Inspections, Audits & Corrective Action Tracking"),

    ...programSection(
      "Purpose",
      [
        "This section establishes the project inspection and audit process used to identify unsafe conditions, verify controls, and track corrective actions."
      ]
    ),

    ...programSection(
      "Routine Inspections",
      [
        "Routine inspections will be conducted across work areas, access routes, equipment staging areas, elevated work zones, and active operations."
      ],
      [
        "Housekeeping",
        "PPE compliance",
        "Ladders and scaffold conditions",
        "Cords and temporary power",
        "Fire protection equipment",
        "Material storage and access",
        "Barricades and signage"
      ]
    ),

    ...programSection(
      "High-Risk Activity Review",
      [
        "Additional review may be required for high-risk work such as lifting operations, energized work, excavations, confined space entry, hot work, or major shutdown activities."
      ]
    ),

    ...programSection(
      "Deficiency Tracking",
      [
        "Deficiencies identified through inspections or audits must be assigned to responsible parties and corrected within the required timeframe."
      ],
      [
        "Immediate correction for imminent danger conditions",
        "Prompt action for significant hazards",
        "Documented closure of corrective actions"
      ]
    ),

    ...programSection(
      "Trend Analysis",
      [
        "Inspection results may be reviewed to identify recurring issues, training gaps, supervision concerns, or emerging risk trends requiring additional attention."
      ]
    )
  ];
}

function program_EmergencyActionMedicalResponse(
  form: PSHSEPInput,
  builderTextConfig: DocumentBuilderTextConfig | null | undefined
) {
  const sectionKey = "emergency_action_medical_response_evacuation";
  const purpose = getSiteBuilderChild(builderTextConfig, sectionKey, "purpose");
  const emergencyCommunication = getSiteBuilderChild(
    builderTextConfig,
    sectionKey,
    "emergency_communication"
  );
  const medicalResponse = getSiteBuilderChild(builderTextConfig, sectionKey, "medical_response");
  const emergencyMedicalResources = getSiteBuilderChild(
    builderTextConfig,
    sectionKey,
    "emergency_medical_resources"
  );
  const evacuation = getSiteBuilderChild(builderTextConfig, sectionKey, "evacuation");
  const fireUtilityChemicalEmergencies = getSiteBuilderChild(
    builderTextConfig,
    sectionKey,
    "fire_utility_chemical_emergencies"
  );
  const severeWeather = getSiteBuilderChild(builderTextConfig, sectionKey, "severe_weather");

  return [
    h2("Emergency Action, Medical Response & Evacuation"),

    ...programSection(
      purpose?.title ?? "Purpose",
      purpose?.paragraphs ?? [
        "This section establishes emergency response expectations for medical events, fire, severe weather, utility emergencies, chemical releases, and evacuation scenarios.",
      ]
    ),

    ...programSection(
      emergencyCommunication?.title ?? "Emergency Communication",
      emergencyCommunication?.paragraphs ?? [
        "Emergency contact numbers, reporting methods, alarm expectations, and designated response procedures must be communicated to all personnel.",
      ]
    ),

    ...programSection(
      medicalResponse?.title ?? "Medical Response",
      medicalResponse?.paragraphs ?? [
        "In the event of an injury or medical emergency, personnel shall immediately notify supervision and initiate the project emergency response process.",
      ],
      medicalResponse?.bullets ?? [
        "Contact emergency services when needed",
        "Provide site-specific directions to responders",
        "Use trained first aid / CPR personnel when available",
        "Document and report the event promptly",
      ]
    ),
    ...programSection(
      emergencyMedicalResources?.title ?? "Emergency Medical Resources",
      [
        emergencyMedicalResources?.paragraphs[0]?.includes("AED Location:")
          ? emergencyMedicalResources.paragraphs[0].replace(
              "Not Specified",
              String(form.aedLocation || "Not Specified")
            )
          : `AED Location: ${form.aedLocation || "Not Specified"}`,
        emergencyMedicalResources?.paragraphs[1]?.includes("First Aid Station Location:")
          ? emergencyMedicalResources.paragraphs[1].replace(
              "Not Specified",
              String(form.firstAidLocation || "Not Specified")
            )
          : `First Aid Station Location: ${form.firstAidLocation || "Not Specified"}`,
      ]
    ),

...(form.siteMap
  ? [
      (() => {
        const image = parseBase64Image(form.siteMap as string);

        return new Paragraph({
          children: [
            new ImageRun({
              type: image.type,
              data: image.buffer,
              transformation: {
                width: 500,
                height: 300,
              },
            }),
          ],
          spacing: { after: 200 },
        });
      })(),
    ]
  : []),

    ...programSection(
      evacuation?.title ?? "Evacuation",
      evacuation?.paragraphs ?? [
        "Workers must know evacuation routes, assembly points, and accountability procedures for their work area.",
      ],
      evacuation?.bullets ?? [
        "Follow alarms and supervisor direction",
        "Do not re-enter until authorized",
        "Account for personnel at designated assembly areas",
      ]
    ),

    ...programSection(
      fireUtilityChemicalEmergencies?.title ?? "Fire / Utility / Chemical Emergencies",
      fireUtilityChemicalEmergencies?.paragraphs ?? [
        "Work must stop immediately in the event of fire, gas release, utility damage, electrical emergency, or uncontrolled chemical spill unless trained emergency response actions are specifically authorized.",
      ]
    ),

    ...programSection(
      severeWeather?.title ?? "Severe Weather",
      severeWeather?.paragraphs ?? [
        "Project leadership will monitor weather conditions and may suspend work for lightning, high winds, tornado warnings, extreme temperatures, or other hazardous conditions.",
      ]
    )
  ];
}

function program_PPE() {
  return [
    h2("Personal Protective Equipment (PPE) Program"),

    ...programSection("Purpose", [
      "This section establishes minimum personal protective equipment requirements for all personnel working on or visiting the project.",
      "PPE shall be used as a final layer of protection after engineering and administrative controls have been evaluated and implemented where feasible."
    ]),

    ...programSection("Basic Site PPE", [
      "Minimum PPE requirements apply unless a task-specific hazard assessment requires additional protection."
    ], [
      "Hard hat",
      "Safety glasses with side shields",
      "High-visibility vest or equivalent",
      "Work boots appropriate for site conditions",
      "Gloves appropriate to the task"
    ]),

    ...programSection("Task-Specific PPE", [
      "Additional PPE may be required depending on the activity, exposure, and location."
    ], [
      "Face shields for grinding or cutting",
      "Hearing protection for high-noise areas",
      "Cut-resistant gloves when handling sharp materials",
      "Arc-rated PPE for qualified electrical work",
      "Chemical-resistant gloves and protective clothing where needed",
      "Respiratory protection where airborne hazards exist"
    ]),

    ...programSection("Selection and Use", [
      "PPE must be selected based on the hazard and used according to manufacturer instructions and applicable standards.",
      "Damaged, defective, or contaminated PPE shall be removed from service immediately."
    ]),

    ...programSection("Employee Responsibilities", [
      "Employees are responsible for wearing required PPE, inspecting it prior to use, and notifying supervision when replacement is needed."
    ]),

    ...programSection("Enforcement", [
      "Failure to wear required PPE may result in removal from the work area, disciplinary action, or project access restrictions."
    ])
  ];
}

function program_HousekeepingMaterialStorage() {
  return [
    h2("Housekeeping, Access & Material Storage"),

    ...programSection("Purpose", [
      "This section establishes expectations for housekeeping, access maintenance, waste control, and proper storage of materials and equipment."
    ]),

    ...programSection("General Expectations", [
      "Work areas shall be maintained in an orderly condition at all times. Poor housekeeping is a leading contributor to trips, fire hazards, blocked access, dropped object exposure, and inefficient work operations."
    ], [
      "Keep walking and working surfaces clear",
      "Remove scrap and debris routinely",
      "Maintain clear access to exits, extinguishers, panels, and emergency equipment",
      "Store materials in stable, designated areas",
      "Control protruding nails, sharp edges, and tripping hazards"
    ]),

    ...programSection("Waste Management", [
      "Waste shall be collected and removed at a frequency sufficient to prevent accumulation and unsafe conditions."
    ], [
      "Use designated trash and scrap containers",
      "Do not overload disposal bins",
      "Separate hazardous waste if applicable",
      "Keep combustible waste under control"
    ]),

    ...programSection("Material Storage", [
      "Materials must be stacked, secured, and stored in a manner that prevents collapse, rolling, shifting, or interference with access."
    ], [
      "Secure pipe, conduit, and round stock from rolling",
      "Store sheet goods to prevent tipping",
      "Maintain aisle and access clearance",
      "Protect stored materials from weather and damage when needed"
    ]),

    ...programSection("Cord and Hose Management", [
      "Extension cords, welding leads, air hoses, and similar items shall be routed and protected to minimize trip hazards and damage."
    ]),

    ...programSection("Responsibility", [
      "Each contractor is responsible for housekeeping within its work area and for restoring the area to a safe condition at the end of each shift."
    ])
  ];
}

function program_LadderSafety() {
  return [
    h2("Ladder Safety Program"),

    ...programSection("Purpose", [
      "This section establishes requirements for the selection, inspection, setup, and use of ladders on the project."
    ]),

    ...programSection("Scope", [
      "Applies to all portable ladders, job-made ladders where authorized, and ladder use associated with access or short-duration work."
    ]),

    ...programSection("Inspection", [
      "Ladders must be inspected before use and removed from service if damaged or defective."
    ], [
      "Check rails, rungs, feet, and locking mechanisms",
      "Verify labels and load ratings remain legible",
      "Do not use painted ladders that obscure defects unless factory coated",
      "Tag and remove defective ladders immediately"
    ]),

    ...programSection("Setup Requirements", [
      "Ladders shall be set up on stable surfaces and used according to manufacturer requirements."
    ], [
      "Maintain 4:1 angle for extension ladders",
      "Extend at least 3 feet above landing when used for access",
      "Secure ladders when necessary to prevent movement",
      "Keep access area clear at top and bottom"
    ]),

    ...programSection("Safe Use", [
      "Employees shall face the ladder when climbing and maintain three points of contact whenever possible."
    ], [
      "Do not stand on top cap or top step unless ladder is designed for it",
      "Do not overreach outside side rails",
      "Do not carry loads that prevent safe climbing",
      "Use the correct ladder type and duty rating"
    ]),

    ...programSection("Prohibited Practices", [
      "Improper ladder use is prohibited."
    ], [
      "Using ladders horizontally as work platforms",
      "Using makeshift repairs",
      "Placing ladders on unstable materials",
      "Using metal ladders near exposed electrical hazards unless authorized and safe"
    ])
  ];
}

function program_ScaffoldSafety() {
  return [
    h2("Scaffold Safety Program"),

    ...programSection("Purpose", [
      "This section establishes requirements for scaffold erection, inspection, access, use, modification, and dismantling."
    ]),

    ...programSection("General Requirements", [
      "Scaffolds must be erected, moved, altered, and dismantled under the supervision of a competent person and used only for their intended purpose."
    ]),

    ...programSection("Inspection & Tagging", [
      "Scaffolds shall be inspected before each shift and after any event that could affect structural integrity."
    ], [
      "Use project scaffold tagging or equivalent status identification",
      "Do not use incomplete or red-tagged scaffolds",
      "Inspect planking, guardrails, access, casters, and foundation/support"
    ]),

    ...programSection("Access", [
      "Safe access shall be provided to scaffold work platforms."
    ], [
      "Use scaffold stairs, ladders, or designed access systems",
      "Do not climb cross bracing unless specifically designed for access",
      "Maintain clear access routes"
    ]),

    ...programSection("Fall Protection", [
      "Fall protection requirements for scaffolds shall comply with applicable regulations and project rules."
    ], [
      "Guardrails where required",
      "Personal fall protection where required by scaffold type or activity",
      "Controlled access to incomplete scaffold areas"
    ]),

    ...programSection("Use Restrictions", [
      "Scaffolds shall not be overloaded or used in a manner inconsistent with design."
    ], [
      "Observe load limits",
      "Do not remove guardrails or planks without authorization",
      "Keep platforms reasonably clear of excess debris and material"
    ])
  ];
}

function program_MEWP() {
  return [
    h2("MEWP / Aerial Lift Safety Program"),

    ...programSection("Purpose", [
      "This section establishes safety requirements for mobile elevating work platforms (MEWPs), aerial lifts, and similar elevated access equipment."
    ]),

    ...programSection("Authorized Operators", [
      "Only trained and authorized personnel may operate MEWPs or aerial lifts."
    ]),

    ...programSection("Pre-Use Inspection", [
      "Operators must inspect the equipment before use and verify that required safety devices are functional."
    ], [
      "Tires and structure",
      "Guardrails and gates",
      "Controls and emergency lowering",
      "Alarms and warning devices",
      "Harness anchorage points where applicable"
    ]),

    ...programSection("Work Area Assessment", [
      "The work area shall be assessed for surface conditions, overhead obstructions, power lines, traffic, holes, slopes, and line-of-fire exposures before operation."
    ]),

    ...programSection("Safe Operation", [
      "Operators shall follow manufacturer requirements and project rules during operation."
    ], [
      "Maintain fall protection as required",
      "Keep feet on platform floor",
      "Do not climb on rails",
      "Maintain clear travel path",
      "Do not exceed rated capacity",
      "Use spotters where needed"
    ]),

    ...programSection("Charging / Fueling / Parking", [
      "Equipment shall be parked, charged, or fueled only in approved locations with required controls in place."
    ])
  ];
}

function program_ForkliftsIndustrialTrucks() {
  return [
    h2("Forklifts & Industrial Trucks Program"),

    ...programSection("Purpose", [
      "This section establishes requirements for powered industrial truck operation, inspection, and material handling safety."
    ]),

    ...programSection("Operator Qualifications", [
      "Only trained and authorized operators may operate forklifts or powered industrial trucks on the project."
    ]),

    ...programSection("Pre-Use Inspection", [
      "Industrial trucks shall be inspected before each shift and removed from service if defects affect safe operation."
    ], [
      "Forks and mast",
      "Hydraulics",
      "Tires",
      "Horn and alarms",
      "Lights if required",
      "Seat belt",
      "Fluid leaks"
    ]),

    ...programSection("Safe Operation", [
      "Operators must maintain control of the load and equipment at all times."
    ], [
      "Travel at safe speed",
      "Wear seat belt where equipped",
      "Keep loads stable and within capacity",
      "Lower forks when parked",
      "Maintain clear view or use spotter if needed",
      "Keep pedestrians clear of operating zone"
    ]),

    ...programSection("Refueling / Charging", [
      "Refueling and battery charging shall be conducted in designated areas with ventilation, ignition control, and spill response capability as required."
    ]),

    ...programSection("Prohibited Practices", [
      "Unsafe forklift practices are prohibited."
    ], [
      "Riders not in designated seats",
      "Traveling with elevated load without need",
      "Using damaged pallets without evaluation",
      "Passing under elevated forks or loads"
    ])
  ];
}

function program_MaterialHandlingRiggingSupport() {
  return [
    h2("Material Handling & Rigging Support"),

    ...programSection("Purpose", [
      "This section establishes safe practices for manual and mechanical material handling, staging, and support activities associated with rigging and delivery."
    ]),

    ...programSection("Planning", [
      "Material movement shall be planned before execution to reduce struck-by, overexertion, pinch-point, and access hazards."
    ], [
      "Evaluate route and destination",
      "Confirm material weight and dimensions where possible",
      "Assign spotters when needed",
      "Verify storage location is ready"
    ]),

    ...programSection("Manual Handling", [
      "Employees shall use safe lifting techniques and mechanical assistance where appropriate."
    ], [
      "Assess load before lifting",
      "Use team lift when needed",
      "Keep load close to body",
      "Avoid twisting while lifting",
      "Use carts, dollies, or lifting aids when possible"
    ]),

    ...programSection("Mechanical Handling", [
      "Mechanical equipment used for material handling shall be appropriate for the task and operated by authorized personnel."
    ]),

    ...programSection("Staging", [
      "Staged materials shall be placed so they do not create instability, overload platforms, or block work access and emergency routes."
    ])
  ];
}

function program_ToolsEquipmentTemporaryPower() {
  return [
    h2("Tools, Equipment & Temporary Power"),

    ...programSection("Purpose", [
      "This section establishes requirements for inspection and safe use of hand tools, power tools, jobsite equipment, and temporary power systems."
    ]),

    ...programSection("Inspection", [
      "Tools and equipment must be inspected before use and removed from service if defective."
    ], [
      "Check guards and safety devices",
      "Inspect cords and plugs",
      "Verify labels and ratings where needed",
      "Confirm batteries and chargers are in good condition"
    ]),

    ...programSection("Power Tool Safety", [
      "Power tools shall be used according to manufacturer recommendations and task requirements."
    ], [
      "Use correct tool for the task",
      "Do not bypass guards",
      "Secure workpiece where necessary",
      "Disconnect power before servicing or blade changes"
    ]),

    ...programSection("Temporary Power", [
      "Temporary power installations shall be maintained in a safe condition and protected from damage."
    ], [
      "Use GFCI protection where required",
      "Protect cords from traffic and pinch points",
      "Maintain clear access to panels",
      "Do not use damaged cords or improvised wiring"
    ]),

    ...programSection("Compressed Air / Pneumatic Equipment", [
      "Compressed air and pneumatic tools shall be used with appropriate fittings, whip checks where required, and pressure controls."
    ])
  ];
}

function program_LineOfFireStruckByCaughtBetween() {
  return [
    h2("Line of Fire, Struck-By & Caught-Between Prevention"),

    ...programSection("Purpose", [
      "This section establishes awareness and control measures for line-of-fire hazards, struck-by exposures, and caught-between incidents."
    ]),

    ...programSection("Common Exposures", [
      "Line-of-fire hazards exist when a worker is placed in the path of moving equipment, suspended loads, released energy, shifting material, or pinch-point zones."
    ], [
      "Backing equipment",
      "Swinging loads",
      "Dropped objects",
      "Stored energy release",
      "Pinch points between equipment and structures",
      "Shifting materials"
    ]),

    ...programSection("Required Controls", [
      "Work shall be planned and executed to keep personnel out of exposure zones."
    ], [
      "Establish barricades and exclusion zones",
      "Use spotters and signal persons",
      "Maintain awareness of equipment travel paths",
      "Never position under suspended loads",
      "Control stored energy before work begins"
    ]),

    ...programSection("Worker Responsibilities", [
      "Employees must stay alert to changing conditions and avoid placing themselves between fixed and moving objects or within drop zones."
    ]),

    ...programSection("Supervision", [
      "Supervisors shall address line-of-fire hazards during pre-task planning and coordinate controls with adjacent trades."
    ])
  ];
}

function program_EnvironmentalControls() {
  return [
    h2("Environmental Controls & Site Conditions"),

    ...programSection("Purpose", [
      "This section establishes requirements for managing environmental conditions and controlling impacts associated with construction activities."
    ]),

    ...programSection("General Expectations", [
      "Contractors shall follow project requirements related to dust, waste, stormwater, chemical handling, noise, and other environmental concerns."
    ]),

    ...programSection("Dust and Airborne Debris", [
      "Activities generating dust or airborne debris shall be controlled to protect workers, nearby operations, and the surrounding environment."
    ], [
      "Use water or vacuum controls where appropriate",
      "Maintain housekeeping to reduce dust accumulation",
      "Protect adjacent finished or sensitive areas when needed"
    ]),

    ...programSection("Spill Prevention", [
      "Fuel, oil, chemicals, and similar materials shall be stored and used to minimize the risk of spills or releases."
    ], [
      "Use proper containers and labels",
      "Maintain spill kits where needed",
      "Report and clean spills promptly",
      "Dispose of waste according to requirements"
    ]),

    ...programSection("Weather and Site Conditions", [
      "Site conditions such as mud, ice, snow, wind, heat, and rain shall be monitored and addressed before and during work activities."
    ]),

    ...programSection("Noise / Vibration / Community Impact", [
      "Operations that generate elevated noise, vibration, or other offsite impacts shall be managed in accordance with project and local requirements."
    ])
  ];
}

function program_SteelErection() {
  return [
    h2("Steel Erection Program"),

    ...programSection("Purpose", [
      "This section establishes requirements for structural steel erection, decking, connection work, and associated fall, rigging, and stability hazards."
    ]),

    ...programSection("Planning", [
      "Steel erection activities shall be planned in advance with consideration for sequencing, stability, access, fall protection, hoisting, and exclusion zones."
    ], [
      "Review erection drawings and sequencing",
      "Verify structural stability requirements",
      "Coordinate crane and rigging support",
      "Establish access and drop zone controls"
    ]),

    ...programSection("Fall Protection", [
      "Fall protection for steel erection shall comply with applicable regulations and project requirements."
    ], [
      "Use designated access where possible",
      "Maintain controlled decking zones only where permitted",
      "Use personal fall protection where required",
      "Protect openings and edges promptly"
    ]),

    ...programSection("Structural Stability", [
      "No member shall be released from the hoisting line until properly secured and stability requirements are met."
    ]),

    ...programSection("Connections & Decking", [
      "Connection work and decking operations shall be coordinated to minimize exposure to falls, dropped objects, and unstable materials."
    ])
  ];
}

function program_ConcreteMasonry() {
  return [
    h2("Concrete & Masonry Program"),

    ...programSection("Purpose", [
      "This section establishes safety requirements for concrete, masonry, formwork, reinforcing steel, placement, finishing, and related activities."
    ]),

    ...programSection("Hazards", [
      "Concrete and masonry operations may expose workers to impalement, form failure, silica, chemical burns, struck-by hazards, and material handling injuries."
    ], [
      "Rebar impalement hazards",
      "Formwork failure",
      "Wet concrete skin exposure",
      "Silica dust",
      "Heavy material handling"
    ]),

    ...programSection("Formwork & Reshoring", [
      "Forms, shores, and reshoring systems shall be erected, braced, and maintained according to design and manufacturer requirements where applicable."
    ]),

    ...programSection("Rebar Protection", [
      "Exposed reinforcing steel that presents an impalement hazard shall be protected."
    ]),

    ...programSection("Placement & Finishing", [
      "Concrete placement and finishing shall be coordinated to control access, hose movement, line-of-fire exposure, and slip/trip hazards."
    ]),

    ...programSection("Masonry Activities", [
      "Masonry work shall include safe material staging, scaffold use, cutting controls, and wall bracing where required."
    ])
  ];
}

function program_Demolition() {
  return [
    h2("Demolition Program"),

    ...programSection("Purpose", [
      "This section establishes requirements for demolition, selective demolition, teardown, and removal activities."
    ]),

    ...programSection("Engineering Survey / Pre-Planning", [
      "Demolition work shall not begin until the structure or affected area has been evaluated for stability, utilities, hazardous materials, and sequencing."
    ], [
      "Identify structural hazards",
      "Locate and control utilities",
      "Evaluate adjacent occupancy and protection needs",
      "Establish demolition sequence and debris handling plan"
    ]),

    ...programSection("Access Control", [
      "Demolition areas shall be barricaded and controlled to prevent unauthorized entry."
    ]),

    ...programSection("Debris Removal", [
      "Debris shall be removed in a controlled manner that does not overload floors, create falling-object hazards, or block access/egress."
    ]),

    ...programSection("Hazard Controls", [
      "Demolition may involve silica, noise, dust, sharp materials, hidden energy sources, and unstable components."
    ], [
      "Dust suppression and respiratory controls as needed",
      "Cut-resistant gloves where appropriate",
      "Utility verification before disturbance",
      "Protection from falling material"
    ])
  ];
}

function program_TemporaryStructuresBracing() {
  return [
    h2("Temporary Structures, Supports & Bracing"),

    ...programSection("Purpose", [
      "This section establishes requirements for temporary structures, supports, shoring, bracing, and stability controls used during construction."
    ]),

    ...programSection("General Requirements", [
      "Temporary structures and support systems shall be capable of supporting intended loads and maintained in a stable condition."
    ]),

    ...programSection("Inspection", [
      "Temporary systems shall be inspected after installation and periodically thereafter, especially after impact, weather events, or changes in loading."
    ]),

    ...programSection("Modification Control", [
      "No temporary support, brace, anchor, or restraint shall be removed or modified without authorization from responsible supervision or design authority where applicable."
    ]),

    ...programSection("Access & Loading", [
      "Workers shall not overload temporary structures or use them beyond their intended purpose."
    ])
  ];
}

function program_HazardCommunication() {
  return [
    h2("Hazard Communication Program"),

    ...programSection("Purpose", [
      "This section establishes requirements for communicating chemical hazards to employees through labels, Safety Data Sheets (SDS), and training."
    ]),

    ...programSection("Chemical Inventory & SDS", [
      "Each employer shall maintain access to SDS for hazardous chemicals used or stored onsite and communicate associated hazards to employees."
    ]),

    ...programSection("Labeling", [
      "All chemical containers shall be properly labeled unless specifically exempted by regulation."
    ], [
      "Maintain manufacturer labels where applicable",
      "Label secondary containers as required",
      "Do not use unidentified chemicals"
    ]),

    ...programSection("Training", [
      "Employees shall be trained on chemical hazards, label elements, SDS access, and protective measures prior to exposure."
    ]),

    ...programSection("Project Coordination", [
      "Contractors shall coordinate hazardous chemical use that could affect adjacent trades, occupied areas, or the public."
    ])
  ];
}

function program_ChemicalSafety() {
  return [
    h2("Chemical Safety Program"),

    ...programSection("Purpose", [
      "This section establishes requirements for safe handling, storage, transfer, and disposal of chemicals used on the project."
    ]),

    ...programSection("General Handling", [
      "Chemicals shall be used in accordance with SDS recommendations, manufacturer instructions, and project requirements."
    ], [
      "Use proper PPE",
      "Avoid incompatible mixing",
      "Maintain ventilation where required",
      "Control ignition sources where applicable"
    ]),

    ...programSection("Storage", [
      "Chemicals shall be stored in approved containers and locations with attention to compatibility, labeling, and environmental protection."
    ]),

    ...programSection("Spill Response", [
      "Spill kits and response procedures shall be available where needed. Spills shall be reported and managed promptly."
    ]),

    ...programSection("Waste Disposal", [
      "Chemical waste shall be managed according to project and regulatory requirements."
    ])
  ];
}

function program_SilicaExposureControl() {
  return [
    h2("Silica Exposure Control Program"),

    ...programSection("Purpose", [
      "This section establishes controls for respirable crystalline silica exposure during tasks such as cutting, grinding, drilling, chipping, demolition, and masonry operations."
    ]),

    ...programSection("Exposure-Generating Tasks", [
      "Employers shall identify tasks that may generate respirable silica and implement effective controls before work begins."
    ]),

    ...programSection("Control Measures", [
      "Engineering and work practice controls shall be used to minimize airborne exposure."
    ], [
      "Wet methods where applicable",
      "HEPA vacuum dust collection",
      "Minimize dry sweeping",
      "Use tools designed for dust capture"
    ]),

    ...programSection("Respiratory Protection", [
      "Respiratory protection shall be used when required by applicable standards, task controls, or exposure assessment."
    ]),

    ...programSection("Housekeeping", [
      "Housekeeping methods shall not create unnecessary airborne silica exposure."
    ])
  ];
}

function program_HeatIllnessPrevention() {
  return [
    h2("Heat Illness Prevention Program"),

    ...programSection("Purpose", [
      "This section establishes requirements for recognizing, preventing, and responding to heat-related illness."
    ]),

    ...programSection("Risk Factors", [
      "Heat illness risk may increase due to high temperature, humidity, radiant heat, physical exertion, PPE burden, and inadequate acclimatization."
    ]),

    ...programSection("Preventive Measures", [
      "Supervision shall implement appropriate controls during hot weather conditions."
    ], [
      "Provide water and encourage hydration",
      "Allow rest breaks as needed",
      "Provide shaded or cooler recovery areas where feasible",
      "Monitor new or returning workers for acclimatization"
    ]),

    ...programSection("Recognition & Response", [
      "Workers and supervisors shall be trained to recognize early signs of heat stress and take prompt action."
    ], [
      "Stop work if symptoms appear",
      "Move affected worker to cooler area",
      "Notify supervision immediately",
      "Seek medical attention when needed"
    ])
  ];
}

function program_ColdStressWinterWork() {
  return [
    h2("Cold Stress & Winter Work Program"),

    ...programSection("Purpose", [
      "This section establishes requirements for protecting workers from cold stress, winter weather, and related site hazards."
    ]),

    ...programSection("Hazards", [
      "Cold temperatures, wind, snow, ice, and wet conditions can increase the risk of slips, frostbite, hypothermia, reduced dexterity, and unsafe access."
    ]),

    ...programSection("Controls", [
      "Project leadership and contractors shall evaluate winter conditions and implement appropriate controls."
    ], [
      "Treat or remove snow and ice from access routes",
      "Use weather-appropriate PPE and layering",
      "Provide warm-up opportunities when needed",
      "Monitor workers for signs of cold stress"
    ]),

    ...programSection("Work Surface Safety", [
      "Walking and working surfaces shall be maintained to reduce slip hazards and preserve safe access."
    ])
  ];
}

function program_RespiratoryProtection() {
  return [
    h2("Respiratory Protection Program"),

    ...programSection("Purpose", [
      "This section establishes requirements for respiratory protection where airborne hazards cannot be adequately controlled by other means."
    ]),

    ...programSection("Program Requirements", [
      "Employers requiring respirator use shall implement a respiratory protection program consistent with applicable standards."
    ], [
      "Medical evaluation where required",
      "Fit testing where required",
      "Training on use, limitations, and care",
      "Appropriate cartridge/filter selection"
    ]),

    ...programSection("Voluntary Use", [
      "Voluntary respirator use shall be managed in accordance with applicable requirements and manufacturer instructions."
    ]),

    ...programSection("Storage & Maintenance", [
      "Respirators shall be stored, cleaned, maintained, and inspected to preserve effectiveness."
    ])
  ];
}

function program_FirePrevention() {
  return [
    h2("Fire Prevention Program"),

    ...programSection("Purpose", [
      "This section establishes requirements for preventing fires and controlling ignition sources on the project."
    ]),

    ...programSection("Ignition Source Control", [
      "Potential ignition sources shall be identified and controlled during planning and execution of work."
    ], [
      "Hot work permitting where required",
      "No smoking restrictions enforced",
      "Control temporary heating devices",
      "Maintain electrical equipment in safe condition"
    ]),

    ...programSection("Combustible Control", [
      "Combustible waste and materials shall be managed to limit fire load and ignition potential."
    ]),

    ...programSection("Fire Protection Equipment", [
      "Portable extinguishers and other fire response equipment shall be available, accessible, and inspected as required."
    ]),

    ...programSection("Emergency Response", [
      "Personnel shall know how to report a fire, initiate alarm/notification procedures, and evacuate when necessary."
    ])
  ];
}

function program_FlammableLiquidsGasStorage() {
  return [
    h2("Flammable Liquids, Fuel Gas & Cylinder Storage"),

    ...programSection("Purpose", [
      "This section establishes requirements for storage and handling of flammable liquids, combustible liquids, fuel gases, and compressed gas cylinders."
    ]),

    ...programSection("General Storage", [
      "Flammable and combustible materials shall be stored in approved containers and locations with required separation, ventilation, and ignition control."
    ]),

    ...programSection("Compressed Gas Cylinders", [
      "Compressed gas cylinders shall be secured and protected from damage."
    ], [
      "Store upright and secured",
      "Install valve caps when not in use",
      "Separate oxygen and fuel gases as required",
      "Keep away from heat and impact"
    ]),

    ...programSection("Handling", [
      "Cylinders and flammable containers shall be handled carefully to prevent leaks, rupture, or ignition."
    ]),

    ...programSection("Inspection", [
      "Containers, regulators, hoses, and storage conditions shall be inspected routinely."
    ])
  ];
}

function program_SiteTrafficControl() {
  return [
    h2("Site Traffic Control Program"),

    ...programSection("Purpose", [
      "This section establishes requirements for controlling vehicle traffic, pedestrian interaction, delivery routes, backing operations, and site logistics movement."
    ]),

    ...programSection("General Requirements", [
      "Site traffic shall be planned and controlled to minimize struck-by hazards, congestion, access conflicts, and unauthorized vehicle movement."
    ], [
      "Establish designated travel routes",
      "Separate pedestrians from equipment where feasible",
      "Control backing and blind-spot exposure",
      "Use signage, barricades, and spotters where needed"
    ]),

    ...programSection("Equipment / Pedestrian Interface", [
      "Pedestrian access routes shall be maintained and clearly identified where practical. Workers shall remain alert to moving vehicles and equipment at all times."
    ]),

    ...programSection("Backing / Spotter Requirements", [
      "Backing operations shall be limited where possible. When required, spotters or other control measures shall be used as appropriate for site conditions."
    ]),

    ...programSection("Temporary Route Changes", [
      "Changes to traffic routes, access points, or delivery patterns shall be communicated promptly to affected contractors and personnel."
    ])
  ];
}

function program_DeliveryLogisticsManagement() {
  return [
    h2("Delivery, Staging & Logistics Management"),

    ...programSection("Purpose", [
      "This section establishes requirements for coordinating deliveries, unloading, staging, and internal logistics movement."
    ]),

    ...programSection("Planning", [
      "Deliveries shall be planned to avoid congestion, access obstruction, overlapping work conflicts, and uncontrolled unloading activity."
    ], [
      "Confirm delivery route and arrival point",
      "Coordinate with superintendent or logistics lead",
      "Verify receiving area is clear and ready",
      "Assess unloading equipment needs in advance"
    ]),

    ...programSection("Staging Requirements", [
      "Materials shall be staged only in approved areas and in a manner that does not overload surfaces, block access, or create line-of-fire hazards."
    ]),

    ...programSection("Unloading Controls", [
      "Unloading activity shall be controlled to protect workers from shifting loads, suspended materials, traffic exposure, and pinch points."
    ]),

    ...programSection("Housekeeping During Deliveries", [
      "Packaging, banding, dunnage, and waste generated during deliveries shall be controlled and removed to prevent unsafe conditions."
    ])
  ];
}

function program_StopWorkAuthority() {
  return [
    h2("Stop Work Authority"),

    ...programSection("Purpose", [
      "This section establishes stop work authority for unsafe conditions, unplanned high-risk exposure, and situations where controls are absent or ineffective."
    ]),

    ...programSection("Authority", [
      "Every worker on the project has the responsibility and authority to stop or pause work when an unsafe condition or unsafe act presents imminent risk or when work cannot be performed safely."
    ]),

    ...programSection("Expectations", [
      "Stop work shall be exercised in good faith and without fear of retaliation."
    ], [
      "Pause the activity",
      "Notify supervision immediately",
      "Protect affected personnel from ongoing exposure",
      "Do not resume until corrective action is complete"
    ]),

    ...programSection("Resolution", [
      "Once work is stopped, supervision shall evaluate the condition, implement corrective actions, communicate changes, and verify the work can safely resume."
    ]),

    ...programSection("Documentation", [
      "Projects may document stop work events to support trend analysis, lessons learned, and improvement of planning processes."
    ])
  ];
}

function program_SafetyDisciplinaryPolicy() {
  return [
    h2("Safety Accountability & Disciplinary Policy"),

    ...programSection("Purpose", [
      "This section establishes a consistent approach for correcting unsafe behavior and repeated noncompliance with project safety requirements."
    ]),

    ...programSection("General Expectations", [
      "All workers, supervisors, and contractors are expected to comply with project safety rules, permits, procedures, and hazard controls."
    ]),

    ...programSection("Corrective Actions", [
      "The project may use progressive or immediate corrective action depending on the severity of the violation."
    ], [
      "Coaching / verbal warning",
      "Written warning",
      "Removal from work area",
      "Removal from site",
      "Escalation to employer management"
    ]),

    ...programSection("Serious Violations", [
      "Serious or willful violations may result in immediate removal from the project and additional contractual consequences as determined by project leadership."
    ]),

    ...programSection("Employer Responsibility", [
      "Each employer remains responsible for disciplinary action affecting its employees and for providing effective supervision to prevent recurrence."
    ])
  ];
}

function program_SubcontractorSafetyRequirements() {
  return [
    h2("Subcontractor Safety Requirements"),

    ...programSection("Purpose", [
      "This section establishes minimum safety expectations for subcontractors and lower-tier subcontractors working on the project."
    ]),

    ...programSection("Pre-Mobilization Expectations", [
      "Subcontractors shall provide required safety documentation before beginning work where required by the project."
    ], [
      "Safety plan / hazard program information",
      "Training and qualification records",
      "Insurance / contractual safety documentation where applicable",
      "Emergency contact information",
      "Competent / qualified person designations where applicable"
    ]),

    ...programSection("Field Responsibilities", [
      "Subcontractors are responsible for supervising their work, enforcing PPE, completing pre-task planning, and coordinating with adjacent trades."
    ]),

    ...programSection("Lower-Tier Oversight", [
      "Subcontractors are responsible for ensuring lower-tier subcontractors comply with the same project safety expectations."
    ]),

    ...programSection("Noncompliance", [
      "Failure to comply with project safety requirements may result in corrective action, stop work, removal from site, or escalation through project leadership."
    ])
  ];
}

function program_PublicProtectionOccupiedAreas() {
  return [
    h2("Public Protection & Occupied Area Controls"),

    ...programSection("Purpose", [
      "This section establishes requirements for protecting occupants, visitors, the public, and adjacent operations from construction-related hazards."
    ]),

    ...programSection("Access Control", [
      "Construction areas shall be separated from occupied or public areas through barricades, signage, partitions, controlled access points, or other effective means."
    ]),

    ...programSection("Overhead / Falling Object Protection", [
      "Where work could expose occupied or public areas to falling materials, the project shall implement overhead protection, exclusion zones, debris netting, or equivalent controls."
    ]),

    ...programSection("Noise / Dust / Utility Impact", [
      "Work affecting occupied spaces may require additional coordination to control noise, vibration, dust, odors, shutdowns, and access interruptions."
    ]),

    ...programSection("Communication", [
      "Planned impacts to occupants, adjacent operations, or the public should be communicated in advance through project channels where required."
    ])
  ];
}

function program_SanitationWelfareFacilities() {
  return [
    h2("Sanitation, Drinking Water & Welfare Facilities"),

    ...programSection("Purpose", [
      "This section establishes requirements for sanitary conditions, drinking water, handwashing, and worker welfare facilities."
    ]),

    ...programSection("Sanitation Requirements", [
      "Toilets, wash stations, break areas, and related facilities shall be provided and maintained in a sanitary condition consistent with applicable requirements."
    ]),

    ...programSection("Drinking Water", [
      "Potable drinking water shall be available and protected from contamination."
    ]),

    ...programSection("Housekeeping of Welfare Areas", [
      "Break areas, gang boxes used for storage of food, and welfare facilities shall be maintained in an orderly and sanitary condition."
    ]),

    ...programSection("Cold / Heat Conditions", [
      "Additional welfare considerations may be necessary during extreme heat, cold, or other environmental conditions."
    ])
  ];
}

function program_SecuritySiteAccessControl() {
  return [
    h2("Security & Site Access Control"),

    ...programSection("Purpose", [
      "This section establishes requirements for controlling access to the project and protecting materials, equipment, personnel, and the site."
    ]),

    ...programSection("Authorized Access", [
      "Only authorized personnel, approved visitors, and scheduled delivery drivers may access the project."
    ]),

    ...programSection("Identification / Check-In", [
      "Projects may require badges, sign-in logs, orientation verification, or other access control measures before entry."
    ]),

    ...programSection("Restricted Areas", [
      "Restricted areas shall be clearly identified and entered only by authorized personnel with a business need and required training."
    ]),

    ...programSection("After-Hours Security", [
      "Equipment, tools, and materials shall be secured when not in use. Additional after-hours controls may be implemented for sensitive or high-value areas."
    ])
  ];
}

function program_SevereWeatherResponse() {
  return [
    h2("Severe Weather Response Program"),

    ...programSection("Purpose", [
      "This section establishes requirements for monitoring and responding to lightning, high winds, heavy rain, tornado warnings, extreme cold, extreme heat, and similar weather events."
    ]),

    ...programSection("Monitoring", [
      "Project leadership shall monitor weather conditions and communicate changing conditions that may affect safe operations."
    ]),

    ...programSection("Work Suspension Criteria", [
      "Certain activities may need to be suspended when weather creates unacceptable risk."
    ], [
      "Cranes / lifts in high wind",
      "Elevated work during lightning or severe storms",
      "Excavation work during heavy rain or unstable conditions",
      "Roof work during unsafe weather exposure"
    ]),

    ...programSection("Shelter / Response", [
      "Workers shall know where to seek shelter and how to respond when severe weather notifications are issued."
    ]),

    ...programSection("Post-Event Evaluation", [
      "Following severe weather, work areas, excavations, scaffolds, temporary structures, and equipment shall be evaluated before work resumes."
    ])
  ];
}

function program_FirstAidMedicalServices() {
  return [
    h2("First Aid, Medical Services & Injury Management"),

    ...programSection("Purpose", [
      "This section establishes requirements for first aid resources, medical response coordination, and injury reporting on the project."
    ]),

    ...programSection("Availability", [
      "First aid supplies, trained personnel where required, and emergency communication methods shall be available consistent with project needs and applicable requirements."
    ]),

    ...programSection("Response Process", [
      "When an injury or illness occurs, supervision shall be notified immediately and the appropriate response initiated."
    ], [
      "Provide first aid if trained and appropriate",
      "Contact emergency services when needed",
      "Direct responders to the exact location",
      "Preserve the scene when required"
    ]),

    ...programSection("Transportation / Clinics", [
      "Project teams should identify the nearest clinic, hospital, and transportation process for non-emergency injuries where needed."
    ]),

    ...programSection("Documentation", [
      "Injuries, first aid cases, and medical events shall be documented and reported according to project and employer requirements."
    ])
  ];
}

function program_ErgonomicsManualHandling() {
  return [
    h2("Ergonomics & Manual Handling Program"),

    ...programSection("Purpose", [
      "This section establishes requirements for reducing musculoskeletal strain, overexertion, repetitive motion exposure, and injuries related to manual handling."
    ]),

    ...programSection("General Expectations", [
      "Work activities shall be planned to reduce excessive lifting, awkward postures, repetitive motion, forceful exertion, and unnecessary carrying distances."
    ], [
      "Assess load size and weight before lifting",
      "Use carts, dollies, forklifts, or hoists where feasible",
      "Use team lifting when appropriate",
      "Stage material closer to point of use when possible"
    ]),

    ...programSection("Body Mechanics", [
      "Workers shall use sound body mechanics and avoid lifting or moving materials in a manner that places unnecessary strain on the back, shoulders, knees, or wrists."
    ], [
      "Keep loads close to the body",
      "Avoid twisting while lifting",
      "Lift with the legs where possible",
      "Break down large or awkward loads when feasible"
    ]),

    ...programSection("Workstation / Task Layout", [
      "Task layout should be reviewed to reduce reaching, bending, kneeling, overhead work, and sustained awkward positioning where possible."
    ]),

    ...programSection("Reporting", [
      "Employees should report symptoms of strain, overexertion, or repetitive-use discomfort early so adjustments can be made before injury occurs."
    ])
  ];
}

function program_HandPowerToolsExpansion() {
  return [
    h2("Hand & Power Tools - Detailed Requirements"),

    ...programSection("Purpose", [
      "This section expands on requirements for hand tools, portable power tools, and common jobsite equipment used during construction activities."
    ]),

    ...programSection("Selection", [
      "Only tools appropriate for the intended task and in safe working condition shall be used."
    ], [
      "Use the correct tool for the application",
      "Observe manufacturer limitations",
      "Do not improvise with damaged or modified tools"
    ]),

    ...programSection("Inspection", [
      "Tools shall be inspected before use for damage, missing guards, worn cords, cracked housings, damaged bits/blades, or other defects affecting safe operation."
    ]),

    ...programSection("Guarding & Safety Devices", [
      "Required guards and safety devices shall remain in place and functional at all times unless the equipment is removed from service for authorized maintenance."
    ]),

    ...programSection("Portable Electric Tools", [
      "Portable electric tools shall be protected from moisture, physical damage, and unauthorized modification. GFCI protection shall be used where required."
    ]),

    ...programSection("Battery-Powered Tools", [
      "Battery-powered tools and chargers shall be used and stored according to manufacturer instructions. Damaged batteries shall be removed from service."
    ]),

    ...programSection("Grinding / Abrasive Tools", [
      "Grinding and abrasive wheel use requires special attention to wheel compatibility, guarding, face protection, and spark control."
    ], [
      "Match wheel rating to equipment speed",
      "Inspect wheel before use",
      "Use guards and face protection",
      "Control sparks and hot particles"
    ]),

    ...programSection("Storage & Housekeeping", [
      "Tools shall be stored in an orderly manner to prevent damage and reduce trip or struck-by hazards."
    ])
  ];
}

function program_WeldingCuttingExpansion() {
  return [
    h2("Welding, Cutting & Brazing - Detailed Requirements"),

    ...programSection("Purpose", [
      "This section expands on safety requirements for welding, torch cutting, brazing, soldering, grinding associated with hot work, and related support activities."
    ]),

    ...programSection("Pre-Work Assessment", [
      "Before beginning hot work, the area shall be assessed for combustibles, adjacent occupancy, ventilation, overhead hazards, confined spaces, and permit requirements."
    ]),

    ...programSection("Ventilation", [
      "Adequate ventilation shall be provided when welding, cutting, or brazing creates fumes, smoke, or gases that may affect workers or adjacent trades."
    ]),

    ...programSection("Cylinder / Hose / Regulator Safety", [
      "Compressed gas cylinders, hoses, torches, and regulators shall be inspected before use and handled to prevent leaks, backflow, flashback, or tip-over."
    ]),

    ...programSection("Fire Prevention", [
      "Hot work shall not begin until fire prevention controls are in place and the area is suitable for the activity."
    ], [
      "Combustibles removed or protected",
      "Extinguisher staged",
      "Fire watch assigned where required",
      "Spark containment in place",
      "Area above, below, and adjacent inspected"
    ]),

    ...programSection("PPE Requirements", [
      "Task-specific PPE shall be worn based on the type of hot work being performed and the associated hazards."
    ], [
      "Welding hood or eye protection with correct shade",
      "Gloves suitable for hot work",
      "Protective clothing / sleeves as needed",
      "Face shield for grinding where applicable"
    ]),

    ...programSection("Post-Work Monitoring", [
      "When required, the work area shall be monitored after completion of hot work to verify no ignition source remains."
    ])
  ];
}

function program_ElectricalLOTOExpansion() {
  return [
    h2("Electrical Safety & LOTO - Detailed Requirements"),

    ...programSection("Purpose", [
      "This section expands on electrical safety, temporary power, troubleshooting restrictions, and hazardous energy control requirements."
    ]),

    ...programSection("Planning & Authorization", [
      "Electrical work shall be planned in advance and performed only by personnel with the training and qualifications appropriate for the task."
    ]),

    ...programSection("De-Energization Priority", [
      "Equipment and systems shall be de-energized and verified safe before work begins whenever feasible."
    ]),

    ...programSection("Verification of Isolation", [
      "Lockout / tagout is not complete until isolation is verified using appropriate methods."
    ], [
      "Identify all energy sources",
      "Apply lock(s) / tag(s)",
      "Release stored energy",
      "Verify zero energy condition"
    ]),

    ...programSection("Temporary Power Management", [
      "Temporary power systems shall be installed, protected, and maintained to reduce shock, fire, trip, and equipment damage hazards."
    ]),

    ...programSection("Panel / Disconnect Access", [
      "Working clearance around electrical panels, disconnects, and related equipment shall be maintained at all times."
    ]),

    ...programSection("Damaged Equipment", [
      "Damaged cords, receptacles, covers, adapters, and electrical equipment shall be removed from service immediately."
    ]),

    ...programSection("Restrictions", [
      "Unauthorized energized work, unprotected troubleshooting, or makeshift wiring practices are prohibited."
    ])
  ];
}

function program_ExcavationDeepExpansion() {
  return [
    h2("Excavation & Trenching - Detailed Requirements"),

    ...programSection("Purpose", [
      "This section expands excavation and trenching controls including preplanning, inspection, access, spoil placement, utilities, and emergency response."
    ]),

    ...programSection("Pre-Excavation Planning", [
      "Excavation work shall be planned before disturbance begins."
    ], [
      "Identify excavation scope and location",
      "Verify utility locate / clearance process",
      "Determine soil conditions where applicable",
      "Select protective system",
      "Coordinate access and spoil placement"
    ]),

    ...programSection("Competent Person Duties", [
      "A competent person shall inspect excavations, surrounding areas, and protective systems before work starts, as conditions change, and after hazard-increasing events."
    ]),

    ...programSection("Access / Egress", [
      "Safe access and egress shall be provided for trenches and excavations as required."
    ], [
      "Ladders or approved access where required",
      "Travel distance controlled",
      "Access kept clear and stable"
    ]),

    ...programSection("Spoil / Equipment Setback", [
      "Spoil piles, materials, and equipment shall be kept back from excavation edges as required to reduce surcharge and falling material hazards."
    ]),

    ...programSection("Water Accumulation", [
      "Excavation work shall not continue in a manner that exposes employees to unsafe water accumulation or unstable conditions."
    ]),

    ...programSection("Utility Exposure", [
      "Exposed utilities shall be protected and excavation in utility conflict areas shall be coordinated with responsible parties."
    ]),

    ...programSection("Emergency Preparedness", [
      "Excavation rescue and emergency response considerations shall be addressed during planning, especially where deeper excavations, utility exposure, or adjacent structures increase risk."
    ])
  ];
}

function program_ConfinedSpaceDeepExpansion() {
  return [
    h2("Confined Space Entry - Detailed Requirements"),

    ...programSection("Purpose", [
      "This section expands confined space evaluation, entry permit controls, atmospheric testing, rescue coordination, and role responsibilities."
    ]),

    ...programSection("Space Evaluation", [
      "Potential confined spaces shall be evaluated before entry to determine whether permit-required conditions exist."
    ]),

    ...programSection("Entry Roles", [
      "When permit-required confined space entry is performed, entry roles shall be clearly assigned."
    ], [
      "Entry supervisor",
      "Authorized entrant(s)",
      "Attendant",
      "Rescue support where required"
    ]),

    ...programSection("Atmospheric Testing", [
      "Atmospheric testing shall be conducted using calibrated equipment and in the proper sequence where atmospheric hazards may exist."
    ], [
      "Oxygen content",
      "Flammable atmosphere",
      "Toxic contaminants as applicable"
    ]),

    ...programSection("Isolation & Hazard Control", [
      "Hazardous energy, engulfment sources, mechanical hazards, and other identified exposures shall be isolated or controlled before entry."
    ]),

    ...programSection("Communications", [
      "Reliable communication shall be maintained between entrants and attendants for the duration of the entry."
    ]),

    ...programSection("Rescue Planning", [
      "Rescue planning shall be completed before entry begins. Rescue capability shall match the hazards and conditions of the space."
    ]),

    ...programSection("Permit Closeout", [
      "Permits shall be closed out when work is completed or when entry conditions change such that reevaluation is required."
    ])
  ];
}

function program_CraneLiftPlanningExpansion() {
  return [
    h2("Crane, Hoisting & Lift Planning - Detailed Requirements"),

    ...programSection("Purpose", [
      "This section expands lift planning, rigging verification, communication, environmental limits, and critical lift controls."
    ]),

    ...programSection("Lift Classification", [
      "Lifts shall be evaluated to determine whether routine or critical lift controls are required by project policy."
    ]),

    ...programSection("Lift Plan Content", [
      "Lift plans should clearly identify the load, equipment, radius, pick point, set location, communication method, travel path, and identified hazards."
    ]),

    ...programSection("Rigging Verification", [
      "Rigging components shall be selected based on load characteristics, capacity, connection points, and environmental conditions."
    ], [
      "Slings and hardware inspected",
      "Capacities verified",
      "Load center of gravity understood",
      "Tag lines used when appropriate"
    ]),

    ...programSection("Ground / Setup Conditions", [
      "Crane setup locations shall be assessed for stability, surface condition, slope, underground concerns, and swing radius protection."
    ]),

    ...programSection("Communication", [
      "Signal methods shall be established before the lift begins. Only one designated signal person should direct the lift unless an agreed transfer occurs."
    ]),

    ...programSection("Suspended Load Controls", [
      "Personnel shall not be exposed beneath suspended loads or within unprotected swing / line-of-fire zones."
    ]),

    ...programSection("Environmental Limits", [
      "Lifts shall be reevaluated when wind, visibility, weather, or changing site conditions could affect safe execution."
    ])
  ];
}

function program_FallProtectionExpansion() {
  return [
    h2("Fall Protection - Rescue, Anchorage & Inspection Expansion"),

    ...programSection("Purpose", [
      "This section expands fall protection requirements for equipment inspection, anchorage, rescue planning, and supervision of exposed work."
    ]),

    ...programSection("Pre-Task Planning", [
      "Fall exposure shall be addressed during planning for any task involving leading edges, roof work, floor openings, ladders, scaffolds, steel, aerial lifts, or elevated platforms."
    ]),

    ...programSection("Anchorage Requirements", [
      "Anchorages used for personal fall protection shall be appropriate for the intended system and selected in accordance with applicable requirements."
    ]),

    ...programSection("Equipment Inspection", [
      "Harnesses, lanyards, self-retracting devices, connectors, and anchor components shall be inspected before each use and removed from service if defective."
    ]),

    ...programSection("Protection of Openings / Edges", [
      "Floor openings, roof openings, shafts, and unprotected edges shall be protected promptly to prevent access and fall exposure."
    ]),

    ...programSection("Rescue Planning", [
      "A site-specific rescue plan shall address how a suspended worker will be reached, retrieved, and medically assessed in a timely manner."
    ], [
      "Rescue equipment identified",
      "Rescue roles understood",
      "Emergency communication method established",
      "Adjacent trades aware of rescue constraints where applicable"
    ]),

    ...programSection("Supervisory Oversight", [
      "Supervisors shall verify fall protection systems are in place, properly used, and consistent with changing site conditions."
    ])
  ];
}

function program_DemolitionDeepExpansion() {
  return [
    h2("Demolition - Detailed Requirements"),

    ...programSection("Purpose", [
      "This section expands demolition requirements for planning, sequencing, utilities, debris handling, structural stability, and occupied-area protection."
    ]),

    ...programSection("Engineering Survey / Pre-Task Review", [
      "Before demolition begins, affected structures, systems, and adjacent areas shall be reviewed for stability, utility conflicts, hazardous materials, access constraints, and public or occupant exposure."
    ]),

    ...programSection("Utility Isolation", [
      "Utilities serving the demolition area shall be identified, isolated, verified, and documented as required before disturbance begins."
    ], [
      "Electrical",
      "Gas",
      "Water",
      "Steam",
      "Communication / low voltage",
      "Process or specialty utilities"
    ]),

    ...programSection("Structural Stability", [
      "Demolition sequencing shall maintain structural stability throughout the work. Walls, floors, elevated slabs, and supporting elements shall not be weakened in a manner that creates uncontrolled collapse potential."
    ]),

    ...programSection("Debris Handling", [
      "Debris removal shall be controlled to prevent overloading, falling material, blocked access, or line-of-fire hazards."
    ], [
      "Use controlled debris removal methods",
      "Maintain drop zones / exclusion zones",
      "Do not overload floors or platforms",
      "Manage sharp materials and protrusions"
    ]),

    ...programSection("Occupied / Adjacent Area Protection", [
      "Where demolition affects occupied or adjacent areas, additional controls may be required for dust, noise, vibration, overhead protection, and access control."
    ]),

    ...programSection("Daily Review", [
      "Demolition work shall be reevaluated daily and whenever site conditions, sequencing, access, or structural conditions change."
    ])
  ];
}

function program_ConcreteMasonryDeepExpansion() {
  return [
    h2("Concrete & Masonry - Detailed Requirements"),

    ...programSection("Purpose", [
      "This section expands concrete and masonry controls for formwork, rebar exposure, wall bracing, placement operations, finishing, and silica-producing activities."
    ]),

    ...programSection("Formwork / Shore Design", [
      "Forms, shoring, reshoring, and related support systems shall be suitable for anticipated loads and maintained in accordance with design and manufacturer requirements where applicable."
    ]),

    ...programSection("Placement Hazards", [
      "Concrete placement shall be coordinated to control hose movement, line pressure, unstable access, slip hazards, and struck-by exposure around pumping and placing operations."
    ]),

    ...programSection("Rebar / Impalement Protection", [
      "Exposed reinforcing steel that creates impalement potential shall be protected with approved methods."
    ]),

    ...programSection("Masonry Wall Stability", [
      "Masonry walls and partially completed structures shall be braced and protected against collapse until permanent support systems are in place."
    ]),

    ...programSection("Cutting / Drilling / Grinding", [
      "Concrete and masonry cutting, coring, drilling, and grinding shall include silica controls, access control, and utility verification where applicable."
    ]),

    ...programSection("Curing / Chemical Contact", [
      "Wet concrete, grouts, curing compounds, and related materials can create skin, eye, and respiratory hazards requiring task-specific PPE and handling controls."
    ])
  ];
}

function program_SteelErectionDeepExpansion() {
  return [
    h2("Steel Erection - Detailed Requirements"),

    ...programSection("Purpose", [
      "This section expands steel erection requirements for controlled access, stability, decking, connector work, hoisting coordination, and fall protection."
    ]),

    ...programSection("Sequencing & Coordination", [
      "Steel erection activities shall be sequenced to maintain stability and reduce overlap with conflicting trades, suspended-load exposure, and incomplete deck access."
    ]),

    ...programSection("Structural Stability", [
      "Columns, beams, joists, decking, and connection points shall not be released or loaded until required stability measures are achieved."
    ]),

    ...programSection("Connector / Decking Work", [
      "Connector work and decking operations require close coordination of access, fall exposure, dropped-object control, and material staging."
    ]),

    ...programSection("Fall Exposure Controls", [
      "Personnel exposed to falls during steel work shall be protected by applicable fall protection systems and project requirements."
    ]),

    ...programSection("Material Landing / Placement", [
      "Deck bundles, joists, and other structural materials shall be landed only in approved locations with regard to capacity, stability, and erection sequence."
    ]),

    ...programSection("Communication & Exclusion Zones", [
      "Drop zones, overhead work zones, and steel placement areas shall be clearly communicated and controlled to protect lower-level personnel."
    ])
  ];
}

function program_RiggingHardwareInspection() {
  return [
    h2("Rigging Hardware, Sling Inspection & Load Control"),

    ...programSection("Purpose", [
      "This section establishes requirements for inspecting rigging hardware, verifying capacity, protecting rigging components, and controlling loads during handling operations."
    ]),

    ...programSection("Inspection Before Use", [
      "Slings, shackles, hooks, eyebolts, spreader bars, and related rigging hardware shall be inspected before use and removed from service if damaged or questionable."
    ], [
      "Broken wires / damaged stitching",
      "Distortion or bent hardware",
      "Missing latches or tags",
      "Excessive wear, cuts, or heat damage"
    ]),

    ...programSection("Capacity Verification", [
      "Rigging gear shall be matched to the load based on weight, configuration, angles, center of gravity, and connection points."
    ]),

    ...programSection("Load Protection", [
      "Rigging shall be protected from sharp edges, pinch points, crushing, or abrasion that could compromise safe lifting."
    ]),

    ...programSection("Load Control", [
      "Loads shall be controlled during hoisting, travel, and landing to prevent swing, rotation, shift, or uncontrolled contact."
    ]),

    ...programSection("Storage & Documentation", [
      "Rigging gear shall be stored to prevent damage and, where required, tracked or documented in accordance with company and project procedures."
    ])
  ];
}

function program_TemporaryStructuresWeatherProtection() {
  return [
    h2("Temporary Structures, Weather Protection & Enclosures"),

    ...programSection("Purpose", [
      "This section establishes requirements for temporary structures, weather protection systems, tarping, shrink wrap, temporary walls, canopies, and related enclosures."
    ]),

    ...programSection("Design / Suitability", [
      "Temporary weather protection and enclosure systems shall be suitable for anticipated environmental conditions, attachment methods, and loading."
    ]),

    ...programSection("Wind / Weather Exposure", [
      "Temporary coverings and enclosure materials shall be evaluated for wind loading, water accumulation, tearing, blow-off potential, and impact on adjacent structures."
    ]),

    ...programSection("Heating / Ventilation in Enclosures", [
      "Temporary enclosures using heat sources shall be managed to control fire, carbon monoxide, oxygen depletion, and ventilation hazards."
    ]),

    ...programSection("Inspection & Maintenance", [
      "Temporary structures and weather barriers shall be inspected after installation and following significant weather, impact, or visible damage."
    ]),

    ...programSection("Access & Egress", [
      "Temporary systems shall not block required access, emergency egress, extinguishers, panels, or emergency response routes."
    ])
  ];
}

function program_IndoorAirQualityDustControl() {
  return [
    h2("Indoor Air Quality, Dust Control & Exposure Management"),

    ...programSection("Purpose", [
      "This section establishes requirements for controlling airborne dust, fumes, odors, and indoor air quality impacts that may affect workers, occupants, or adjacent operations."
    ]),

    ...programSection("Dust-Generating Work", [
      "Dust-producing activities shall be identified during planning and controlled through engineering methods, work practices, containment, and housekeeping."
    ], [
      "Saw cutting",
      "Grinding",
      "Drilling / coring",
      "Demolition",
      "Sweeping / cleanup",
      "Material transfer"
    ]),

    ...programSection("Control Measures", [
      "Controls shall be selected based on the task, environment, and potential for worker or occupant exposure."
    ], [
      "Wet methods",
      "HEPA vacuum collection",
      "Negative air / containment where needed",
      "Scheduled work during low-occupancy periods where applicable",
      "Prompt cleanup of debris and dust"
    ]),

    ...programSection("Occupied Area Considerations", [
      "Work in or near occupied areas may require enhanced dust barriers, pressure control, communication, and cleanup procedures."
    ]),

    ...programSection("Odor / Fume Control", [
      "Products generating odors, fumes, or vapors shall be evaluated for ventilation needs, adjacent exposure, and compatibility with project conditions."
    ]),

    ...programSection("Monitoring / Response", [
      "Where conditions warrant, project teams may monitor air quality conditions or stop work until controls are improved."
    ])
  ];
}

function program_OwnerGCAuthorityDocumentControl() {
  return [
    h2("Owner / GC Authority, Document Control & Revision Management"),

    ...programSection("Purpose", [
      "This section establishes the authority of the Owner and General Contractor / Construction Manager to administer project safety requirements and maintain control of current safety documentation."
    ]),

    ...programSection("Authority", [
      "The Owner and GC/CM reserve the right to inspect work, require corrections, stop unsafe work, request documentation, and enforce project safety expectations."
    ]),

    ...programSection("Current Document Control", [
      "Only the current approved revision of project safety documents, plans, permits, and forms shall be used in the field where required."
    ]),

    ...programSection("Revision Management", [
      "Revisions to the project safety plan, forms, or procedures shall be communicated to affected parties and incorporated into current field use."
    ], [
      "Track revision date",
      "Identify revision summary",
      "Remove obsolete versions from use",
      "Brief affected supervision and crews"
    ]),

    ...programSection("Contractor Responsibility", [
      "Each contractor is responsible for ensuring current procedures, permits, training documents, and project instructions are available to their supervision and workforce as applicable."
    ]),

    ...programSection("Records Retention", [
      "Project records, permits, inspection forms, incident records, and revision logs shall be maintained according to project and employer requirements."
    ])
  ];
}

function blankLine(label: string, width = 70) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [
      new TextRun({
        text: `${label}: `,
        bold: true,
        size: 22,
        color: "1F1F1F",
      }),
      new TextRun({
        text: "_".repeat(width),
        size: 22,
        color: "444444",
      }),
    ],
  });
}

function checkboxLine(text: string) {
  return new Paragraph({
    spacing: { after: 70 },
    children: [
      new TextRun({
        text: `☐ ${text}`,
        size: 22,
        color: "1F1F1F",
      }),
    ],
  });
}

function formSectionTitle(text: string) {
  return new Paragraph({
    spacing: { before: 180, after: 120 },
    shading: {
      type: ShadingType.CLEAR,
      color: "auto",
      fill: "2F5597",
    },
    border: {
      top: { style: BorderStyle.SINGLE, size: 6, color: "2F5597" },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "2F5597" },
      left: { style: BorderStyle.SINGLE, size: 6, color: "2F5597" },
      right: { style: BorderStyle.SINGLE, size: 6, color: "2F5597" },
    },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 24,
        color: "FFFFFF",
      }),
    ],
  });
}

function simpleTable(headers: string[], rows: string[][]) {
  const outer = {
    top: { style: BorderStyle.SINGLE, size: 8, color: "2F5597" },
    bottom: { style: BorderStyle.SINGLE, size: 8, color: "2F5597" },
    left: { style: BorderStyle.SINGLE, size: 8, color: "2F5597" },
    right: { style: BorderStyle.SINGLE, size: 8, color: "2F5597" },
  };

  const inner = {
    top: { style: BorderStyle.SINGLE, size: 2, color: "B7C9E2" },
    bottom: { style: BorderStyle.SINGLE, size: 2, color: "B7C9E2" },
    left: { style: BorderStyle.SINGLE, size: 2, color: "B7C9E2" },
    right: { style: BorderStyle.SINGLE, size: 2, color: "B7C9E2" },
  };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map(
          (h) =>
            new TableCell({
              borders: outer,
              shading: {
                type: ShadingType.CLEAR,
                color: "auto",
                fill: "D9EAF7",
              },
              margins: {
                top: 120,
                bottom: 120,
                left: 120,
                right: 120,
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: h,
                      bold: true,
                      size: 22,
                      color: "1F1F1F",
                    }),
                  ],
                }),
              ],
            })
        ),
      }),
      ...rows.map(
        (row, rowIndex) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  borders: {
                    top: rowIndex === rows.length - 1 ? outer.top : inner.top,
                    bottom: rowIndex === rows.length - 1 ? outer.bottom : inner.bottom,
                    left: outer.left,
                    right: outer.right,
                  },
                  shading: {
                    type: ShadingType.CLEAR,
                    color: "auto",
                    fill: rowIndex % 2 === 0 ? "FFFFFF" : "F7FBFF",
                  },
                  margins: {
                    top: 100,
                    bottom: 100,
                    left: 120,
                    right: 120,
                  },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: cell || " ",
                          size: 22,
                          color: "222222",
                        }),
                      ],
                    }),
                  ],
                })
            ),
          })
      ),
    ],
  });
}

function appendix_EmergencyContacts() {
  return [
    h2("Appendix A - Emergency Contacts & Response Information"),

    ...programSection("Purpose", [
      "This appendix provides a placeholder structure for emergency contacts, response expectations, escalation pathways, and project-specific emergency information."
    ]),

    ...programSection("Required Contact Listings", [
      "The project team shall complete and maintain current emergency contact information for the site."
    ], [
      "Project management contacts",
      "Superintendent contacts",
      "Site safety contacts",
      "Owner / client emergency contacts",
      "Nearest medical facility",
      "Emergency services / fire / police",
      "Utility emergency contacts",
      "Environmental spill contacts where applicable"
    ]),

    ...programSection("Posting Requirements", [
      "Emergency contacts shall be posted in conspicuous locations including project office areas, break areas, gang boxes where appropriate, and other designated communication points."
    ]),

    ...programSection("Directions for Emergency Responders", [
      "Projects should maintain clear site access directions, gate information, assembly points, and responder routing instructions to reduce emergency response delay."
    ]),

    ...programSection("Template Fields", [
      "Complete the project-specific fields below prior to mobilization or as soon as practical."
    ], [
      "Project address",
      "Nearest cross streets",
      "Gate / access point number",
      "Assembly / muster location",
      "Onsite first aid / AED location",
      "Nearest clinic / hospital name and address"
    ])
  ];
}

function appendix_IncidentForms(): DocChild[] {
  return [
    h2("Appendix B - Incident Report, Investigation & Corrective Action Forms"),

    formSectionTitle("INITIAL INCIDENT NOTIFICATION"),
    infoTable([
      ["Project Name", "", "Project Number", ""],
      ["Date", "", "Time", ""],
      ["Exact Location", "", "Employer / Contractor", ""],
      ["Person(s) Involved", "", "Witnesses", ""],
      ["Reported By", "", "Supervisor Notified", ""],
      ["Incident Type", "", "Severity Level", ""],
    ]),

    spacerParagraph(),
    blankLine("Brief Description of Event", 60),
    spacerParagraph(2),
    blankLine("Immediate Action Taken", 60),
    spacerParagraph(2),
    blankLine("Medical Treatment Required", 60),

    pageBreak(),

    formSectionTitle("INCIDENT INVESTIGATION SUMMARY"),
    infoTable([
      ["Investigation Lead", "", "Date of Investigation", ""],
      ["Incident Classification", "", "Work Activity", ""],
      ["Tools / Equipment Involved", "", "Environmental Conditions", ""],
    ]),

    spacerParagraph(),
    blankLine("Sequence of Events", 60),
    spacerParagraph(2),
    blankLine("Direct Cause", 60),
    spacerParagraph(2),
    blankLine("Contributing Factors", 60),
    spacerParagraph(2),
    blankLine("Root Cause", 60),

    pageBreak(),

    formSectionTitle("CORRECTIVE ACTION LOG"),
    simpleTable(
      ["Item", "Corrective Action", "Responsible Party", "Due Date", "Closed Date"],
      [
        ["1", "", "", "", ""],
        ["2", "", "", "", ""],
        ["3", "", "", "", ""],
        ["4", "", "", "", ""],
        ["5", "", "", "", ""],
        ["6", "", "", "", ""],
        ["7", "", "", "", ""],
        ["8", "", "", "", ""],
      ]
    ),

    spacerParagraph(),
    formSectionTitle("REVIEW / SIGNATURES"),
    simpleTable(
      ["Name", "Title / Position", "Company", "Signature", "Date"],
      [
        ["", "", "", "", ""],
        ["", "", "", "", ""],
        ["", "", "", "", ""],
      ]
    ),
  ];
}

function appendix_DAPPreTaskPlanning(): DocChild[] {
  return [
    h2("Appendix C - Construction Daily Activity Plan (DAP) / Risk Assessment"),

    formSectionTitle("CONSTRUCTION DAILY ACTIVITY PLAN / RISK ASSESSMENT"),

    infoTable([
      ["Project Name", "", "Project Number", ""],
      ["Date", "", "Contractor / Trade", ""],
      ["Foreman / Supervisor", "", "Safety Representative", ""],
      ["Work Area / Location", "", "Crew Size", ""],
      ["Overall Scope of Work / Task Description", "", "Shift", ""],
    ]),

    spacerParagraph(),

    formSectionTitle("PREPARED BY"),
    simpleTable(
      ["Name", "Title / Position", "Company", "Phone / Email", "Signature"],
      [["", "", "", "", ""]]
    ),

    spacerParagraph(),

    formSectionTitle("ACTIVITY RISK PLANNING TABLE"),
    simpleTable(
      [
        "Work Activity / Subtask",
        "Hazard",
        "Initial Risk",
        "Control / Mitigation",
        "Implementation / Responsible Person",
        "Residual Risk",
      ],
      [
        ["", "", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["", "", "", "", "", ""],
      ]
    ),

    spacerParagraph(),

    formSectionTitle("REQUIRED PERMITS / AUTHORIZATIONS"),
    checkboxLine("Hot Work Permit"),
    checkboxLine("Confined Space Permit"),
    checkboxLine("Excavation / Trench Permit"),
    checkboxLine("LOTO / Hazardous Energy Control"),
    checkboxLine("Crane / Critical Lift Plan"),
    checkboxLine("Work at Height Authorization"),
    checkboxLine("Ground Disturbance Permit"),
    checkboxLine("Electrical / Energized Work Authorization"),
    checkboxLine("Other: ______________________________"),

    spacerParagraph(),

    formSectionTitle("OVERALL RESIDUAL RISK LEVEL"),
    simpleTable(
      ["Extremely High", "High", "Medium", "Low"],
      [["☐", "☐", "☐", "☐"]]
    ),

    spacerParagraph(),

    formSectionTitle("SUPERVISION / OVERSIGHT PLAN"),
    blankLine("How work will be supervised", 60),
    spacerParagraph(2),
    blankLine("Who is responsible for field oversight", 60),
    spacerParagraph(2),
    blankLine("Recommended course of action", 60),

    spacerParagraph(),

    simpleTable(
      ["Name", "Title / Position", "Company", "Signature"],
      [["", "", "", ""]]
    ),

    pageBreak(),

    formSectionTitle("APPROVAL TO PROCEED"),
    checkboxLine("Approved to Proceed"),
    checkboxLine("Hold Work / Not Approved"),
    spacerParagraph(),
    infoTable([
      ["Approval Authority", "", "Title / Position", ""],
      ["Company", "", "Date", ""],
      ["Signature", "", "Additional Guidance", ""],
    ]),

    spacerParagraph(),

    formSectionTitle("CREW BRIEFING / SIGN-IN"),
    p(
      "All affected workers shall be briefed on the work scope, hazards, controls, permits, and supervision requirements before work begins."
    ),
    simpleTable(
      ["Print Name", "Company", "Trade", "Signature"],
      [
        ["", "", "", ""],
        ["", "", "", ""],
        ["", "", "", ""],
        ["", "", "", ""],
        ["", "", "", ""],
        ["", "", "", ""],
        ["", "", "", ""],
        ["", "", "", ""],
        ["", "", "", ""],
        ["", "", "", ""],
        ["", "", "", ""],
        ["", "", "", ""],
      ]
    ),

    pageBreak(),

    formSectionTitle("RISK REVIEW / FIELD REVISION"),
    p("Use this section when the work scope changes, site conditions change, or the risk level changes during execution."),
    simpleTable(
      ["Date", "Reviewer", "Title / Position", "Changes / Revisions Made", "Signature"],
      [
        ["", "", "", "", ""],
        ["", "", "", "", ""],
        ["", "", "", "", ""],
        ["", "", "", "", ""],
        ["", "", "", "", ""],
      ]
    ),

    spacerParagraph(),

    formSectionTitle("FEEDBACK / LESSONS LEARNED / REMARKS"),
    blankLine("What controls worked well", 60),
    spacerParagraph(2),
    blankLine("What needs improvement", 60),
    spacerParagraph(2),
    blankLine("Additional comments / remarks", 60),

    pageBreak(),

    formSectionTitle("CONSTRUCTION RISK MATRIX"),
    p("Use this matrix to assign initial and residual risk before and after controls."),
    simpleTable(
      ["Severity \\ Probability", "Frequent", "Likely", "Occasional", "Seldom", "Unlikely"],
      [
        ["Catastrophic", "EH", "EH", "H", "H", "M"],
        ["Critical", "EH", "H", "H", "M", "L"],
        ["Moderate", "H", "H", "M", "L", "L"],
        ["Negligible", "M", "L", "L", "L", "L"],
      ]
    ),
    spacerParagraph(),
    p("Legend: EH = Extremely High, H = High, M = Medium, L = Low"),
  ];
}

function appendix_PermitControls() {
  return [
    h2("Appendix D - Permit Control Forms"),

    ...programSection("Purpose", [
      "This appendix outlines common permit-controlled activities and provides a framework for permit use on the project."
    ]),

    ...programSection("Typical Permit Types", [
      "Permit requirements vary by project and owner expectations. Contractors must comply with all required permit systems."
    ], [
      "Hot work permit",
      "Confined space entry permit",
      "Excavation / trench permit",
      "LOTO / hazardous energy permit or authorization",
      "Electrical energized work authorization where applicable",
      "Crane / critical lift permit or approval",
      "Work at height permit where required",
      "Ground disturbance permit"
    ]),

    ...programSection("Permit Expectations", [
      "Permits should identify the work location, scope, timeframe, hazards, required controls, responsible persons, and approval/signature requirements."
    ]),

    ...programSection("Posting and Closeout", [
      "Permits should be posted at the work area where required and formally closed out when work is complete or conditions change."
    ])
  ];
}

function appendix_InspectionChecklists(): DocChild[] {
  return [
    h2("Appendix E - Inspection Checklists"),

    formSectionTitle("DAILY SAFETY INSPECTION CHECKLIST"),
    infoTable([
      ["Project Name", "", "Date", ""],
      ["Inspector", "", "Company", ""],
      ["Area Inspected", "", "Weather / Conditions", ""],
    ]),

    spacerParagraph(),
    p("Mark all applicable items below and document deficiencies requiring correction."),

    simpleTable(
      ["Inspection Category", "Acceptable", "Needs Attention", "Comments / Deficiencies"],
      [
        ["Access / Egress", "☐", "☐", ""],
        ["Housekeeping", "☐", "☐", ""],
        ["PPE Compliance", "☐", "☐", ""],
        ["Ladders", "☐", "☐", ""],
        ["Scaffolds", "☐", "☐", ""],
        ["Temporary Power / Cords", "☐", "☐", ""],
        ["Fire Extinguishers / Fire Protection", "☐", "☐", ""],
        ["Material Storage / Staging", "☐", "☐", ""],
        ["Barricades / Signage", "☐", "☐", ""],
        ["Fall Protection", "☐", "☐", ""],
        ["Line-of-Fire Hazards", "☐", "☐", ""],
        ["Equipment / Tools", "☐", "☐", ""],
      ]
    ),

    spacerParagraph(),
    blankLine("Deficiencies Noted", 60),
    spacerParagraph(2),
    blankLine("Immediate Corrective Actions Taken", 60),

    pageBreak(),

    formSectionTitle("CORRECTIVE ACTION TRACKING"),
    simpleTable(
      ["Item", "Deficiency", "Responsible Party", "Due Date", "Status / Closed"],
      [
        ["1", "", "", "", ""],
        ["2", "", "", "", ""],
        ["3", "", "", "", ""],
        ["4", "", "", "", ""],
        ["5", "", "", "", ""],
        ["6", "", "", "", ""],
        ["7", "", "", "", ""],
        ["8", "", "", "", ""],
      ]
    ),

    spacerParagraph(),
    formSectionTitle("INSPECTOR REVIEW"),
    simpleTable(
      ["Inspector Name", "Title / Position", "Signature", "Date"],
      [["", "", "", ""]]
    ),
  ];
}

function appendix_TrainingMatrix(): DocChild[] {
  return [
    h2("Appendix F - Training Matrix & Qualification Tracking"),

    formSectionTitle("TRAINING MATRIX"),
    infoTable([
      ["Project Name", "", "Date", ""],
      ["Employer / Contractor", "", "Prepared By", ""],
    ]),

    spacerParagraph(),
    p("Use this matrix to document site orientation, required training, operator qualifications, and competent / qualified person designations."),

    simpleTable(
      [
        "Employee Name",
        "Company / Trade",
        "Training / Qualification",
        "Date Completed",
        "Expiration / Retraining",
        "Verified By"
      ],
      [
        ["", "", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["", "", "", "", "", ""],
      ]
    ),

    pageBreak(),

    formSectionTitle("REQUIRED TRAINING CATEGORIES"),
    simpleTable(
      ["Training / Qualification Type", "Required", "Project Specific Notes"],
      [
        ["Site Orientation", "☐", ""],
        ["Fall Protection", "☐", ""],
        ["Ladder Safety", "☐", ""],
        ["Scaffold User / Erector", "☐", ""],
        ["MEWP / Aerial Lift Operator", "☐", ""],
        ["Forklift Operator", "☐", ""],
        ["LOTO Awareness / Authorized", "☐", ""],
        ["Hazard Communication", "☐", ""],
        ["Respiratory Protection", "☐", ""],
        ["Confined Space Awareness / Entry", "☐", ""],
        ["Signal Person / Rigger / Crane Operator", "☐", ""],
      ]
    ),
  ];
}

function appendix_PPEMatrix(): DocChild[] {
  return [
    h2("Appendix G - PPE Matrix"),

    formSectionTitle("PERSONAL PROTECTIVE EQUIPMENT (PPE) MATRIX"),
    infoTable([
      ["Project Name", "", "Date", ""],
      ["Prepared By", "", "Company", ""],
    ]),

    spacerParagraph(),
    p("Use this matrix to identify required PPE by task or activity. Update as project conditions and work scopes change."),

    simpleTable(
      [
        "Task / Activity",
        "Primary Hazard",
        "Required PPE",
        "Additional PPE / Notes"
      ],
      [
        ["General Site Access", "Routine construction exposure", "Hard hat, safety glasses, hi-vis, work boots", ""],
        ["Cutting / Grinding", "Flying particles / sparks", "Safety glasses, face shield, gloves", ""],
        ["Welding / Hot Work", "Radiant energy / sparks / burns", "Welding hood, gloves, FR clothing, eye protection", ""],
        ["Concrete / Masonry", "Silica / splash / abrasion", "Safety glasses, gloves, boots", ""],
        ["Chemical Handling", "Splash / skin / vapor exposure", "Chemical gloves, eye protection", ""],
        ["Work at Height", "Fall exposure", "Harness / lanyard where required", ""],
        ["Electrical Work", "Shock / arc flash", "Task-specific electrical PPE", ""],
        ["Demolition", "Sharp debris / dust / impact", "Gloves, eye protection, hard hat, hi-vis", ""],
        ["Excavation / Trenching", "Cave-in / struck-by / access", "Hard hat, boots, hi-vis", ""],
        ["Heavy Equipment Support", "Struck-by / line-of-fire", "Hard hat, hi-vis, safety glasses, boots", ""],
      ]
    ),

    pageBreak(),

    formSectionTitle("TASK-SPECIFIC PPE REVIEW"),
    simpleTable(
      ["Task / Area", "Hazard", "Required PPE Verified", "Supervisor Initials", "Date"],
      [
        ["", "", "", "", ""],
        ["", "", "", "", ""],
        ["", "", "", "", ""],
        ["", "", "", "", ""],
        ["", "", "", "", ""],
        ["", "", "", "", ""],
        ["", "", "", "", ""],
        ["", "", "", "", ""],
      ]
    ),

    spacerParagraph(),
    formSectionTitle("PPE NOTES / SPECIAL REQUIREMENTS"),
    blankLine("Additional task-specific PPE requirements", 60),
    spacerParagraph(2),
    blankLine("Restricted areas / special conditions", 60),
    spacerParagraph(2),
    blankLine("Project-specific notes", 60),
  ];
}

function appendix_EquipmentInspectionForms(): DocChild[] {
  return [
    h2("Appendix H - Equipment Inspection Forms"),

    ...programSection("Purpose", [
      "This appendix provides a framework for documenting equipment inspections and maintaining records for tools, lifts, forklifts, scaffolds, and other equipment as required."
    ]),

    ...programSection("Typical Equipment Categories", [
      "Inspection forms may be used for the following equipment."
    ], [
      "MEWPs / aerial lifts",
      "Forklifts / industrial trucks",
      "Portable ladders",
      "Scaffolds",
      "Power tools",
      "Generators / temporary power equipment",
      "Rigging gear and hardware"
    ]),

    ...programSection("Minimum Inspection Elements", [
      "Inspection forms should identify the equipment, date, inspector, condition, noted deficiencies, and action taken."
    ]),

    ...programSection("Defective Equipment Control", [
      "Defective equipment shall be tagged out or removed from service immediately until properly repaired or replaced."
    ])
  ];
}

function appendix_HotWorkFireWatchForms(): DocChild[] {
  return [
    h2("Appendix I - Hot Work Permit & Fire Watch Forms"),

    formSectionTitle("HOT WORK PERMIT"),
    infoTable([
      ["Project Name", "", "Permit Number", ""],
      ["Date", "", "Start Time", ""],
      ["Stop Time", "", "Work Area / Location", ""],
      ["Contractor / Trade", "", "Supervisor", ""],
      ["Description of Work", "", "Fire Watch Assigned", ""],
    ]),

    spacerParagraph(),
    p("Pre-Work Fire Prevention Checklist"),
    checkboxLine("Combustibles removed or protected"),
    checkboxLine("Fire extinguisher available and inspected"),
    checkboxLine("Spark containment / screens in place"),
    checkboxLine("Area above / below / adjacent checked"),
    checkboxLine("Fire watch assigned and briefed"),
    checkboxLine("Permit posted at work area"),
    checkboxLine("Gas cylinders / hoses / leads inspected"),
    checkboxLine("Emergency communication available"),

    spacerParagraph(),
    blankLine("Special Precautions / Notes", 60),

    spacerParagraph(),
    formSectionTitle("AUTHORIZATION"),
    simpleTable(
      ["Name", "Title / Position", "Company", "Signature", "Date"],
      [
        ["Issuer", "", "", "", ""],
        ["Supervisor", "", "", "", ""],
        ["Fire Watch", "", "", "", ""],
      ]
    ),

    pageBreak(),

    formSectionTitle("FIRE WATCH LOG"),
    p("Document fire watch monitoring during and after hot work as required by site rules."),
    simpleTable(
      ["Time", "Area Checked", "Conditions Observed", "Initials"],
      [
        ["", "", "", ""],
        ["", "", "", ""],
        ["", "", "", ""],
        ["", "", "", ""],
        ["", "", "", ""],
        ["", "", "", ""],
        ["", "", "", ""],
        ["", "", "", ""],
      ]
    ),

    spacerParagraph(),
    formSectionTitle("PERMIT CLOSEOUT"),
    checkboxLine("Area re-inspected"),
    checkboxLine("No residual ignition hazards remain"),
    checkboxLine("Permit closed"),
    spacerParagraph(),
    simpleTable(
      ["Closed By", "Title / Position", "Signature", "Date / Time"],
      [["", "", "", ""]]
    ),
  ];
}

function appendix_HighRiskWorkForms(): DocChild[] {
  return [
    h2("Appendix J - High-Risk Work Planning Forms"),

    formSectionTitle("HIGH-RISK WORK AUTHORIZATION / PLANNING"),
    infoTable([
      ["Project Name", "", "Date", ""],
      ["Contractor / Trade", "", "Supervisor", ""],
      ["Work Area / Location", "", "High-Risk Activity Type", ""],
      ["Description of Work", "", "Start Time / Duration", ""],
    ]),

    spacerParagraph(),
    p("Select all applicable high-risk work categories:"),
    checkboxLine("Excavation / Trenching"),
    checkboxLine("Confined Space Entry"),
    checkboxLine("Critical Lift / Crane Activity"),
    checkboxLine("LOTO / Hazardous Energy Control"),
    checkboxLine("Work at Height / Fall Exposure"),
    checkboxLine("Hot Work"),
    checkboxLine("Demolition"),
    checkboxLine("Energized Electrical Work"),
    checkboxLine("Ground Disturbance"),
    checkboxLine("Other: ______________________________"),

    spacerParagraph(),
    formSectionTitle("HAZARD / CONTROL REVIEW"),
    simpleTable(
      [
        "Hazard / Exposure",
        "Required Control",
        "Responsible Person",
        "Verified"
      ],
      [
        ["Access control / barricades", "", "", ""],
        ["Permit / authorization in place", "", "", ""],
        ["Competent / qualified person assigned", "", "", ""],
        ["PPE requirements reviewed", "", "", ""],
        ["Rescue / emergency response reviewed", "", "", ""],
        ["Adjacent trade coordination complete", "", "", ""],
        ["Environmental / weather conditions reviewed", "", "", ""],
        ["Tools / equipment inspected", "", "", ""],
      ]
    ),

    pageBreak(),

    formSectionTitle("APPROVAL / AUTHORIZATION"),
    simpleTable(
      ["Role", "Name", "Title / Position", "Signature", "Date"],
      [
        ["Supervisor / Foreman", "", "", "", ""],
        ["Site Safety", "", "", "", ""],
        ["Project Superintendent", "", "", "", ""],
        ["Other Approver", "", "", "", ""],
      ]
    ),

    spacerParagraph(),
    formSectionTitle("FIELD REVISION / CHANGE CONTROL"),
    p("Use this section when site conditions, work scope, or risk level changes after the original authorization."),
    simpleTable(
      ["Date", "Change / Revision", "Reviewed By", "Signature"],
      [
        ["", "", "", ""],
        ["", "", "", ""],
        ["", "", "", ""],
        ["", "", "", ""],
        ["", "", "", ""],
      ]
    ),

    pageBreak(),

    formSectionTitle("ACTIVITY-SPECIFIC WORKSHEETS"),
    p("Use the following blank rows to document additional task-specific planning details."),
    simpleTable(
      ["Subtask / Step", "Hazard", "Control / Mitigation", "Responsible Person", "Notes"],
      [
        ["", "", "", "", ""],
        ["", "", "", "", ""],
        ["", "", "", "", ""],
        ["", "", "", "", ""],
        ["", "", "", "", ""],
        ["", "", "", "", ""],
        ["", "", "", "", ""],
        ["", "", "", "", ""],
      ]
    ),
  ];
}

/* ------------------------------------------------ */
/* COVER + ADMIN CONTENT */
/* ------------------------------------------------ */


function titlePageLine(text: string, size = 24, bold = false) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 140 },
    children: [
      new TextRun({
        text,
        size,
        bold,
        color: "1F1F1F",
      }),
    ],
  });
}

function buildTOC(): DocChild[] {
  return [
    pageBreak(),
    h1("Table of Contents"),

    simpleTable(
      ["Section", "Title"],
      [
        ["1", "Project Administration & Safety Management"],
        ["2", "Roles, Responsibilities & Accountability"],
        ["3", "Communication, Coordination & Pre-Task Planning"],
        ["4", "Safety Orientation, Training & Competency"],
        ["5", "Incident Reporting, Investigation & Corrective Action"],
        ["6", "Inspections, Audits & Corrective Action Tracking"],
        ["7", "Emergency Action, Medical Response & Evacuation"],
        ["8", "Personal Protective Equipment (PPE)"],
        ["9", "Housekeeping, Access & Material Storage"],
        ["10", "Fall Protection"],
        ["11", "Excavation & Trenching"],
        ["12", "Cranes, Rigging & Critical Lifts"],
        ["13", "Confined Space"],
        ["14", "Electrical Safety & LOTO"],
        ["15", "Hot Work & Fire Prevention"],
        ["16", "Ladder Safety"],
        ["17", "Scaffold Safety"],
        ["18", "MEWP / Aerial Lift Safety"],
        ["19", "Forklifts & Industrial Trucks"],
        ["20", "Material Handling & Rigging Support"],
        ["21", "Tools, Equipment & Temporary Power"],
        ["22", "Line of Fire, Struck-By & Caught-Between Prevention"],
        ["23", "Environmental Controls & Site Conditions"],
        ["24-60", "Expanded Safety Programs"],
        ["Appendix A-J", "Forms, Checklists, Matrices & Planning Documents"],
      ]
    ),
  ];
}

function brandedHeaderBar(text: string) {
  return new Paragraph({
    spacing: { before: 120, after: 180 },
    shading: {
      type: ShadingType.CLEAR,
      color: "auto",
      fill: "2F5597",
    },
    border: {
      top: { style: BorderStyle.SINGLE, size: 8, color: "2F5597" },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: "2F5597" },
      left: { style: BorderStyle.SINGLE, size: 8, color: "2F5597" },
      right: { style: BorderStyle.SINGLE, size: 8, color: "2F5597" },
    },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 28,
        color: "FFFFFF",
      }),
    ],
  });
}

function buildRevisionLog(form: PSHSEPInput): DocChild[] {
  const revision = typeof form.revision === "string" ? form.revision : "0";
  const approvalDate = form.approval_date || "";

  return [
    pageBreak(),
    h1("Revision Log"),

    p("Use this page to document changes, updates, and controlled revisions to the project safety plan."),

    simpleTable(
      ["Revision", "Date", "Description of Change", "Prepared By", "Approved By"],
      [
        [revision, approvalDate, "Initial issue", form.plan_author || "", form.approval_name || ""],
        ["", "", "", "", ""],
        ["", "", "", "", ""],
        ["", "", "", "", ""],
        ["", "", "", "", ""],
        ["", "", "", "", ""],
      ]
    ),
  ];
}

function buildAdminSummary(
  form: PSHSEPInput,
  builderTextConfig: DocumentBuilderTextConfig | null | undefined
) {
  const projectName = form.project_name || "Project";
  const projectNumber = form.project_number || "";

  const companyName =
    typeof form.company_name === "string" && form.company_name.trim()
      ? form.company_name.trim()
      : "Safety360Docs";

  const rows: Array<[string, string]> = [
    ["Company Name", companyName],
    ["Project Name", projectName],
    ["Project Number", projectNumber],
    ["Project Address", form.project_address || ""],
    ["Owner / Client", form.owner_client || ""],
    ["GC / CM", form.gc_cm || ""],
    ["GC Safety Contact", form.gc_safety_contact || ""],
    ["Contractor Company", form.contractor_company || ""],
    ["Contractor Phone", form.contractor_phone || ""],
    ["Contractor Email", form.contractor_email || ""],
    ["Plan Author", form.plan_author || ""],
    ["Approved By", form.approval_name || ""],
    ["Approval Date", form.approval_date || ""],
    ["Revision", typeof form.revision === "string" ? form.revision : "0"],
    ["Assumed Trades Count", String(asStringList(form.assumed_trades_index).length || 0)],
  ];

  return {
    heading: h1("Administrative Summary"),
    intro: p(
      getSiteBuilderSection(builderTextConfig, "administrative_summary_intro")?.paragraphs[0] ??
        "This Project / Site Specific Health, Safety & Environment Plan establishes the minimum safety expectations, responsibilities, procedures, and controls for all personnel and contractors performing work on this project. Where project requirements are more stringent than regulatory minimums, the more protective requirement shall apply."
    ),
    table: twoColTable(rows),
  };
}

function buildStarterAdminSections(
  form: PSHSEPInput,
  builderTextConfig: DocumentBuilderTextConfig | null | undefined
): DocChild[] {
  const assumedTrades = asStringList(form.assumed_trades_index);
  const disciplinaryPolicy =
    typeof form.disciplinary_policy_text === "string" && form.disciplinary_policy_text.trim()
      ? form.disciplinary_policy_text.trim()
      : getSiteBuilderChild(builderTextConfig, "starter_admin_sections", "disciplinary_policy")
          ?.paragraphs[0] ??
        "Each employer must enforce progressive discipline for repeated or serious safety violations, including stop-work and removal where warranted.";
  const ownerLetter =
    typeof form.owner_letter_text === "string" && form.owner_letter_text.trim()
      ? form.owner_letter_text.trim()
      : getSiteBuilderChild(builderTextConfig, "starter_admin_sections", "owner_letter")
          ?.paragraphs[0] ??
        `Owner leadership affirms support for this ${SITE_SAFETY_BLUEPRINT_TITLE} and expects all onsite employers to follow project safety requirements.`;
  const incidentReporting =
    typeof form.incident_reporting_process_text === "string" &&
    form.incident_reporting_process_text.trim()
      ? form.incident_reporting_process_text.trim()
      : getSiteBuilderChild(
            builderTextConfig,
            "starter_admin_sections",
            "incident_reporting_process"
          )?.paragraphs[0] ??
        "All incidents, near misses, and unsafe conditions shall be reported immediately, documented, and tracked through corrective action closure.";
  const specialConditionsPermit =
    typeof form.special_conditions_permit_text === "string" &&
    form.special_conditions_permit_text.trim()
      ? form.special_conditions_permit_text.trim()
      : getSiteBuilderChild(
            builderTextConfig,
            "starter_admin_sections",
            "special_conditions_permit"
          )?.paragraphs[0] ??
        `Any variation from this ${SITE_SAFETY_BLUEPRINT_TITLE} requires written authorization, temporary controls, and closeout verification.`;

  return [
    pageBreak(),
    h1("A1. Disciplinary Policy"),
    p(disciplinaryPolicy),
    pageBreak(),
    h1("A2. Letter from Owner"),
    p(ownerLetter),
    pageBreak(),
    h1("A3. Incident Reporting Process"),
    p(incidentReporting),
    pageBreak(),
    h1("A4. Special Conditions Permit (Variations)"),
    p(specialConditionsPermit),
    pageBreak(),
    h1("A5. Assumed Trades Index"),
    ...(assumedTrades.length
      ? appendNumberedParagraphs("A5", assumedTrades)
      : [
          p(
            getSiteBuilderChild(
              builderTextConfig,
              "starter_admin_sections",
              "assumed_trades_index"
            )?.paragraphs[0] ??
              `No assumed trades were listed in this ${SITE_SAFETY_BLUEPRINT_TITLE} draft.`
          ),
        ]),
  ];
}

function buildOshaAppendix(
  form: PSHSEPInput,
  builderTextConfig: DocumentBuilderTextConfig | null | undefined
): DocChild[] {
  const refs = new Set<string>(["29 CFR 1926"]);
  const normalizedForm = normalizePshsepBuilderFormData(form) as PSHSEPInput;
  const selectedScopes = asStringList(normalizedForm.scope_of_work_selected).join(" ").toLowerCase();
  const selectedPermits = asStringList(normalizedForm.permits_selected).join(" ").toLowerCase();
  const source = `${selectedScopes} ${selectedPermits}`;
  if (source.includes("fall") || source.includes("scaffold") || source.includes("roof")) {
    refs.add("29 CFR 1926 Subpart M");
  }
  if (source.includes("excavat") || source.includes("trench")) {
    refs.add("29 CFR 1926 Subpart P");
  }
  if (source.includes("crane") || source.includes("lift")) {
    refs.add("29 CFR 1926 Subpart CC");
  }
  if (source.includes("confined")) {
    refs.add("29 CFR 1926 Subpart AA");
  }
  if (source.includes("electrical") || source.includes("loto")) {
    refs.add("29 CFR 1926 Subpart K");
  }
  if (source.includes("hot work")) {
    refs.add("29 CFR 1926 Subpart J");
  }
  collectPshsepCatalogOshaRefs({
    scope_of_work_selected: asStringList(normalizedForm.scope_of_work_selected),
    high_risk_focus_areas: asStringList(normalizedForm.high_risk_focus_areas),
    permits_selected: asStringList(normalizedForm.permits_selected),
  }).forEach((ref) => refs.add(ref));

  return [
    pageBreak(),
    h1(
      getSiteBuilderSection(builderTextConfig, "osha_reference_summary")?.title ??
        "Appendix OSHA. OSHA Reference Summary"
    ),
    p(
      getSiteBuilderSection(builderTextConfig, "osha_reference_summary")?.paragraphs[0] ??
        "This appendix consolidates OSHA references applicable to selected scope and permit conditions."
    ),
    ...appendNumberedParagraphs("Appendix OSHA", [...refs]),
  ];
}

function buildCover(
  form: PSHSEPInput,
  builderTextConfig: DocumentBuilderTextConfig | null | undefined
): DocChild[] {
  const companyName =
    typeof form.company_name === "string" && form.company_name.trim()
      ? form.company_name.trim()
      : "Safety360Docs";

  const projectName = form.project_name || "Project";
  const projectNumber = form.project_number || "";
  const revision = typeof form.revision === "string" ? form.revision : "0";
  const approvalDate = form.approval_date || "";

  return [
    brandedHeaderBar(companyName),

    new Paragraph({
      spacing: { after: 500 },
      children: [new TextRun({ text: " ", size: 24 })],
    }),

    titleCenter("PROJECT / SITE SPECIFIC"),
    titleCenter(SITE_SAFETY_BLUEPRINT_TITLE.toUpperCase()),

    new Paragraph({
      spacing: { after: 300 },
      children: [new TextRun({ text: " ", size: 24 })],
    }),

    formSectionTitle("PROJECT INFORMATION"),
    infoTable([
      ["Project Name", projectName, "Project Number", projectNumber],
      ["Project Address", form.project_address || "", "Owner / Client", form.owner_client || ""],
      ["GC / CM", form.gc_cm || "", "GC Safety Contact", form.gc_safety_contact || ""],
      ["Contractor Company", form.contractor_company || "", "Contractor Phone", form.contractor_phone || ""],
      ["Contractor Email", form.contractor_email || "", "Plan Author", form.plan_author || ""],
      ["Approved By", form.approval_name || "", "Approval Date", approvalDate],
      ["Revision", revision, "Document Status", "Issued for Construction Use"],
    ]),

    spacerParagraph(2),

    formSectionTitle("DOCUMENT PURPOSE"),
    p(
      getSiteBuilderSection(builderTextConfig, "cover_document_purpose")?.paragraphs[0] ??
        "This Project / Site Specific Health, Safety & Environment Plan establishes the minimum requirements, responsibilities, procedures, and controls for construction activities performed on this project. All contractors, subcontractors, suppliers, and authorized visitors are expected to comply with this document and all applicable project safety requirements."
    ),

    spacerParagraph(3),

    titlePageLine("Generated by Safety360Docs", 20, false),
  ];
}

function buildPrograms(
  form: PSHSEPInput,
  builderTextConfig: DocumentBuilderTextConfig | null | undefined
) {
  const { normalizedForm, includedPrograms } = getPshsepExportProfile(form);
  const blocks: DocChild[] = [];
  const hasProgram = (...programIds: PshsepExportProgramId[]) =>
    programIds.some((programId) => includedPrograms.has(programId));

  blocks.push(...buildStarterAdminSections(normalizedForm, builderTextConfig));

  const addProgram = (
    num: string,
    sectionKey: string | null,
    title: string,
    buildBody: () => DocChild[]
  ) => {
    const configuredTitle =
      sectionKey ? getSiteBuilderSection(builderTextConfig, sectionKey)?.title ?? title : title;
    blocks.push(pageBreak());
    blocks.push(h1(`${num}. ${configuredTitle}`));
    setActiveProgramSection(num);
    const body = buildBody();
    clearActiveProgramSection();
    blocks.push(...body);
  };

  addProgram("1", "project_administration_safety_management", "Project Administration & Safety Management", () => program_ProjectAdministration());
  addProgram("2", "roles_responsibilities_accountability", "Roles, Responsibilities & Accountability", () => program_ResponsibilitiesAccountability());
  addProgram("3", "communication_coordination_pre_task_planning", "Communication, Coordination & Pre-Task Planning", () => program_CommunicationCoordination());
  addProgram("4", "safety_orientation_training_competency", "Safety Orientation, Training & Competency", () => program_SafetyOrientationTraining());
  addProgram("5", "incident_reporting_investigation_corrective_action", "Incident Reporting, Investigation & Corrective Action", () => program_IncidentReportingInvestigation());
  addProgram("6", "inspections_audits_corrective_action_tracking", "Inspections, Audits & Corrective Action Tracking", () => program_InspectionsAudits());
  addProgram("7", "emergency_action_medical_response_evacuation", "Emergency Action, Medical Response & Evacuation", () => program_EmergencyActionMedicalResponse(normalizedForm, builderTextConfig));
  addProgram("8", "personal_protective_equipment", "Personal Protective Equipment (PPE)", () => program_PPE());
  addProgram("9", "housekeeping_access_material_storage", "Housekeeping, Access & Material Storage", () => program_HousekeepingMaterialStorage());

if (include(form.include_fall_protection, true) || hasProgram("fall_protection")) {
  addProgram("10", "fall_protection", "Fall Protection", () => program_FallProtection(builderTextConfig));
}

if (include(form.include_excavation, false) || hasProgram("excavation")) {
  addProgram("11", null, "Excavation & Trenching", () => program_Excavation());
}

if (include(form.include_crane_rigging, false) || hasProgram("crane_rigging")) {
  addProgram("12", null, "Cranes, Rigging & Critical Lifts", () => program_CranesRiggingCriticalLifts(normalizedForm));
}

if (include(form.include_confined_space, false) || hasProgram("confined_space")) {
  addProgram("13", null, "Confined Space", () => program_ConfinedSpace());
}

if (include(form.include_electrical_loto, false) || hasProgram("electrical_loto")) {
  addProgram("14", null, "Electrical Safety & LOTO", () => program_ElectricalLOTO());
}

if (include(form.include_hot_work, false) || hasProgram("hot_work")) {
  addProgram("15", null, "Hot Work & Fire Prevention", () => program_HotWorkFirePrevention());
}

addProgram("16", null, "Ladder Safety", () => program_LadderSafety());

if (hasProgram("scaffold_safety")) {
  addProgram("17", null, "Scaffold Safety", () => program_ScaffoldSafety());
}

if (hasProgram("mewp")) {
  addProgram("18", null, "MEWP / Aerial Lift Safety", () => program_MEWP());
}

if (hasProgram("forklift_material_handling")) {
  addProgram("19", null, "Forklifts & Industrial Trucks", () => program_ForkliftsIndustrialTrucks());
}

if (hasProgram("material_handling_support", "forklift_material_handling")) {
  addProgram("20", null, "Material Handling & Rigging Support", () => program_MaterialHandlingRiggingSupport());
}

  addProgram("21", null, "Tools, Equipment & Temporary Power", () => program_ToolsEquipmentTemporaryPower());
  addProgram("22", null, "Line of Fire, Struck-By & Caught-Between Prevention", () => program_LineOfFireStruckByCaughtBetween());
  addProgram("23", null, "Environmental Controls & Site Conditions", () => program_EnvironmentalControls());

  if (hasProgram("steel_erection")) {
    addProgram("24", null, "Steel Erection", () => program_SteelErection());
  }
  if (hasProgram("concrete_masonry")) {
    addProgram("25", null, "Concrete & Masonry", () => program_ConcreteMasonry());
  }
  if (hasProgram("demolition")) {
    addProgram("26", null, "Demolition", () => program_Demolition());
  }
  if (hasProgram("temporary_structures")) {
    addProgram("27", null, "Temporary Structures, Supports & Bracing", () => program_TemporaryStructuresBracing());
  }
  if (hasProgram("hazard_communication")) {
    addProgram("28", null, "Hazard Communication", () => program_HazardCommunication());
  }
  if (hasProgram("chemical_safety")) {
    addProgram("29", null, "Chemical Safety", () => program_ChemicalSafety());
  }
  if (hasProgram("silica_exposure")) {
    addProgram("30", null, "Silica Exposure Control", () => program_SilicaExposureControl());
  }
  addProgram("31", null, "Heat Illness Prevention", () => program_HeatIllnessPrevention());
  addProgram("32", null, "Cold Stress & Winter Work", () => program_ColdStressWinterWork());
  if (hasProgram("respiratory_protection")) {
    addProgram("33", null, "Respiratory Protection", () => program_RespiratoryProtection());
  }
  if (hasProgram("fire_prevention", "hot_work")) {
    addProgram("34", null, "Fire Prevention", () => program_FirePrevention());
  }
  if (hasProgram("flammable_storage", "fire_prevention", "hot_work")) {
    addProgram("35", null, "Flammable Liquids, Fuel Gas & Cylinder Storage", () => program_FlammableLiquidsGasStorage());
  }

  if (hasProgram("site_traffic")) {
    addProgram("36", null, "Site Traffic Control", () => program_SiteTrafficControl());
  }
  if (hasProgram("delivery_logistics", "site_traffic")) {
    addProgram("37", null, "Delivery, Staging & Logistics Management", () => program_DeliveryLogisticsManagement());
  }
  addProgram("38", null, "Stop Work Authority", () => program_StopWorkAuthority());
  addProgram("39", null, "Safety Accountability & Disciplinary Policy", () => program_SafetyDisciplinaryPolicy());
  addProgram("40", null, "Subcontractor Safety Requirements", () => program_SubcontractorSafetyRequirements());
  if (hasProgram("public_protection")) {
    addProgram("41", null, "Public Protection & Occupied Area Controls", () => program_PublicProtectionOccupiedAreas());
  }
  addProgram("42", null, "Sanitation, Drinking Water & Welfare Facilities", () => program_SanitationWelfareFacilities());
  if (hasProgram("security_site_access")) {
    addProgram("43", null, "Security & Site Access Control", () => program_SecuritySiteAccessControl());
  }
  addProgram("44", null, "Severe Weather Response Program", () => program_SevereWeatherResponse());
  addProgram("45", null, "First Aid, Medical Services & Injury Management", () => program_FirstAidMedicalServices());

  addProgram("46", null, "Ergonomics & Manual Handling", () => program_ErgonomicsManualHandling());
  addProgram("47", null, "Hand & Power Tools - Detailed Requirements", () => program_HandPowerToolsExpansion());
  if (hasProgram("hot_work")) {
    addProgram("48", null, "Welding, Cutting & Brazing - Detailed Requirements", () => program_WeldingCuttingExpansion());
  }
  if (hasProgram("electrical_loto")) {
    addProgram("49", null, "Electrical Safety & LOTO - Detailed Requirements", () => program_ElectricalLOTOExpansion());
  }
  if (hasProgram("excavation")) {
    addProgram("50", null, "Excavation & Trenching - Detailed Requirements", () => program_ExcavationDeepExpansion());
  }
  if (hasProgram("confined_space")) {
    addProgram("51", null, "Confined Space Entry - Detailed Requirements", () => program_ConfinedSpaceDeepExpansion());
  }
  if (hasProgram("crane_rigging")) {
    addProgram("52", null, "Crane, Hoisting & Lift Planning - Detailed Requirements", () => program_CraneLiftPlanningExpansion());
  }
  if (hasProgram("fall_protection")) {
    addProgram("53", null, "Fall Protection - Rescue, Anchorage & Inspection Expansion", () => program_FallProtectionExpansion());
  }

  if (hasProgram("demolition")) {
    addProgram("54", null, "Demolition - Detailed Requirements", () => program_DemolitionDeepExpansion());
  }
  if (hasProgram("concrete_masonry")) {
    addProgram("55", null, "Concrete & Masonry - Detailed Requirements", () => program_ConcreteMasonryDeepExpansion());
  }
  if (hasProgram("steel_erection")) {
    addProgram("56", null, "Steel Erection - Detailed Requirements", () => program_SteelErectionDeepExpansion());
  }
  if (hasProgram("crane_rigging")) {
    addProgram("57", null, "Rigging Hardware, Sling Inspection & Load Control", () => program_RiggingHardwareInspection());
  }
  if (hasProgram("temporary_structures")) {
    addProgram("58", null, "Temporary Structures, Weather Protection & Enclosures", () => program_TemporaryStructuresWeatherProtection());
  }
  if (hasProgram("silica_exposure", "respiratory_protection")) {
    addProgram("59", null, "Indoor Air Quality, Dust Control & Exposure Management", () => program_IndoorAirQualityDustControl());
  }
  addProgram("60", null, "Owner / GC Authority, Document Control & Revision Management", () => program_OwnerGCAuthorityDocumentControl());
  blocks.push(...buildOshaAppendix(normalizedForm, builderTextConfig));

  addProgram("Appendix A", null, "Emergency Contacts & Response Information", () => appendix_EmergencyContacts());
  addProgram("Appendix B", null, "Incident Report, Investigation & Corrective Action Forms", () => appendix_IncidentForms());
  addProgram("Appendix C", null, "Daily Activity Plan (DAP) / Pre-Task Planning Forms", () => appendix_DAPPreTaskPlanning());
  addProgram("Appendix D", null, "Permit Control Forms", () => appendix_PermitControls());
  addProgram("Appendix E", null, "Inspection Checklists", () => appendix_InspectionChecklists());
  addProgram("Appendix F", null, "Training Matrix & Qualification Tracking", () => appendix_TrainingMatrix());
  addProgram("Appendix G", null, "PPE Matrix", () => appendix_PPEMatrix());
  addProgram("Appendix H", null, "Equipment Inspection Forms", () => appendix_EquipmentInspectionForms());
  addProgram("Appendix I", null, "Hot Work Permit & Fire Watch Forms", () => appendix_HotWorkFireWatchForms());
  addProgram("Appendix J", null, "High-Risk Work Planning Forms", () => appendix_HighRiskWorkForms());

  return blocks;
}

async function buildDoc(form: PSHSEPInput) {
  const normalizedForm = normalizePshsepBuilderFormData(form) as PSHSEPInput;
  const builderTextConfig = await getDocumentBuilderTextConfig().catch(() => null);
  const cover = buildCover(normalizedForm, builderTextConfig);
  const toc = buildTOC();
  const revisionLog = buildRevisionLog(normalizedForm);
  const admin = buildAdminSummary(normalizedForm, builderTextConfig);
  const programs = buildPrograms(normalizedForm, builderTextConfig);
  const disclaimer = [
    pageBreak(),
    formSectionTitle("DISCLAIMER"),
    ...DOCUMENT_DISCLAIMER_LINES.map((line) => p(line)),
  ];

  return createSafetyPlanDocument([
    ...cover,
    ...toc,
    ...revisionLog,
    pageBreak(),
    admin.heading,
    admin.intro,
    admin.table,
    ...programs,
    ...disclaimer,
  ]);
}

export function normalizePshsepForm(form: PSHSEPInput): PSHSEPInput {
  const normalized = normalizePshsepBuilderFormData(form) as PSHSEPInput;
  const scopeSelections = Array.isArray(normalized.scope_of_work_selected)
    ? normalized.scope_of_work_selected
    : [];
  const includedPrograms = new Set(derivePshsepExportProgramIds(normalized));

  if (scopeSelections.length > 0) {
    normalized.include_fall_protection =
      include(normalized.include_fall_protection, true) || includedPrograms.has("fall_protection");
    normalized.include_excavation =
      include(normalized.include_excavation, false) || includedPrograms.has("excavation");
    normalized.include_crane_rigging =
      include(normalized.include_crane_rigging, false) || includedPrograms.has("crane_rigging");
    normalized.include_confined_space =
      include(normalized.include_confined_space, false) || includedPrograms.has("confined_space");
    normalized.include_electrical_loto =
      include(normalized.include_electrical_loto, false) || includedPrograms.has("electrical_loto");
    normalized.include_hot_work =
      include(normalized.include_hot_work, false) || includedPrograms.has("hot_work");
  }

  return normalized;
}

function isGeneratedDraft(value: unknown): value is GeneratedSafetyPlanDraft {
  return Boolean(value) && typeof value === "object" && "sectionMap" in (value as Record<string, unknown>);
}

export async function generatePshsepDocx(
  form: PSHSEPInput | { generatedDocumentId?: string | null; draft?: GeneratedSafetyPlanDraft | null },
  options?: { supabase?: any }
) {
  if (form && typeof form === "object" && isGeneratedDraft((form as { draft?: unknown }).draft)) {
    return renderSafetyPlanDocx((form as { draft: GeneratedSafetyPlanDraft }).draft);
  }

  if (
    form &&
    typeof form === "object" &&
    typeof (form as { generatedDocumentId?: unknown }).generatedDocumentId === "string" &&
    options?.supabase
  ) {
    const draft = await loadGeneratedDocumentDraft(
      options.supabase,
      (form as { generatedDocumentId: string }).generatedDocumentId
    );
    return renderSafetyPlanDocx(draft);
  }

  const normalized = normalizePshsepForm(form as PSHSEPInput);
  const doc = await buildDoc(normalized);
  const buffer = await Packer.toBuffer(doc);

  return {
    body: new Uint8Array(buffer),
    filename: getSafetyBlueprintDraftFilename(
      safeFilePart(normalized.project_name || "Project"),
      "pshsep"
    ).replace("_Draft", ""),
  };
}

/* ROUTE HANDLER */
/* ------------------------------------------------ */

export async function POST(req: Request) {
  try {
    const auth = await authorizeRequest(req);

    if ("error" in auth) {
      return auth.error;
    }

    const form = (await req.json()) as PSHSEPInput | {
      generatedDocumentId?: string | null;
      draft?: GeneratedSafetyPlanDraft | null;
    };
    const { body, filename } = await generatePshsepDocx(form, { supabase: auth.supabase });

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    console.error(`${SITE_SAFETY_BLUEPRINT_TITLE} DOCX export failed:`, err);

    return NextResponse.json(
      { error: `Failed to generate ${SITE_SAFETY_BLUEPRINT_TITLE} DOCX.` },
      { status: 500 }
    );
  }
}
/* ------------------------------------------------ */
/* OPTIONAL: KEEP EXTRA PROGRAMS WITHOUT LINT NOISE */
/* ------------------------------------------------ */

/**
 * If you have a large library of program_* functions that you don't always
 * include in buildPrograms() yet, register them here. This keeps lint clean.
 *
 * Add any program functions you have but aren't using yet into this object.
 * It "uses" them so eslint won't warn, but doesn't change output.
 */
const _unusedProgramRegistry = {
  // Example placeholders (uncomment when those functions exist in your file):
  // program_IncidentInvestigation,
  // program_Inspections,
  // program_Housekeeping,
  // program_PPE,
  // program_SafetyOrientation,
} as const;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _ignoreUnused = _unusedProgramRegistry;
