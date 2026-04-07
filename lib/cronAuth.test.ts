import { describe, expect, it, afterEach } from "vitest";
import { isCronRequestAuthorized } from "./cronAuth";

describe("isCronRequestAuthorized", () => {
  const prev = process.env.CRON_SECRET;

  afterEach(() => {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });

  it("returns false when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    const req = new Request("https://example.com/api/cron/x");
    expect(isCronRequestAuthorized(req)).toBe(false);
  });

  it("accepts Bearer token (case-insensitive scheme)", () => {
    process.env.CRON_SECRET = "abc123";
    const req = new Request("https://example.com/api/cron/x", {
      headers: { authorization: "bearer abc123" },
    });
    expect(isCronRequestAuthorized(req)).toBe(true);
  });

  it("accepts Bearer with extra spaces trimmed", () => {
    process.env.CRON_SECRET = "abc123";
    const req = new Request("https://example.com/api/cron/x", {
      headers: { authorization: "  Bearer   abc123  " },
    });
    expect(isCronRequestAuthorized(req)).toBe(true);
  });

  it("accepts matching secret query param", () => {
    process.env.CRON_SECRET = "abc123";
    const req = new Request("https://example.com/api/cron/x?secret=abc123");
    expect(isCronRequestAuthorized(req)).toBe(true);
  });

  it("rejects wrong bearer", () => {
    process.env.CRON_SECRET = "abc123";
    const req = new Request("https://example.com/api/cron/x", {
      headers: { authorization: "Bearer other" },
    });
    expect(isCronRequestAuthorized(req)).toBe(false);
  });
});
