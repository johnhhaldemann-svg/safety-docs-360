import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const outputDir = join(repoRoot, "public", "training");
const previewDir = join(repoRoot, ".codex-reference-render", "training-previews");

async function importArtifactTool() {
  try {
    return await import("@oai/artifact-tool");
  } catch {
    const configured = process.env.CODEX_ARTIFACT_TOOL_ENTRY;
    const userProfile = process.env.USERPROFILE || process.env.HOME || "";
    const fallback = configured || join(
      userProfile,
      ".cache",
      "codex-runtimes",
      "codex-primary-runtime",
      "dependencies",
      "node",
      "node_modules",
      "@oai",
      "artifact-tool",
      "dist",
      "artifact_tool.mjs"
    );

    if (!existsSync(fallback)) {
      throw new Error(
        "Could not find @oai/artifact-tool. Set CODEX_ARTIFACT_TOOL_ENTRY to dist/artifact_tool.mjs."
      );
    }

    return import(pathToFileURL(fallback).href);
  }
}

const {
  Presentation,
  PresentationFile,
  column,
  row,
  grid,
  text,
  rule,
  fill,
  hug,
  wrap,
  fixed,
  grow,
  fr,
  auto,
} = await importArtifactTool();

const W = 1920;
const H = 1080;
const colors = {
  ink: "#0F172A",
  text: "#334155",
  muted: "#64748B",
  blue: "#2563EB",
  cyan: "#0891B2",
  green: "#15803D",
  amber: "#B45309",
  red: "#B91C1C",
  line: "#CBD5E1",
};

