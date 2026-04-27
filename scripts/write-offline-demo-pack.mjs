/**
 * Writes an offline demo reference pack next to the repo folder (Desktop by default):
 *   ../safety360_offline_demo_pack/
 *
 * Aligned with lib/demoWorkspace.ts (Summit Ridge Constructors, North Tower).
 * Usage: node scripts/write-offline-demo-pack.mjs [optional-output-dir]
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const defaultOut = path.join(repoRoot, "..", "safety360_offline_demo_pack");
const outDir = path.resolve(process.argv[2] || defaultOut);

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({
        text,
        size: 22,
        ...opts,
      }),
    ],
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 160 },
    children: [new TextRun({ text, bold: true })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, bold: true })],
  });
}

function coverLine(text, { bold = false, size = 28 } = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text, bold, size })],
  });
}

function buildCsepDoc() {
  const project = "North Tower — SR-1042";
  const contractor = "Summit Ridge Constructors (self-performed steel package)";
  const site = "4100 Industrial Way, Austin, TX 78701";

  return new Document({
    sections: [
      {
        properties: {},
        children: [
          coverLine("ISSUED — FOR DEMONSTRATION ONLY", { size: 20 }),
          coverLine("Contractor Safety & Environmental Plan (CSEP)", { bold: true, size: 36 }),
          coverLine(project, { bold: true, size: 26 }),
          coverLine(contractor, { size: 22 }),
          coverLine(site, { size: 22 }),
          coverLine(`Status: Issued (demo) · Revision: R1 · ${new Date().toISOString().slice(0, 10)}`, {
            size: 20,
          }),
          new Paragraph({ children: [new TextRun({ text: "", break: 1 })] }),

          h1("1. Purpose and scope"),
          p(
            "This CSEP describes how Summit Ridge Constructors controls safety and health exposures during core-and-shell work at North Tower, including crane-assisted steel erection, temporary decking, leading-edge work, and street-side logistics. It satisfies pre-task planning, competent-person accountability, and coordination with the site PSHSEP."
          ),

          h1("2. Key roles"),
          p(
            "Project Manager: Avery Patel. Site safety lead: Maria Chen. Field supervision: Jordan Lee / Eli Brooks. Competent persons are designated per Subpart R steel erection and fall protection programs. All workers hold universal stop-work authority."
          ),

          h1("3. Site conditions and sequence"),
          p(
            "Active work includes Level 5 steel welding, crane picks, and material staging. Fire watch is mandatory for all hot work on temporary decking. Barricades and controlled access zones protect swing radius and leading edges. Night-shift MEP interfaces are coordinated through the GC logistics gate."
          ),

          h1("4. Hazard controls (summary)"),
          h2("Fall protection"),
          p(
            "100% tie-off or equivalent approved systems at unprotected edges six feet and above. Controlled decking zones and access limits per erection plan. Rescue provisions identified before exposed work begins."
          ),
          h2("Crane and rigging"),
          p(
            "Qualified signal person on all picks. No personnel under suspended loads. Lift plans reviewed when radius or capacity margins are tight."
          ),
          h2("Hot work"),
          p(
            "Permit-required hot work with 60-minute fire watch minimum, non-combustible shields at deck penetrations, and documented handoff between shifts."
          ),

          h1("5. Emergency response"),
          p(
            "911 primary. Nearest ER communicated at site orientation. Assembly point: north parking lane. Spill kit and extinguisher maps posted at hoist landings."
          ),

          h1("6. Training and submittals"),
          p(
            "Toolbox talks logged daily for steel crew. MSHA/OSHA orientation cards on file. SDS for welding consumables and hydraulic fluids available at field office."
          ),

          h1("7. Document control"),
          p(
            "This issued CSEP is a static demo artifact for SafetyDocs360 walkthroughs. Live projects should replace placeholders with GC-approved versions and controlled revisions."
          ),
        ],
      },
    ],
  });
}

function buildPshsepDoc() {
  const project = "North Tower — SR-1042";
  const ownerGc = "Demo Owner / CM (fictional for product demo)";
  const site = "4100 Industrial Way, Austin, TX 78701";

  return new Document({
    sections: [
      {
        properties: {},
        children: [
          coverLine("ISSUED — FOR DEMONSTRATION ONLY", { size: 20 }),
          coverLine("Project / Site Health, Safety & Environmental Plan (PSHSEP)", {
            bold: true,
            size: 32,
          }),
          coverLine("(Same plan family as PHSEP / PESHEP labels in legacy forms)", { size: 20 }),
          coverLine(project, { bold: true, size: 26 }),
          coverLine(ownerGc, { size: 22 }),
          coverLine(site, { size: 22 }),
          coverLine(`Status: Issued (demo) · Revision: R1 · ${new Date().toISOString().slice(0, 10)}`, {
            size: 20,
          }),
          new Paragraph({ children: [new TextRun({ text: "", break: 1 })] }),

          h1("1. Administrative overview"),
          p(
            "This PSHSEP establishes site-wide expectations for the North Tower program: commercial core-and-shell with active crane operations, steel erection, street logistics, and phased tenant areas. It interfaces with contractor CSEPs and lower-tier safety plans."
          ),

          h1("2. Environmental controls"),
          p(
            "Stormwater: inlet protection inspected weekly and after significant rain. Dust: water suppression on demolition and bulk handling. Noise: monitor at property line during extended crane operations. Waste: commingled recycling where markets allow; hazardous wastes handled by licensed vendor only."
          ),

          h1("3. Site safety organization"),
          p(
            "GC safety lead chairs weekly coordination. Trade CSEPs are reviewed before high-risk work (steel picks, energization, confined space). Stop-work authority is universal. Incident notification ladder: foreman → PM → owner within contract timelines."
          ),

          h1("4. Life safety and logistics"),
          p(
            "Pedestrian routes separated from equipment via hard barricades where feasible. Flaggers trained per state requirements. Fire department access lanes kept clear. Hoist and stair pressurization tested per commissioning plan."
          ),

          h1("5. Industrial hygiene"),
          p(
            "Silica exposure assessed for concrete cutting and tuck-point scopes. Welding fume controls via LEV where feasible in enclosed levels. Heat illness prevention program active May–September."
          ),

          h1("6. Emergency preparedness"),
          p(
            "Muster maps at each floor field office. Severe weather: pause crane operations per manufacturer and site wind table. Spill response: 24-hour environmental contact on call board."
          ),

          h1("7. Audits and metrics"),
          p(
            "Weekly GC walk documented. Monthly owner walk. Corrective actions tracked to closure. This demo document mirrors the approved PESHEP row shown in the in-app sales demo Library."
          ),

          h1("8. Document control"),
          p(
            "Issued for SafetyDocs360 offline demonstrations only. Production sites must maintain controlled registers, transmittals, and revision history per contract."
          ),
        ],
      },
    ],
  });
}

const snapshot = {
  meta: {
    description:
      "Static snapshot aligned with in-app sales_demo workspace (see lib/demoWorkspace.ts and docs/demo-mode.md).",
    company: {
      id: "demo-company",
      name: "Summit Ridge Constructors",
      team_key: "summit-ridge",
      address: "4100 Industrial Way, Austin, TX 78701",
      primary_contact: "Jordan Lee",
      primary_email: "demo.20260425@safety360docs.local",
    },
    note_PHSEP_vs_PSHSEP:
      "The product labels the site plan as PSHSEP (Project/Site HSEP). Some customers say PHSEP or PESHEP; formatSafetyBlueprintDocumentType maps those to the same Site Safety Plan.",
  },
  jobsites: [
    {
      id: "demo-jobsite-1",
      name: "North Tower",
      project_number: "SR-1042",
      location: "Austin, TX",
      phase_notes: "Core and shell; crane picks; steel erection; street logistics.",
    },
    {
      id: "demo-jobsite-2",
      name: "Warehouse Retrofit",
      project_number: "SR-2210",
      location: "Round Rock, TX",
    },
    {
      id: "demo-jobsite-3",
      name: "South Clinic Buildout",
      project_number: "SR-3097",
      location: "San Marcos, TX",
      status: "planned",
    },
  ],
  library_documents_demo: [
    {
      project_name: "North Tower",
      document_title: "Site-specific safety plan",
      document_type: "PESHEP",
      status: "approved",
      maps_to_offline_file: "deliverables/North_Tower_Issued_PSHSEP_Summit_Ridge.docx",
    },
    {
      project_name: "North Tower",
      document_title: "Steel erection CSEP",
      document_type: "CSEP",
      status: "submitted",
      maps_to_offline_file: "deliverables/North_Tower_Issued_CSEP_Summit_Ridge.docx",
    },
  ],
  demo_walkthrough: [
    "Provision Supabase user with role sales_demo (see docs/demo-mode.md).",
    "Sign in and open /dashboard — data is generated client-side; no customer DB rows.",
    "Use this pack for printed/USB handouts: issued CSEP + PSHSEP match the North Tower storyline.",
  ],
};

async function main() {
  fs.mkdirSync(path.join(outDir, "deliverables"), { recursive: true });

  const csepPath = path.join(outDir, "deliverables", "North_Tower_Issued_CSEP_Summit_Ridge.docx");
  const pshsepPath = path.join(outDir, "deliverables", "North_Tower_Issued_PSHSEP_Summit_Ridge.docx");

  await Packer.toBuffer(buildCsepDoc()).then((buf) => fs.writeFileSync(csepPath, buf));
  await Packer.toBuffer(buildPshsepDoc()).then((buf) => fs.writeFileSync(pshsepPath, buf));

  fs.writeFileSync(
    path.join(outDir, "demo_workspace_snapshot.json"),
    JSON.stringify(snapshot, null, 2),
    "utf8"
  );

  const readme = `# SafetyDocs360 — offline demo pack

This folder sits **next to** the \`safety_docs_360\` repository so you can hand off a USB or zip without copying the whole app.

## Contents

| Path | Purpose |
|------|---------|
| \`README.md\` | This file |
| \`demo_workspace_snapshot.json\` | Key facts that mirror \`lib/demoWorkspace.ts\` (Summit Ridge / North Tower) |
| \`deliverables/North_Tower_Issued_CSEP_Summit_Ridge.docx\` | **Issued** contractor CSEP (demo narrative) |
| \`deliverables/North_Tower_Issued_PSHSEP_Summit_Ridge.docx\` | **Issued** site/project HSEP — product label **PSHSEP** (same family as PHSEP / PESHEP) |

## In-app demo account

The **sales_demo** role shows the same company story in the product (dashboard, jobsites, permits, library cards). Configure Auth + \`user_roles\` as described in \`docs/demo-mode.md\` inside the repo.

## Regenerating Word files

From the repo root:

\`\`\`bash
node scripts/write-offline-demo-pack.mjs
\`\`\`

Optional custom output directory:

\`\`\`bash
node scripts/write-offline-demo-pack.mjs "D:/handouts/safety360_offline_demo_pack"
\`\`\`

---

Generated: ${new Date().toISOString()}
`;

  fs.writeFileSync(path.join(outDir, "README.md"), readme, "utf8");

  console.log(`Offline demo pack written to:\n  ${outDir}`);
  console.log(`  - ${csepPath}`);
  console.log(`  - ${pshsepPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
