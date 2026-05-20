import { describe, expect, it } from "vitest";
import { parseTrainingRecordPhotoExtraction } from "@/lib/trainingRecordPhotoExtraction";

describe("parseTrainingRecordPhotoExtraction", () => {
  it("normalizes extracted JSON into training record form fields", () => {
    const draft = parseTrainingRecordPhotoExtraction(
      JSON.stringify({
        title: " OSHA 10 Construction ",
        completedOn: "6/11/2025",
        expiresOn: "2027-06-11",
        provider: " ABC Safety ",
        notes: " Card #12345 ",
        confidence: 0.82,
        warnings: [],
      })
    );

    expect(draft).toEqual({
      title: "OSHA 10 Construction",
      completedOn: "2025-06-11",
      expiresOn: "2027-06-11",
      provider: "ABC Safety",
      notes: "Card #12345",
      confidence: 0.82,
      warnings: [],
    });
  });

  it("accepts fenced JSON and warns for invalid visible dates", () => {
    const draft = parseTrainingRecordPhotoExtraction(`\`\`\`json
      {
        "title": "Respirator Fit Test",
        "completedOn": "not a date",
        "expiresOn": "",
        "provider": "HealthCheck Safety",
        "notes": "",
        "confidence": 2,
        "warnings": ["Expiration not visible"]
      }
    \`\`\``);

    expect(draft?.completedOn).toBe("");
    expect(draft?.confidence).toBe(1);
    expect(draft?.warnings).toContain("Completed date was visible but could not be normalized.");
    expect(draft?.warnings).toContain("Expiration not visible");
  });

  it("returns null for malformed model output", () => {
    expect(parseTrainingRecordPhotoExtraction("{not-json")).toBeNull();
  });

  it("keeps missing fields empty and flags missing title", () => {
    const draft = parseTrainingRecordPhotoExtraction(
      JSON.stringify({
        title: "",
        completedOn: "",
        expiresOn: "",
        provider: "",
        notes: "",
        confidence: 0.2,
        warnings: [],
      })
    );

    expect(draft?.title).toBe("");
    expect(draft?.warnings).toContain("Training title was not visible enough to extract.");
  });
});
