# My Biotech AI Engine Platform Blueprint

Generated: 2026-05-27  
Purpose: Use this file as the readable blueprint for building a fresh biotech platform around the AI Engine.

This is not customer data. This is not a production config. This is not medical, legal, regulatory, or quality-system approval. It is a clean build guide for a biotech-focused AI platform.

## Core Direction

The new platform is for biotech, not construction.

Keep the engine idea that already works:

- Deterministic scoring first.
- AI explains risk, missing data, and next steps.
- High-risk items escalate.
- Critical items require immediate human review.
- The AI never claims compliance, approval, release, diagnosis, product safety, or regulatory acceptance.

Change the domain:

- Replace jobsites with labs, suites, cleanrooms, manufacturing areas, studies, programs, and batches.
- Replace field hazards with biosafety, contamination, data integrity, quality, regulatory, sample, equipment, trial, and supply-chain risks.
- Replace competent-person review with biosafety officer, QA, quality unit, responsible scientist, principal investigator, manufacturing lead, validation lead, or regulatory affairs review.

## Product Mission

Build an AI platform that helps biotech teams:

- Prevent biosafety and contamination incidents.
- Protect product quality and patient safety.
- Detect data-integrity and documentation risk.
- Manage SOPs, deviations, CAPA, change controls, training, audits, and batch/study readiness.
- Predict operational, quality, and compliance risk before it becomes a failure.
- Give leaders explainable risk intelligence without replacing scientific, QA, regulatory, or clinical judgment.

## Non-Negotiable Principles

- Patient safety, worker safety, biosafety, and product quality come before speed or cost.
- Compliance is the floor, not the ceiling.
- The engine must be transparent and explainable.
- Missing data must be shown clearly.
- High and critical risk must be escalated.
- Critical risk should recommend immediate human review and possible hold, quarantine, stop-use, stop-work, or escalation evaluation.
- AI assists scientists, QA, EHS, biosafety, manufacturing, and regulatory professionals. It does not replace them.
- Do not invent regulatory citations.
- Do not claim GMP, GLP, GCP, FDA, EMA, OSHA, CDC, NIH, ISO, CAP, CLIA, or other compliance unless verified source material is provided.
- Do not diagnose, provide medical advice, approve clinical decisions, or certify product release.

## What To Keep From The Current AI Engine

Keep these proven patterns:

- 0-100 risk scoring.
- Risk levels: low, moderate, high, critical.
- Confidence rating: low, medium, high.
- Top drivers.
- Missing information.
- Human-review flags.
- Guarded explanation text.
- Deterministic rules before LLM output.
- Domain-specific critical controls.
- Tests for escalation and missing-data behavior.
- Draft-only AI coach behavior.

## What To Leave Behind

Do not start the biotech platform with:

- Construction hazard libraries.
- Jobsite-first dashboards.
- Permit-to-work assumptions unless adapted to lab/manufacturing workflows.
- Super Admin complexity.
- Billing.
- Production deployment.
- Live customer data.
- Any AI-generated approval or compliance claim.

## Core Biotech Risk Levels

| Level | Score | Timeframe | Default action |
|---|---:|---|---|
| low | 0-40 | routine | Continue monitoring and document routine controls. |
| moderate | 41-60 | same shift / same business day | Review controls, missing data, and owner follow-up. |
| high | 61-80 | before work, batch, study, or change continues | Escalate to responsible owner and verify controls. |
| critical | 81-100 | immediate | Recommend immediate human review and possible hold, quarantine, stop-use, stop-work, or escalation evaluation. |

## Risk Score Weights

Use deterministic scoring first.

| Input | Weight |
|---|---:|
| severity | 35% |
| likelihood | 20% |
| exposure or scope | 15% |
| control gap | 15% |
| data integrity / confidence concern | 15% |

Why these weights:

- Biotech risk often turns on severity and control state.
- Data integrity matters more here than in a basic operational risk model.
- Scope matters because one issue can affect one sample, a batch, a room, a study, a site, or a product program.

## Required Escalation Overrides

These overrides should raise risk even when the numeric score is lower:

- Potential patient-impacting quality issue becomes at least high.
- Confirmed or suspected product contamination becomes critical until assessed by QA/quality unit.
- Biosafety exposure, release, spill, sharps injury, aerosol event, or containment breach becomes at least high and may become critical.
- Missing chain of custody for critical samples becomes high or critical depending on impact.
- Data integrity concern affecting release, study endpoint, regulatory submission, or batch record becomes high or critical.
- Critical equipment out of tolerance affecting active work becomes high or critical.
- Unapproved change affecting validated process, method, system, assay, cleanroom, or batch becomes high.
- Expired training for critical GxP, biosafety, cleanroom, or assay work increases risk by one band.
- Missing SOP, missing approval, missing deviation, missing CAPA, or overdue CAPA on high-risk work increases risk by one band.
- Repeat deviation pattern across batches, studies, instruments, teams, or sites increases likelihood and confidence.

