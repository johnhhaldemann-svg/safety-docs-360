import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TrustSummaryPanel } from "@/components/leadership/TrustSummaryPanel";
import { buildLeadershipTrustMetadata } from "@/lib/leadershipTrust";

describe("TrustSummaryPanel", () => {
  it("explains what the confidence badge means", () => {
    const trust = buildLeadershipTrustMetadata({
      lastUpdatedAt: "2026-05-06T14:46:32.000Z",
      dateWindowLabel: "Last 30 days",
      sourceCoverage: [
        { key: "correctives", label: "Correctives", count: 4, status: "connected" },
        { key: "permits", label: "Permits", count: 2, status: "connected" },
        { key: "incidents", label: "Incidents", count: 0, status: "missing" },
      ],
      evidenceRefs: [
        {
          id: "evidence-1",
          label: "Corrective actions",
          href: "/corrective-actions",
          sourceModule: "corrective_actions",
        },
      ],
      executiveSummary: "Leadership summary",
      provenanceNote: "Company scoped sources.",
    });

    const html = renderToStaticMarkup(<TrustSummaryPanel trust={trust} compact />);

    expect(html).toContain("confidence");
    expect(html).toContain("Confidence means this summary is backed by 2 of 3 active data sources");
    expect(html).toContain("and 1 evidence reference");
    expect(html).toContain("It is not a safety grade.");
  });
});
