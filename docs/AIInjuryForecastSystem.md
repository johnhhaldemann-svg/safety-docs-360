# AI Injury Forecast System — Reference Architecture

This document is the **target** layered architecture for the **AI Injury Forecast** capability (also referred to in-product as Injury Weather / predictive risk). It is a **roadmap and vocabulary** for data, features, deterministic engines, AI review, outputs, and auditability.

**Current implementation** is partial: see `lib/injuryWeather/` (`riskModel.ts`, `service.ts`, `ai.ts`, `dataConfidence.ts`, `backtest.ts`) and UI under `components/injury-weather/`. This file does not imply every node below exists in code yet.

## Hybrid model (deterministic evidence + AI final review)

**Deterministic engines** (through feature engineering and `DeterministicEvidence`) prepare **structured risk evidence**, numeric factors, and baselines. They **do not** stand alone as the final forecast authority for narrative, labels, or user-facing “why” — that role belongs to **AI final review**.

**AI final review** is the **final contextual predictor**: it consumes **only** the master evidence pack (plus explicit guardrails), and produces the structured forecast object (`AIFinalPrediction` in `lib/injuryWeather/types.ts`), including explanation, unknowns, and preventive recommendations. Deterministic math remains reproducible and auditable; AI output must be traceable to evidence fields, not free invention.

## Ten core layers (summary)

| # | Layer | Purpose |
|---|--------|---------|
| 1 | Data ingestion | Pull historical incidents, live observations, actions, exposure, environment, planning/training |
| 2 | Normalization | Canonical units, codes, time windows, scope alignment |
| 3 | Feature engineering | Signals, trends, blends, weather/exposure features for engines |
| 4 | Deterministic evidence engines | Baseline, loss pressure, leading indicators, environment, exposure, controls, pattern alignment, confidence evidence |
| 5 | Evidence pack builder | Assemble `ForecastContext` + `DeterministicEvidence` (+ guardrails) for the model |
| 6 | AI final review | Final prediction, narrative, drivers, actions — **only step that emits the AI forecast object** |
| 7 | Risk classification | Map outputs to policy/UI bands; keep aligned with evidence-backed story |
| 8 | Output generation | Dashboard, advisor, exports |
| 9 | Auditability and safety | Trails, versioning, no-guarantee language, evidence-linked reasoning |
| 10 | Backtesting and feedback loop | Compare forecasts to outcomes, calibration, prompt/weight learning |

The ASCII tree below uses **layer 10** as the **end-to-end execution orchestration** (steps 1–17); **backtesting and feedback** are the substantive “layer 10” capability in the table above and map to **§9.3 Feedback loop**, **§8.5 exports**, and `backtest.ts`.

## Non-negotiable requirements

- **No observations ≠ no risk** — Absence of live rows does not zero risk; baseline and historical patterns still apply (`baseline_only` mode lowers *confidence*, not hazard by fiat).
- **Risk level and confidence are separate axes** — Do not treat “low confidence” as “low risk”; document both (`dataConfidence`, `forecastConfidenceScore`, vs `overallRiskLevel` / AI headline).
- **AI must not invent facts** — Names, counts, dates, and claims must come from structured evidence; validation/guardrails reject ungrounded text where implemented.
- **AI must only use structured evidence provided** — Evidence pack + allowed rubric fields; no unsourced domain facts.
- **AI must explain why the forecast was made** — Narrative sections tie to month, trade mix, signals, and unknowns (`explanationNarrative`, `whyThisMonthMatters`, etc.).
- **AI must recommend preventive actions** — `recommendedActions` and `recommendedInspectionFocus` are required product outputs, not optional fluff.

---

