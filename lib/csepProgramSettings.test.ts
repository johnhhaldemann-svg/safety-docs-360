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
    const hotWorkProgram = config.definitions.find(
      (definition) => definition.category === "hazard" && definition.item === "Hot work / fire"
    );

    expect(fallProgram?.title).toBe("Edited Fall Protection Program");
    expect(fallProgram?.summary).toBe("Edited summary");
    expect(fallProgram?.controls).toEqual(["Edited control"]);
    // Fall catalog merge uses empty procedure templates so governing text is not duplicated in exports.
    expect(fallProgram?.preTaskProcedures).toEqual([]);
    expect(fallProgram?.workProcedures).toEqual([]);
    expect(fallProgram?.stopWorkProcedures).toEqual([]);
    expect(fallProgram?.closeoutProcedures).toEqual([]);
    expect(electricalProgram?.title).toBe("Electrical Safety Program");
    expect(electricalProgram?.preTaskProcedures.length).toBeGreaterThan(0);
    expect(hotWorkProgram?.title).toBe("Hot Work Program");
    expect(hotWorkProgram?.preTaskProcedures).toEqual([]);
  });
});
