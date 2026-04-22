import { describe, expect, it } from "vitest";
import { parseContentDispositionFilename } from "./browserDownload";

describe("parseContentDispositionFilename", () => {
  it("returns null when no header is present", () => {
    expect(parseContentDispositionFilename(null)).toBeNull();
  });

  it("parses a quoted filename", () => {
    expect(
      parseContentDispositionFilename('attachment; filename="outside-csep_rebuilt.docx"')
    ).toBe("outside-csep_rebuilt.docx");
  });

  it("parses a UTF-8 encoded filename", () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename*=UTF-8''Outside%20CSEP%20rebuilt%20review.docx"
      )
    ).toBe("Outside CSEP rebuilt review.docx");
  });
});