```
AIInjuryForecastSystem
│
├── 1. DataIngestionLayer
│   │
│   ├── 1.1 HistoricalIncidentData
│   │   ├── IncidentId
│   │   ├── IncidentDate
│   │   ├── IncidentMonth
│   │   ├── IncidentSeason
│   │   ├── IncidentYear
│   │   ├── Trade
│   │   ├── SubTrade
│   │   ├── WorkActivity
│   │   ├── InjuryType
│   │   ├── InjuryCategory
│   │   ├── SeverityLevel
│   │   ├── BodyPart
│   │   ├── RootCause
│   │   ├── ContributingFactors
│   │   ├── WeatherContext
│   │   ├── Location
│   │   ├── State
│   │   ├── HoursWorkedAtTime
│   │   ├── CrewSize
│   │   ├── ExperienceLevel
│   │   ├── TimeOfDay
│   │   ├── ShiftType
│   │   └── CorrectiveActionFollowUp
│   │
│   ├── 1.2 LiveObservationData
│   │   ├── SORId
│   │   ├── ObservationDate
│   │   ├── ObservationMonth
│   │   ├── ObservationWeek
│   │   ├── ObservationDay
│   │   ├── Trade
│   │   ├── SubTrade
│   │   ├── WorkArea
│   │   ├── ObservationCategory
│   │   ├── ObservationSubCategory
│   │   ├── HazardType
│   │   ├── RiskLevel
│   │   ├── SeverityPotential
│   │   ├── RepeatedIssue
│   │   ├── UnsafeBehavior
│   │   ├── UnsafeCondition
│   │   ├── PositiveObservation
│   │   ├── Description
│   │   ├── LinkedPermitType
│   │   ├── LinkedDAP
│   │   ├── SupervisorPresent
│   │   ├── CrewPresent
│   │   ├── PhotoEvidence
│   │   └── ClosedOrOpenStatus
│   │
│   ├── 1.3 CorrectiveActionData
│   │   ├── ActionId
│   │   ├── SourceObservationId
│   │   ├── ActionType
│   │   ├── AssignedTo
│   │   ├── DueDate
│   │   ├── CompletionDate
│   │   ├── Status
│   │   ├── OverdueFlag
│   │   ├── CriticalActionFlag
│   │   ├── VerificationRequired
│   │   ├── VerifiedBy
│   │   └── RepeatLinkedHazard
│   │
│   ├── 1.4 WorkforceExposureData
│   │   ├── Date
│   │   ├── Project
│   │   ├── Trade
│   │   ├── HoursWorked
│   │   ├── OvertimeHours
│   │   ├── CrewSize
│   │   ├── NewWorkerCount
│   │   ├── NewWorkerRatio
│   │   ├── ExperienceMix
│   │   ├── ShiftLength
│   │   ├── ConsecutiveDaysWorked
│   │   ├── NightShiftFlag
│   │   └── SubcontractorMix
│   │
│   ├── 1.5 EnvironmentalData
│   │   ├── Date
│   │   ├── State
│   │   ├── Location
│   │   ├── Temperature
│   │   ├── HeatIndex
│   │   ├── WindSpeed
│   │   ├── GustSpeed
│   │   ├── Humidity
│   │   ├── Rain
│   │   ├── Snow
│   │   ├── IceFlag
│   │   ├── StormFlag
│   │   ├── Visibility
│   │   ├── SurfaceCondition
│   │   └── WeatherRiskType
│   │
│   ├── 1.6 PlanningAndControlData
│   │   ├── PermitRecords
│   │   │   ├── HotWorkPermit
│   │   │   ├── ElectricalPermit
│   │   │   ├── TrenchingPermit
│   │   │   ├── LadderPermit
│   │   │   ├── MotionPermit
│   │   │   ├── GravityPermit
│   │   │   ├── AWP_MEWP
│   │   │   ├── ChemicalPermit
│   │   │   └── OtherCriticalControlPermits
│   │   │
│   │   ├── DAPRecords
│   │   │   ├── ActivitySectionScore
│   │   │   ├── HazardSectionScore
│   │   │   ├── MitigationSectionScore
│   │   │   ├── ImplementationSectionScore
│   │   │   ├── TotalScore
│   │   │   ├── MissingPermitCount
│   │   │   ├── MissingSignatureCount
│   │   │   ├── PlanningQualityFlag
│   │   │   └── RepeatedPlanningFailureFlag
│   │   │
│   │   └── TrainingRecords
│   │       ├── WorkerId
│   │       ├── Trade
│   │       ├── RequiredTraining
│   │       ├── TrainingComplete
│   │       ├── ExpirationDate
│   │       ├── GapFlag
│   │       ├── CriticalTrainingGapFlag
│   │       └── CertificationStatus
│   │
│   └── 1.7 ExternalBenchmarkData
│       ├── NationalHistoricalTrends
│       ├── MonthBasedInjuryPatterns
│       ├── SeasonalRiskPatterns
│       ├── TradeRiskBenchmarks
│       ├── InjuryTypeBenchmarks
│       └── StateOrRegionAdjustmentFactors
│
├── 2. DataNormalizationLayer
│   │
│   ├── 2.1 DateNormalization
│   │   ├── ResolveMonthFromDate
│   │   ├── ResolveSeasonFromMonth
│   │   ├── ResolveWeekWindow
│   │   ├── ResolveTrailing30Days
│   │   ├── ResolveTrailing90Days
│   │   ├── ResolveTrailing12Months
│   │   └── ResolveForecastMonth
│   │
│   ├── 2.2 ExposureNormalization
│   │   ├── NormalizeByHoursWorked
│   │   ├── NormalizeByCrewSize
│   │   ├── NormalizeByTradePresence
│   │   ├── NormalizeByProjectVolume
│   │   ├── NormalizeByObservationVolume
│   │   └── NormalizeByWorkIntensity
│   │
│   ├── 2.3 CategoryNormalization
│   │   ├── MapObservationToHazardFamily
│   │   ├── MapIncidentToInjuryFamily
│   │   ├── MapTradeAliasesToMasterTrade
│   │   ├── MapSeverityToNumericScale
│   │   ├── MapPermitTypeToRiskControl
│   │   ├── MapWeatherToRiskCondition
│   │   └── MapRootCauseToBehaviorOrCondition
│   │
│   ├── 2.4 DataQualityNormalization
│   │   ├── RemoveDuplicateEvents
│   │   ├── HandleMissingFields
│   │   ├── ScoreDataCompleteness
│   │   ├── FlagWeakRecords
│   │   ├── FlagUnverifiedRecords
│   │   └── BuildConfidenceInputs
│   │
│   └── 2.5 TimeWindowPreparation
│       ├── CurrentWeekDataset
│       ├── CurrentMonthDataset
│       ├── Last30DayDataset
│       ├── Last90DayDataset
│       ├── Last12MonthDataset
│       ├── HistoricalByMonthDataset
│       ├── HistoricalBySeasonDataset
│       └── ForecastHorizonDataset
│
├── 3. FeatureEngineeringLayer
│   │
│   ├── 3.1 HistoricalPatternFeatures
│   │   ├── IncidentFrequencyByMonth
│   │   ├── IncidentFrequencyBySeason
│   │   ├── InjuryTypeByMonth
│   │   ├── InjuryTypeBySeason
│   │   ├── TradeSpecificIncidentFrequency
│   │   ├── SeverityWeightedFrequency
│   │   ├── RepeatCategoryFrequency
│   │   ├── TrendMomentum3Month
│   │   ├── TrendMomentum6Month
│   │   ├── TrendMomentum12Month
│   │   ├── HistoricalTopDrivers
│   │   └── HistoricalExpectedRiskForSelectedContext
│   │
│   ├── 3.2 LeadingIndicatorFeatures
│   │   ├── HighRiskObservationCount
│   │   ├── CriticalObservationCount
│   │   ├── ObservationRatePer1000Hours
│   │   ├── RepeatHazardCount
│   │   ├── RepeatBehaviorCount
│   │   ├── NearMissCount
│   │   ├── UnsafeConditionCount
│   │   ├── UnsafeBehaviorCount
│   │   ├── PositiveObservationRatio
│   │   ├── OpenActionCount
│   │   ├── OverdueActionCount
│   │   ├── CriticalOverdueActionCount
│   │   ├── PermitFailureCount
│   │   ├── DAPFailureCount
│   │   ├── MissingPermitSignalCount
│   │   ├── MissingSignatureSignalCount
│   │   ├── TrainingGapCount
│   │   ├── CriticalTrainingGapCount
│   │   └── InspectionFindingPressure
│   │
│   ├── 3.3 WorkforceBehaviorFeatures
│   │   ├── FatigueSignal
│   │   │   ├── OvertimePressure
│   │   │   ├── ConsecutiveDayPressure
│   │   │   ├── LongShiftPressure
│   │   │   └── HeatPlusOvertimePressure
│   │   │
│   │   ├── NewWorkerExposureSignal
│   │   ├── ExperienceMixSignal
│   │   ├── CrewTurnoverSignal
│   │   ├── SupervisorCoverageSignal
│   │   ├── RushingPressureSignal
│   │   ├── ProductionPressureSignal
│   │   └── BehavioralEscalationSignal
│   │
│   ├── 3.4 EnvironmentalFeatures
│   │   ├── HeatRiskSignal
│   │   ├── ColdStressSignal
│   │   ├── WindRiskSignal
│   │   ├── SlipConditionSignal
│   │   ├── StormExposureSignal
│   │   ├── VisibilityRiskSignal
│   │   ├── SurfaceInstabilitySignal
│   │   └── WeatherAdjustedWorkPressure
│   │
│   ├── 3.5 TradeAndActivityFeatures
│   │   ├── SelectedTradeRiskWeight
│   │   ├── MultiTradeInteractionRisk
│   │   ├── ElevatedWorkRisk
│   │   ├── ElectricalExposureRisk
│   │   ├── HotWorkRisk
│   │   ├── ExcavationRisk
│   │   ├── MaterialHandlingRisk
│   │   ├── MobileEquipmentRisk
│   │   ├── ConfinedSpaceRisk
│   │   ├── TemporaryPowerRisk
│   │   ├── ScaffoldRisk
│   │   ├── LadderRisk
│   │   ├── CraneRiggingRisk
│   │   └── TaskComplexitySignal
│   │
│   └── 3.6 ForecastReadinessFeatures
│       ├── DataCoverageScore
│       ├── LiveSignalCoverageScore
│       ├── HistoricalDepthScore
│       ├── CategoryConsistencyScore
│       ├── ExposureCompletenessScore
│       └── ForecastConfidenceInputs
│
├── 4. DeterministicEvidenceEngine
│   │
│   ├── 4.1 BaselineRiskEngine
│   │   ├── BuildHistoricalBaseline
│   │   │   ├── MonthWeight
│   │   │   ├── SeasonWeight
│   │   │   ├── TradeWeight
│   │   │   ├── ActivityWeight
│   │   │   ├── InjuryTypeWeight
│   │   │   ├── StateWeight
│   │   │   └── ExposureWeight
│   │   │
│   │   ├── BuildExpectedRiskRange
│   │   ├── BuildBaselineNarrativeInputs
│   │   └── BuildBaselineEvidenceObject
│   │
│   ├── 4.2 LossPressureEngine
│   │   ├── CalculateRecentFrequencyPressure
│   │   ├── CalculateSeverityPressure
│   │   ├── CalculateRecurrencePressure
│   │   ├── CalculateMomentumPressure
│   │   ├── CalculateInjuryTypeResurgence
│   │   └── BuildLossPressureEvidenceObject
│   │
│   ├── 4.3 LeadingIndicatorPressureEngine
│   │   ├── CalculateObservationPressure
│   │   ├── CalculateOpenActionPressure
│   │   ├── CalculateOverdueActionPressure
│   │   ├── CalculatePermitFailurePressure
│   │   ├── CalculateDAPPlanningPressure
│   │   ├── CalculateTrainingGapPressure
│   │   ├── CalculateRepeatHazardPressure
│   │   ├── CalculateBehavioralPressure
│   │   └── BuildLeadingIndicatorEvidenceObject
│   │
│   ├── 4.4 EnvironmentalPressureEngine
│   │   ├── CalculateHeatPressure
│   │   ├── CalculateColdPressure
│   │   ├── CalculateWindPressure
│   │   ├── CalculateSlipPressure
│   │   ├── CalculateStormPressure
│   │   ├── CalculateVisibilityPressure
│   │   └── BuildEnvironmentalEvidenceObject
│   │
│   ├── 4.5 ExposurePressureEngine
│   │   ├── CalculateHoursWorkedPressure
│   │   ├── CalculateOvertimePressure
│   │   ├── CalculateNewWorkerPressure
│   │   ├── CalculateWorkAtHeightPressure
│   │   ├── CalculateElectricalExposurePressure
│   │   ├── CalculateMobileEquipmentPressure
│   │   ├── CalculateExcavationPressure
│   │   ├── CalculateMultiTradeInterferencePressure
│   │   └── BuildExposureEvidenceObject
│   │
│   ├── 4.6 ControlEffectivenessEngine
│   │   ├── MeasurePermitComplianceStrength
│   │   ├── MeasureDAPQualityStrength
│   │   ├── MeasureCorrectiveActionClosureStrength
│   │   ├── MeasureTrainingComplianceStrength
│   │   ├── MeasureSupervisorCoverageStrength
│   │   ├── MeasureInspectionCadenceStrength
│   │   └── BuildControlEffectivenessEvidenceObject
│   │
│   ├── 4.7 PatternAlignmentEngine
│   │   ├── CompareLiveSignalsToHistoricalMonthPatterns
│   │   ├── CompareLiveSignalsToSeasonalPatterns
│   │   ├── CompareTradeSignalsToKnownTradePatterns
│   │   ├── CompareEnvironmentalSignalsToKnownInjuryTypes
│   │   ├── CompareBehaviorSignalsToPriorIncidentDrivers
│   │   ├── DetectConvergingRiskSignals
│   │   ├── DetectContradictorySignals
│   │   └── BuildPatternAlignmentEvidenceObject
│   │
│   └── 4.8 ConfidenceEngine
│       ├── CalculateDataCompletenessConfidence
│       ├── CalculateHistoryDepthConfidence
│       ├── CalculateSignalCoverageConfidence
│       ├── CalculateClassificationConfidence
│       ├── CalculateForecastReliabilityBand
│       └── BuildConfidenceEvidenceObject
│
├── 5. EvidencePackBuilder
│   │
│   ├── 5.1 MasterEvidencePack
│   │   ├── ForecastContext
│   │   │   ├── SelectedMonth
│   │   │   ├── SelectedProject
│   │   │   ├── SelectedState
│   │   │   ├── SelectedTrades
│   │   │   ├── ForecastWindow
│   │   │   └── HoursWorkedContext
│   │   │
│   │   ├── BaselineEvidence
│   │   ├── LossPressureEvidence
│   │   ├── LeadingIndicatorEvidence
│   │   ├── EnvironmentalEvidence
│   │   ├── ExposureEvidence
│   │   ├── ControlEffectivenessEvidence
│   │   ├── PatternAlignmentEvidence
│   │   ├── ConfidenceEvidence
│   │   └── RecommendedGuardrailsForAI
│   │
│   ├── 5.2 DerivedSummaryObjects
│   │   ├── TopRiskDrivers
│   │   ├── TopProtectiveDrivers
│   │   ├── MostLikelyInjuryFamilies
│   │   ├── MostRelevantHazardFamilies
│   │   ├── UnresolvedCriticalControls
│   │   ├── BehavioralPressureSummary
│   │   ├── HistoricalMatchSummary
│   │   ├── TradeSpecificPressureSummary
│   │   └── EnvironmentalPressureSummary
│   │
│   └── 5.3 AIReadyPayload
│       ├── StructuredFactsOnly
│       ├── NoUnsupportedClaims
│       ├── MustMentionUncertaintyIfConfidenceLow
│       ├── MustPreferEvidenceOverGuessing
│       ├── MustReturnPredictionObject
│       └── MustReturnReasoningLinkedToInputs
│
├── 6. AIFinalReviewLayer
│   │
│   ├── 6.1 AIReviewObjective
│   │   ├── ReviewAllStructuredEvidence
│   │   ├── DetermineMostLikelyRiskLevel
│   │   ├── DetermineMostLikelyInjuryType
│   │   ├── DetermineConfidenceLevel
│   │   ├── IdentifyTopRiskDrivers
│   │   ├── IdentifyTopProtectiveDrivers
│   │   ├── ExplainWhyPredictionWasMade
│   │   └── RecommendPreventiveActions
│   │
│   ├── 6.2 AIReviewRules
│   │   ├── DoNotInventFacts
│   │   ├── DoNotIgnoreLowConfidenceSignals
│   │   ├── DoNotTreatNoDataAsNoRisk
│   │   ├── UseBaselineIfLiveDataIsWeak
│   │   ├── PreferConvergingSignalsOverSingleSignals
│   │   ├── WeighRepeatedSignalsHigherThanOneOffSignals
│   │   ├── TreatOverdueCriticalControlsAsEscalators
│   │   ├── WeighHistoricalMatchAsContextNotProof
│   │   ├── SeparateRiskLevelFromConfidence
│   │   └── OutputUncertaintyWhenNeeded
│   │
│   ├── 6.3 AIReviewDecisionFlow
│   │   ├── Step1_ReadForecastContext
│   │   ├── Step2_ReadHistoricalBaselineEvidence
│   │   ├── Step3_ReadRecentLossPressureEvidence
│   │   ├── Step4_ReadLeadingIndicatorEvidence
│   │   ├── Step5_ReadEnvironmentalAndExposureEvidence
│   │   ├── Step6_ReadControlEffectivenessEvidence
│   │   ├── Step7_ReadPatternAlignmentEvidence
│   │   ├── Step8_ReadConfidenceEvidence
│   │   ├── Step9_DetermineLikelyIncidentPressure
│   │   ├── Step10_DetermineLikelyInjuryFamily
│   │   ├── Step11_DetermineConfidenceLevel
│   │   ├── Step12_SelectTop3To5Drivers
│   │   ├── Step13_SelectTopProtectiveFactors
│   │   ├── Step14_WritePredictionNarrative
│   │   └── Step15_WriteActionRecommendations
│   │
│   └── 6.4 AIOutputObject
│       ├── PredictedRiskLevel
│       ├── PredictedRiskScoreBand
│       ├── LikelyInjuryType
│       ├── SecondaryLikelyInjuryType
│       ├── ConfidenceLevel
│       ├── ForecastMode
│       │   ├── BaselineOnly
│       │   ├── BaselinePlusSignals
│       │   ├── StrongSignalForecast
│       │   └── LimitedDataForecast
│       │
│       ├── TopRiskDrivers[]
│       ├── TopProtectiveDrivers[]
│       ├── ExplanationNarrative
│       ├── WhyThisMonthMatters
│       ├── WhyThisTradeMixMatters
│       ├── WhyCurrentSignalsMatter
│       ├── CriticalUnknowns[]
│       ├── RecommendedActions[]
│       └── RecommendedInspectionFocus[]
│
├── 7. RiskClassificationLayer
│   │
│   ├── 7.1 RiskLevelDefinitions
│   │   ├── Low
│   │   │   ├── BaselineRiskPresent
│   │   │   ├── FewEscalatingSignals
│   │   │   ├── ControlsMostlyEffective
│   │   │   └── NoStrongConvergingPressure
│   │   │
│   │   ├── Moderate
│   │   │   ├── BaselineRiskPresent
│   │   │   ├── SomeRelevantSignals
│   │   │   ├── SomeControlWeakness
│   │   │   └── ManageableButActivePressure
│   │   │
│   │   ├── Elevated
│   │   │   ├── MultipleSignalsConverging
│   │   │   ├── HistoricalPatternMatchVisible
│   │   │   ├── OneOrMoreControlWeaknesses
│   │   │   └── IncreasedLikelihoodWithoutIntervention
│   │   │
│   │   ├── High
│   │   │   ├── StrongConvergingSignals
│   │   │   ├── UnresolvedCriticalControls
│   │   │   ├── SignificantExposurePresent
│   │   │   └── HighLikelihoodOfIncidentPressure
│   │   │
│   │   └── Critical
│   │       ├── SevereConvergingSignals
│   │       ├── MultipleCriticalControlFailures
│   │       ├── StrongHistoricalAndLiveAlignment
│   │       └── ImmediateInterventionRequired
│   │
│   └── 7.2 ConfidenceDefinitions
│       ├── LowConfidence
│       │   ├── SparseLiveData
│       │   ├── SparseHistoricalDepth
│       │   ├── WeakExposureData
│       │   └── IncompleteClassification
│       │
│       ├── MediumConfidence
│       │   ├── SufficientEvidence
│       │   ├── SomeGapsRemain
│       │   └── GeneralForecastUsable
│       │
│       └── HighConfidence
│           ├── StrongLiveCoverage
│           ├── StrongHistoricalAlignment
│           ├── StrongExposureData
│           └── StableClassificationAndControlsData
│
├── 8. OutputGenerationLayer
│   │
│   ├── 8.1 DashboardOutput
│   │   ├── OverallRiskLevelCard
│   │   ├── ConfidenceCard
│   │   ├── Next30DayLikelihoodCard
│   │   ├── EstimatedInjuryExposureCard
│   │   ├── TopRiskDriversPanel
│   │   ├── AIAdvisorPanel
│   │   ├── TradeForecastCards
│   │   ├── PriorityThemesPanel
│   │   ├── RecommendedActionsPanel
│   │   ├── TrendChartPanel
│   │   └── ForecastModeBanner
│   │
│   ├── 8.2 AIAdvisorOutput
│   │   ├── SummaryStatement
│   │   ├── WhyRiskIsAtThisLevel
│   │   ├── LikelyInjuryPath
│   │   ├── ThisMonthSeasonalReasoning
│   │   ├── TradeReasoning
│   │   ├── LiveSignalReasoning
│   │   ├── ControlWeaknessReasoning
│   │   ├── ConfidenceExplanation
│   │   └── ImmediateFocusAreas
│   │
│   ├── 8.3 TradeSpecificOutput
│   │   ├── TradeRiskLevel
│   │   ├── TradeTopDrivers
│   │   ├── TradeLikelyInjuryType
│   │   ├── TradeControlsToReview
│   │   └── TradeConfidenceLevel
│   │
│   ├── 8.4 ExplainabilityOutput
│   │   ├── BaselineContribution
│   │   ├── LiveSignalContribution
│   │   ├── EnvironmentalContribution
│   │   ├── ExposureContribution
│   │   ├── ControlWeaknessContribution
│   │   ├── PatternAlignmentContribution
│   │   └── UnknownsAndLimitations
│   │
│   └── 8.5 ExportOutput
│       ├── JSONSnapshot
│       ├── ReportNarrative
│       ├── ExecutiveSummary
│       ├── TechnicalEvidencePack
│       └── AuditTrailObject
│
├── 9. AuditabilityAndSafetyLayer
│   │
│   ├── 9.1 PredictionAuditTrail
│   │   ├── InputSnapshot
│   │   ├── NormalizedFeaturesSnapshot
│   │   ├── DeterministicEvidenceSnapshot
│   │   ├── AIInputPayload
│   │   ├── AIOutputPayload
│   │   ├── Timestamp
│   │   └── VersionedPromptAndModelInfo
│   │
│   ├── 9.2 Guardrails
│   │   ├── NoGuaranteedPredictionLanguage
│   │   ├── NoClaimThatInjuryWillOccur
│   │   ├── RequireRiskFramingOnly
│   │   ├── RequireConfidenceDisclosure
│   │   ├── RequireEvidenceLinkedReasoning
│   │   └── RequirePreventiveActionOutput
│   │
│   └── 9.3 FeedbackLoop
│       ├── CaptureActualOutcomeNextMonth
│       ├── ComparePredictionToOutcome
│       ├── RecordFalsePositive
│       ├── RecordFalseNegative
│       ├── RecordCorrectPrediction
│       ├── UpdatePatternWeights
│       ├── UpdateAIReviewPromptStrategy
│       └── ImproveTradeSpecificForecasting
│
└── 10. ForecastExecutionFlow
    │
    ├── Step01_LoadContext
    ├── Step02_LoadHistoricalData
    ├── Step03_LoadLiveSignals
    ├── Step04_LoadCorrectiveActions
    ├── Step05_LoadExposureData
    ├── Step06_LoadEnvironmentalData
    ├── Step07_LoadPlanningAndTrainingData
    ├── Step08_NormalizeAllInputs
    ├── Step09_CreateFeatures
    ├── Step10_RunDeterministicEvidenceEngines
    ├── Step11_BuildMasterEvidencePack
    ├── Step12_SendEvidencePackToAIReviewer
    ├── Step13_AIProducesFinalPrediction
    ├── Step14_ClassifyRiskAndConfidence
    ├── Step15_GenerateDashboardOutputs
    ├── Step16_SaveAuditTrail
    └── Step17_StoreForBacktestingAndLearning
```