const deckSpecs = [
  {
    fileName: "SafePredict-getting-started.pptx",
    title: "Getting Started With SafePredict",
    subtitle: "Login, profile, dashboard, search, and navigation basics.",
    audience: "All users",
    accent: colors.blue,
    modules: ["Login", "Profile", "Dashboard", "Search", "Navigation"],
    slides: [
      {
        title: "Start from a clean account state",
        kicker: "First 10 minutes",
        bullets: [
          "Sign in from the access portal and confirm the account is active.",
          "Accept the platform agreement so the workspace shell unlocks.",
          "Use the sidebar and command search as the main wayfinding tools.",
        ],
      },
      {
        title: "Profile fields drive the rest of the platform",
        kicker: "Why it matters",
        bullets: [
          "Name, title, trade, and readiness status show up in team views.",
          "Certifications and expiration dates feed the training tracker.",
          "A complete profile reduces follow-up during project setup.",
        ],
      },
      {
        title: "The dashboard is the daily starting point",
        kicker: "Daily workflow",
        bullets: [
          "Review urgent work, open items, and recommended next actions.",
          "Use search when you know the document, page, or project you need.",
          "Open related areas from the sidebar rather than browser history.",
        ],
      },
    ],
    close: [
      "Complete profile before joining a project walkthrough.",
      "Bookmark the dashboard after first login.",
      "Use search whenever a file or workflow location is unclear.",
    ],
  },
  {
    fileName: "SafePredict-documents-marketplace.pptx",
    title: "Documents, Library, And Marketplace",
    subtitle: "Find, upload, submit, review, and build safety documentation.",
    audience: "Document owners",
    accent: colors.cyan,
    modules: ["Library", "Marketplace", "Upload", "Review", "Builders"],
    slides: [
      {
        title: "The library is the record system",
        kicker: "Document hub",
        bullets: [
          "Use completed documents for approved records and final downloads.",
          "Use marketplace templates when starting from vetted examples.",
          "Use search to find records across titles, projects, and metadata.",
        ],
      },
      {
        title: "Uploads and submissions are separate steps",
        kicker: "Review flow",
        bullets: [
          "Upload collects source files and supporting documentation.",
          "Submit for review moves work into the document review path.",
          "Preview requests keep marketplace access controlled before purchase.",
        ],
      },
      {
        title: "Builders create structured safety plan packages",
        kicker: "Guided output",
        bullets: [
          "PESH and CSEP workflows guide users through repeatable inputs.",
          "Generated drafts still need review before operational use.",
          "Final exports should live back in the library as the source of truth.",
        ],
      },
    ],
    close: [
      "Start in the library when looking for a record.",
      "Use marketplace for templates, not final company records.",
      "Treat builders as guided drafting tools with human review.",
    ],
  },
  {
    fileName: "SafePredict-field-work.pptx",
    title: "Field Workflows For Jobsites",
    subtitle: "Jobsites, audits, JSAs, permits, incidents, and field issue tracking.",
    audience: "Field teams",
    accent: colors.green,
    modules: ["Jobsites", "Audits", "JSA", "Permits", "Incidents"],
    slides: [
      {
        title: "Start field work from the jobsite context",
        kicker: "Project view",
        bullets: [
          "Open the jobsite workspace before reviewing project-specific records.",
          "Use jobsite pages for documents, team context, reports, and activity.",
          "Keep field workflows tied to the right project whenever possible.",
        ],
      },
      {
        title: "Use the right field form for the decision",
        kicker: "Daily controls",
        bullets: [
          "Audits capture observations and follow-up work.",
          "JSAs document task hazards, controls, and signoff.",
          "Permits support higher-risk approvals and stop-work visibility.",
        ],
      },
      {
        title: "Incidents and issues need closure discipline",
        kicker: "Follow-up",
        bullets: [
          "Use the incident log for response, escalation, and recordkeeping.",
          "Use the field issue log for corrective actions and recurring concerns.",
          "Close items only when evidence and owner accountability are clear.",
        ],
      },
    ],
    close: [
      "Choose the jobsite first, then the workflow.",
      "Keep evidence attached to the relevant record.",
      "Review open issues before the next planning meeting.",
    ],
  },
  {
    fileName: "SafePredict-training-tracker-team-access.pptx",
    title: "Training Tracker And Team Access",
    subtitle: "Team roles, profiles, certifications, requirements, and contractor readiness.",
    audience: "Admins and supervisors",
    accent: colors.amber,
    modules: ["Team", "Roles", "Profiles", "Requirements", "Gaps"],
    slides: [
      {
        title: "Team access controls who can do what",
        kicker: "Access setup",
        bullets: [
          "Use Team & Access to manage invitations, roles, and permissions.",
          "Assign the least powerful role that still supports the user's work.",
          "Keep inactive or outdated users out of operational workflows.",
        ],
      },
      {
        title: "Profiles turn people into readiness records",
        kicker: "Worker context",
        bullets: [
          "Trade, position, readiness, and certifications create useful matching.",
          "Expiration dates help supervisors find urgent training gaps.",
          "Managed profile edits help admins clean up incomplete team records.",
        ],
      },
      {
        title: "The training tracker shows readiness gaps",
        kicker: "Training matrix",
        bullets: [
          "Requirements define what applies by role, trade, task, or project need.",
          "Matrix cells show matches, gaps, and non-applicable requirements.",
          "Contractor compliance extends the same readiness thinking externally.",
        ],
      },
    ],
    close: [
      "Set roles before inviting broad groups.",
      "Update certification expirations during onboarding.",
      "Review gaps before assigning high-risk work.",
    ],
  },
  {
    fileName: "SafePredict-insights-admin.pptx",
    title: "Insights, Safety Intelligence, And Admin Basics",
    subtitle: "Command center, Safety Intelligence, analytics, reports, billing, and admin routines.",
    audience: "Leaders and admins",
    accent: colors.red,
    modules: ["Command", "Intelligence", "Analytics", "Reports", "Billing"],
    slides: [
      {
        title: "Command Center turns signals into priorities",
        kicker: "Leadership view",
        bullets: [
          "Use it to review current risk, open work, and recommended next steps.",
          "Treat the dashboard as status and the command center as action.",
          "Make it the first stop for manager and safety leader check-ins.",
        ],
      },
      {
        title: "Safety Intelligence supports review and generation",
        kicker: "AI assisted workflow",
        bullets: [
          "Use intake and review flows to structure safety document work.",
          "Check conflicts, permit triggers, and generated drafts before reliance.",
          "Keep human approval as the final control for operational decisions.",
        ],
      },
      {
        title: "Reports, analytics, and admin views close the loop",
        kicker: "Operating rhythm",
        bullets: [
          "Analytics reveal trends across observations, incidents, and workflows.",
          "Reports package management-ready views and exports.",
          "Billing and admin review pages support account health and governance.",
        ],
      },
    ],
    close: [
      "Use Command Center for weekly prevention planning.",
      "Review AI outputs before using them in the field.",
      "Use reports for leadership communication and closeout.",
    ],
  },
];

