"use client";

import { useState } from "react";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { GusPlanningChat } from "@/components/gus/GusPlanningChat";
import { GusPlanningChecklist } from "@/components/gus/GusPlanningChecklist";
import { GusPlanReviewPanel } from "@/components/gus/GusPlanReviewPanel";
import { basePlanningQuestions, gusPlanningDisclaimer } from "@/lib/gus/plans/basePlanningQuestions";
import type {
  GusDraftDocumentType,
  GusDraftSafeWorkPlan,
  GusPlanningSessionInput,
} from "@/lib/gus/plans/basePlanningTypes";
import { generateBaseSafeWorkPlan } from "@/lib/gus/plans/basePlanGenerator";
import {
  findMissingPlanningInformation,
  universalControlChecklist,
  universalHazardChecklist,
} from "@/lib/gus/plans/baseSafetyRules";
import { gusWorkTypes } from "@/lib/gus/plans/workTypeRegistry";

type GusJobsiteOption = {
  id: string;
  name: string;
};

type GusPlanningModeProps = {
  jobsiteOptions?: GusJobsiteOption[];
  onClose?: () => void;
};

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function GusPlanningMode({ jobsiteOptions = [], onClose }: GusPlanningModeProps) {
  const [workTypeId, setWorkTypeId] = useState(gusWorkTypes[0]?.id ?? "general_work");
  const [taskDescription, setTaskDescription] = useState("");
  const [jobsiteId, setJobsiteId] = useState("");
  const [manualJobsiteName, setManualJobsiteName] = useState("");
  const [crewTrade, setCrewTrade] = useState("");
  const [equipmentToolsMaterials, setEquipmentToolsMaterials] = useState("");
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [selectedHazards, setSelectedHazards] = useState<string[]>([]);
  const [selectedControls, setSelectedControls] = useState<string[]>([]);
  const [requestedDraftDocuments, setRequestedDraftDocuments] = useState<GusDraftDocumentType[]>([]);
  const [draftPlan, setDraftPlan] = useState<GusDraftSafeWorkPlan | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const selectedJobsite = jobsiteOptions.find((jobsite) => jobsite.id === jobsiteId);
  const jobsiteName = selectedJobsite?.name ?? manualJobsiteName;

  const planningInput: GusPlanningSessionInput = {
    workTypeId,
    taskDescription,
    jobsiteId: jobsiteId || undefined,
    jobsiteName,
    crewTrade,
    equipmentToolsMaterials,
    questionAnswers,
    selectedHazards,
    selectedControls,
    requestedDraftDocuments,
  };
  const missingInformation = findMissingPlanningInformation(planningInput);

  function updateAnswer(questionId: string, value: string) {
    setQuestionAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function generatePlan() {
    const plan = generateBaseSafeWorkPlan({
      ...planningInput,
      requestedDraftDocuments: Array.from(new Set([...requestedDraftDocuments, "safe_work_plan"])),
    });
    setDraftPlan(plan);
    setRequestedDraftDocuments(plan.requestedDraftDocuments);
    setStatusMessage("Draft safe work plan generated locally. No official record was created.");
  }

  function stageDocument(documentType: GusDraftDocumentType) {
    setRequestedDraftDocuments((current) => Array.from(new Set([...current, documentType])));
    setStatusMessage("Draft document request staged locally. No official record was created.");
  }

  function saveSession() {
    setStatusMessage("Planning session staged locally for this Gus panel. Persistence will be wired in a later phase.");
  }

  return (
    <div className="flex max-h-[82vh] flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-white shadow-[0_22px_52px_rgba(24,41,73,0.18)] ring-1 ring-[rgba(37,99,235,0.08)]">
      <div className="flex items-start gap-3 border-b border-[var(--app-border)] bg-[linear-gradient(135deg,_#ffffff_0%,_#eef5ff_100%)] p-4">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--app-border)] bg-white/86 text-[var(--app-muted)] transition hover:bg-white hover:text-[var(--app-text-strong)]"
            aria-label="Back to Gus message"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : null}
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--app-accent-primary)] text-white">
          <ClipboardList className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-accent-primary)]">
            Plan work with Gus
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--app-text-strong)]">{gusPlanningDisclaimer}</p>
        </div>
      </div>

      <div className="overflow-y-auto p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
            <section className="grid gap-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                  Work Type
                </span>
                <select
                  value={workTypeId}
                  onChange={(event) => setWorkTypeId(event.currentTarget.value)}
                  className="mt-2 min-h-10 w-full rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-ring)]"
                >
                  {gusWorkTypes.map((workType) => (
                    <option key={workType.id} value={workType.id}>
                      {workType.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                  Jobsite
                </span>
                {jobsiteOptions.length > 0 ? (
                  <select
                    value={jobsiteId}
                    onChange={(event) => setJobsiteId(event.currentTarget.value)}
                    className="mt-2 min-h-10 w-full rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-ring)]"
                  >
                    <option value="">Select jobsite</option>
                    {jobsiteOptions.map((jobsite) => (
                      <option key={jobsite.id} value={jobsite.id}>
                        {jobsite.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={manualJobsiteName}
                    onChange={(event) => setManualJobsiteName(event.currentTarget.value)}
                    placeholder="Jobsite or work area"
                    className="mt-2 min-h-10 w-full rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-ring)]"
                  />
                )}
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                  Free-Text Task Description
                </span>
                <textarea
                  value={taskDescription}
                  onChange={(event) => setTaskDescription(event.currentTarget.value)}
                  rows={3}
                  placeholder="Describe the task, sequence, location constraints, and known concerns."
                  className="mt-2 min-h-24 w-full resize-y rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-ring)]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                  Crew / Trade
                </span>
                <input
                  value={crewTrade}
                  onChange={(event) => setCrewTrade(event.currentTarget.value)}
                  placeholder="Crew, contractor, or trade"
                  className="mt-2 min-h-10 w-full rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-ring)]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                  Equipment / Tools / Materials
                </span>
                <input
                  value={equipmentToolsMaterials}
                  onChange={(event) => setEquipmentToolsMaterials(event.currentTarget.value)}
                  placeholder="Tools, equipment, chemicals, energy sources"
                  className="mt-2 min-h-10 w-full rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-ring)]"
                />
              </label>
            </section>

            <GusPlanningChat questions={basePlanningQuestions} answers={questionAnswers} onAnswerChange={updateAnswer} />
            <GusPlanningChecklist
              title="Hazard Checklist"
              items={universalHazardChecklist}
              selected={selectedHazards}
              onToggle={(label) => setSelectedHazards((current) => toggleValue(current, label))}
            />
            <GusPlanningChecklist
              title="Controls Checklist"
              items={universalControlChecklist}
              selected={selectedControls}
              onToggle={(label) => setSelectedControls((current) => toggleValue(current, label))}
            />
          </div>

          <GusPlanReviewPanel
            plan={draftPlan}
            missingInformation={missingInformation}
            stagedDocuments={requestedDraftDocuments}
            statusMessage={statusMessage}
            onGeneratePlan={generatePlan}
            onStageDocument={stageDocument}
            onSaveSession={saveSession}
          />
        </div>
      </div>
    </div>
  );
}
