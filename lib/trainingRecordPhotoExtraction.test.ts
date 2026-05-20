import { describe, expect, it } from "vitest";
import { parseTrainingRecordPhotoExtraction } from "@/lib/trainingRecordPhotoExtraction";

describe("parseTrainingRecordPhotoExtraction", () => {
  it("normalizes extracted JSON into training record form fields", () => {
    const draft = parseTrainingRecordPhotoExtraction(
      JSON.stringify({
        title: " OSHA 10 Construction ",
        completedOn: "6/11/2025",
        expiresOn: "2027-06-11",
        completedOnLabel: "Completed",
        expiresOnLabel: "Expires",
        provider: " ABC Safety ",
        notes: " Card #12345 ",
        confidence: 0.82,
        rawVisibleText: "OSHA 10 Construction",
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
        "completedOnLabel": "Completed",
        "expiresOnLabel": "",
        "provider": "HealthCheck Safety",
        "notes": "",
        "confidence": 2,
        "rawVisibleText": "Respirator Fit Test",
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
        completedOnLabel: "",
        expiresOnLabel: "",
        provider: "",
        notes: "",
        confidence: 0.2,
        rawVisibleText: "",
        warnings: [],
      })
    );

    expect(draft?.title).toBe("");
    expect(draft?.warnings).toContain("Training title was not visible enough to extract.");
  });

  it("uses visible OSHA course text instead of generic certificate headings", () => {
    const draft = parseTrainingRecordPhotoExtraction(
      JSON.stringify({
        title: "Certificate of Completion",
        completedOn: "March 24, 2025",
        expiresOn: "",
        completedOnLabel: "Date",
        expiresOnLabel: "",
        provider: "[Your Company Name]",
        notes: "Certificate ID: 208485-194-352-23239; Instructor: [Name]",
        confidence: 0.9,
        rawVisibleText:
          "Certificate of Completion OSHA 10-HOUR CONSTRUCTION SAFETY This is to certify that JANE DOE Date: March 24, 2025",
        warnings: [],
      })
    );

    expect(draft?.title).toBe("OSHA 10-Hour Construction Safety");
    expect(draft?.completedOn).toBe("2025-03-24");
    expect(draft?.expiresOn).toBe("");
  });

  it("moves a non-expiration date out of expiresOn when the model used the wrong date field", () => {
    const draft = parseTrainingRecordPhotoExtraction(
      JSON.stringify({
        title: "Certificate of Completion",
        completedOn: "",
        expiresOn: "03/24/2025",
        completedOnLabel: "",
        expiresOnLabel: "Date",
        provider: "[Your Company Name]",
        notes: "Certificate ID: 208485-194-352-23239",
        confidence: 0.9,
        rawVisibleText: "OSHA 10-HOUR CONSTRUCTION SAFETY Date: March 24, 2025",
        warnings: [],
      })
    );

    expect(draft?.title).toBe("OSHA 10-Hour Construction Safety");
    expect(draft?.completedOn).toBe("2025-03-24");
    expect(draft?.expiresOn).toBe("");
    expect(draft?.warnings).toContain("A date was visible, but no expiration label was visible; review before saving.");
  });
});