---

## Implementation sketch (repo today)

| Architecture layer | Rough mapping in this codebase |
|-------------------|--------------------------------|
| 1 — Ingestion | `service.ts` live fetches (SOR, corrective actions, incidents); seed workbook; optional workforce/hours |
| 2 — Normalization | Month filters, trade filters, exposure denominators, `normalizeBehaviorSignals` / `normalizeWorkSchedule` |
| 3 — Features | Structural blend inputs, trend/momentum, trade mix, `locationWeather` |
| 4 — Deterministic | `riskModel.ts` (baseline engine, overlay, predicted risk product, trend validation) |
| 5 — Evidence pack | `computeAiContext` / grounding in `ai.ts`; not a full MasterEvidencePack yet |
| 6 — AI review | `generateInjuryWeatherAiInsights`, prompt + guards |
| 7 — Classification | `riskLevelFromStructuralScore`, `dataConfidence` / `forecastConfidenceScore` |
| 8 — Output | `InjuryWeatherDashboard.tsx`, exports |
| 9 — Audit | `riskModelVersion`, JSON export, daily snapshot table; full audit trail TBD |
| 10 — Backtest & feedback | `backtest.ts`, backtest runs/history, feedback loop (§9.3); orchestration: `getInjuryWeatherDashboardData` → dashboard / AI |
