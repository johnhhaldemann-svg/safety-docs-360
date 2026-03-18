export const runtime = "nodejs";

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { NextResponse } from "next/server";
import { DOCUMENT_DISCLAIMER_LINES } from "@/lib/legal";
import { authorizeRequest } from "@/lib/rbac";

type RiskLevel = "Low" | "Medium" | "High";

type CSEPRiskItem = {
  activity: string;
  hazard: string;
  risk: RiskLevel;
  controls: string[];
  permit: string;
};

type HazardProgram = {
  title: string;
  triggerHazards: string[];
  oshaRefs: string[];
  purpose: string;
  controls: string[];
};

type IncludedContent = {
  project_information?: boolean;
  contractor_information?: boolean;
  trade_summary?: boolean;
  scope_of_work?: boolean;
  site_specific_notes?: boolean;
  emergency_procedures?: boolean;
  required_ppe?: boolean;
  additional_permits?: boolean;
  osha_references?: boolean;
  selected_hazards?: boolean;
  activity_hazard_matrix?: boolean;
};

type CSEPInput = {
  project_name: string;
  project_number: string;
  project_address: string;
  owner_client: string;
  gc_cm: string;

  contractor_company: string;
  contractor_contact: string;
  contractor_phone: string;
  contractor_email: string;

  trade: string;
  scope_of_work: string;
  site_specific_notes: string;
  emergency_procedures: string;

  required_ppe: string[];
  additional_permits: string[];
  selected_hazards?: string[];
  included_sections?: string[];

  tradeSummary?: string;
  oshaRefs?: string[];
  tradeItems?: CSEPRiskItem[];
  derivedHazards?: string[];
  derivedPermits?: string[];
  includedContent?: IncludedContent;
};

function valueOrNA(value?: string) {
  return value?.trim() ? value.trim() : "N/A";
}

function heading1(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 200, after: 160 },
    children: [new TextRun({ text, bold: true, size: 32 })],
  });
}

function heading2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 160, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26 })],
  });
}

function body(
  text: string,
  align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT
) {
  return new Paragraph({
    alignment: align,
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function bullet(text: string) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function tableCell(text: string, bold = false, width = 20) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
    },
    children: [
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text, bold, size: 20 })],
      }),
    ],
  });
}

function buildProjectInfoTable(form: CSEPInput) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          tableCell("Project Name", true, 25),
          tableCell(valueOrNA(form.project_name), false, 25),
          tableCell("Project Number", true, 25),
          tableCell(valueOrNA(form.project_number), false, 25),
        ],
      }),
      new TableRow({
        children: [
          tableCell("Project Address", true, 25),
          tableCell(valueOrNA(form.project_address), false, 25),
          tableCell("Owner / Client", true, 25),
          tableCell(valueOrNA(form.owner_client), false, 25),
        ],
      }),
      new TableRow({
        children: [
          tableCell("GC / CM", true, 25),
          tableCell(valueOrNA(form.gc_cm), false, 25),
          tableCell("Trade", true, 25),
          tableCell(valueOrNA(form.trade), false, 25),
        ],
      }),
    ],
  });
}

function buildContractorInfoTable(form: CSEPInput) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          tableCell("Contractor Company", true, 25),
          tableCell(valueOrNA(form.contractor_company), false, 25),
          tableCell("Contractor Contact", true, 25),
          tableCell(valueOrNA(form.contractor_contact), false, 25),
        ],
      }),
      new TableRow({
        children: [
          tableCell("Contractor Phone", true, 25),
          tableCell(valueOrNA(form.contractor_phone), false, 25),
          tableCell("Contractor Email", true, 25),
          tableCell(valueOrNA(form.contractor_email), false, 25),
        ],
      }),
    ],
  });
}

function buildRiskTable(items: CSEPRiskItem[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          tableCell("Activity", true, 20),
          tableCell("Hazard", true, 20),
          tableCell("Risk", true, 12),
          tableCell("Controls", true, 30),
          tableCell("Permit", true, 18),
        ],
      }),
      ...items.map(
        (item) =>
          new TableRow({
            children: [
              tableCell(item.activity, false, 20),
              tableCell(item.hazard, false, 20),
              tableCell(item.risk, false, 12),
              tableCell(item.controls.join(", "), false, 30),
              tableCell(item.permit, false, 18),
            ],
          })
      ),
    ],
  });
}

