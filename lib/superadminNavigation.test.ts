import { describe, expect, it } from "vitest";
import { flattenSuperadminTools } from "@/lib/superadminNavigation";

describe("superadmin navigation", () => {
  it("includes the Owner Validation Console", () => {
    const tools = flattenSuperadminTools();

    expect(tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: "/superadmin/owner-validation",
          label: "Owner Validation Console",
          short: "OV",
        }),
      ])
    );
  });
});
