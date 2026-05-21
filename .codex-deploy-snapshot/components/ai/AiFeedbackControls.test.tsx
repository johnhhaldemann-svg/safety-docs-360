import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AiFeedbackControls } from "@/components/ai/AiFeedbackControls";

vi.mock("@/lib/supabaseBrowser", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      getSession: vi.fn(),
    },
  }),
}));

describe("AiFeedbackControls", () => {
  it("renders compact metadata-only outcome actions", () => {
    const html = renderToStaticMarkup(
      <AiFeedbackControls
        surface="permit-copilot"
        sourceId="activity-1"
        metadata={{ workflowStep: "permit_copilot_suggestion", documentType: "hot_work" }}
      />
    );

    expect(html).toContain("Accept");
    expect(html).toContain("Edited");
    expect(html).toContain("Reject");
    expect(html).toContain("Rerun");
    expect(html).toContain("Field used");
    expect(html).not.toContain("generatedText");
  });
});
