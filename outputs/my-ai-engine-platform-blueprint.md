# My AI Engine Platform Blueprint

Generated: 2026-05-27  
Purpose: Use this file as the readable blueprint for building a fresh SafetyDocs360 platform around the working AI Engine core.

This is not customer data. This is not a production config. This is the clean foundation to build from.

## Build Philosophy

Build the new platform around the AI Engine, not around screens.

The engine should first answer:

- What is the safety risk?
- Why is it that risk level?
- What information is missing?
- What controls should be checked first?
- Who needs to review it?
- What should never be claimed by AI?

Everything else, including dashboards, documents, permits, Gus, Super Admin, and analytics, should attach to that core.

## Keep From The Current Project

Keep these because they work:

- Deterministic risk scoring before any LLM call.
- Risk bands: low, moderate, high, critical.
- Clear top drivers and missing information.
- High and critical risk escalation.
- Critical risk immediate review and possible stop-work evaluation.
- Hierarchy of controls: elimination, substitution, engineering, administrative, PPE, competent-person review.
- Control recommendations for high-risk construction work.
- Gus as a draft-only coach, not an approver.
- Guardrails against invented regulations, compliance claims, and unsafe authority.
- Tests that prove the engine does not downgrade imminent danger or fatality potential.

Leave these out at the beginning:

- Current dashboard shell.
- Current routing/navigation.
- Billing.
- Production deployment settings.
- Existing auth and role complexity.
- Live customer data.
- LLM-first decisions.
- Anything that says AI approved, released, certified, cleared, or guaranteed compliance.

## Non-Negotiable Safety Rules

- Human life and serious injury prevention come first.
- Compliance is the floor, not the ceiling.
- AI must be transparent and explainable.
- Missing data must be shown, not hidden.
- High and critical risk must be escalated.
- Critical risk should recommend immediate review and possible stop-work evaluation.
- AI assists safety professionals. It does not replace them.
- Do not invent regulatory citations.
- Do not claim guaranteed compliance.
- Practical controls should follow the hierarchy of controls.

## Core Risk Levels

| Level | Score | Timeframe | Default action |
|---|---:|---|---|
| low | 0-40 | routine | Continue monitoring and documenting field conditions. |
| moderate | 41-60 | same shift | Review risk controls during the current shift. |
| high | 61-80 | before work continues | Verify controls before affected work continues. |
| critical | 81-100 | immediate | Pause affected work for human review. |

## Risk Score Weights

Use a deterministic 0-100 score.

Each input is normalized to 1-5 first.

| Input | Weight |
|---|---:|
| severity | 40% |
| likelihood | 25% |
| exposure frequency | 15% |
| control gap | 10% |
| data confidence concern | 10% |

## Required Escalation Overrides

These rules override the normal score when needed:

- Imminent danger always becomes critical.
- Fatality or catastrophic potential with weak controls becomes critical.
- High-consequence work with unverified critical controls becomes at least high.
- High-consequence work with severe conditions and unverified critical controls becomes critical.
- High-risk work with missing training, missing permit, missing competent-person review, or overdue corrective action increases by one risk band.

Never let low numeric inputs downgrade imminent danger.

## Input Contract

Start with this shape:

```ts
type SafetyRiskLevel = "low" | "moderate" | "high" | "critical";
type SafetyAiConfidence = "low" | "medium" | "high";

type SafetySignalType =
  | "incident"
  | "near_miss"
  | "observation"
  | "inspection_failure"
  | "corrective_action"
  | "calibration_feedback"
  | "training_gap"
  | "permit_gap"
  | "high_risk_work"
  | "environment";

type SafetyAiSignal = {
  id?: string | null;
  type: SafetySignalType;
  label: string;
  hazard?: string | null;
  severity?: number | string | null;
  likelihood?: number | string | null;
  exposureFrequency?: number | string | null;
  controlGap?: number | string | null;
  status?: string | null;
  trade?: string | null;
  task?: string | null;
  crewSize?: number | null;
  highRisk?: boolean | null;
  imminentDanger?: boolean | null;
  fatalityOrCatastrophicPotential?: boolean | null;
  missingRequiredTraining?: boolean | null;
  missingRequiredPermit?: boolean | null;
  missingCompetentPersonReview?: boolean | null;
  overdueCorrectiveAction?: boolean | null;
  controls?: string[] | null;
  controlEvidence?: string | null;
};

type SafetyAiInput = {
  jobsiteId?: string | null;
  jobsiteName?: string | null;
  location?: string | null;
  trade?: string | null;
  taskType?: string | null;
  equipment?: string[] | null;
  crewExposure?: number | null;
  highRiskWorkCategories?: string[];
  observedControls?: string[];
  controlEffectiveness?: "missing" | "ineffective" | "partial" | "effective" | "unknown" | null;
  dataCompleteness?: number | null;
  missingData?: string[];
  signals?: SafetyAiSignal[];
  imminentDanger?: boolean | null;
  fatalityOrCatastrophicPotential?: boolean | null;
  missingRequiredTraining?: boolean | null;
  missingRequiredPermit?: boolean | null;
  missingCompetentPersonReview?: boolean | null;
  overdueCorrectiveActionForHazard?: boolean | null;
};
```

