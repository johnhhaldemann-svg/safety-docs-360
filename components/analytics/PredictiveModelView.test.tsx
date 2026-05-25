import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabaseBrowser", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
    },
  }),
}));

import { PredictiveModelView } from "@/components/analytics/PredictiveModelView";
import { buildEmptyPredictiveRiskPayload, buildSalesDemoPredictiveRiskPayload } from "@/lib/predictiveRisk";

describe("PredictiveModelView", () => {
  it("renders populated predictive risk sections", () => {
    const html = renderToStaticMarkup(
      <PredictiveModelView
        data={buildSalesDemoPredictiveRiskPayload(30)}
        loading={false}
        error=""
        days={30}
      />
    );

    expect(html).toContain("Predict risk before it happens");
    expect(html).toContain("Top locations by predicted risk");
    expect(html).toContain("Top risk drivers");
    expect(html).toContain("Recommended actions");
    expect(html).toContain("North Tower");
    expect(html).toContain("How these numbers work");
    expect(html).toContain("Methodology notes");
    expect(html).toContain("lower is better, higher is worse");
    expect(html).toContain("0 means no active risk signals");
    expect(html).toContain("100 means the location hit the cap");
    expect(html).toContain("Positive trend means risk pressure is increasing");
    expect(html).toContain("Higher is worse; 100 is the cap");
    expect(html).toContain("0 is best, 100 is highest risk pressure");
    expect(html).toContain("Positive is worsening, negative is improving");
    expect(html).toContain("Share of active risk categories in the selected window.");
    expect(html).toContain("Confidence reflects data and model coverage, not a safety grade.");
    expect(html).toContain("Safety AI Assessment");
    expect(html).toContain("Explainable jobsite risk score");
    expect(html).toContain("Guardrail:");
    expect(html).toContain("does not guarantee OSHA compliance");
    expect(html).toContain("Escalation status");
    expect(html).toContain("Stop-work review");
    expect(html).toContain("Missing data");
    expect(html).toContain("Human Behavior Risk");
    expect(html).toContain("Coaching and verification guidance");
    expect(html).toContain("Field verification required");
    expect(html).toContain("Behavior Risk by Trade");
  });

  it("renders loading metric placeholders", () => {
    const html = renderToStaticMarkup(
      <PredictiveModelView data={null} loading error="" days={30} />
    );

    expect(html).toContain("High risk locations");
    expect(html).toContain("Loading");
  });

  it("renders the error state", () => {
    const html = renderToStaticMarkup(
      <PredictiveModelView data={null} loading={false} error="Could not load model." days={30} />
    );

    expect(html).toContain("Could not load model.");
  });

  it("renders the empty state", () => {
    const html = renderToStaticMarkup(
      <PredictiveModelView
        data={buildEmptyPredictiveRiskPayload(30)}
        loading={false}
        error=""
        days={30}
      />
    );

    expect(html).toContain("No predictive risk signals yet");
  });

  it("renders predicted workface conflicts with review-safe language", () => {
    const data = {
      ...buildEmptyPredictiveRiskPayload(30),
      aiSafetyConflictMap: {
        generatedAt: "2026-05-22T00:00:00.000Z",
        summary: "1 predicted workface conflict needs review before work proceeds.",
        highConflictCount: 1,
        criticalConflictCount: 0,
        missingData: [],
        confidence: "medium" as const,
        findings: [
          {
            id: "conflict-1",
            type: "adjacent_work_conflict" as const,
            riskLevel: "high" as const,
            confidence: "medium" as const,
            title: "Hot work overlaps combustible or flammable exposure",
            reason: "Spark-producing work is planned near material exposure signals.",
            dataUsed: ["Hot work grinding", "Paint staging"],
            missingInformation: ["fire watch assignment"],
            recommendedAction: "Review the work sequence and verify controls before either task proceeds in the shared workface.",
            requiredVerification: "Verify hot work permit, fire watch, extinguisher, and combustible-material clearance before work proceeds.",
            humanApprovalRequired: true,
            humanApprovalReason: "Potentially incompatible work in the same workface requires supervisor review before work proceeds.",
            evidenceRefs: [],
            affectedWorkItemIds: ["work-1", "work-2"],
            jobsiteId: "j1",
            jobsiteName: "North Tower",
            trade: "Steel",
            area: "Level 2",
            sourceKey: "adjacent:test",
          },
        ],
      },
      aiSafetyActionQueue: {
        ...buildEmptyPredictiveRiskPayload(30).aiSafetyActionQueue,
        items: [
          {
            id: "action-1",
            sourceKey: "action-conflict",
            title: "Review predicted workface conflict - Hot work overlaps combustible or flammable exposure",
            detail: "Spark-producing work is planned near material exposure signals.",
            category: "workface_conflict_review" as const,
            riskLevel: "high" as const,
            priority: "high" as const,
            ownerRole: "field_supervisor" as const,
            dueAt: null,
            approvalState: "review_required" as const,
            recommendedControl: "Review the work sequence and verify controls before either task proceeds in the shared workface.",
            evidenceRefs: [],
            missingInformation: [],
            humanApprovalRequired: true,
            humanApprovalReason: "Potentially incompatible work in the same workface requires supervisor review before work proceeds.",
            sourceWorkItemId: "work-1",
            sourceWorkTitle: "Hot work grinding",
            jobsiteId: "j1",
            jobsiteName: "North Tower",
            trade: "Steel",
            area: "Level 2",
            targetModule: "command_center" as const,
            targetHref: "/command-center",
            feedbackInfluence: [],
            feedbackConfidenceAdjustment: "neutral" as const,
            memoryInfluence: [],
          },
        ],
      },
    };

    const html = renderToStaticMarkup(
      <PredictiveModelView data={data} loading={false} error="" days={30} />
    );

    expect(html).toContain("Predicted workface conflicts");
    expect(html).toContain("Hot work overlaps combustible or flammable exposure");
    expect(html).toContain("Predicted workface conflict");
    expect(html).toContain("Human review required before work proceeds");
    expect(html).not.toMatch(/safe to start|cleared|guaranteed/i);
  });

  it("renders interactive risk action controls and mitigation state", () => {
    const html = renderToStaticMarkup(
      <PredictiveModelView
        data={buildEmptyPredictiveRiskPayload(30)}
        loading={false}
        error=""
        days={30}
        riskActionRecommendations={[
          {
            id: "rec-1",
            kind: "test",
            title: "Verify controls before release",
            body: "Document controls and assign a field verification.",
            confidence: 0.8,
            created_at: "2026-05-21T00:00:00.000Z",
            status: "active",
            priority: "high",
            actionType: "create_corrective_action",
            verificationRequired: true,
            mitigationState: "linked_action_created",
            riskReductionPoints: 0,
            evidenceRefs: [],
          },
        ]}
      />
    );

    expect(html).toContain("Suggested action");
    expect(html).toContain("Corrective action");
    expect(html).toContain("Residual risk");
    expect(html).toContain("Verification required");
    expect(html).toContain("Do: Corrective action");
    expect(html).toContain("Stop-work review");
  });
});
