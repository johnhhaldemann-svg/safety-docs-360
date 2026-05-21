import { describe, expect, it } from "vitest";
import { buildCanonicalDocumentAiContext } from "@/lib/documentAiReviewContext";

describe("buildCanonicalDocumentAiContext", () => {
  it("orders stored notes, embedded comments, then reviewer text", () => {
    const context = buildCanonicalDocumentAiContext({
      recordNotes: "Stored note",
      annotations: [
        {
          id: "1",
          author: "john",
          date: "2026-04-16T14:35:00Z",
          anchorText: "Related Task Triggers",
          note: "List the task instead of naming triggers",
        },
      ],
      reviewerContext: "Manual reviewer context",
    });

    expect(context).toContain("Stored document notes:\nStored note");
    expect(context).toContain("Embedded reviewer notes from DOCX comments:");
    expect(context).toContain("Anchor text: Related Task Triggers");
    expect(context).toContain("Reviewer-entered context:\nManual reviewer context");
    expect(context.indexOf("Stored document notes")).toBeLessThan(
      context.indexOf("Embedded reviewer notes")
    );
    expect(context.indexOf("Embedded reviewer notes")).toBeLessThan(
      context.indexOf("Reviewer-entered context")
    );
  });
});