## Biotech Domain Objects

Start with these objects:

- Organization
- Site
- Lab
- Cleanroom / suite
- Manufacturing area
- Program
- Product candidate
- Study
- Batch / lot
- Sample
- Assay
- Instrument / equipment
- SOP
- Training record
- Deviation
- CAPA
- Change control
- Audit finding
- Environmental monitoring event
- Biosafety incident
- Supplier / material
- Document
- Risk assessment

## Input Contract

Use this starter shape:

```ts
type BioRiskLevel = "low" | "moderate" | "high" | "critical";
type BioAiConfidence = "low" | "medium" | "high";

type BioSignalType =
  | "deviation"
  | "capa"
  | "change_control"
  | "audit_finding"
  | "training_gap"
  | "sop_gap"
  | "biosafety_event"
  | "contamination_event"
  | "environmental_monitoring"
  | "equipment_event"
  | "sample_chain_of_custody"
  | "data_integrity"
  | "batch_record"
  | "assay_qc"
  | "supplier_material"
  | "clinical_study"
  | "regulatory_commitment";

type BioAiSignal = {
  id?: string | null;
  type: BioSignalType;
  label: string;
  area?: string | null;
  program?: string | null;
  productCandidate?: string | null;
  batchOrLot?: string | null;
  sampleId?: string | null;
  assay?: string | null;
  equipmentId?: string | null;
  severity?: number | string | null;
  likelihood?: number | string | null;
  scope?: number | string | null;
  controlGap?: number | string | null;
  dataIntegrityConcern?: number | string | null;
  status?: string | null;
  dueDate?: string | null;
  overdue?: boolean | null;
  repeatFinding?: boolean | null;
  patientImpactPotential?: boolean | null;
  productQualityImpactPotential?: boolean | null;
  biosafetyImpactPotential?: boolean | null;
  regulatoryImpactPotential?: boolean | null;
  gxpImpact?: boolean | null;
  controls?: string[] | null;
  evidence?: string | null;
};

type BioAiInput = {
  organizationId?: string | null;
  siteId?: string | null;
  siteName?: string | null;
  area?: string | null;
  workflow?: string | null;
  program?: string | null;
  productCandidate?: string | null;
  batchOrLot?: string | null;
  studyId?: string | null;
  sampleId?: string | null;
  assay?: string | null;
  equipment?: string[] | null;
  materials?: string[] | null;
  processStage?: string | null;
  controlEffectiveness?: "missing" | "ineffective" | "partial" | "effective" | "unknown" | null;
  dataCompleteness?: number | null;
  missingData?: string[];
  signals?: BioAiSignal[];
  patientImpactPotential?: boolean | null;
  productQualityImpactPotential?: boolean | null;
  biosafetyImpactPotential?: boolean | null;
  regulatoryImpactPotential?: boolean | null;
  gxpImpact?: boolean | null;
  missingRequiredTraining?: boolean | null;
  missingRequiredSop?: boolean | null;
  missingQaReview?: boolean | null;
  missingBiosafetyReview?: boolean | null;
  missingDeviationOrCapa?: boolean | null;
  unapprovedChange?: boolean | null;
  outOfToleranceEquipment?: boolean | null;
  chainOfCustodyGap?: boolean | null;
  contaminationSuspected?: boolean | null;
};
```

## Output Contract

Every engine call should return this:

```ts
type BioAiAssessment = {
  score: number;
  level: BioRiskLevel;
  confidence: BioAiConfidence;
  topDrivers: Array<{
    label: string;
    category:
      | "severity"
      | "likelihood"
      | "scope"
      | "controls"
      | "data_integrity"
      | "biosafety"
      | "quality"
      | "regulatory"
      | "training"
      | "equipment"
      | "sample"
      | "pattern";
    impact: "low" | "medium" | "high" | "critical";
    explanation: string;
  }>;
  missingInformation: string[];
  criticalControlGaps: string[];
  recommendedActions: Array<{
    title: string;
    priority: "low" | "medium" | "high" | "urgent";
    ownerRole:
      | "responsible_scientist"
      | "principal_investigator"
      | "qa"
      | "quality_unit"
      | "biosafety_officer"
      | "ehs"
      | "manufacturing_lead"
      | "validation_lead"
      | "regulatory_affairs"
      | "clinical_operations";
    actionType:
      | "hold_or_quarantine_review"
      | "containment_review"
      | "qa_review"
      | "deviation_or_capa"
      | "change_control"
      | "training_review"
      | "equipment_review"
      | "sample_review"
      | "documentation_review"
      | "monitoring";
    reason: string;
  }>;
  explanation: string;
  escalationRequired: boolean;
  holdOrQuarantineReviewRecommended: boolean;
  humanReviewRequired: boolean;
  humanReviewReason: string | null;
  actionTimeframe: "routine" | "same_day" | "before_continuing" | "immediate";
  doNotClaim: string[];
};
```

