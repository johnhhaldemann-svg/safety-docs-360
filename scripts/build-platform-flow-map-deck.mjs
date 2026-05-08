import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const runtimeNodeModules = "C:/Users/johnh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const pptxgen = require(`${runtimeNodeModules}/pptxgenjs`);
const { Canvas } = await import(
  pathToFileURL(`${runtimeNodeModules}/@oai/artifact-tool/node_modules/skia-canvas/lib/index.mjs`).href
);

const outDir = resolve("docs", "platform-flow-map");
mkdirSync(outDir, { recursive: true });

const pptxPath = join(outDir, "safety360-platform-flow-map.pptx");
const previewPath = join(outDir, "safety360-platform-flow-map-preview.png");

const pptx = new pptxgen();
pptx.author = "Safety360docs";
pptx.company = "Safety360docs";
pptx.subject = "Current platform process flow";
pptx.title = "Safety360 Platform Flow Map";
pptx.lang = "en-US";
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";
pptx.theme = {
  headFontFace: "Aptos Display",
  bodyFontFace: "Aptos",
  lang: "en-US",
};

const C = {
  bg: "F7FAF8",
  ink: "14202A",
  muted: "52616D",
  line: "9AA9B4",
  white: "FFFFFF",
  teal: "0F766E",
  tealSoft: "E7F5F2",
  blue: "1D4ED8",
  blueSoft: "EAF1FF",
  green: "2E7D32",
  greenSoft: "EAF6EA",
  amber: "B7791F",
  amberSoft: "FFF5DD",
  red: "B42318",
  redSoft: "FDECEA",
  violet: "5B4B8A",
  violetSoft: "F0EDFF",
  slateSoft: "EEF3F4",
};

const slide = pptx.addSlide();
slide.background = { color: C.bg };

function text(value, x, y, w, h, opts = {}) {
  slide.addText(value, {
    x,
    y,
    w,
    h,
    margin: opts.margin ?? 0,
    fit: "shrink",
    fontFace: opts.fontFace ?? "Aptos",
    fontSize: opts.fontSize ?? 9,
    color: opts.color ?? C.ink,
    bold: opts.bold ?? false,
    valign: opts.valign ?? "mid",
    align: opts.align ?? "left",
    paraSpaceAfterPt: 0,
  });
}

function box({ x, y, w, h, title, body, fill, stroke, accent, titleColor = C.ink }) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: stroke ?? fill, width: 1.15 },
  });
  if (accent) {
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w: 0.075,
      h,
      fill: { color: accent },
      line: { color: accent, transparency: 100 },
    });
  }
  text(title, x + 0.16, y + 0.11, w - 0.32, 0.23, {
    fontSize: 10.4,
    bold: true,
    color: titleColor,
    align: "center",
  });
  text(body, x + 0.18, y + 0.42, w - 0.36, h - 0.5, {
    fontSize: 7.7,
    color: C.muted,
    align: "center",
    valign: "top",
  });
}

function arrow(x1, y1, x2, y2, color = C.line, width = 1.2) {
  slide.addShape(pptx.ShapeType.line, {
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
    line: { color, width, beginArrowType: "none", endArrowType: "triangle" },
  });
}

function line(x1, y1, x2, y2, color = C.line, width = 1.05) {
  slide.addShape(pptx.ShapeType.line, {
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
    line: { color, width },
  });
}

function lane(label, x, y, w, color) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.28,
    rectRadius: 0.06,
    fill: { color },
    line: { color, transparency: 100 },
  });
  text(label, x + 0.1, y + 0.045, w - 0.2, 0.17, {
    fontSize: 7.2,
    bold: true,
    color: C.white,
    align: "center",
  });
}

text("Safety360 Platform Process Flow", 0.44, 0.28, 6.1, 0.45, {
  fontFace: "Aptos Display",
  fontSize: 24,
  bold: true,
});
text("Current operating loop across access, setup, field execution, documents, AI, analytics, and admin controls", 0.47, 0.79, 8.5, 0.24, {
  fontSize: 9.4,
  color: C.muted,
});
text("Start with the hub. Work happens in modules. Data comes back as risk, recommendations, and review queues.", 7.05, 0.43, 5.75, 0.3, {
  fontSize: 12.4,
  bold: true,
  color: C.teal,
  align: "right",
});

