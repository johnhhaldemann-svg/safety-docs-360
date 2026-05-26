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

const outDir = resolve("docs", "ai-engine-tree");
mkdirSync(outDir, { recursive: true });

const pptxPath = join(outDir, "safepredict-ai-engine-tree.pptx");
const previewPath = join(outDir, "safepredict-ai-engine-tree-preview.png");

const pptx = new pptxgen();
pptx.author = "SafePredict";
pptx.company = "SafePredict";
pptx.subject = "AI Engine tree with behavior risk model";
pptx.title = "SafePredict AI Engine Tree";
pptx.lang = "en-US";
pptx.layout = "LAYOUT_WIDE";
pptx.theme = {
  headFontFace: "Aptos Display",
  bodyFontFace: "Aptos",
  lang: "en-US",
};
pptx.margin = 0;
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";

const W = 13.333;
const H = 7.5;
const C = {
  ink: "15202B",
  muted: "536171",
  faint: "EEF3F4",
  paper: "F8FAF7",
  blue: "1D4ED8",
  teal: "0F766E",
  green: "2E7D32",
  amber: "B7791F",
  red: "B42318",
  violet: "5B4B8A",
  line: "9AA7B2",
  white: "FFFFFF",
};

const slide = pptx.addSlide();
slide.background = { color: C.paper };

function addText(text, x, y, w, h, opts = {}) {
  slide.addText(text, {
    x,
    y,
    w,
    h,
    margin: opts.margin ?? 0,
    fit: "shrink",
    fontFace: opts.fontFace ?? "Aptos",
    fontSize: opts.fontSize ?? 11,
    color: opts.color ?? C.ink,
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
    valign: opts.valign ?? "mid",
    align: opts.align ?? "left",
    paraSpaceAfterPt: 0,
    breakLine: false,
  });
}

function addNode({ x, y, w, h, title, body, fill, line = fill, titleColor = C.white, bodyColor = C.white, accent = null }) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: line, width: 1.2 },
  });
  if (accent) {
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w: 0.08,
      h,
      fill: { color: accent },
      line: { color: accent, transparency: 100 },
    });
  }
  addText(title, x + 0.16, y + 0.12, w - 0.32, 0.24, {
    fontSize: 10.8,
    bold: true,
    color: titleColor,
    align: "center",
  });
  addText(body, x + 0.18, y + 0.43, w - 0.36, h - 0.52, {
    fontSize: 8.1,
    color: bodyColor,
    valign: "top",
    align: "center",
  });
}

function addLine(x1, y1, x2, y2, color = C.line, width = 1.25) {
  slide.addShape(pptx.ShapeType.line, {
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
    line: { color, width, beginArrowType: "none", endArrowType: "none" },
  });
}

function addPill(text, x, y, w, fill, color = C.white) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.28,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: fill },
  });
  addText(text, x + 0.04, y + 0.045, w - 0.08, 0.18, {
    fontSize: 7.5,
    bold: true,
    color,
    align: "center",
  });
}

addText("SafePredict AI Engine", 0.48, 0.34, 5.5, 0.5, {
  fontFace: "Aptos Display",
  fontSize: 26,
  bold: true,
});
addText("Tree view with the new behavior-risk model as the scoring trunk", 0.52, 0.88, 6.6, 0.26, {
  fontSize: 9.8,
  color: C.muted,
});
addText("Evidence -> deterministic scoring -> AI surfaces -> telemetry -> learning loop", 7.05, 0.48, 5.65, 0.38, {
  fontSize: 13.5,
  bold: true,
  color: C.teal,
  align: "right",
});

addNode({
  x: 5.0,
  y: 1.22,
  w: 3.35,
  h: 0.82,
  title: "AI Engine Root",
  body: "Company-scoped safety intelligence, predictive risk, and document assistance",
  fill: C.ink,
  accent: C.teal,
});

