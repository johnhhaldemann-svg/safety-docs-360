"use client";

import Link from "next/link";
import {
  FAILED_CONTROL_CODES,
  PERMIT_STATUS_SUMMARY_CODES,
  PPE_STATUS_SUMMARY_CODES,
  ROOT_CAUSE_LEVEL1,
  ROOT_CAUSE_LEVEL2_BY_L1,
  SCOPE_OF_WORK_CODES,
  SCOPE_OF_WORK_LABELS,
  SEVERITY_POTENTIAL_CODES,
  TRADE_CODES,
  TRADE_LABELS,
  WEATHER_CONDITION_CODES,
  getSubTradeOptionsForTrade,
  getTaskOptionsForTradeAndSubTrade,
  type RootCauseLevel1,
  type ScopeOfWorkCode,
  type TradeCode,
} from "@/lib/riskMemory/taxonomy";
import { EXPOSURE_EVENT_TYPES, EXPOSURE_EVENT_TYPE_LABELS } from "@/lib/incidents/exposureEventType";
import type { RiskMemoryFormInput } from "@/lib/riskMemory/form";
import {
  BEHAVIOR_CATEGORY_CODES,
  COST_IMPACT_BAND_CODES,
  SUPERVISION_STATUS_CODES,
  TRAINING_STATUS_CODES,
} from "@/lib/riskMemory/taxonomyPhase2";

