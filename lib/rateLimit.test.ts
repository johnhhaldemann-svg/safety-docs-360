import { describe, expect, it } from "vitest";
import { checkFixedWindowRateLimit, contentTypeFromFilenameHint } from "./rateLimit";

describe("checkFixedWindowRateLimit", () => {
  it("allows requests under the max within the window", () => {
    const k = `test-under-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      expect(checkFixedWindowRateLimit(k, { windowMs: 60_000, max: 10 }).ok).toBe(true);
    }
  });

  it("blocks after max in the same window", () => {
    const k = `test-block-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      expect(checkFixedWindowRateLimit(k, { windowMs: 60_000, max: 3 }).ok).toBe(true);
    }
    const last = checkFixedWindowRateLimit(k, { windowMs: 60_000, max: 3 });
    expect(last.ok).toBe(false);
    if (!last.ok) {
      expect(last.retryAfterSec).toBeGreaterThan(0);
    }
  });
});

describe("contentTypeFromFilenameHint", () => {
  it("maps common extensions", () => {
    expect(contentTypeFromFilenameHint("x.pdf")).toBe("application/pdf");
    expect(contentTypeFromFilenameHint("y.DOCX")).toContain("wordprocessingml");
  });
});