lane("ACCESS + SCOPE", 0.55, 1.23, 1.75, C.teal);
lane("DAILY HUB", 3.0, 1.23, 1.55, C.blue);
lane("WORK MODULES", 5.05, 1.23, 2.15, C.green);
lane("INTELLIGENCE", 8.15, 1.23, 1.85, C.violet);
lane("ACTION + OVERSIGHT", 10.83, 1.23, 2.0, C.amber);

const access = { x: 0.5, y: 1.72, w: 1.9, h: 0.94, title: "Sign In + Tenant", body: "Login\nCompany workspace\nRole permissions\nJobsite scope", fill: C.tealSoft, stroke: "9ACFC7", accent: C.teal, titleColor: C.teal };
const setup = { x: 0.5, y: 3.0, w: 1.9, h: 0.94, title: "Setup", body: "Team + access\nJobsites\nBilling\nContractors\nIntegrations", fill: C.slateSoft, stroke: "CBD7DC", accent: C.muted };
const hub = { x: 2.82, y: 2.15, w: 1.9, h: 1.14, title: "Dashboard / Command Center", body: "Risk Memory\nOpen work\nRecommendations\nPredictive view\nCompany knowledge", fill: C.blueSoft, stroke: "A9BDF1", accent: C.blue, titleColor: C.blue };
const field = { x: 5.08, y: 1.74, w: 2.06, h: 0.92, title: "Field + Jobsites", body: "Jobsite overview\nJSA / permits\nIncidents\nField issues\nLive view", fill: C.greenSoft, stroke: "AFD6B0", accent: C.green, titleColor: C.green };
const docs = { x: 5.08, y: 3.0, w: 2.06, h: 0.92, title: "Documents", body: "Submit / upload\nLibrary + search\nBlueprint builders\nMarketplace previews", fill: C.white, stroke: "CBD7DC", accent: C.teal, titleColor: C.ink };
const programs = { x: 5.08, y: 4.26, w: 2.06, h: 0.92, title: "Programs + Training", body: "Safety Intelligence\nInductions\nSafety forms\nTraining matrix\nContractor compliance", fill: C.amberSoft, stroke: "E4C57E", accent: C.amber, titleColor: C.amber };
const data = { x: 8.0, y: 2.05, w: 2.18, h: 1.26, title: "Data + AI Layer", body: "Supabase + RLS\nRules + conflicts\nCompany memory\nRisk Memory\nBehavior risk model\nAI Engine logging", fill: C.violetSoft, stroke: "B9AFE8", accent: C.violet, titleColor: C.violet };
const insights = { x: 8.0, y: 4.06, w: 2.18, h: 0.96, title: "Analytics + Reports", body: "Safety analytics\nPredictive model\nWorkflow activity\nReports\nRecommendation snapshots", fill: C.blueSoft, stroke: "A9BDF1", accent: C.blue, titleColor: C.blue };
const admin = { x: 10.88, y: 1.72, w: 1.96, h: 1.0, title: "Admin Review", body: "Document queue\nMarketplace admin\nCompanies / users\nBilling\nAudit admin", fill: C.redSoft, stroke: "E9ACA4", accent: C.red, titleColor: C.red };
const superadmin = { x: 10.88, y: 3.06, w: 1.96, h: 1.0, title: "Superadmin Ops", body: "AI Engine operations\nPrediction validation\nSystem health\nCSEP completeness\nJurisdiction standards", fill: C.white, stroke: "CBD7DC", accent: C.violet, titleColor: C.ink };
const action = { x: 10.88, y: 4.42, w: 1.96, h: 0.92, title: "Field Action", body: "Assign work\nClose findings\nVerify controls\nRefresh hub\nRepeat loop", fill: C.greenSoft, stroke: "AFD6B0", accent: C.green, titleColor: C.green };

for (const node of [access, setup, hub, field, docs, programs, data, insights, admin, superadmin, action]) box(node);

