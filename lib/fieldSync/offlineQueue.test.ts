import { describe, expect, it } from "vitest";

describe("offlineQueue", () => {
  it("module exports are defined", async () => {
    const mod = await import("./offlineQueue");
    expect(typeof mod.enqueueToolboxOperation).toBe("function");
    expect(typeof mod.listQueuedToolboxOperations).toBe("function");
  });
});