function buildResponsibilitiesTable() {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          tableCell("Role", true, 30),
          tableCell("Responsibility", true, 70),
        ],
      }),
      new TableRow({
        children: [
          tableCell("Contractor Superintendent", false, 30),
          tableCell(
            "Direct field operations, coordinate work sequencing, enforce the site-specific safety plan, and correct unsafe conditions immediately.",
            false,
            70
          ),
        ],
      }),
      new TableRow({
        children: [
          tableCell("Foreman / Lead", false, 30),
          tableCell(
            "Review daily activities with the crew, verify controls are in place, confirm required permits are obtained, and stop work when hazards change.",
            false,
            70
          ),
        ],
      }),
      new TableRow({
        children: [
          tableCell("Workers", false, 30),
          tableCell(
            "Follow this CSEP, wear required PPE, attend safety briefings, report hazards immediately, and refuse unsafe work.",
            false,
            70
          ),
        ],
      }),
      new TableRow({
        children: [
          tableCell("Safety Representative", false, 30),
          tableCell(
            "Support inspections, hazard assessments, coaching, corrective actions, and verification of permit and training compliance.",
            false,
            70
          ),
        ],
      }),
    ],
  });
}

function buildTrainingBullets(form: CSEPInput) {
  const bullets: string[] = [
    "All workers shall receive site orientation before starting work.",
    "Daily pre-task planning shall be completed before beginning work activities.",
    "Tool-specific and task-specific training shall be completed before use of equipment or specialty tools.",
    "Workers shall be trained on emergency procedures, evacuation routes, and incident reporting expectations.",
  ];

  if ((form.trade || "").toLowerCase().includes("electrical")) {
    bullets.push(
      "Electrical workers shall be trained on LOTO, temporary power, and energized work restrictions."
    );
  }

  if ((form.trade || "").toLowerCase().includes("excavation")) {
    bullets.push(
      "Excavation workers shall be trained on trench hazards, soil conditions, utility awareness, and protective systems."
    );
  }

  if ((form.trade || "").toLowerCase().includes("roof")) {
    bullets.push(
      "Roofing workers shall be trained on fall protection systems, leading-edge controls, and weather restrictions."
    );
  }

  return bullets;
}

function normalizeIncludedContent(form: CSEPInput): Required<IncludedContent> {
  const defaults: Required<IncludedContent> = {
    project_information: true,
    contractor_information: true,
    trade_summary: true,
    scope_of_work: true,
    site_specific_notes: true,
    emergency_procedures: true,
    required_ppe: true,
    additional_permits: true,
    osha_references: true,
    selected_hazards: true,
    activity_hazard_matrix: true,
  };

  return {
    ...defaults,
    ...(form.includedContent ?? {}),
  };
}