## Output Contract

Every assessment should return this:

```ts
type SafetyAiAssessment = {
  score: number;
  level: SafetyRiskLevel;
  confidence: SafetyAiConfidence;
  scoreExplanation: {
    score: number;
    level: SafetyRiskLevel;
    confidence: SafetyAiConfidence;
    reason: string;
    dataInputs: string[];
    missingInformation: string[];
    recommendedAction: string;
    humanApprovalRequired: boolean;
    humanApprovalReason: string | null;
    driverSummary: string[];
  };
  topDrivers: Array<{
    label: string;
    category: string;
    impact: "low" | "medium" | "high" | "critical";
    explanation: string;
  }>;
  recommendations: Array<{
    title: string;
    priority: "low" | "medium" | "high" | "urgent";
    controlType:
      | "elimination"
      | "substitution"
      | "engineering"
      | "administrative"
      | "ppe"
      | "competent_person_review";
    reason: string;
    suggestedOwnerRole: string;
  }>;
  controlRecommendations: Array<{
    title: string;
    recommendedAction: string;
    hazardFamily: string;
    controlCategory: string;
    basis: string;
    missingInformation: string[];
    verificationRequired: string;
    humanApprovalRequired: boolean;
    humanApprovalReason: string | null;
    confidence: SafetyAiConfidence;
  }>;
  escalationRequired: boolean;
  stopWorkReviewRecommended: boolean;
  humanApprovalRequired: boolean;
  humanApprovalReason: string | null;
  explanation: string;
  missingData: string[];
  criticalControlGaps: string[];
  reviewTriggers: string[];
  actionTimeframe: "routine" | "same_shift" | "before_work_continues" | "immediate";
};
```

## Hazard Families To Start With

Build these first:

- Fall exposure
- Excavation and trenching
- Energized electrical and LOTO
- Confined space
- Hot work and fire exposure
- Crane, rigging, and suspended loads
- Mobile equipment and struck-by exposure
- Chemical, silica, and respiratory exposure
- Weather-sensitive work

## Critical Controls By Hazard

Fall exposure:

- Guardrails or verified tie-off.
- Rescue plan.
- Competent-person inspection.

Excavation and trenching:

- Protective system.
- Safe access or egress.
- Competent-person inspection.
- Utility locate/isolation.
- Water control.

Electrical and LOTO:

- De-energization where feasible.
- LOTO verification.
- Test before touch.
- Qualified-worker review.
- Arc-flash boundary or barricades.

Confined space:

- Entry permit.
- Atmospheric monitoring.
- Ventilation.
- Attendant.
- Rescue or retrieval plan.

Hot work:

- Hot-work permit.
- Fire watch.
- Extinguisher readiness.
- Combustible control.
- Post-work fire check.

Crane and rigging:

- Lift plan.
- Load chart review.
- Qualified rigger or signal person.
- Rigging inspection.
- Suspended-load exclusion zone.
- Weather threshold.

Mobile equipment:

- Pedestrian separation.
- Traffic plan.
- Spotter or signal method.
- Defined equipment route.
- Barricades or exclusion zone.

Chemical, silica, and respiratory:

- Exposure control method.
- SDS/HazCom information.
- Ventilation or containment.
- Wet method or HEPA controls where applicable.
- Respiratory protection verification.

Weather:

- Wind, lightning, heat, rain, or storm threshold.
- Shelter or hydration plan.
- Communication path.
- Pause criteria.

## Control Recommendation Rules

Start with these recommendations:

Hot work:

- Require or verify an active hot work permit, fire watch, extinguisher, and combustible-material control before grinding, welding, cutting, or spark-producing work starts.

Excavation:

- Verify competent-person inspection, protective system, access/egress, spoil placement, and changing-condition review before trench or excavation entry.

Fall exposure:

- Review the fall protection plan, anchor/tie-off method, rescue readiness, and access controls before elevated work starts.

Electrical and LOTO:

- Confirm LOTO steps, zero-energy verification, qualified-worker assignment, and barricades before energized or electrical work proceeds.

Mobile equipment:

- Require a spotter or barricaded exclusion zone, defined route, and pedestrian separation before equipment movement affects workers or shared access.