arrow(2.4, 2.19, 2.82, 2.52, C.teal);
arrow(2.4, 3.47, 2.82, 2.87, C.line);
arrow(4.72, 2.45, 5.08, 2.2, C.blue);
arrow(4.72, 2.72, 5.08, 3.38, C.blue);
arrow(4.72, 2.98, 5.08, 4.66, C.blue);
arrow(7.14, 2.2, 8.0, 2.48, C.green);
arrow(7.14, 3.38, 8.0, 2.7, C.teal);
arrow(7.14, 4.66, 8.0, 2.92, C.amber);
arrow(10.18, 2.48, 10.88, 2.18, C.violet);
arrow(10.18, 2.8, 10.88, 3.56, C.violet);
arrow(10.18, 4.55, 10.88, 4.88, C.blue);
line(0.94, 2.66, 0.94, 3.0, C.line);
arrow(9.1, 3.31, 9.1, 4.06, C.violet);
line(11.86, 5.34, 11.86, 5.72, C.green, 1.0);
line(11.86, 5.72, 3.78, 5.72, C.line, 1.0);
arrow(3.78, 5.72, 3.78, 3.29, C.blue, 1.0);

slide.addShape(pptx.ShapeType.roundRect, {
  x: 0.55,
  y: 6.18,
  w: 12.28,
  h: 0.54,
  rectRadius: 0.08,
  fill: { color: C.white },
  line: { color: "CBD7DC", width: 0.9 },
});
text(
  "Security boundary: all company and jobsite data passes through route-handler scope checks, Supabase RLS, storage policy, and role permissions.",
  0.75,
  6.32,
  11.84,
  0.18,
  { fontSize: 8.1, color: C.muted, align: "center" }
);

text("Sources: README, docs/route-structure.md, docs/command-center.md, app navigation, Safety Intelligence workflow", 0.55, 7.04, 8.2, 0.17, {
  fontSize: 6.5,
  color: "6B7785",
});
text("Current map - May 2026", 10.65, 7.04, 2.18, 0.17, {
  fontSize: 6.5,
  color: "6B7785",
  align: "right",
});

await pptx.writeFile({ fileName: pptxPath });

const canvas = new Canvas(1920, 1080);
const ctx = canvas.getContext("2d");
const sx = 144;
const sy = 144;
const px = (v) => v * sx;
const py = (v) => v * sy;

function rr(x, y, w, h, r, fill, stroke = null, lw = 1.5) {
  x = px(x);
  y = py(y);
  w = px(w);
  h = py(h);
  r = px(r);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = `#${fill}`;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = `#${stroke}`;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}
