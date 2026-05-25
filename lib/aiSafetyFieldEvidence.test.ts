import { describe, expect, it } from "vitest";
import {
  buildFieldEvidenceInsertForGusPhotoReview,
  fieldEvidenceSignalFromRecommendation,
  fieldEvidenceSignalsFromRecommendations,
  linkFieldEvidenceSignalsToPredictiveContext,
} from "@/lib/aiSafetyFieldEvidence";
import type { AiSafetyConflictMap } from "@/lib/aiSafetyConflictMap";
import type { GusPhotoReviewOutput } from "@/lib/gus/gusTypes";
import type { DailyRiskBriefing, PredictiveSafetyWorkItem } from "@/lib/predictiveSafetyEngine";
import { assessSafetyRisk } from "@/lib/safety-ai/riskEngine";

const review: GusPhotoReviewOutput = {
  answer: "Open edge needs review.",
  riskLevel: "high" as const,
  whatLooksRight: ["Barricade is partly visible"],
  concerns: ["Open roof edge appears exposed"],
  criticalFlags: [],
  missingInformation: ["Exact area"],
  recommendedControls: ["Verify fall protection plan and edge protection"],
  nextActions: ["Have the supervisor verify the roof edge in the field."],
  limitations: ["Photo angle does not show the full deck."],
  confidence: 0.72,
  draftOnly: true,
  humanReviewRequired: true,
};

const assessment = assessSafetyRisk({
  jobsiteId: "j1",
  jobsiteName: "North Tower",
  taskType: "Roof edge layout",
  highRiskWorkCategories: ["fall protection", "roof edge"],
  controlEffectiveness: "partial",
  missingData: ["anchor plan"],
});

const work: PredictiveSafetyWorkItem = {
  id: "work-1",
  title: "Roof edge layout",
  timing: "today",
  jobsiteId: "j1",
  jobsiteName: "North Tower",
  date: "2026-05-24",
  trade: "Roofing",
  area: "Roof edge",
  crewSize: 4,
  riskLevel: "high",
  riskScore: assessment.score,
  actionTimeframe: assessment.actionTimeframe,
  blockers: [],
  controlsToVerify: ["Fall protection plan"],
  recommendedControls: assessment.controlRecommendations,
  drivers: ["Fall protection"],
  whyItMatters: "Elevated work near open edges needs field verification.",
  scoreExplanation: assessment.scoreExplanation,
  humanApprovalRequired: true,
  humanApprovalReason: "High-risk work requires review.",
  evidenceRefs: [],
  assessment,
};

const briefing: DailyRiskBriefing = {
  generatedAt: "2026-05-24T12:00:00.000Z",
  engineVersion: "test",
  window: { today: "2026-05-24", tomorrow: "2026-05-25", days: 7 },
  headline: "Roof work needs review.",
  highRiskWork: [work],
  attentionTargets: [],
  readinessBlockers: [],
  controlsToVerify: [],
  whyThisMatters: [],
  missingData: [],
  confidence: "medium",
  escalationRequired: false,
  stopWorkReviewRecommended: false,
  evidenceRefs: [],
};

const conflictMap: AiSafetyConflictMap = {
  generatedAt: "2026-05-24T12:00:00.000Z",
  summary: "No conflicts.",
  findings: [],
  highConflictCount: 0,
  criticalConflictCount: 0,
  missingData: [],
  confidence: "medium",
};

describe("AI safety field evidence adapter", () => {
  it("converts Gus photo review output into summary-only insert and signal", () => {
    const candidate = buildFieldEvidenceInsertForGusPhotoReview({
      companyId: "co1",
      actorUserId: "u1",
      jobsiteId: "j1",
      review,
      userNote: "Check roof edge.",
      sourceKey: "gus-photo-review:co1:j1:u1:1",
    });

    expect(candidate.row).toEqual(
      expect.objectContaining({
        kind: "ai_safety_field_evidence",
        target_module: "command_center",
        verification_required: true,
        mitigation_state: "unverified",
      }),
    );
    expect(candidate.row.evidence_summary.gusPhotoReview).toEqual(
      expect.objectContaining({
        concerns: ["Open roof edge appears exposed"],
        userNote: "Check roof edge.",
        needsFieldVerification: true,
      }),
    );
    expect(JSON.stringify(candidate.row)).not.toContain("data:image");
  });

  it("converts persisted field evidence summaries back into signals", () => {
    const candidate = buildFieldEvidenceInsertForGusPhotoReview({
      companyId: "co1",
      actorUserId: "u1",
      jobsiteId: "j1",
      review,
      userNote: "Check roof edge.",
      sourceKey: "gus-photo-review:co1:j1:u1:1",
    });
    const signal = fieldEvidenceSignalFromRecommendation({
      id: "rec-1",
      jobsite_id: "j1",
      title: candidate.row.title,
      body: candidate.row.body,
      confidence: candidate.row.confidence,
      evidence_summary: candidate.row.evidence_summary,
    });

    expect(signal).toEqual(
      expect.objectContaining({
        id: "rec-1",
        persistedRecommendationId: "rec-1",
        source: "gus_photo_review",
        jobsiteId: "j1",
        needsFieldVerification: true,
      }),
    );
    expect(fieldEvidenceSignalsFromRecommendations([{ id: "rec-1", evidence_summary: candidate.row.evidence_summary }])).toHaveLength(1);
  });

  it("links matching field evidence to scheduled work and lowers confidence when unlinked", () => {
    const linked = linkFieldEvidenceSignalsToPredictiveContext({
      dailyBriefing: briefing,
      conflictMap,
      signals: [
        {
          id: "field-1",
          source: "gus_photo_review",
          sourceKey: "field-1",
          jobsiteId: "j1",
          riskLevel: "high",
          confidence: "medium",
          concerns: ["Roof edge fall exposure"],
          criticalFlags: [],
          missingInformation: [],
          recommendedControls: [],
          nextActions: [],
          limitations: [],
          evidenceRefs: [],
          needsFieldVerification: true,
        },
      ],
    })[0];
    const unlinked = linkFieldEvidenceSignalsToPredictiveContext({
      dailyBriefing: briefing,
      conflictMap,
      signals: [
        {
          ...linked,
          id: "field-2",
          jobsiteId: "j2",
          confidence: "high",
          linkedWorkItemId: null,
          linkedWorkTitle: null,
        },
      ],
    })[0];

    expect(linked.linkedWorkItemId).toBe("work-1");
    expect(unlinked.linkedWorkItemId).toBeNull();
    expect(unlinked.confidence).toBe("medium");
    expect(unlinked.missingInformation).toEqual(expect.arrayContaining([expect.stringContaining("No matching scheduled work")]));
  });
});
