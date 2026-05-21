import { CSEP_RESTART_AFTER_VERIFICATION, CSEP_STOP_WORK_UNIVERSAL_AUTHORITY } from "@/lib/csepStopWorkLanguage";
import type { GeneratedSafetyPlanSection } from "@/types/safety-intelligence";

export const CSEP_SAFETY_PROGRAM_REFERENCE_PACK_KEY = "appendix_safety_program_reference_pack";
export const CSEP_SAFETY_PROGRAM_REFERENCE_PACK_DISPLAY_REF =
  "Appendix F — Safety Program Reference Pack";
export const CSEP_SAFETY_PROGRAM_REFERENCE_PACK_TITLE =
  "Appendix F. Safety Program Reference Pack";

function normToken(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqueStrings(values: Array<string | null | undefined>, max: number) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const t = (raw ?? "").replace(/\s+/g, " ").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Catalog / steel program titles whose full narratives are moved out of the main
 * Hazards and Controls flow into {@link CSEP_SAFETY_PROGRAM_REFERENCE_PACK_TITLE}.
 */
export function isSafetyProgramReferenceRelocationTargetTitle(rawTitle: string): boolean {
  const n = normToken(rawTitle);
  if (!n) return false;

  return (
    n === "fall protection program" ||
    (n.includes("ladder") && (n.includes("authorization") || n.includes("use controls"))) ||
    n === "hot work program" ||
    n === "hot work permit program" ||
    n === "overhead and gravity hazard program" ||
    n === "equipment motion and traffic control program" ||
    ((n.includes("aerial work platform") || n.includes("mewp")) && n.includes("program")) ||
    (n.includes("controlled decking zone") && n.includes("program")) ||
    (n.includes("crane") && n.includes("rigging") && n.includes("safety program")) ||
    (n.includes("multiple lift") && n.includes("rigging")) ||
    (n.includes("structural stability") && n.includes("bracing")) ||
    (n.includes("fall rescue") && n.includes("suspension trauma")) ||
    (n.includes("hoisting") && n.includes("rigging") && n.includes("multiple lift"))
  );
}

function pickFieldSummaryBullets(section: GeneratedSafetyPlanSection, max: number) {
  const fromSubs = (section.subsections ?? []).flatMap((s) => s.bullets ?? []);
  return uniqueStrings([...(section.bullets ?? []), ...fromSubs], max);
}

function flattenProgramToPackSubsections(full: GeneratedSafetyPlanSection) {
  const subs: NonNullable<GeneratedSafetyPlanSection["subsections"]> = [];
  const prefix = full.title.trim() || "Program";
  if (full.summary?.trim()) {
    subs.push({ title: `${prefix} — overview`, body: full.summary.trim(), bullets: [] });
  }
  if (full.body?.trim()) {
    subs.push({ title: `${prefix} — narrative`, body: full.body.trim(), bullets: [] });
  }
  if (full.bullets?.length) {
    subs.push({ title: `${prefix} — checklist lines`, body: null, bullets: full.bullets });
  }
  for (const sub of full.subsections ?? []) {
    const st = sub.title?.trim() || "Program detail";
    subs.push({
      title: `${prefix} — ${st}`,
      body: sub.body?.trim() ?? null,
      bullets: sub.bullets ?? [],
    });
  }
  return subs;
}

function buildStubProgramSection(full: GeneratedSafetyPlanSection): GeneratedSafetyPlanSection {
  const summary = full.summary?.trim();
  const bullets = pickFieldSummaryBullets(full, 4);
  return {
    ...full,
    summary: summary ? summary.slice(0, 420) : undefined,
    body: `Field use: follow the competent person, site permits, lift plans, daily briefing, and contract documents for this program. Full narrative, references, and detailed procedures: ${CSEP_SAFETY_PROGRAM_REFERENCE_PACK_DISPLAY_REF} under “${full.title.trim()}”.`,
    bullets:
      bullets.length > 0
        ? bullets
        : [
            "Confirm applicability with supervision before starting exposed work.",
            "Verify permits, inspections, and rescue or interface readiness per site rules.",
            `${CSEP_STOP_WORK_UNIVERSAL_AUTHORITY} ${CSEP_RESTART_AFTER_VERIFICATION}`,
          ],
    subsections: undefined,
  };
}

function buildStubSteelProgramSubsection(
  sub: NonNullable<GeneratedSafetyPlanSection["subsections"]>[number]
) {
  const title = sub.title?.trim() || "Program module";
  const keep = (sub.bullets ?? []).slice(0, 4);
  const lead = keep[0] ?? "Follow the steel erection plan, lift plan, and competent-person direction for this program.";
  return {
    title,
    body: `Summary: ${lead} Full program narrative: ${CSEP_SAFETY_PROGRAM_REFERENCE_PACK_DISPLAY_REF} under “${title}”.`,
    bullets: keep,
  };
}

function processSteelProgramModulesSection(
  section: GeneratedSafetyPlanSection,
  packPieces: NonNullable<GeneratedSafetyPlanSection["subsections"]>,
  seenFragmentTitles: Set<string>
): GeneratedSafetyPlanSection {
  const subs = section.subsections ?? [];
  if (!subs.length) return section;

  const nextSubs: NonNullable<GeneratedSafetyPlanSection["subsections"]> = [];
  for (const sub of subs) {
    const st = sub.title ?? "";
    if (!isSafetyProgramReferenceRelocationTargetTitle(st)) {
      nextSubs.push(sub);
      continue;
    }
    const fragKey = normToken(st);
    if (!seenFragmentTitles.has(fragKey)) {
      seenFragmentTitles.add(fragKey);
      packPieces.push(
        ...flattenProgramToPackSubsections({
          key: `${section.key}__${fragKey || "module"}`,
          title: st,
          summary: null,
          body: null,
          bullets: [],
          subsections: [sub],
        })
      );
    }
    nextSubs.push(buildStubSteelProgramSubsection(sub));
  }

  return { ...section, subsections: nextSubs };
}

function processTopLevelProgramSection(
  section: GeneratedSafetyPlanSection,
  packPieces: NonNullable<GeneratedSafetyPlanSection["subsections"]>,
  seenFragmentTitles: Set<string>
): GeneratedSafetyPlanSection {
  if (!isSafetyProgramReferenceRelocationTargetTitle(section.title)) {
    return section;
  }
  const key = normToken(section.title);
  if (seenFragmentTitles.has(key)) {
    return buildStubProgramSection(section);
  }
  seenFragmentTitles.add(key);
  packPieces.push(...flattenProgramToPackSubsections(section));
  return buildStubProgramSection(section);
}

/**
 * Shortens matching program sections for Hazards and Controls and appends one
 * appendix section carrying the full narratives (stable key for DOCX appendix merge).
 */
export function relocateSafetyProgramReferencePacks(
  sections: GeneratedSafetyPlanSection[]
): GeneratedSafetyPlanSection[] {
  const packPieces: NonNullable<GeneratedSafetyPlanSection["subsections"]> = [];
  const seenFragmentTitles = new Set<string>();

  const next = sections.map((section) => {
    const nk = normToken(section.key);
    if (nk === "steel program modules reference") {
      return processSteelProgramModulesSection(section, packPieces, seenFragmentTitles);
    }
    const isProgramKey =
      nk.startsWith("program hazard") || nk.startsWith("program permit") || nk.startsWith("program ppe");
    if (isProgramKey) {
      return processTopLevelProgramSection(section, packPieces, seenFragmentTitles);
    }
    return section;
  });

  if (!packPieces.length) {
    return next;
  }

  const packIdx = next.findIndex((s) => s.key === CSEP_SAFETY_PROGRAM_REFERENCE_PACK_KEY);
  if (packIdx !== -1) {
    const existing = next[packIdx];
    const merged = [...next];
    merged[packIdx] = {
      ...existing,
      kind: "appendix",
      summary:
        existing.summary?.trim() ||
        "Detailed narratives for the selected safety programs below. The Hazards and Controls section keeps short field summaries; use this appendix for audit, training, and full procedure text.",
      subsections: [...(existing.subsections ?? []), ...packPieces],
    };
    return merged;
  }

  return [
    ...next,
    {
      key: CSEP_SAFETY_PROGRAM_REFERENCE_PACK_KEY,
      kind: "appendix" as const,
      order: 1000,
      title: CSEP_SAFETY_PROGRAM_REFERENCE_PACK_TITLE,
      summary:
        "Detailed narratives for the selected safety programs below. The Hazards and Controls section keeps short field summaries and pointers here for audit, training, and full procedure text.",
      body: null,
      bullets: [],
      subsections: packPieces,
    },
  ];
}