const topY = 2.58;
const nodes = [
  {
    x: 0.48,
    y: topY,
    w: 2.28,
    h: 1.2,
    title: "Evidence Intake",
    body: "JSA activities\nPermits\nSOR observations\nCorrective actions\nIncidents\nTraining gaps",
    fill: "EAF6F4",
    line: "95C9C2",
    titleColor: C.teal,
    bodyColor: C.ink,
    accent: C.teal,
  },
  {
    x: 3.15,
    y: topY,
    w: 2.62,
    h: 1.2,
    title: "Behavior Risk Model",
    body: "1-30 day look-ahead\nDriver points\n0-100 score\nLow -> Critical level\nTop drivers + actions",
    fill: C.teal,
    line: C.teal,
    accent: "7DD3C7",
  },
  {
    x: 6.22,
    y: topY,
    w: 2.36,
    h: 1.2,
    title: "AI Surfaces",
    body: "Safety Intelligence\nCompany Memory\nPermit Copilot\nCSEP / GC review\nInjury Weather\nEmbeddings",
    fill: "EEF2FF",
    line: "A8B2E6",
    titleColor: C.violet,
    bodyColor: C.ink,
    accent: C.violet,
  },
  {
    x: 9.02,
    y: topY,
    w: 1.84,
    h: 1.2,
    title: "Ops Telemetry",
    body: "AI call log\nLatency\nFallbacks\nFailures\nTokens\nModels",
    fill: "FFF6E4",
    line: "E7BE72",
    titleColor: C.amber,
    bodyColor: C.ink,
    accent: C.amber,
  },
  {
    x: 11.24,
    y: topY,
    w: 1.62,
    h: 1.2,
    title: "Learning Loop",
    body: "Feedback\nField-used\nEvals\nSnapshots\nRecommendations",
    fill: "FEEDEA",
    line: "E5A29A",
    titleColor: C.red,
    bodyColor: C.ink,
    accent: C.red,
  },
];

for (const node of nodes) addNode(node);

const rootCenterX = 6.675;
addLine(rootCenterX, 2.04, rootCenterX, 2.31, C.line, 1.4);
addLine(1.62, 2.31, 12.05, 2.31, C.line, 1.4);
for (const node of nodes) {
  addLine(node.x + node.w / 2, 2.31, node.x + node.w / 2, topY, C.line, 1.4);
}

addText("behavior drivers", 3.15, 4.13, 2.62, 0.22, { fontSize: 8, bold: true, color: C.teal, align: "center" });
addPill("weak JSA", 2.88, 4.46, 0.86, C.teal);
addPill("missing control", 3.84, 4.46, 1.18, C.teal);
addPill("permit mismatch", 5.12, 4.46, 1.26, C.teal);
addPill("training gap", 3.18, 4.83, 1.02, "2E7D32");
addPill("repeat SOR", 4.34, 4.83, 0.98, "2E7D32");
addPill("prior incident", 5.46, 4.83, 1.08, "2E7D32");
addPill("schedule pressure", 3.02, 5.2, 1.28, C.blue);
addPill("trade overlap", 4.46, 5.2, 1.08, C.blue);
addPill("control dependency", 5.68, 5.2, 1.34, C.blue);
addLine(4.46, 3.78, 4.46, 4.35, C.teal, 1.25);
addLine(3.31, 4.35, 6.27, 4.35, C.teal, 1.25);

addNode({
  x: 0.67,
  y: 4.55,
  w: 1.9,
  h: 0.76,
  title: "Scope Guard",
  body: "RBAC + company/jobsite access before model input",
  fill: C.white,
  line: "C9D4D8",
  titleColor: C.ink,
  bodyColor: C.muted,
  accent: C.green,
});

addNode({
  x: 7.05,
  y: 4.58,
  w: 2.0,
  h: 0.72,
  title: "Outputs",
  body: "score, risk level, source events, rollups by trade/supervisor",
  fill: C.white,
  line: "C9D4D8",
  titleColor: C.ink,
  bodyColor: C.muted,
  accent: C.blue,
});