const HAZARD_PROGRAM_LIBRARY: HazardProgram[] = [
  {
    title: "Fall Protection Program",
    triggerHazards: ["Falls from height"],
    oshaRefs: ["OSHA 1926 Subpart M – Fall Protection"],
    purpose:
      "This program establishes the minimum controls required to protect workers exposed to falls from height, leading edges, roof edges, floor openings, and elevated work platforms.",
    controls: [
      "A fall protection plan shall be reviewed before elevated work begins.",
      "Approved fall protection systems shall be used when required by site rules or OSHA criteria.",
      "Workers shall inspect harnesses, lanyards, SRLs, anchors, and connectors before each use.",
      "Guardrails, covers, warning lines, and controlled access zones shall be maintained where applicable.",
      "Damaged fall protection equipment shall be removed from service immediately.",
      "Only trained personnel shall use personal fall arrest systems.",
      "Dropped object exposure below elevated work shall be controlled with barricades and exclusion zones.",
    ],
  },
  {
    title: "Electrical Safety Program",
    triggerHazards: ["Electrical shock"],
    oshaRefs: ["OSHA 1926 Subpart K – Electrical"],
    purpose:
      "This program defines the controls required to prevent shock, arc, burn, and energized equipment exposure during construction activities.",
    controls: [
      "All temporary power systems shall be installed and maintained in a safe condition.",
      "GFCI protection shall be used where required.",
      "Damaged cords, tools, and electrical equipment shall be removed from service.",
      "Only qualified personnel shall perform electrical tie-ins, troubleshooting, or energized system work.",
      "LOTO procedures shall be followed before servicing equipment where hazardous energy is present.",
      "Extension cords shall be protected from damage, water, pinch points, and vehicle traffic.",
      "Panels and disconnects shall remain accessible and properly identified.",
    ],
  },
  {
    title: "Hot Work Program",
    triggerHazards: ["Hot work / fire"],
    oshaRefs: ["OSHA 1926 Subpart J – Fire Protection and Prevention"],
    purpose:
      "This program establishes fire prevention and hot work controls for welding, cutting, torch work, grinding, soldering, brazing, and spark-producing tasks.",
    controls: [
      "Hot work shall not begin until required permits are obtained.",
      "Combustible materials shall be removed or protected before hot work starts.",
      "Fire extinguishers shall be available in the immediate work area.",
      "A fire watch shall be assigned when required by permit or site rules.",
      "Workers shall inspect hoses, regulators, torches, leads, and equipment before use.",
      "Hot work shall stop immediately if unsafe conditions develop.",
      "Post-work fire watch requirements shall be followed.",
    ],
  },
  {
    title: "Excavation and Trenching Safety Program",
    triggerHazards: ["Confined spaces"],
    oshaRefs: ["OSHA 1926 Subpart P – Excavations"],
    purpose:
      "This program provides minimum controls for trenching, excavation support activities, underground utility work, and changing soil conditions.",
    controls: [
      "Excavations shall be inspected by a competent person as required.",
      "Protective systems shall be used where required by depth, soil, and field conditions.",
      "Spoil piles and materials shall be kept back from excavation edges.",
      "Safe access and egress shall be maintained.",
      "Workers shall stay clear of suspended loads and equipment swing areas near trenches.",
      "Underground utilities shall be identified before excavation begins.",
      "Water accumulation, surcharge loading, and changing ground conditions shall be addressed before work continues.",
    ],
  },
  {
    title: "Struck-By and Equipment Safety Program",
    triggerHazards: ["Struck by equipment"],
    oshaRefs: [
      "OSHA 1926 Subpart O – Motor Vehicles, Mechanized Equipment, and Marine Operations",
    ],
    purpose:
      "This program establishes controls for equipment interaction, backing hazards, haul routes, blind spots, and worker exposure around moving equipment.",
    controls: [
      "Workers shall remain clear of moving equipment unless directly involved in the operation.",
      "Spotters shall be used where visibility is restricted or site rules require them.",
      "Equipment routes, swing radiuses, and exclusion zones shall be identified and maintained.",
      "Operators shall inspect equipment before use.",
      "Workers shall wear high visibility garments where equipment traffic is present.",
      "No employee shall position themselves between fixed objects and moving equipment.",
      "Loads shall be secured and transported safely.",
    ],
  },
  {
    title: "Ladder Safety Program",
    triggerHazards: ["Ladder misuse"],
    oshaRefs: ["OSHA 1926 Subpart X – Stairways and Ladders"],
    purpose:
      "This program establishes controls for safe ladder selection, inspection, setup, and use.",
    controls: [
      "Ladders shall be inspected before use.",
      "Damaged ladders shall be removed from service immediately.",
      "Ladders shall be set on stable surfaces and used at the proper angle where applicable.",
      "Three points of contact shall be maintained during climbing.",
      "Workers shall not overreach or use the top step unless the ladder is designed for it.",
      "Ladders shall be secured where required.",
      "Only the proper ladder type shall be used for the task.",
    ],
  },
  {
    title: "Confined Space Safety Program",
    triggerHazards: ["Confined spaces"],
    oshaRefs: ["OSHA 1926 Subpart AA – Confined Spaces in Construction"],
    purpose:
      "This program establishes controls for confined spaces, limited-entry work areas, and spaces requiring atmospheric evaluation or permit controls.",
    controls: [
      "Confined spaces shall be identified before work begins.",
      "Permit requirements shall be followed when applicable.",
      "Atmospheric testing shall be completed when required.",
      "Rescue procedures and communication methods shall be established before entry.",
      "Unauthorized entry shall be prevented.",
      "Entrants, attendants, and supervisors shall understand their responsibilities.",
      "Conditions shall be reevaluated whenever the work or atmosphere changes.",
    ],
  },
  {
    title: "Hazard Communication and Chemical Safety Program",
    triggerHazards: ["Chemical exposure"],
    oshaRefs: ["OSHA 1926.59 / Hazard Communication"],
    purpose:
      "This program establishes minimum requirements for chemical review, SDS access, labeling, handling, storage, and worker protection.",
    controls: [
      "Safety Data Sheets shall be available for chemicals used on site.",
      "Containers shall be properly labeled.",
      "Workers shall review hazards before using chemical products.",
      "Required PPE shall be worn when handling hazardous materials.",
      "Chemical storage areas shall be maintained in a safe condition.",
      "Spill response materials shall be available when required.",
      "Incompatible chemicals shall not be stored together.",
    ],
  },
  {
    title: "Falling Object and Overhead Work Safety Program",
    triggerHazards: ["Falling objects"],
    oshaRefs: ["OSHA 1926 Subpart M – Fall Protection"],
    purpose:
      "This program establishes controls to protect workers from falling tools, materials, debris, and overhead work activities.",
    controls: [
      "Toe boards, debris nets, tool lanyards, or overhead protection shall be used where needed.",
      "Barricades and exclusion zones shall be established below overhead work.",
      "Materials shall be secured against displacement.",
      "Workers shall not enter suspended load zones unless authorized and protected.",
      "Staging at edges and elevated surfaces shall be controlled.",
      "Dropped object risks shall be reviewed during pre-task planning.",
      "Hard hats shall be worn where overhead hazards exist.",
    ],
  },
  {
    title: "Crane, Rigging, and Lift Safety Program",
    triggerHazards: ["Crane lift hazards"],
    oshaRefs: ["OSHA 1926 Subpart CC – Cranes and Derricks in Construction"],
    purpose:
      "This program defines controls for crane activity, rigging, lifting operations, material picks, and suspended load exposure.",
    controls: [
      "Lift plans shall be used when required by site rules or lift complexity.",
      "Only trained and authorized personnel shall rig or direct crane lifts.",
      "Rigging shall be inspected before use.",
      "Workers shall remain clear of suspended loads.",
      "Tag lines shall be used when appropriate.",
      "Communication methods between operators and signal persons shall be clearly established.",
      "Crane setup, ground conditions, and swing areas shall be evaluated before lifting.",
    ],
  },
  {
    title: "Housekeeping and Slip, Trip, Fall Prevention Program",
    triggerHazards: ["Slips trips falls"],
    oshaRefs: ["OSHA 1926 Subpart C – General Safety and Health Provisions"],
    purpose:
      "This program establishes housekeeping expectations to reduce same-level fall hazards, blocked access, and material clutter.",
    controls: [
      "Walkways, access points, and work areas shall be kept clear.",
      "Debris shall be removed routinely.",
      "Cords, hoses, and materials shall be managed to prevent trip hazards.",
      "Wet, muddy, icy, or uneven surfaces shall be addressed promptly.",
      "Lighting shall be adequate for safe travel and work.",
      "Storage areas shall be organized and maintained.",
      "Workers shall report and correct slip, trip, and housekeeping hazards immediately.",
    ],
  },
];

