import { describe, expect, it } from "vitest";
import { normalizeCsepProgramConfig } from "@/lib/csepPrograms";

describe("normalizeCsepProgramConfig", () => {
  it("keeps overridden program text while preserving the full default catalog", () => {
    const config = normalizeCsepProgramConfig({
      definitions: [
        {
          category: "hazard",
          item: "Falls from height",
          title: "Edited Fall Protection Program",
          summary: "Edited summary",
          controls: ["Edited control"],
        },
      ],
    });

    const fallProgram = config.definitions.find(
      (definition) =>
        definition.category === "hazard" && definition.item === "Falls from height"
    );
    const electricalProgram = config.definitions.find(
      (definition) =>
        definition.category === "hazard" && definition.item === "Electrical shock"
    );

    expect(fallProgram?.title).toBe("Edited Fall Protection Program");
    expect(fallProgram?.summary).toBe("Edited summary");
    expect(fallProgram?.controls).toEqual(["Edited control"]);
    expect(fallProgram?.preTaskProcedures.length).toBeGreaterThan(0);
    expect(fallProgram?.workProcedures.length).toBeGreaterThan(0);
    expect(fallProgram?.stopWorkProcedures.length).toBeGreaterThan(0);
    expect(fallProgram?.closeoutProcedures.length).toBeGreaterThan(0);
    expect(electricalProgram?.title).toBe("Electrical Safety Program");
    expect(electricalProgram?.preTaskProcedures.length).toBeGreaterThan(0);
  });
});
