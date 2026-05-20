import { describe, expect, it } from "vitest";
import {
  getDocumentStatusLabel,
  getDocumentStatusTone,
  isApprovedDocumentStatus,
  normalizeDocumentStatus,
} from "@/lib/documentStatus";

describe("document status lifecycle mapping", () => {
  it("uses final file presence as approved lifecycle state", () => {
    expect(normalizeDocumentStatus("draft", true)).toBe("approved");
    expect(isApprovedDocumentStatus("submitted", true)).toBe(true);
  });

  it("maps known lifecycle states to customer-facing labels and tones", () => {
    expect(getDocumentStatusLabel("submitted")).toBe("In Review");
    expect(getDocumentStatusTone("submitted")).toBe("app-badge-warning");
    expect(getDocumentStatusLabel(null)).toBe("Draft");
    expect(getDocumentStatusTone("archived")).toBe("app-badge-neutral");
  });
});
