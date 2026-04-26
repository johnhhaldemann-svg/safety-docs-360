import { cleanFinalText } from "@/lib/csepFinalization";

type RiskProfile = { hazard: string; controls: readonly string[]; permit: string };

function normTask(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dedupeStrings(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const cleaned = cleanFinalText(raw);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

/** Normalized short controls from profileForTask that the full task packs supersede. */
const GENERIC_CRANE_PROFILE = new Set(["lift plan", "signal persons", "exclusion zone"]);
const GENERIC_HOT_WORK_PROFILE = new Set(["fire watch", "remove combustibles", "spark containment"]);
const GENERIC_FALL_TRIPLET = new Set(["guardrails", "pfas", "pre-task planning"]);

function stripRedundantBaseControls(controls: readonly string[], redundant: Set<string>): string[] {
  return controls.filter((c) => {
    const key = cleanFinalText(c)?.toLowerCase().trim() ?? "";
    return key && !redundant.has(key);
  });
}

function tradeLooksLikeSteel(tradeLabel: string, subTradeLabel: string | null | undefined) {
  const s = `${tradeLabel} ${subTradeLabel ?? ""}`.toLowerCase();
  return (
    /\bsteel\b/.test(s) ||
    /\bironwork/.test(s) ||
    /structural steel/.test(s) ||
    /steel erection/.test(s) ||
    /metal deck/.test(s) ||
    /ornamental metal/.test(s)
  );
}

const CRANE_RIGGING_HAZARDS = [
  "Swing radius and load-path exposures; struck-by suspended loads",
  "Rigging failure, overload, loss of load control, or unstable crane support / ground",
] as const;

const CRANE_RIGGING_CONTROLS = [
  "Lift plan / pick plan in effect before the pick",
  "Crane permit where required by site / AHJ",
  "Qualified rigger for rigging selection and attachment",
  "Qualified signal person (voice, radio, or other verified method)",
  "Rigging inspection (pre-use; remove damaged gear from service)",
  "Load weight verification against chart and rigging capacity",
  "Crane setup and ground condition review (mats, blocking, subsurface, access)",
  "Swing radius control (barricades, controlled access, spotters as required)",
  "Load path control (tag lines, swing limits, clear swing zone)",
  "No employees under suspended loads at any time",
  "Wind / weather review before and during picks; stop when limits are exceeded",
  "Barricaded landing zone and controlled delivery path",
  "Communication method verified before lift and maintained during the sequence",
] as const;

const WELDING_HAZARDS = [
  "Ignition of combustibles; fire spread; hazardous weld / cut fumes; arc flash and burns",
] as const;

const WELDING_CONTROLS = [
  "Hot work permit active and posted where required",
  "Fire watch where required; maintain until safe cool-down",
  "Combustible material control (removal, wetting, shielding, covers) and re-check when the work front moves",
  "Welding screens / shields where arc exposure could reach workers or the public",
  "Fume control per process and space (local exhaust, ventilation limits, respiratory protection when required)",
  "Cylinder storage, transport, caps, chains, and separation from heat / traffic",
  "Burn protection for adjacent trades and surfaces; cool-down before leaving the area",
  "Eye / face protection appropriate to process and site rules",
  "Fire extinguisher availability sized and staged per permit and AHJ expectations",
] as const;

const DECKING_HAZARDS = [
  "Leading-edge and opening exposures during sheet placement; deck bundle instability",
  "Drop hazards from unsecured sheets, tools, and debris; wind-driven sheet movement",
] as const;

const DECKING_CONTROLS = [
  "Controlled decking zone (CDZ) only when used per written plan and competent-person limits",
  "Leading-edge controls (guardrail, safety net, PFAS, or approved combination) commensurate with exposure",
  "Opening protection for roof / floor openings created or uncovered during placement",
  "Deck bundle placement limits — land only where the steel can support bundles; do not overload bays",
  "Fall protection for connectors / installers until permanent edges or collective systems are in place",
  "Drop zone controls below active decking faces; restrict access until sheets are secured",
  "Weather / wind controls; stop or secure when manufacturer / site wind limits apply",
  "Secure sheets / bundles before release of cranes or before workers step away from leading edges",
] as const;

const STEEL_LIFT_COORD_HAZARDS = [
  "Suspended load swing and drop-zone exposure during steel placement",
] as const;

const STEEL_LIFT_COORD_CONTROLS = [
  "Coordinated pick / lift plan or sequence tied to ironworker work zone",
  "Qualified rigger and qualified signal person where hoisting supports steel placement",
  "Barricade / exclude personnel from swing, load path, and drop zones during sets",
  "No work or transit under suspended steel",
  "Tag lines and controlled landing as required by lift plan",
] as const;

const STEEL_CONNECTION_HAZARDS = [
  "Leading-edge / elevation exposure during connections; dropped objects from tools or hardware",
  "Frame stability until permanent connections and bracing are completed",
] as const;

const STEEL_CONNECTION_CONTROLS = [
  "PFAS or other approved fall protection for connectors and installers at leading edges",
  "Plumb / brace / temporary stability verified before releasing hoisting gear",
  "Tool tethering and housekeeping to limit dropped-object exposure below",
  "Bolt-up / fitting sequence per erection plan; no improvised structural releases",
  "Communication between ironworkers, crane, and supervision during each connection step",
] as const;

const STEEL_MATERIAL_HANDLING_HAZARDS = [
  "Struck-by loads and equipment; pinch / crush during unloading, sorting, and staging",
  "Stack instability, shifting bundles, and trip hazards in laydown and delivery areas",
] as const;

const STEEL_MATERIAL_HANDLING_CONTROLS = [
  "Stay clear of suspended loads; use tag lines and controlled landing zones",
  "Rigging inspection and qualified rigger when mobile crane / loader handles bundles",
  "Stacking limits, dunnage, and banding integrity verified before leaving loads unattended",
  "Spotters / traffic control when deliveries interact with equipment or pedestrian routes",
  "Housekeeping and clear walking paths between nested members",
  "Cut / sharp edge awareness and appropriate hand / foot protection",
] as const;

const STEEL_BOLTING_HAZARDS = [
  "Dropped bolts and tools; torque / pinch exposure; at-height reaching during bolt-up",
] as const;

const STEEL_BOLTING_CONTROLS = [
  "Tool tethering and debris nets / toe boards where drop zones are active below",
  "Torque guns and sockets inspected; pinch points guarded or briefed",
  "Fall protection maintained during bolt-up at leading edges or open bays",
  "Sequential bolt-up per connection detail; do not remove critical bolts prematurely",
] as const;

const STEEL_EMBED_HAZARDS = [
  "Trip / impalement from protruding embeds; opening and edge exposure during placement",
] as const;

const STEEL_EMBED_CONTROLS = [
  "Cap, bend, guard, or flag protruding reinforcing / embeds per site rules",
  "Opening and edge protection immediately after slab / deck penetrations are formed",
  "Coordination with concrete / carpentry so embed layout matches steel landing plan",
] as const;

function isCraneOrRiggingTask(t: string) {
  if (isUnloadOrSortTask(t)) return false;
  return (
    /\b(crane|pick|rigging|rigger|hoist|signal|tag line|outrigger|suspended|telehandler)\b/.test(t) ||
    t.includes("load path") ||
    t.includes("swing radius")
  );
}

function isWeldingOrCuttingTask(t: string, risk: RiskProfile) {
  if (risk.hazard === "Hot work / fire") return true;
  return (
    /\b(weld|braze|torch|hot work|tack|spark)\b/.test(t) ||
    (/\bcut\b/.test(t) && !/\bsaw cut/.test(t) && (t.includes("steel") || t.includes("metal") || t.includes("plate")))
  );
}

function isDeckingInstallTask(t: string) {
  return (
    t.includes("deck") ||
    t.includes("metal roof deck") ||
    t.includes("floor deck") ||
    t.includes("cdz") ||
    t.includes("bundle")
  );
}

function isColumnOrBeamTask(t: string) {
  if (t.includes("deck")) return false;
  return (
    t.includes("column") ||
    t.includes("beam") ||
    t.includes("girder") ||
    t.includes("joist") ||
    t.includes("erect")
  );
}

function isUnloadOrSortTask(t: string) {
  return (
    (t.includes("unload") && t.includes("steel")) ||
    (t.includes("sort") && t.includes("member")) ||
    t.includes("sort steel") ||
    t.includes("laydown") ||
    t.includes("staging steel")
  );
}

function isBoltingTask(t: string) {
  return t.includes("bolt");
}

function isEmbedTask(t: string) {
  return t.includes("embed");
}

/**
 * Adds task-specific hazards and controls for Appendix E / activity hazard matrix rows.
 * Crane, welding, and decking tasks receive full control packs; other steel tasks get tailored lists.
 */
export function augmentCsepActivityMatrixRow(params: {
  taskTitle: string;
  tradeLabel: string;
  subTradeLabel: string | null | undefined;
  risk: RiskProfile;
  base: { hazards: string[]; controls: string[] };
}): { hazards: string[]; controls: string[] } {
  const t = normTask(params.taskTitle);
  const steel = tradeLooksLikeSteel(params.tradeLabel, params.subTradeLabel);

  const extraHazards: string[] = [];
  const extraControls: string[] = [];
  let appliedCranePack = false;
  let appliedWeldingPack = false;
  let appliedDeckingPack = false;

  if (isCraneOrRiggingTask(t)) {
    extraHazards.push(...CRANE_RIGGING_HAZARDS);
    extraControls.push(...CRANE_RIGGING_CONTROLS);
    appliedCranePack = true;
  } else if (steel && isColumnOrBeamTask(t)) {
    extraHazards.push(...STEEL_LIFT_COORD_HAZARDS, ...STEEL_CONNECTION_HAZARDS);
    extraControls.push(...STEEL_LIFT_COORD_CONTROLS, ...STEEL_CONNECTION_CONTROLS);
  } else if (steel && isUnloadOrSortTask(t)) {
    extraHazards.push(...STEEL_MATERIAL_HANDLING_HAZARDS);
    extraControls.push(...STEEL_MATERIAL_HANDLING_CONTROLS);
  } else if (steel && isBoltingTask(t)) {
    extraHazards.push(...STEEL_BOLTING_HAZARDS);
    extraControls.push(...STEEL_BOLTING_CONTROLS);
  } else if (steel && isEmbedTask(t)) {
    extraHazards.push(...STEEL_EMBED_HAZARDS);
    extraControls.push(...STEEL_EMBED_CONTROLS);
  }

  if (isWeldingOrCuttingTask(t, params.risk)) {
    extraHazards.push(...WELDING_HAZARDS);
    extraControls.push(...WELDING_CONTROLS);
    appliedWeldingPack = true;
  }

  if (isDeckingInstallTask(t) || (steel && params.risk.hazard === "Falls from height" && t.includes("deck"))) {
    extraHazards.push(...DECKING_HAZARDS);
    extraControls.push(...DECKING_CONTROLS);
    appliedDeckingPack = true;
  }

  if (extraHazards.length === 0 && extraControls.length === 0) {
    return { hazards: params.base.hazards, controls: params.base.controls };
  }

  let baseControls = params.base.controls;
  if (appliedCranePack) {
    baseControls = stripRedundantBaseControls(baseControls, GENERIC_CRANE_PROFILE);
  }
  if (appliedWeldingPack) {
    baseControls = stripRedundantBaseControls(baseControls, GENERIC_HOT_WORK_PROFILE);
  }
  if (appliedDeckingPack) {
    baseControls = stripRedundantBaseControls(baseControls, GENERIC_FALL_TRIPLET);
  }

  return {
    hazards: dedupeStrings([...extraHazards, ...params.base.hazards]),
    controls: dedupeStrings([...extraControls, ...baseControls]),
  };
}
