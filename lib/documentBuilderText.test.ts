import { describe, expect, it } from "vitest";
import {
  DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG,
  cloneDocumentBuilderTextConfig,
  normalizeDocumentBuilderTextConfig,
  resolveDocumentBuilderSection,
} from "@/lib/documentBuilderText";

describe("normalizeDocumentBuilderTextConfig", () => {
  it("preserves the default structure while applying overrides", () => {
    const config = normalizeDocumentBuilderTextConfig({
      builders: {
        csep: {
          sections: [
            {
              key: "scope_of_work",
              title: "Custom Scope",
              paragraphs: ["Custom scope paragraph"],
            },
          ],
        },
      },
    });

    expect(config.builders.csep.sections[0].title).toBe("Custom Scope");
    expect(config.builders.csep.sections[0].paragraphs).toEqual(["Custom scope paragraph"]);
    expect(config.builders.site_builder.sections[0].title).toBe(
      DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG.builders.site_builder.sections[0].title
    );
  });

  it("allows intentionally cleared paragraph and bullet lists", () => {
    const next = cloneDocumentBuilderTextConfig(DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG);
    next.builders.csep.sections[0].paragraphs = [];
    const trainingSection = next.builders.csep.sections.find(
      (section) => section.key === "training_requirements"
    );

    if (!trainingSection) {
      throw new Error("Expected training_requirements section.");
    }

    trainingSection.bullets = [];

    const config = normalizeDocumentBuilderTextConfig(next);

    expect(config.builders.csep.sections[0].paragraphs).toEqual([]);
    expect(
      config.builders.csep.sections.find((section) => section.key === "training_requirements")
        ?.bullets
    ).toEqual([]);
  });

  it("resolves referenced weather content before csep-specific overlay text", () => {
    const section = resolveDocumentBuilderSection(
      DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG,
      "csep",
      "weather_requirements_and_severe_weather_response"
    );

    expect(section?.paragraphs[0]).toContain("Project leadership will monitor weather conditions");
    expect(section?.paragraphs.at(-1)).toContain(
      "Contractors shall monitor weather daily, adjust work plans accordingly"
    );
    expect(section?.bullets).toEqual(
      expect.arrayContaining([
        expect.stringContaining("lightning is detected within 10 miles"),
        expect.stringContaining("Review weather conditions during the morning huddle"),
      ])
    );
  });
});