addNode({
  x: 9.75,
  y: 4.58,
  w: 2.38,
  h: 0.72,
  title: "Superadmin AI Engine",
  body: "metrics, calls, feedback, evals, deterministic recommendations",
  fill: C.white,
  line: "C9D4D8",
  titleColor: C.ink,
  bodyColor: C.muted,
  accent: C.amber,
});

addLine(2.57, 4.93, 3.02, 4.93, C.line, 1.1);
addLine(6.98, 4.93, 7.05, 4.93, C.line, 1.1);
addLine(9.05, 4.93, 9.75, 4.93, C.line, 1.1);
addLine(12.13, 4.93, 12.13, 3.78, C.red, 1.1);

addText(
  "Code anchors: lib/predictive/behaviorRisk.ts, app/api/predictive/behavior-risk/route.ts, lib/superadmin/aiEngineOperations.ts",
  0.52,
  7.02,
  9.7,
  0.2,
  { fontSize: 6.8, color: "6B7785" }
);
addText("Draft architecture tree - May 2026", 10.65, 7.02, 2.2, 0.2, {
  fontSize: 6.8,
  color: "6B7785",
  align: "right",
});

await pptx.writeFile({ fileName: pptxPath });

const canvas = new Canvas(1920, 1080);
const ctx = canvas.getContext("2d");
const sx = 144;
const sy = 144;