const TIME_OF_DAY_OPTIONS = [
  { value: "", label: "—" },
  { value: "night", label: "Night" },
  { value: "early_morning", label: "Early morning" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
];

type ContractorOption = { id: string; name: string };
type CrewOption = { id: string; name: string };

type Props = {
  value: RiskMemoryFormInput;
  onChange: (next: RiskMemoryFormInput) => void;
  /** When false, hide outcome / CA fields (e.g. observations). */
  showOutcomeFields?: boolean;
  /** Populated from `/api/company/contractors`; optional FK on saved facets. */
  contractors?: ContractorOption[];
  /** From `/api/company/crews` (optionally filtered by jobsite). */
  crews?: CrewOption[];
  className?: string;
  /** Surface a link to company contractor/crew directory setup (not shown in the main nav). */
  showPicklistSettingsLink?: boolean;
};

const selectClass =
  "rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark]";

function formatCodeLabel(code: string) {
  return code.replace(/_/g, " ");
}

export function RiskMemoryFormFields({
  value,
  onChange,
  showOutcomeFields = true,
  contractors = [],
  crews = [],
  className = "",
  showPicklistSettingsLink = false,
}: Props) {
  const l1 = (value.rootCauseLevel1 || "") as RootCauseLevel1 | "";
  const l2Options = l1 && l1 in ROOT_CAUSE_LEVEL2_BY_L1 ? ROOT_CAUSE_LEVEL2_BY_L1[l1 as RootCauseLevel1] : [];
  const subTradeOptions = getSubTradeOptionsForTrade(value.trade);
  const taskOptions = getTaskOptionsForTradeAndSubTrade(value.trade, value.subTrade);

  function patch(p: Partial<RiskMemoryFormInput>) {
    onChange({ ...value, ...p });
  }

  return (
    <div className={`grid gap-3 md:grid-cols-2 ${className}`}>
      {showPicklistSettingsLink ? (
        <p className="md:col-span-2 text-sm text-slate-400">
          Contractor and crew pick lists are managed in{" "}
          <Link
            href="/settings/risk-memory"
            className="font-semibold text-sky-400 underline-offset-2 hover:underline"
          >
            Risk Memory setup
          </Link>
          .
        </p>
      ) : null}
      <div className="md:col-span-2 text-xs font-semibold uppercase tracking-wide text-sky-400/90">
        Risk Memory Engine (optional context)
      </div>
      <select
        value={value.scopeOfWork}
        onChange={(e) => patch({ scopeOfWork: e.target.value })}
        className={selectClass}
        aria-label="Scope of work"
      >
        <option value="">Scope of work…</option>
        {SCOPE_OF_WORK_CODES.map((code) => (
          <option key={code} value={code}>
            {SCOPE_OF_WORK_LABELS[code as ScopeOfWorkCode]}
          </option>
        ))}
      </select>
      <select
        value={value.trade}
        onChange={(e) => patch({ trade: e.target.value, subTrade: "", task: "" })}
        className={selectClass}
        aria-label="Trade"
      >
        <option value="">Trade…</option>
        {TRADE_CODES.map((code) => (
          <option key={code} value={code}>
            {TRADE_LABELS[code as TradeCode]}
          </option>
        ))}
      </select>
      <select
        value={value.subTrade}
        onChange={(e) => patch({ subTrade: e.target.value, task: "" })}
        className={selectClass}
        disabled={!value.trade}
        aria-label="Sub-trade"
      >
        <option value="">Sub-trade</option>
        {subTradeOptions.map((subTrade) => (
          <option key={subTrade.code} value={subTrade.code}>
            {subTrade.label}
          </option>
        ))}
      </select>
      <select
        value={value.task}
        onChange={(e) => patch({ task: e.target.value })}
        className={selectClass}
        disabled={!value.subTrade}
        aria-label="Task"
      >
        <option value="">Task</option>
        {taskOptions.map((task) => (
          <option key={task.code} value={task.code}>
            {task.label}
          </option>
        ))}
      </select>
      <select
        value={value.primaryHazard}
        onChange={(e) => patch({ primaryHazard: e.target.value })}
        className={selectClass}
        aria-label="Primary hazard"
      >
        <option value="">Primary hazard (exposure type)…</option>
        {EXPOSURE_EVENT_TYPES.map((code) => (
          <option key={code} value={code}>
            {EXPOSURE_EVENT_TYPE_LABELS[code]}
          </option>
        ))}
      </select>
      <select
        value={value.secondaryHazard1}
        onChange={(e) => patch({ secondaryHazard1: e.target.value })}
        className={selectClass}
        aria-label="Secondary hazard 1"
      >
        <option value="">Secondary hazard 1 (optional)…</option>
        {EXPOSURE_EVENT_TYPES.map((code) => (
          <option key={code} value={code}>
            {EXPOSURE_EVENT_TYPE_LABELS[code]}
          </option>
        ))}
      </select>
      <select
        value={value.secondaryHazard2}
        onChange={(e) => patch({ secondaryHazard2: e.target.value })}
        className={selectClass}
        aria-label="Secondary hazard 2"
      >
        <option value="">Secondary hazard 2 (optional)…</option>
        {EXPOSURE_EVENT_TYPES.map((code) => (
          <option key={code} value={code}>
            {EXPOSURE_EVENT_TYPE_LABELS[code]}
          </option>
        ))}
      </select>
      <select
        value={value.weather}
        onChange={(e) => patch({ weather: e.target.value })}
        className={selectClass}
        aria-label="Weather"
      >
        <option value="">Weather condition…</option>
        {WEATHER_CONDITION_CODES.map((code) => (
          <option key={code} value={code}>
            {code.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <select
        value={value.failedControl}
        onChange={(e) => patch({ failedControl: e.target.value })}
        className={selectClass}
        aria-label="Failed control"
      >
        <option value="">Failed or missing control…</option>
        {FAILED_CONTROL_CODES.map((code) => (
          <option key={code} value={code}>
            {code.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <select
        value={value.rootCauseLevel1}
        onChange={(e) =>
          patch({
            rootCauseLevel1: e.target.value,
            rootCauseLevel2: "",
          })
        }
        className={selectClass}
        aria-label="Root cause level 1"
      >
        <option value="">Root cause (category)…</option>
        {ROOT_CAUSE_LEVEL1.map((code) => (
          <option key={code} value={code}>
            {code.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <select
        value={value.rootCauseLevel2}
        onChange={(e) => patch({ rootCauseLevel2: e.target.value })}
        className={selectClass}
        disabled={!l1}
        aria-label="Root cause level 2"
      >
        <option value="">Root cause (detail)…</option>
        {l2Options.map((code) => (
          <option key={code} value={code}>
            {code.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <select
        value={value.contractorId}
        onChange={(e) => patch({ contractorId: e.target.value })}
        className={selectClass}
        aria-label="Contractor (workspace directory)"
      >
        <option value="">Contractor directory…</option>
        {contractors.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input
        value={value.contractor}
        onChange={(e) => patch({ contractor: e.target.value })}
        placeholder="Contractor note (free text)"
        aria-label="Contractor note"
        className={`${selectClass} placeholder:text-slate-500`}
      />
      <select
        value={value.crewId}
        onChange={(e) => patch({ crewId: e.target.value })}
        className={selectClass}
        aria-label="Crew"
      >
        <option value="">Crew directory…</option>
        {crews.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input
        value={value.locationArea}
        onChange={(e) => patch({ locationArea: e.target.value })}
        placeholder="Area / zone"
        aria-label="Area or zone"
        className={`${selectClass} placeholder:text-slate-500`}
      />
      <input
        value={value.locationGrid}
        onChange={(e) => patch({ locationGrid: e.target.value })}
        placeholder="Location grid / map ref (optional)"
        aria-label="Location grid or map reference"
        className={`${selectClass} placeholder:text-slate-500`}
      />
      <select
        value={value.timeOfDay}
        onChange={(e) => patch({ timeOfDay: e.target.value })}
        className={selectClass}
        aria-label="Time of day band"
      >
        {TIME_OF_DAY_OPTIONS.map((o) => (
          <option key={o.value || "none"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        value={value.permitStatus}
        onChange={(e) => patch({ permitStatus: e.target.value })}
        className={selectClass}
        aria-label="Permit status summary"
      >
        <option value="">Permit status…</option>
        {PERMIT_STATUS_SUMMARY_CODES.map((code) => (
          <option key={code} value={code}>
            {code.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <select
        value={value.ppeStatus}
        onChange={(e) => patch({ ppeStatus: e.target.value })}
        className={selectClass}
        aria-label="PPE status summary"
      >
        <option value="">PPE status…</option>
        {PPE_STATUS_SUMMARY_CODES.map((code) => (
          <option key={code} value={code}>
            {code.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <div className="md:col-span-2 mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Learning dimensions (optional — use for systems, not blame)
      </div>
      <select
        value={value.behaviorCategory}
        onChange={(e) => patch({ behaviorCategory: e.target.value })}
        className={selectClass}
        aria-label="Behavior category"
      >
        <option value="">Behavior category…</option>
        {BEHAVIOR_CATEGORY_CODES.map((code) => (
          <option key={code} value={code}>
            {formatCodeLabel(code)}
          </option>
        ))}
      </select>
      <select
        value={value.trainingStatus}
        onChange={(e) => patch({ trainingStatus: e.target.value })}
        className={selectClass}
        aria-label="Training status"
      >
        <option value="">Training status…</option>
        {TRAINING_STATUS_CODES.map((code) => (
          <option key={code} value={code}>
            {formatCodeLabel(code)}
          </option>
        ))}
      </select>
      <select
        value={value.supervisionStatus}
        onChange={(e) => patch({ supervisionStatus: e.target.value })}
        className={selectClass}
        aria-label="Supervision status"
      >
        <option value="">Supervision…</option>
        {SUPERVISION_STATUS_CODES.map((code) => (
          <option key={code} value={code}>
            {formatCodeLabel(code)}
          </option>
        ))}
      </select>
      <input
        value={value.equipmentType}
        onChange={(e) => patch({ equipmentType: e.target.value })}
        placeholder="Equipment type (short)"
        aria-label="Equipment type"
        className={`${selectClass} placeholder:text-slate-500`}
      />
      <select
        value={value.costImpactBand}
        onChange={(e) => patch({ costImpactBand: e.target.value })}
        className={selectClass}
        aria-label="Cost impact band"
      >
        <option value="">Cost impact…</option>
        {COST_IMPACT_BAND_CODES.map((code) => (
          <option key={code} value={code}>
            {formatCodeLabel(code)}
          </option>
        ))}
      </select>
      <input
        value={value.forecastConfidence}
        onChange={(e) => patch({ forecastConfidence: e.target.value })}
        placeholder="Forecast confidence 0–1 (optional)"
        inputMode="decimal"
        className={`${selectClass} placeholder:text-slate-500`}
        aria-label="Forecast confidence"
      />
      {showOutcomeFields ? (
        <>
          <select
            value={value.potentialSeverity}
            onChange={(e) => patch({ potentialSeverity: e.target.value })}
            className={selectClass}
            aria-label="Potential severity"
          >
            <option value="">Potential severity…</option>
            {SEVERITY_POTENTIAL_CODES.map((code) => (
              <option key={code} value={code}>
                {code.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select
            value={value.actualOutcomeSeverity}
            onChange={(e) => patch({ actualOutcomeSeverity: e.target.value })}
            className={selectClass}
            aria-label="Actual outcome severity"
          >
            <option value="">Actual outcome severity…</option>
            {SEVERITY_POTENTIAL_CODES.map((code) => (
              <option key={code} value={code}>
                {code.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <input
            value={value.correctiveActionStatus}
            onChange={(e) => patch({ correctiveActionStatus: e.target.value })}
            placeholder="Corrective action status note (optional)"
            aria-label="Corrective action status note"
            className={`md:col-span-2 ${selectClass} placeholder:text-slate-500`}
          />
        </>
      ) : null}
    </div>
  );
}
