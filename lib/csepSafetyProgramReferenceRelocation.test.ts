import { describe, expect, it } from "vitest";
import {
  CSEP_SAFETY_PROGRAM_REFERENCE_PACK_KEY,
  isSafetyProgramReferenceRelocationTargetTitle,
  relocateSafetyProgramReferencePacks,
} from "@/lib/csepSafetyProgramReferenceRelocation";
import type { GeneratedSafetyPlanSection } from "@/types/safety-intelligence";

describe("csepSafetyProgramReferenceRelocation", () => {
  it("matches catalog and steel program titles from the relocation list", () => {
    expect(isSafetyProgramReferenceRelocationTargetTitle("Fall Protection Program")).toBe(true);
    expect(isSafetyProgramReferenceRelocationTargetTitle("Ladder Use Controls")).toBe(true);
    expect(isSafetyProgramReferenceRelocationTargetTitle("Hot Work Program")).toBe(true);
    expect(isSafetyProgramReferenceRelocationTargetTitle("Overhead and Gravity Hazard Program")).toBe(true);
    expect(isSafetyProgramReferenceRelocationTargetTitle("Equipment Motion and Traffic Control Program")).toBe(
      true
    );
    expect(isSafetyProgramReferenceRelocationTargetTitle("Aerial Work Platform / MEWP Program")).toBe(true);
    expect(isSafetyProgramReferenceRelocationTargetTitle("Controlled Decking Zone and Decking Access Program")).toBe(
      true
    );
    expect(isSafetyProgramReferenceRelocationTargetTitle("Crane, Rigging, and Lift Safety Program")).toBe(true);
    expect(isSafetyProgramReferenceRelocationTargetTitle("Multiple Lift Rigging Program")).toBe(true);
    expect(isSafetyProgramReferenceRelocationTargetTitle("Structural Stability and Temporary Bracing Program")).toBe(
      true
    );
    expect(isSafetyProgramReferenceRelocationTargetTitle("Fall Rescue and Suspension Trauma Program")).toBe(true);
    expect(isSafetyProgramReferenceRelocationTargetTitle("Hoisting and Rigging, Multiple Lift")).toBe(true);
    expect(isSafetyProgramReferenceRelocationTargetTitle("Electrical Safety Program")).toBe(false);
  });

  it("stubs catalog program sections and appends a reference pack appendix", () => {
    const fall: GeneratedSafetyPlanSection = {
      key: "program_hazard__falls_from_height__base",
      title: "Fall Protection Program",
      summary: "Governs fall protection for exposed work.",
      subsections: [
        { title: "When It Applies", body: "Long narrative A.", bullets: [] },
        { title: "Pre-Task Setup", body: "Long narrative B.", bullets: ["b1", "b2"] },
      ],
    };
    const out = relocateSafetyProgramReferencePacks([fall]);
    expect(out).toHaveLength(2);
    const main = out[0]!;
    const pack = out.find((s) => s.key === CSEP_SAFETY_PROGRAM_REFERENCE_PACK_KEY);
    expect(pack?.subsections?.length).toBeGreaterThan(0);
    expect(main.subsections).toBeUndefined();
    expect(main.body).toContain("Appendix F");
    expect(pack?.subsections?.some((s) => s.title.includes("When It Applies"))).toBe(true);
  });

  it("stubs matching steel program module subsections and moves detail to the pack", () => {
    const steel: GeneratedSafetyPlanSection = {
      key: "steel_program_modules_reference",
      title: "Steel program modules",
      subsections: [
        {
          title: "Fall Rescue and Suspension Trauma Program",
          body: null,
          bullets: ["alpha", "bravo", "charlie", "delta", "echo"],
        },
        {
          title: "Unrelated Steel Topic",
          body: "Keep me.",
          bullets: [],
        },
      ],
    };
    const out = relocateSafetyProgramReferencePacks([steel]);
    const pack = out.find((s) => s.key === CSEP_SAFETY_PROGRAM_REFERENCE_PACK_KEY);
    const main = out.find((s) => s.key === "steel_program_modules_reference")!;
    expect(pack?.subsections?.length).toBeGreaterThan(0);
    const rescue = main.subsections?.find((s) => s.title === "Fall Rescue and Suspension Trauma Program");
    expect(rescue?.bullets?.length).toBeLessThanOrEqual(4);
    expect(rescue?.body).toContain("Appendix F");
    expect(main.subsections?.find((s) => s.title === "Unrelated Steel Topic")?.body).toBe("Keep me.");
  });

  it("merges narratives into an existing reference pack appendix section", () => {
    const existingPack: GeneratedSafetyPlanSection = {
      key: CSEP_SAFETY_PROGRAM_REFERENCE_PACK_KEY,
      kind: "appendix",
      title: "Appendix F. Safety Program Reference Pack",
      table: { columns: ["A", "B"], rows: [["x", "y"]] },
      subsections: [{ title: "Existing", body: "prior", bullets: [] }],
    };
    const hot: GeneratedSafetyPlanSection = {
      key: "program_hazard__hot_work__base",
      title: "Hot Work Program",
      summary: "Hot summary.",
      subsections: [{ title: "Work Execution", body: "detail", bullets: [] }],
    };
    const out = relocateSafetyProgramReferencePacks([existingPack, hot]);
    const pack = out.find((s) => s.key === CSEP_SAFETY_PROGRAM_REFERENCE_PACK_KEY)!;
    expect(out.filter((s) => s.key === CSEP_SAFETY_PROGRAM_REFERENCE_PACK_KEY)).toHaveLength(1);
    expect(pack.subsections?.some((s) => s.title === "Existing")).toBe(true);
    expect(pack.subsections?.some((s) => s.title.includes("Work Execution"))).toBe(true);
  });
});
