import { describe, expect, it } from "vitest";
import { parseCompletedCsepCompletenessReviewPostBody } from "@/lib/parseGcProgramAiReviewPostBody";

function buildMultipartRequest(formData: FormData) {
  return new Request("https://example.com/api/superadmin/csep-completeness-review", {
    method: "POST",
    body: formData,
  });
}

describe("parseCompletedCsepCompletenessReviewPostBody", () => {
  it("accepts a PDF upload with optional context and multiple site references", async () => {
    const formData = new FormData();
    formData.append(
      "document",
      new File([Buffer.from("primary")], "completed-csep.pdf", { type: "application/pdf" })
    );
    formData.append(
      "siteDocument",
      new File([Buffer.from("reference")], "site-reference.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
    );
    formData.append(
      "siteDocument",
      new File([Buffer.from("reference-2")], "gc-logistics.pdf", {
        type: "application/pdf",
      })
    );
    formData.append("additionalReviewerContext", "Focus on rescue and permits.");

    const parsed = await parseCompletedCsepCompletenessReviewPostBody(buildMultipartRequest(formData));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("Expected multipart request to parse.");
    }
    expect(parsed.data.document.fileName).toBe("completed-csep.pdf");
    expect(parsed.data.siteDocuments.map((item) => item.fileName)).toEqual([
      "site-reference.docx",
      "gc-logistics.pdf",
    ]);
    expect(parsed.data.additionalReviewerContext).toBe("Focus on rescue and permits.");
  });

  it("rejects unsupported site reference file types", async () => {
    const formData = new FormData();
    formData.append(
      "document",
      new File([Buffer.from("primary")], "completed-csep.pdf", { type: "application/pdf" })
    );
    formData.append(
      "siteDocument",
      new File([Buffer.from("bad")], "reference.txt", { type: "text/plain" })
    );

    const parsed = await parseCompletedCsepCompletenessReviewPostBody(buildMultipartRequest(formData));

    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      throw new Error("Expected invalid site reference file to fail.");
    }
    expect(parsed.response.status).toBe(400);
    await expect(parsed.response.json()).resolves.toMatchObject({
      error: "Every site reference file must be a PDF or DOCX.",
    });
  });

  it("rejects requests with no primary document", async () => {
    const formData = new FormData();
    formData.append("additionalReviewerContext", "No file attached.");

    const parsed = await parseCompletedCsepCompletenessReviewPostBody(buildMultipartRequest(formData));

    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      throw new Error("Expected missing document to fail.");
    }
    expect(parsed.response.status).toBe(400);
    await expect(parsed.response.json()).resolves.toMatchObject({
      error: "A completed CSEP PDF or DOCX file is required.",
    });
  });

  it("rejects oversized uploads", async () => {
    const oversized = new Uint8Array(12 * 1024 * 1024 + 1);
    const formData = new FormData();
    formData.append(
      "document",
      new File([oversized], "completed-csep.pdf", { type: "application/pdf" })
    );

    const parsed = await parseCompletedCsepCompletenessReviewPostBody(buildMultipartRequest(formData));

    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      throw new Error("Expected oversized document to fail.");
    }
    expect(parsed.response.status).toBe(413);
  });

  it("rejects unsupported file types", async () => {
    const formData = new FormData();
    formData.append(
      "document",
      new File([Buffer.from("plain text")], "completed-csep.txt", { type: "text/plain" })
    );

    const parsed = await parseCompletedCsepCompletenessReviewPostBody(buildMultipartRequest(formData));

    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      throw new Error("Expected unsupported document type to fail.");
    }
    expect(parsed.response.status).toBe(400);
    await expect(parsed.response.json()).resolves.toMatchObject({
      error: "Completed CSEP file must be a PDF or DOCX.",
    });
  });
});
