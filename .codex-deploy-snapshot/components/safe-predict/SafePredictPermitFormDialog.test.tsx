import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SafePredictPermitFormDialog } from "@/components/safe-predict/SafePredictPermitFormDialog";
import { defaultPermitChecklistItems, preparePermitFormForSave } from "@/lib/safePredictPermitForms";
import type { SafePredictPermitRecord } from "@/lib/safePredictData";

const jobsites = [{ id: "site-1", name: "North Pier Expansion" }];

function permit(overrides: Partial<SafePredictPermitRecord> = {}): SafePredictPermitRecord {
  const permitForm = overrides.permitForm ?? {
    checklistItems: defaultPermitChecklistItems("Hot Work"),
    acknowledgement: {
      acknowledged: false,
      name: "",
      acknowledgedAt: null,
      statement: "I acknowledge the permit checklist has been reviewed.",
    },
    notes: "",
  };
  return {
    id: "permit-1",
    siteId: "site-1",
    type: "Hot Work",
    title: "Level 3 hot work permit",
    status: "Active",
    owner: "Site Team",
    expiresAt: "May 27",
    riskLevel: "high",
    permitForm,
    readiness: "Checklist incomplete",
    ...overrides,
  };
}

describe("SafePredictPermitFormDialog", () => {
  it("renders an editable checkbox permit form with disabled save until acknowledged", () => {
    const html = renderToStaticMarkup(
      <SafePredictPermitFormDialog
        mode="edit"
        permit={permit()}
        jobsites={jobsites}
        fallbackSiteId="site-1"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(html).toContain("Permit checklist");
    expect(html).toContain("Acknowledgment");
    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("Checklist incomplete");
  });

  it("enables save when checklist and acknowledgement are complete", () => {
    const completedForm = preparePermitFormForSave({
      checklistItems: defaultPermitChecklistItems("Hot Work").map((item) => ({ ...item, checked: true })),
      acknowledgement: {
        acknowledged: true,
        name: "Jack Jane",
        acknowledgedAt: "2026-05-20T12:00:00.000Z",
        statement: "I acknowledge the permit checklist has been reviewed.",
      },
      notes: "",
    });
    const html = renderToStaticMarkup(
      <SafePredictPermitFormDialog
        mode="edit"
        permit={permit({ permitForm: completedForm, readiness: "Ready" })}
        jobsites={jobsites}
        fallbackSiteId="site-1"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(html).toContain("Ready");
    expect(html).toContain("Save permit");
    expect(html).not.toContain("disabled=\"\"");
  });
});
