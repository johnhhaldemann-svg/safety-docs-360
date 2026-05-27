import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_OWNER_CHANGE_LOG_ENTRIES,
  ensureDefaultOwnerChangeLogEntries,
  validateOwnerChangeLogInput,
} from "@/lib/superadmin/ownerChangeLog";

function createMockClient() {
  const upsert = vi.fn().mockResolvedValue({ data: [], error: null });
  const from = vi.fn(() => ({ upsert }));

  return {
    client: { from },
    from,
    upsert,
  };
}

describe("ownerChangeLog", () => {
  it("seeds the default owner validation console change entry", async () => {
    const mock = createMockClient();

    await ensureDefaultOwnerChangeLogEntries(mock.client as never);

    expect(mock.from).toHaveBeenCalledWith("owner_change_log_entries");
    expect(mock.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          change_key: DEFAULT_OWNER_CHANGE_LOG_ENTRIES[0].changeKey,
          module_name: "Owner Validation Console",
          safe_to_show_customer: "Needs Review",
        }),
      ]),
      { onConflict: "change_key", ignoreDuplicates: true }
    );
  });

  it("normalizes owner-facing change input", () => {
    const input = validateOwnerChangeLogInput({
      moduleName: " Documents ",
      plainEnglishDescription: " Export labels changed ",
      filesChanged: [" app/page.tsx ", "", 12],
      pagesAffected: ["/documents"],
      riskLevel: "Low",
      safeToShowCustomer: "Yes",
      ownerReviewRequired: false,
    });

    expect(input.moduleName).toBe("Documents");
    expect(input.filesChanged).toEqual(["app/page.tsx"]);
    expect(input.pagesAffected).toEqual(["/documents"]);
    expect(input.riskLevel).toBe("Low");
    expect(input.safeToShowCustomer).toBe("Yes");
    expect(input.ownerReviewRequired).toBe(false);
  });
});