function px(v) {
  return v * sx;
}
function py(v) {
  return v * sy;
}
function drawRoundRect(x, y, w, h, r, fill, stroke = null, lw = 1) {
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
function wrapLines(text, maxWidth) {
  const lines = [];
  for (const rawLine of String(text).split("\n")) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}
function drawText(text, x, y, w, opts = {}) {
  const size = opts.size ?? 14;
  ctx.font = `${opts.bold ? "700" : "400"} ${size}px ${opts.face ?? "Arial"}`;
  ctx.fillStyle = `#${opts.color ?? C.ink}`;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = "top";
  const maxWidth = px(w);
  const lines = wrapLines(text, maxWidth);
  const lh = size * 1.16;
  const startX = opts.align === "center" ? px(x) + maxWidth / 2 : opts.align === "right" ? px(x) + maxWidth : px(x);
  lines.forEach((line, i) => ctx.fillText(line, startX, py(y) + i * lh));
}
function drawLine(x1, y1, x2, y2, color = C.line, width = 2) {
  ctx.beginPath();
  ctx.moveTo(px(x1), py(y1));
  ctx.lineTo(px(x2), py(y2));
  ctx.strokeStyle = `#${color}`;
  ctx.lineWidth = width;
  ctx.stroke();
}
function drawNode(node) {
  drawRoundRect(node.x, node.y, node.w, node.h, 0.08, node.fill, node.line ?? node.fill, 2);
  if (node.accent) {
    ctx.fillStyle = `#${node.accent}`;
    ctx.fillRect(px(node.x), py(node.y), px(0.08), py(node.h));
  }
  drawText(node.title, node.x + 0.16, node.y + 0.11, node.w - 0.32, {
    size: 15,
    bold: true,
    color: node.titleColor ?? C.white,
    align: "center",
  });
  drawText(node.body, node.x + 0.18, node.y + 0.43, node.w - 0.36, {
    size: 11.2,
    color: node.bodyColor ?? C.white,
    align: "center",
  });
}
function drawPill(label, x, y, w, fill) {
  drawRoundRect(x, y, w, 0.28, 0.08, fill, fill, 1);
  drawText(label, x + 0.04, y + 0.055, w - 0.08, { size: 10, bold: true, color: C.white, align: "center" });
}

ctx.fillStyle = `#${C.paper}`;
ctx.fillRect(0, 0, 1920, 1080);
drawText("SafePredict AI Engine", 0.48, 0.32, 5.5, { face: "Arial", size: 38, bold: true, color: C.ink });
drawText("Tree view with the new behavior-risk model as the scoring trunk", 0.52, 0.89, 6.6, { size: 14, color: C.muted });
drawText("Evidence -> deterministic scoring -> AI surfaces -> telemetry -> learning loop", 7.05, 0.48, 5.65, {
  size: 19,
  bold: true,
  color: C.teal,
  align: "right",
});
const root = {
  x: 5.0,
  y: 1.22,
  w: 3.35,
  h: 0.82,
  title: "AI Engine Root",
  body: "Company-scoped safety intelligence, predictive risk, and document assistance",
  fill: C.ink,
  line: C.ink,
  accent: C.teal,
};
drawNode(root);
drawLine(rootCenterX, 2.04, rootCenterX, 2.31, C.line, 2);
drawLine(1.62, 2.31, 12.05, 2.31, C.line, 2);
for (const node of nodes) drawLine(node.x + node.w / 2, 2.31, node.x + node.w / 2, topY, C.line, 2);
for (const node of nodes) drawNode(node);
drawText("behavior drivers", 3.15, 4.13, 2.62, { size: 11, bold: true, color: C.teal, align: "center" });
drawLine(4.46, 3.78, 4.46, 4.35, C.teal, 2);
drawLine(3.31, 4.35, 6.27, 4.35, C.teal, 2);
drawPill("weak JSA", 2.88, 4.46, 0.86, C.teal);
drawPill("missing control", 3.84, 4.46, 1.18, C.teal);
drawPill("permit mismatch", 5.12, 4.46, 1.26, C.teal);
drawPill("training gap", 3.18, 4.83, 1.02, C.green);
drawPill("repeat SOR", 4.34, 4.83, 0.98, C.green);
drawPill("prior incident", 5.46, 4.83, 1.08, C.green);
drawPill("schedule pressure", 3.02, 5.2, 1.28, C.blue);
drawPill("trade overlap", 4.46, 5.2, 1.08, C.blue);
drawPill("control dependency", 5.68, 5.2, 1.34, C.blue);
drawNode({
  x: 0.67,
  y: 4.55,
  w: 1.9,
  h: 0.76,
  title: "Scope Guard",
  body: "RBAC + company/jobsite access before model input",
  fill: C.white,
  line: "C9D4D8",
  titleColor: C.ink,
  bodyColor: C.muted,
  accent: C.green,
});
drawNode({
  x: 7.05,
  y: 4.58,
  w: 2.0,
  h: 0.72,
  title: "Outputs",
  body: "score, risk level, source events, rollups by trade/supervisor",
  fill: C.white,
  line: "C9D4D8",
  titleColor: C.ink,
  bodyColor: C.muted,
  accent: C.blue,
});
drawNode({
  x: 9.75,
  y: 4.58,
  w: 2.38,
  h: 0.72,
  title: "Superadmin AI Engine",
  body: "metrics, calls, feedback, evals, deterministic recommendations",
  fill: C.white,
  line: "C9D4D8",
  titleColor: C.ink,
  bodyColor: C.muted,
  accent: C.amber,
});
drawLine(2.57, 4.93, 3.02, 4.93, C.line, 1.7);
drawLine(6.98, 4.93, 7.05, 4.93, C.line, 1.7);
drawLine(9.05, 4.93, 9.75, 4.93, C.line, 1.7);
drawLine(12.13, 4.93, 12.13, 3.78, C.red, 1.7);
drawText(
  "Code anchors: lib/predictive/behaviorRisk.ts, app/api/predictive/behavior-risk/route.ts, lib/superadmin/aiEngineOperations.ts",
  0.52,
  7.02,
  9.7,
  { size: 10, color: "6B7785" }
);
drawText("Draft architecture tree - May 2026", 10.65, 7.02, 2.2, { size: 10, color: "6B7785", align: "right" });

await canvas.toFile(previewPath);

console.log(JSON.stringify({ pptxPath, previewPath }, null, 2));