function paragraph(value, size = 30, color = colors.text, bold = false) {
  return text(value, {
    name: value.slice(0, 36).replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
    width: fill,
    height: hug,
    style: { fontSize: size, color, bold },
  });
}

function bulletList(items, accent) {
  return column(
    { name: "bullet-list", width: fill, height: hug, gap: 18 },
    items.map((item) =>
      row(
        { name: `bullet-${item.slice(0, 20)}`, width: fill, height: hug, gap: 16 },
        [
          text("->", {
            name: "bullet-marker",
            width: fixed(42),
            height: hug,
            style: { fontSize: 28, color: accent, bold: true },
          }),
          text(item, {
            name: "bullet-copy",
            width: fill,
            height: hug,
            style: { fontSize: 31, color: colors.text },
          }),
        ]
      )
    )
  );
}

function compose(slide, content) {
  slide.compose(content, {
    frame: { left: 0, top: 0, width: W, height: H },
    baseUnit: 8,
  });
}

function addCover(presentation, spec) {
  const slide = presentation.slides.add();
  compose(
    slide,
    grid(
      {
        name: "cover-root",
        width: fill,
        height: fill,
        columns: [fr(1.08), fr(0.92)],
        rows: [auto, fr(1), auto],
        padding: { x: 96, y: 76 },
        columnGap: 72,
        rowGap: 48,
      },
      [
        text("SafePredict Platform Training", {
          name: "cover-eyebrow",
          columnSpan: 2,
          width: fill,
          height: hug,
          style: { fontSize: 24, color: spec.accent, bold: true },
        }),
        column(
          { name: "cover-title-stack", width: fill, height: fill, gap: 30 },
          [
            text(spec.title, {
              name: "cover-title",
              width: fill,
              height: hug,
              style: { fontSize: 76, color: colors.ink, bold: true },
            }),
            rule({ name: "cover-rule", width: fixed(360), stroke: spec.accent, weight: 8 }),
            text(spec.subtitle, {
              name: "cover-subtitle",
              width: wrap(760),
              height: hug,
              style: { fontSize: 33, color: colors.text },
            }),
          ]
        ),
        column(
          { name: "cover-module-stack", width: fill, height: fill, gap: 22 },
          [
            paragraph(`Audience: ${spec.audience}`, 30, colors.ink, true),
            ...spec.modules.map((module, index) =>
              text(`${index + 1}. ${module}`, {
                name: `module-${index + 1}`,
                width: fill,
                height: hug,
                style: { fontSize: 34, color: index === 0 ? spec.accent : colors.text, bold: index === 0 },
              })
            ),
          ]
        ),
        text("Editable PowerPoint deck | Built for live walkthroughs and onboarding.", {
          name: "cover-footer",
          columnSpan: 2,
          width: fill,
          height: hug,
          style: { fontSize: 20, color: colors.muted },
        }),
      ]
    )
  );
}

function addAgenda(presentation, spec) {
  const slide = presentation.slides.add();
  compose(
    slide,
    column(
      { name: "agenda-root", width: fill, height: fill, padding: { x: 96, y: 76 }, gap: 38 },
      [
        paragraph("What this module teaches", 25, spec.accent, true),
        text(spec.title, {
          name: "agenda-title",
          width: fill,
          height: hug,
          style: { fontSize: 62, color: colors.ink, bold: true },
        }),
        rule({ name: "agenda-rule", width: fixed(260), stroke: spec.accent, weight: 6 }),
        grid(
          {
            name: "agenda-grid",
            width: fill,
            height: grow(1),
            columns: [fr(1), fr(1), fr(1)],
            rows: [auto, auto],
            columnGap: 48,
            rowGap: 34,
          },
          spec.modules.map((module, index) =>
            column(
              { name: `agenda-${index}`, width: fill, height: hug, gap: 14 },
              [
                text(String(index + 1).padStart(2, "0"), {
                  name: "agenda-number",
                  width: fill,
                  height: hug,
                  style: { fontSize: 48, color: spec.accent, bold: true },
                }),
                text(module, {
                  name: "agenda-module",
                  width: fill,
                  height: hug,
                  style: { fontSize: 34, color: colors.ink, bold: true },
                }),
                rule({ name: "agenda-module-rule", width: fill, stroke: colors.line, weight: 2 }),
              ]
            )
          )
        ),
      ]
    )
  );
}