## Core Biotech Risk Families

Build these first:

### Biosafety And Containment

Examples:

- Exposure.
- Spill.
- Sharps injury.
- Aerosol-generating event.
- Containment breach.
- Incorrect BSL controls.
- Waste handling issue.

Critical controls:

- Biosafety review.
- Appropriate containment level.
- PPE matched to hazard.
- Spill/exposure response.
- Waste decontamination.
- Incident documentation.
- Medical/EHS escalation when appropriate.

### Contamination And Sterility Assurance

Examples:

- Microbial contamination.
- Cross-contamination.
- Cleanroom excursion.
- Environmental monitoring excursion.
- Sterility concern.
- Aseptic process breach.

Critical controls:

- Segregation or quarantine review.
- QA review.
- Environmental monitoring assessment.
- Cleaning/disinfection verification.
- Batch/sample impact assessment.
- Deviation and CAPA workflow.

### Product Quality And Batch Risk

Examples:

- Batch record discrepancy.
- Process deviation.
- Critical process parameter excursion.
- Material mix-up.
- Labeling issue.
- Release-impacting discrepancy.

Critical controls:

- Batch hold or QA disposition review.
- Deviation record.
- Impact assessment.
- Material traceability.
- Second-person verification where required by SOP.
- CAPA when systemic.

### Data Integrity

Examples:

- Missing raw data.
- Unattributable entry.
- Backdated record concern.
- Audit trail gap.
- Uncontrolled spreadsheet.
- Invalidated assay without rationale.
- Missing review signature.

Critical controls:

- Preserve records.
- QA/data owner review.
- Audit trail review.
- Document correction under controlled process.
- Do not overwrite or recreate source data.
- Escalate if release, endpoint, or submission could be affected.

### Sample Integrity And Chain Of Custody

Examples:

- Unknown sample identity.
- Missing chain of custody.
- Temperature excursion.
- Label mismatch.
- Missing storage record.
- Sample mix-up.

Critical controls:

- Quarantine or hold affected sample/material.
- Chain-of-custody reconstruction by authorized owner.
- Temperature/log review.
- Identity confirmation.
- Impact assessment before use.

### Equipment, Calibration, And Validation

Examples:

- Out-of-calibration instrument.
- Failed qualification.
- Maintenance overdue.
- Invalidated system.
- Alarm ignored.
- Critical freezer/incubator excursion.

Critical controls:

- Stop-use or restricted-use review.
- QA/validation assessment.
- Impact assessment for affected data, samples, batches, or studies.
- Calibration or qualification evidence.
- Deviation/CAPA if required.

### SOP, Training, And Readiness

Examples:

- Expired training.
- Missing SOP.
- Unapproved procedure.
- Wrong SOP revision.
- Work performed before training completion.

Critical controls:

- Training verification.
- Current approved SOP.
- Supervisor or QA review.
- Work impact assessment if already performed.
- Documentation of remediation.

### Change Control And Validation

Examples:

- Unapproved process change.
- Method change.
- System configuration change.
- Facility or cleanroom change.
- Supplier/material change.
- Assay acceptance criteria change.

Critical controls:

- Change control review.
- Validation or qualification impact assessment.
- QA approval where required.
- Regulatory impact assessment when applicable.
- Implementation controls.

### Supplier And Material Risk

Examples:

- Supplier quality issue.
- Material CoA mismatch.
- Expired material.
- Temperature excursion in transit.
- Unapproved supplier.
- Incoming inspection failure.

Critical controls:

- Material quarantine review.
- Supplier quality assessment.
- CoA and traceability review.
- Impact assessment for affected batches/studies.
- QA disposition.

### Clinical Study Or Patient-Impacting Risk

Examples:

- Protocol deviation.
- Informed consent issue.
- Endpoint data concern.
- Sample mismatch.
- Safety event documentation gap.
- Clinical supply quality concern.

Critical controls:

- Clinical operations review.
- PI or medical monitor escalation when applicable.
- QA/regulatory review.
- Preserve source records.
- Assess patient safety and data integrity impact.

## AI Guardrails

The AI must never say:

- This batch is released.
- This product is safe.
- This study is compliant.
- This deviation is closed.
- This CAPA is adequate.
- This SOP is approved.
- This change is approved.
- This data is valid for submission.
- This clinical decision is appropriate.
- FDA/EMA/NIH/CDC/OSHA/ISO/CLIA/CAP compliance is guaranteed.

The AI may say:

- Based on available data.
- Potential risk.
- Needs QA review.
- Needs biosafety review.
- Needs responsible-scientist review.
- Missing information includes...
- Suggested draft next steps.
- Consider hold or quarantine review.
- Consider stop-use review.
- This does not replace quality, regulatory, biosafety, clinical, or scientific judgment.

## AI Coach Role

The biotech AI coach should be a calm technical assistant.

It can:

- Explain risks.
- Draft questions.
- Summarize deviations.
- Identify missing information.
- Suggest draft controls.
- Prepare review packets.
- Help triage CAPA, change control, SOP, training, sample, batch, and equipment risks.

It cannot:

- Approve.
- Release.
- Close.
- Certify.
- Diagnose.
- Prescribe.
- Submit regulatory decisions.
- Replace QA, PI, biosafety, EHS, regulatory, clinical, validation, or manufacturing authority.

Coach response order:

1. State the concern.
2. Explain why it matters.
3. List missing information.
4. Recommend the owner for review.
5. Give draft next steps.

## Recommended Build Order

1. Create TypeScript contracts.
2. Build deterministic scoring.
3. Build risk band classifier.
4. Build missing-data detector.
5. Build biotech risk family matcher.
6. Build escalation overrides.
7. Build top risk drivers.
8. Build recommended actions.
9. Build guarded explanations.
10. Build tests.
11. Build a simple engine workbench page.
12. Add saved assessments.
13. Add audit logs.
14. Add document/SOP intelligence.
15. Add deviation/CAPA intelligence.
16. Add batch/sample/equipment intelligence.
17. Add AI coach.
18. Add dashboards.
19. Add admin monitoring.
20. Add LLM providers only after deterministic rules are proven.

## Tests To Build First

- Low-risk complete data stays low.
- Missing data lowers confidence.
- Suspected contamination becomes critical.
- Biosafety exposure becomes high or critical.
- Patient-impacting quality issue becomes at least high.
- Data-integrity issue affecting release or submission becomes high or critical.
- Missing chain of custody escalates sample risk.
- Out-of-calibration equipment affecting active work escalates risk.
- Unapproved validated-process change escalates risk.
- Expired critical training increases risk by one band.
- Repeat deviation pattern increases likelihood.
- Strong documented controls prevent false critical escalation.
- AI explanation includes missing information.
- AI never claims compliance or approval.
- AI never releases batch, closes deviation, approves CAPA, or certifies data.

## Starter Sample Input

```json
{
  "siteName": "Demo Biotech Site",
  "area": "QC Microbiology Lab",
  "workflow": "Sterility assay review",
  "program": "Demo Program",
  "productCandidate": "BIO-001",
  "batchOrLot": "LOT-0001",
  "controlEffectiveness": "partial",
  "contaminationSuspected": true,
  "productQualityImpactPotential": true,
  "gxpImpact": true,
  "signals": [
    {
      "type": "contamination_event",
      "label": "Unexpected microbial growth in assay control",
      "severity": "high",
      "status": "open",
      "productQualityImpactPotential": true,
      "gxpImpact": true,
      "controls": ["Initial lab notification completed"],
      "evidence": "Assay control showed unexpected growth; investigation not complete."
    },
    {
      "type": "data_integrity",
      "label": "Missing second-person review signature",
      "severity": "medium",
      "status": "open",
      "dataIntegrityConcern": 4,
      "evidence": "Review signature missing from assay worksheet."
    }
  ]
}
```

Expected output:

- Level: critical.
- Confidence: medium or low if investigation details are missing.
- Human review required: true.
- Hold or quarantine review recommended: true.
- Top drivers include contamination, product quality impact, data integrity, and control gap.
- Missing information includes investigation status, QA assessment, batch/sample impact, and final disposition.
- Recommended owner includes QA or quality unit.
- AI does not say the batch is released, compliant, safe, or acceptable.

## First Screen Of The New Platform

Do not make the first screen a marketing landing page.

Make the first screen the AI Engine Workbench:

- Intake panel.
- Risk score.
- Risk badge.
- Confidence.
- Top drivers.
- Missing information.
- Critical control gaps.
- Recommended owner.
- Draft next steps.
- Human-review required indicator.
- Audit log preview.

## Product Rule

The platform should make biotech risk easy to understand quickly.

Every risk output should answer:

- What is the issue?
- What could it affect?
- How severe could it be?
- What data is missing?
- What controls are missing or unverified?
- Who needs to review it?
- What should happen before work, batch, study, sample, or change continues?

