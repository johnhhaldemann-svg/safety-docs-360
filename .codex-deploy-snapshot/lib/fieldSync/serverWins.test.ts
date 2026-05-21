import { describe, expect, it } from "vitest";
import { parseIsoDate, shouldRejectStaleUpdate } from "./serverWins";

describe("serverWins", () => {
  it("rejects when server is newer than client snapshot", () => {
    expect(
      shouldRejectStaleUpdate({
        serverUpdatedAtIso: "2026-04-26T12:00:00.000Z",
        ifUnmodifiedSinceIso: "2026-04-25T12:00:00.000Z",
      })
    ).toBe(true);
  });

  it("allows when client snapshot matches or is newer", () => {
    expect(
      shouldRejectStaleUpdate({
        serverUpdatedAtIso: "2026-04-25T12:00:00.000Z",
        ifUnmodifiedSinceIso: "2026-04-25T12:00:00.000Z",
      })
    ).toBe(false);
    expect(
      shouldRejectStaleUpdate({
        serverUpdatedAtIso: "2026-04-24T12:00:00.000Z",
        ifUnmodifiedSinceIso: "2026-04-25T12:00:00.000Z",
      })
    ).toBe(false);
  });

  it("parseIsoDate returns null for invalid", () => {
    expect(parseIsoDate("")).toBeNull();
    expect(parseIsoDate("not-a-date")).toBeNull();
  });
});