function getTriggeredPrograms(selectedHazards: string[]) {
  return HAZARD_PROGRAM_LIBRARY.filter((program) =>
    program.triggerHazards.some((hazard) => selectedHazards.includes(hazard))
  );
}

function addProgramSection(
  children: (Paragraph | Table)[],
  sectionNumber: number,
  program: HazardProgram
) {
  children.push(heading1(`${sectionNumber}. ${program.title}`));
  children.push(body(program.purpose));

  if (program.oshaRefs.length) {
    children.push(heading2("Applicable References"));
    program.oshaRefs.forEach((ref) => children.push(bullet(ref)));
  }

  children.push(heading2("Minimum Required Controls"));
  program.controls.forEach((control) => children.push(bullet(control)));
}

function buildDoc(form: CSEPInput) {
  const includedContent = normalizeIncludedContent(form);

  const tradeItems = Array.isArray(form.tradeItems) ? form.tradeItems : [];
  const oshaRefs = Array.isArray(form.oshaRefs) ? form.oshaRefs : [];
  const derivedHazards = Array.isArray(form.derivedHazards)
    ? form.derivedHazards
    : [];
  const derivedPermits = Array.isArray(form.derivedPermits)
    ? form.derivedPermits
    : [];
  const requiredPPE = Array.isArray(form.required_ppe) ? form.required_ppe : [];
  const additionalPermits = Array.isArray(form.additional_permits)
    ? form.additional_permits
    : [];
  const selectedHazards = Array.isArray(form.selected_hazards)
    ? form.selected_hazards
    : [];
  const permitList = Array.from(
    new Set([...additionalPermits, ...derivedPermits].filter(Boolean))
  );

  const activeHazards = selectedHazards.length
    ? selectedHazards
    : derivedHazards;
  const triggeredPrograms = getTriggeredPrograms(activeHazards);

  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 220 },
      children: [
        new TextRun({
          text: "Contractor Site Specific Safety Plan",
          bold: true,
          size: 34,
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: valueOrNA(form.project_name),
          size: 24,
        }),
      ],
    })
  );

  children.push(
    body(`Trade: ${valueOrNA(form.trade)}`, AlignmentType.CENTER)
  );
  children.push(
    body(
      `Contractor: ${valueOrNA(form.contractor_company)}`,
      AlignmentType.CENTER
    )
  );
  children.push(new Paragraph({ children: [new PageBreak()] }));

  let sectionNumber = 1;

  if (includedContent.project_information) {
    children.push(heading1(`${sectionNumber}. Project Information`));
    children.push(buildProjectInfoTable(form));
    sectionNumber++;
  }

  if (includedContent.contractor_information) {
    children.push(heading1(`${sectionNumber}. Contractor Information`));
    children.push(buildContractorInfoTable(form));
    sectionNumber++;
  }

  if (includedContent.scope_of_work) {
    children.push(heading1(`${sectionNumber}. Scope of Work`));
    children.push(
      body(
        valueOrNA(form.scope_of_work) === "N/A"
          ? "The contractor shall perform work in accordance with the approved project scope, applicable plans, and all site-specific requirements."
          : valueOrNA(form.scope_of_work)
      )
    );
    sectionNumber++;
  }

  if (includedContent.site_specific_notes) {
    children.push(heading1(`${sectionNumber}. Site Specific Notes`));
    children.push(
      body(
        valueOrNA(form.site_specific_notes) === "N/A"
          ? "Site-specific constraints, active construction conditions, adjacent operations, and coordination requirements shall be reviewed daily before work begins."
          : valueOrNA(form.site_specific_notes)
      )
    );
    sectionNumber++;
  }

  if (includedContent.emergency_procedures) {
    children.push(heading1(`${sectionNumber}. Emergency Procedures`));
    children.push(
      body(
        valueOrNA(form.emergency_procedures) === "N/A"
          ? "In the event of an emergency, workers shall stop work, notify supervision immediately, follow site alarm and evacuation procedures, and report to the designated assembly area."
          : valueOrNA(form.emergency_procedures)
      )
    );
    sectionNumber++;
  }

  if (includedContent.required_ppe) {
    children.push(
      heading1(`${sectionNumber}. Required Personal Protective Equipment`)
    );
    if (requiredPPE.length) {
      requiredPPE.forEach((item) => children.push(bullet(item)));
    } else {
      children.push(body("No additional PPE selections were entered."));
    }
    sectionNumber++;
  }

  if (includedContent.additional_permits) {
    children.push(heading1(`${sectionNumber}. Permit Requirements`));
    if (permitList.length) {
      permitList.forEach((item) => children.push(bullet(item)));
    } else {
      children.push(body("No permit triggers were selected or derived."));
    }
    sectionNumber++;
  }

  if (includedContent.osha_references) {
    children.push(heading1(`${sectionNumber}. Applicable OSHA References`));
    if (oshaRefs.length) {
      oshaRefs.forEach((ref) => children.push(bullet(ref)));
    } else {
      children.push(
        body(
          "Applicable OSHA references shall be identified based on the selected trade, tools, equipment, and site conditions."
        )
      );
    }
    sectionNumber++;
  }

  if (includedContent.trade_summary) {
    children.push(heading1(`${sectionNumber}. Trade Summary`));
    children.push(
      body(
        valueOrNA(form.tradeSummary) === "N/A"
          ? "This contractor’s work includes trade-specific exposures that require planning, supervision, appropriate PPE, safe access, and hazard controls throughout execution of the work."
          : valueOrNA(form.tradeSummary)
      )
    );
    sectionNumber++;
  }

  if (includedContent.selected_hazards) {
    children.push(heading1(`${sectionNumber}. Selected Hazard Summary`));
    if (activeHazards.length) {
      activeHazards.forEach((hazard) => children.push(bullet(hazard)));
    } else {
      children.push(
        body(
          "Key hazards will be determined from the selected trade, work methods, adjacent operations, and changing field conditions."
        )
      );
    }
    sectionNumber++;
  }

  children.push(heading1(`${sectionNumber}. Roles and Responsibilities`));
  children.push(buildResponsibilitiesTable());
  sectionNumber++;

  children.push(heading1(`${sectionNumber}. Training Requirements`));
  buildTrainingBullets(form).forEach((item) => children.push(bullet(item)));
  sectionNumber++;

  children.push(heading1(`${sectionNumber}. General Safety Expectations`));
  [
    "Housekeeping shall be maintained in all work areas, access routes, and staging areas.",
    "All tools and equipment shall be inspected before use and removed from service when damaged.",
    "Workers shall maintain situational awareness for adjacent crews, moving equipment, suspended loads, and changing site conditions.",
    "Barricades, signage, and exclusion zones shall be maintained whenever work creates exposure to others.",
    "Work shall stop when hazards are uncontrolled, conditions change, or permit requirements are not met.",
  ].forEach((item) => children.push(bullet(item)));
  sectionNumber++;

  if (includedContent.activity_hazard_matrix) {
    children.push(
      heading1(`${sectionNumber}. Activity Hazard Analysis Matrix`)
    );
    if (tradeItems.length) {
      children.push(buildRiskTable(tradeItems));
    } else {
      children.push(
        body(
          "No trade activity matrix was provided. Select a trade and hazards on the CSEP page to load activities, hazards, controls, and permit triggers."
        )
      );
    }
    sectionNumber++;
  }

  if (triggeredPrograms.length) {
    children.push(new Paragraph({ children: [new PageBreak()] }));

    triggeredPrograms.forEach((program) => {
      addProgramSection(children, sectionNumber, program);
      sectionNumber++;
    });
  }

  children.push(new Paragraph({ children: [new PageBreak()] }));

  children.push(
    heading1(`${sectionNumber}. Stop Work and Change Management`)
  );
  [
    "Any worker has the authority and obligation to stop work when an unsafe condition exists.",
    "Work shall be reevaluated when scope changes, crews change, weather changes, or new equipment is introduced.",
    "Changed conditions shall be reviewed with supervision and the crew before work resumes.",
    "New hazards shall be documented and controlled before proceeding.",
  ].forEach((item) => children.push(bullet(item)));
  sectionNumber++;

  children.push(heading1(`${sectionNumber}. Acknowledgment`));
  children.push(
    body(
      "The contractor acknowledges responsibility for complying with this Contractor Site Specific Safety Plan, applicable site rules, required permits, and all regulatory requirements associated with the work."
    )
  );
  children.push(
    body("Contractor Representative: ________________________________")
  );
  children.push(
    body("Signature: ______________________________________________")
  );
  children.push(
    body("Date: ___________________________________________________")
  );
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Disclaimer"));
  DOCUMENT_DISCLAIMER_LINES.forEach((line) => {
    children.push(body(line));
  });

  return new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });
}

export async function generateCsepDocx(form: CSEPInput) {
  const doc = buildDoc(form);
  const buffer = await Packer.toBuffer(doc);
  const fileData = new Uint8Array(buffer);

  const safeProject = valueOrNA(form.project_name).replace(/[^\w\-]+/g, "_");
  const safeTrade = valueOrNA(form.trade).replace(/[^\w\-]+/g, "_");
  const filename = `${safeProject}_${safeTrade}_CSEP.docx`;

  return new NextResponse(fileData, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function POST(req: Request) {
  try {
    const auth = await authorizeRequest(req);

    if ("error" in auth) {
      return auth.error;
    }

    const form = (await req.json()) as CSEPInput;
    return await generateCsepDocx(form);
  } catch (error) {
    console.error("CSEP export error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to generate CSEP document.";

    return new NextResponse(JSON.stringify({ error: message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