function addContentSlide(presentation, spec, slideSpec, index) {
  const slide = presentation.slides.add();
  compose(
    slide,
    grid(
      {
        name: `content-root-${index}`,
        width: fill,
        height: fill,
        columns: [fr(0.8), fr(1.2)],
        rows: [auto, fr(1), auto],
        padding: { x: 96, y: 76 },
        columnGap: 70,
        rowGap: 44,
      },
      [
        text(slideSpec.kicker, {
          name: "content-kicker",
          columnSpan: 2,
          width: fill,
          height: hug,
          style: { fontSize: 25, color: spec.accent, bold: true },
        }),
        column(
          { name: "content-title-stack", width: fill, height: fill, gap: 26 },
          [
            text(slideSpec.title, {
              name: "content-title",
              width: fill,
              height: hug,
              style: { fontSize: 62, color: colors.ink, bold: true },
            }),
            rule({ name: "content-rule", width: fixed(300), stroke: spec.accent, weight: 7 }),
            text(`Module ${index + 1} of ${spec.slides.length}`, {
              name: "content-progress",
              width: fill,
              height: hug,
              style: { fontSize: 24, color: colors.muted },
            }),
          ]
        ),
        bulletList(slideSpec.bullets, spec.accent),
        text("Trainer cue: demonstrate the matching page in the live workspace before moving on.", {
          name: "trainer-cue",
          columnSpan: 2,
          width: fill,
          height: hug,
          style: { fontSize: 22, color: colors.muted },
        }),
      ]
    )
  );
}

function addClose(presentation, spec) {
  const slide = presentation.slides.add();
  compose(
    slide,
    column(
      { name: "close-root", width: fill, height: fill, padding: { x: 96, y: 76 }, gap: 34 },
      [
        paragraph("Closeout checklist", 25, spec.accent, true),
        text("Before the team leaves the training", {
          name: "close-title",
          width: fill,
          height: hug,
          style: { fontSize: 68, color: colors.ink, bold: true },
        }),
        rule({ name: "close-rule", width: fixed(320), stroke: spec.accent, weight: 7 }),
        bulletList(spec.close, spec.accent),
        text("Next step: open SafePredict, repeat the workflow, and assign one owner for any cleanup found during training.", {
          name: "close-next-step",
          width: wrap(1320),
          height: hug,
          style: { fontSize: 32, color: colors.text, bold: true },
        }),
      ]
    )
  );
}

async function saveDeck(spec) {
  const presentation = Presentation.create({
    slideSize: { width: W, height: H },
  });

  addCover(presentation, spec);
  addAgenda(presentation, spec);
  spec.slides.forEach((slideSpec, index) => addContentSlide(presentation, spec, slideSpec, index));
  addClose(presentation, spec);

  const pptx = await PresentationFile.exportPptx(presentation);
  const outputPath = join(outputDir, spec.fileName);
  await pptx.save(outputPath);

  const slides = [];
  for (let i = 0; i < presentation.slides.count; i += 1) {
    const slide = presentation.slides.getItem(i);
    const png = await slide.export({ format: "png", width: 1280 });
    const previewPath = join(previewDir, spec.fileName.replace(/\.pptx$/i, `-slide-${i + 1}.png`));
    await writeFile(previewPath, Buffer.from(await png.arrayBuffer()));
    slides.push(previewPath);
  }

  return { outputPath, previews: slides };
}

await mkdir(outputDir, { recursive: true });
await mkdir(previewDir, { recursive: true });

const results = [];
for (const spec of deckSpecs) {
  results.push(await saveDeck(spec));
}

console.log(JSON.stringify(results, null, 2));