function drawText(value, x, y, w, opts = {}) {
  const size = opts.size ?? 13;
  ctx.font = `${opts.bold ? "700" : "400"} ${size}px Arial`;
  ctx.fillStyle = `#${opts.color ?? C.ink}`;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = "top";
  const max = px(w);
  const lines = [];
  for (const raw of String(value).split("\n")) {
    const words = raw.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > max && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  const start = opts.align === "center" ? px(x) + max / 2 : opts.align === "right" ? px(x) + max : px(x);
  lines.forEach((line, i) => ctx.fillText(line, start, py(y) + i * size * 1.16));
}
function drawBox(node) {
  rr(node.x, node.y, node.w, node.h, 0.08, node.fill, node.stroke ?? node.fill, 2);
  if (node.accent) {
    ctx.fillStyle = `#${node.accent}`;
    ctx.fillRect(px(node.x), py(node.y), px(0.075), py(node.h));
  }
  drawText(node.title, node.x + 0.16, node.y + 0.12, node.w - 0.32, {
    size: 14.6,
    bold: true,
    color: node.titleColor ?? C.ink,
    align: "center",
  });
  drawText(node.body, node.x + 0.18, node.y + 0.42, node.w - 0.36, {
    size: 10.7,
    color: C.muted,
    align: "center",
  });
}
function drawLane(label, x, y, w, color) {
  rr(x, y, w, 0.28, 0.06, color, color, 1);
  drawText(label, x + 0.1, y + 0.055, w - 0.2, { size: 10, bold: true, color: C.white, align: "center" });
}
function drawLine(x1, y1, x2, y2, color = C.line, width = 2) {
  ctx.beginPath();
  ctx.moveTo(px(x1), py(y1));
  ctx.lineTo(px(x2), py(y2));
  ctx.strokeStyle = `#${color}`;
  ctx.lineWidth = width;
  ctx.stroke();
}
function drawArrow(x1, y1, x2, y2, color = C.line, width = 2) {
  drawLine(x1, y1, x2, y2, color, width);
  const angle = Math.atan2(py(y2 - y1), px(x2 - x1));
  const len = 10;
  ctx.beginPath();
  ctx.moveTo(px(x2), py(y2));
  ctx.lineTo(px(x2) - len * Math.cos(angle - Math.PI / 7), py(y2) - len * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(px(x2) - len * Math.cos(angle + Math.PI / 7), py(y2) - len * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fillStyle = `#${color}`;
  ctx.fill();
}

ctx.fillStyle = `#${C.bg}`;
ctx.fillRect(0, 0, 1920, 1080);
drawText("Safety360 Platform Process Flow", 0.44, 0.28, 6.1, { size: 34, bold: true, color: C.ink });
drawText("Current operating loop across access, setup, field execution, documents, AI, analytics, and admin controls", 0.47, 0.8, 8.5, {
  size: 13,
  color: C.muted,
});
drawText("Start with the hub. Work happens in modules. Data comes back as risk, recommendations, and review queues.", 7.05, 0.43, 5.75, {
  size: 17,
  bold: true,
  color: C.teal,
  align: "right",
});
drawLane("ACCESS + SCOPE", 0.55, 1.23, 1.75, C.teal);
drawLane("DAILY HUB", 3.0, 1.23, 1.55, C.blue);
drawLane("WORK MODULES", 5.05, 1.23, 2.15, C.green);
drawLane("INTELLIGENCE", 8.15, 1.23, 1.85, C.violet);
drawLane("ACTION + OVERSIGHT", 10.83, 1.23, 2.0, C.amber);
for (const node of [access, setup, hub, field, docs, programs, data, insights, admin, superadmin, action]) drawBox(node);
drawArrow(2.4, 2.19, 2.82, 2.52, C.teal);
drawArrow(2.4, 3.47, 2.82, 2.87, C.line);
drawArrow(4.72, 2.45, 5.08, 2.2, C.blue);
drawArrow(4.72, 2.72, 5.08, 3.38, C.blue);
drawArrow(4.72, 2.98, 5.08, 4.66, C.blue);
drawArrow(7.14, 2.2, 8.0, 2.48, C.green);
drawArrow(7.14, 3.38, 8.0, 2.7, C.teal);
drawArrow(7.14, 4.66, 8.0, 2.92, C.amber);
drawArrow(10.18, 2.48, 10.88, 2.18, C.violet);
drawArrow(10.18, 2.8, 10.88, 3.56, C.violet);
drawArrow(10.18, 4.55, 10.88, 4.88, C.blue);
drawLine(0.94, 2.66, 0.94, 3.0, C.line, 1.6);
drawArrow(9.1, 3.31, 9.1, 4.06, C.violet);
drawLine(11.86, 5.34, 11.86, 5.72, C.green, 1.6);
drawLine(11.86, 5.72, 3.78, 5.72, C.line, 1.6);
drawArrow(3.78, 5.72, 3.78, 3.29, C.blue, 1.6);
rr(0.55, 6.18, 12.28, 0.54, 0.08, C.white, "CBD7DC", 1.5);
drawText(
  "Security boundary: all company and jobsite data passes through route-handler scope checks, Supabase RLS, storage policy, and role permissions.",
  0.75,
  6.34,
  11.84,
  { size: 11.5, color: C.muted, align: "center" }
);
drawText("Sources: README, docs/route-structure.md, docs/command-center.md, app navigation, Safety Intelligence workflow", 0.55, 7.04, 8.2, {
  size: 9.3,
  color: "6B7785",
});
drawText("Current map - May 2026", 10.65, 7.04, 2.18, { size: 9.3, color: "6B7785", align: "right" });
await canvas.toFile(previewPath);

console.log(JSON.stringify({ pptxPath, previewPath }, null, 2));