Weather-sensitive work:

- Send a weather alert to affected supervisors and verify wind, lightning, heat, rain, or storm thresholds against the planned work before start.

Generic high or critical fallback:

- Review the high-risk task with the supervisor or competent person and verify task-specific controls before work proceeds.

## Gus AI Coach Rules

Gus should be added only after the rules engine is stable.

Gus is:

- A calm AI safety coach.
- A planning helper.
- A drafter.
- A field-question generator.
- A risk explainer.

Gus is not:

- A competent person.
- A supervisor.
- A qualified person.
- An engineer.
- A legal advisor.
- An approver.

Gus must never:

- Approve work.
- Submit a JSA.
- Close a corrective action.
- Delete a record.
- Change training status.
- Modify an official document.
- Send notifications without user-controlled workflow.
- Give legal advice.
- Invent OSHA requirements.
- State that work is compliant without verification.
- Say work is safe to start.
- Say work is released for work.

Gus should answer in this order when useful:

1. Notice what is happening.
2. Explain why it matters.
3. Ask one practical field question.
4. Give the next safe step.

Gus output should always include:

```ts
type GusOutput = {
  answer: string;
  missingInformation: string[];
  riskFlags: string[];
  recommendedControls: string[];
  draftOnly: true;
  humanReviewRequired: true;
};
```

## Words To Rewrite Or Block

If AI says this:

- approved
- compliant
- safe to start
- released for work
- no review needed

Rewrite to:

- ready for human review
- aligned with available platform checks and pending human review
- not ready to start until reviewed by a qualified human
- pending human release for work
- human review is required

## Unified Safety Context

The future platform should blend these sources:

- Predictive risk
- Safety intelligence
- Gus photo or field evidence
- Risk memory
- Recommendation feedback

The unified context should always produce:

- Source coverage.
- Evidence.
- Conflicts.
- Missing information.
- Conflicting signals.
- Next best actions.
- Confidence.
- Do-not-claim rules.

Do-not-claim rules:

- Do not approve permits or release work.
- Do not declare final OSHA compliance.
- Do not provide legal advice.
- Do not claim work is safe, cleared, or guaranteed.
- Do not replace safety-manager, supervisor, or competent-person judgment.

## First Build Order

1. Build the TypeScript contracts.
2. Build deterministic scoring and band classification.
3. Build missing-data detection.
4. Build hazard family matching.
5. Build escalation overrides.
6. Build top drivers.
7. Build hierarchy-of-controls recommendations.
8. Build control recommendation rules.
9. Build plain-language score explanations.
10. Build validation tests.
11. Build a simple engine test page.
12. Add Gus draft-only coach.
13. Add saved assessments and audit logs.
14. Add dashboards.
15. Add documents, permits, and workflow automation.
16. Add Super Admin monitoring.
17. Add LLM providers only where rules cannot do the job.

## Tests To Create First

Create tests for these before building UI:

- Complete low-risk scenario stays low.
- Missing controls raise risk.
- Fatality potential plus missing controls forces critical.
- Missing data lowers confidence and is shown.
- Imminent danger cannot be downgraded.
- High and critical findings require escalation.
- Missing permit on high-risk hot work raises risk to high.
- Recommendations follow hierarchy of controls.
- Score always stays between 0 and 100.
- Explanation uses guarded wording.
- Trench entry without competent-person review becomes critical.
- Converging fall exposure signals raise likelihood.
- Strong documented controls avoid false critical-control gap.
- Unknown safety domain returns conservative missing-data output.
- Gus never approves, releases, certifies, or claims compliance.

## Starter Sample Input

```json
{
  "jobsiteName": "Demo Site",
  "taskType": "Trench entry for utility tie-in",
  "trade": "Earthwork",
  "controlEffectiveness": "partial",
  "highRiskWorkCategories": ["excavation", "trenching"],
  "signals": [
    {
      "type": "high_risk_work",
      "label": "Crew scheduled for trench entry",
      "hazard": "excavation trenching",
      "severity": "high",
      "highRisk": true,
      "missingCompetentPersonReview": true,
      "controlEvidence": "Use caution and wear PPE."
    }
  ]
}
```

Expected result:

- Level: critical.
- Score: at least 81.
- Timeframe: immediate.
- Human approval required: true.
- Top drivers include critical-control gap and high-risk task gap escalation.
- Critical-control gaps include excavation or trenching.
- Control recommendations include competent-person excavation inspection.

## Product Rule

The new platform should make safety risk easy to understand quickly:

- Show the risk badge.
- Show the score.
- Show confidence.
- Show top drivers.
- Show missing information.
- Show critical control gaps.
- Show the next safe step.
- Show whether human review is required.

Do not bury urgent safety issues.

