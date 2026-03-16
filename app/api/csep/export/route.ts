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

type RiskLevel = "Low" | "Medium" | "High";

type CSEPRiskItem = {
  activity: string;
  hazard: string;
  risk: RiskLevel;
  controls: string[];
  permit: string;
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

  tradeSummary?: string;
  oshaRefs?: string[];
  tradeItems?: CSEPRiskItem[];
  derivedHazards?: string[];
  derivedPermits?: string[];
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

function labelValue(label: string, value: string) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 22 }),
      new TextRun({ text: value, size: 22 }),
    ],
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

function buildInfoTable(form: CSEPInput) {
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
    bullets.push("Electrical workers shall be trained on LOTO, temporary power, and energized work restrictions.");
  }

  if ((form.trade || "").toLowerCase().includes("excavation")) {
    bullets.push("Excavation workers shall be trained on trench hazards, soil conditions, utility awareness, and protective systems.");
  }

  if ((form.trade || "").toLowerCase().includes("roof")) {
    bullets.push("Roofing workers shall be trained on fall protection systems, leading-edge controls, and weather restrictions.");
  }

  return bullets;
}

function buildDoc(form: CSEPInput) {
  const tradeItems = Array.isArray(form.tradeItems) ? form.tradeItems : [];
  const oshaRefs = Array.isArray(form.oshaRefs) ? form.oshaRefs : [];
  const derivedHazards = Array.isArray(form.derivedHazards) ? form.derivedHazards : [];
  const derivedPermits = Array.isArray(form.derivedPermits) ? form.derivedPermits : [];
  const requiredPPE = Array.isArray(form.required_ppe) ? form.required_ppe : [];
  const additionalPermits = Array.isArray(form.additional_permits) ? form.additional_permits : [];

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

  children.push(body(`Trade: ${valueOrNA(form.trade)}`, AlignmentType.CENTER));
  children.push(body(`Contractor: ${valueOrNA(form.contractor_company)}`, AlignmentType.CENTER));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  children.push(heading1("1. Project and Contractor Information"));
  children.push(buildInfoTable(form));

  children.push(heading1("2. Scope of Work"));
  children.push(
    body(
      valueOrNA(form.scope_of_work) === "N/A"
        ? "The contractor shall perform work in accordance with the approved project scope, applicable plans, and all site-specific requirements."
        : valueOrNA(form.scope_of_work)
    )
  );

  children.push(heading1("3. Site Specific Notes"));
  children.push(
    body(
      valueOrNA(form.site_specific_notes) === "N/A"
        ? "Site-specific constraints, active construction conditions, adjacent operations, and coordination requirements shall be reviewed daily before work begins."
        : valueOrNA(form.site_specific_notes)
    )
  );

  children.push(heading1("4. Emergency Procedures"));
  children.push(
    body(
      valueOrNA(form.emergency_procedures) === "N/A"
        ? "In the event of an emergency, workers shall stop work, notify supervision immediately, follow site alarm and evacuation procedures, and report to the designated assembly area."
        : valueOrNA(form.emergency_procedures)
    )
  );

  children.push(heading1("5. Required Personal Protective Equipment"));
  if (requiredPPE.length) {
    requiredPPE.forEach((item) => children.push(bullet(item)));
  } else {
    children.push(body("No additional PPE selections were entered."));
  }

  children.push(heading1("6. Permit Requirements"));
  if (additionalPermits.length || derivedPermits.length) {
    Array.from(new Set([...additionalPermits, ...derivedPermits])).forEach((item) =>
      children.push(bullet(item))
    );
  } else {
    children.push(body("No permit triggers were selected or derived."));
  }

  children.push(heading1("7. Applicable OSHA References"));
  if (oshaRefs.length) {
    oshaRefs.forEach((ref) => children.push(bullet(ref)));
  } else {
    children.push(
      body(
        "Applicable OSHA references shall be identified based on the selected trade, tools, equipment, and site conditions."
      )
    );
  }

  children.push(heading1("8. Trade Summary"));
  children.push(
    body(
      valueOrNA(form.tradeSummary) === "N/A"
        ? "This contractor’s work includes trade-specific exposures that require planning, supervision, appropriate PPE, safe access, and hazard controls throughout execution of the work."
        : valueOrNA(form.tradeSummary)
    )
  );

  children.push(heading1("9. Key Hazard Summary"));
  if (derivedHazards.length) {
    derivedHazards.forEach((hazard) => children.push(bullet(hazard)));
  } else {
    children.push(
      body(
        "Key hazards will be determined from the selected trade, work methods, adjacent operations, and changing field conditions."
      )
    );
  }

  children.push(heading1("10. Roles and Responsibilities"));
  children.push(buildResponsibilitiesTable());

  children.push(heading1("11. Training Requirements"));
  buildTrainingBullets(form).forEach((item) => children.push(bullet(item)));

  children.push(heading1("12. General Safety Expectations"));
  [
    "Housekeeping shall be maintained in all work areas, access routes, and staging areas.",
    "All tools and equipment shall be inspected before use and removed from service when damaged.",
    "Workers shall maintain situational awareness for adjacent crews, moving equipment, suspended loads, and changing site conditions.",
    "Barricades, signage, and exclusion zones shall be maintained whenever work creates exposure to others.",
    "Work shall stop when hazards are uncontrolled, conditions change, or permit requirements are not met.",
  ].forEach((item) => children.push(bullet(item)));

  children.push(heading1("13. Activity Hazard Analysis Matrix"));
  if (tradeItems.length) {
    children.push(buildRiskTable(tradeItems));
  } else {
    children.push(
      body(
        "No trade activity matrix was provided. Select a trade on the CSEP page to load activities, hazards, controls, and permit triggers."
      )
    );
  }

  children.push(new Paragraph({ children: [new PageBreak()] }));

  children.push(heading1("14. Stop Work and Change Management"));
  [
    "Any worker has the authority and obligation to stop work when an unsafe condition exists.",
    "Work shall be reevaluated when scope changes, crews change, weather changes, or new equipment is introduced.",
    "Changed conditions shall be reviewed with supervision and the crew before work resumes.",
    "New hazards shall be documented and controlled before proceeding.",
  ].forEach((item) => children.push(bullet(item)));

  children.push(heading1("15. Acknowledgment"));
  children.push(
    body(
      "The contractor acknowledges responsibility for complying with this Contractor Site Specific Safety Plan, applicable site rules, required permits, and all regulatory requirements associated with the work."
    )
  );
  children.push(body("Contractor Representative: ________________________________"));
  children.push(body("Signature: ______________________________________________"));
  children.push(body("Date: ___________________________________________________"));

  return new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });
}

export async function POST(req: Request) {
  try {
    const form = (await req.json()) as CSEPInput;

    const doc = buildDoc(form);

    const buffer = await Packer.toBuffer(doc);

    // Convert Node Buffer to Uint8Array for NextResponse
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

  } catch (error) {
    console.error("CSEP export error:", error);

    return new NextResponse(
      JSON.stringify({ error: "Failed to generate CSEP document." }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}