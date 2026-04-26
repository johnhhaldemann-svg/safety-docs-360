"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  StartChecklist,
  StatusBadge,
  WorkflowPath,
  appNativeSelectClassName,
} from "@/components/WorkspacePrimitives";
import type { BuilderProgramAiReview } from "@/lib/builderDocumentAiReview";
import {
  buildSurveyTestEnrichment,
  createDefaultSurveyTestForm,
  getSurveyTestSubTradeOptions,
  getSurveyTestTaskOptions,
  getSurveyTestTradeOptions,
  SURVEY_TEST_LAYOUT_SECTIONS,
  type SurveyTestFormData,
} from "@/lib/csepSurveyTest";

const supabase = getSupabaseBrowserClient();

const steps = [
  { title: "Trade selection", detail: "Lock the workflow to the survey / layout trade." },
  { title: "Sub-trade", detail: "Choose the active survey sub-trade for this test build." },
  { title: "Select sections", detail: "Choose which survey layout sections belong in the DOCX." },
  { title: "Selectable tasks", detail: "Pick the work tasks that drive the intelligence enrichment." },
  { title: "Intelligence enrichment", detail: "Review OSHA, SOR, injury, permits, training, hazards, and PPE outputs." },
  { title: "Intelligence review", detail: "Run the review summary before you finish the document." },
  { title: "Finish document", detail: "Capture project metadata and download the survey test CSEP." },
];

type FeedbackTone = "neutral" | "success" | "warning" | "error";

export default function SuperadminCsepSurveyTestPage() {
  const [form, setForm] = useState<SurveyTestFormData>(createDefaultSurveyTestForm());
  const [step, setStep] = useState(0);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("neutral");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [review, setReview] = useState<BuilderProgramAiReview | null>(null);
  const [reviewDisclaimer, setReviewDisclaimer] = useState("");

  const tradeOptions = useMemo(() => getSurveyTestTradeOptions(), []);
  const subTradeOptions = useMemo(() => getSurveyTestSubTradeOptions(), []);
  const taskOptions = useMemo(
    () => getSurveyTestTaskOptions(form.subTrade),
    [form.subTrade]
  );
  const enrichment = useMemo(() => buildSurveyTestEnrichment(form), [form]);

  const setFeedbackMessage = useCallback(
    (message: string, tone: FeedbackTone = "neutral") => {
      setFeedback(message);
      setFeedbackTone(tone);
    },
    []
  );

  useEffect(() => {
    void (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        if (!accessToken) {
          setUserRole(null);
          return;
        }

        const meResponse = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const meData = (await meResponse.json().catch(() => null)) as
          | { user?: { role?: string } }
          | null;

        if (meResponse.ok) {
          setUserRole(meData?.user?.role ?? null);
        }
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error("You must be logged in as a super admin.");
    }

    return session.access_token;
  }, []);

  function updateField<K extends keyof SurveyTestFormData>(field: K, value: SurveyTestFormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field !== "project_name" && review) {
      setReview(null);
      setReviewDisclaimer("");
    }
  }

  function toggleArrayValue(field: "tasks" | "selectedLayoutSections", value: string) {
    setForm((prev) => {
      const current = prev[field];
      const exists = current.includes(value as never);

      return {
        ...prev,
        [field]: exists
          ? current.filter((item) => item !== value)
          : [...current, value],
      };
    });

    if (review) {
      setReview(null);
      setReviewDisclaimer("");
    }
  }

  function canProceed(currentStep: number) {
    if (currentStep === 0) return Boolean(form.trade.trim());
    if (currentStep === 1) return Boolean(form.subTrade.trim());
    if (currentStep === 2) return form.selectedLayoutSections.length > 0;
    if (currentStep === 3) return form.tasks.length > 0;
    if (currentStep === 4) return enrichment.hazards.length > 0;
    if (currentStep === 5) return Boolean(review);
    return true;
  }

  async function runReview() {
    setReviewLoading(true);
    setFeedbackMessage("");
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/superadmin/csep-survey-test/review", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            disclaimer?: string;
            review?: BuilderProgramAiReview;
          }
        | null;

      if (!response.ok || !data?.review) {
        throw new Error(data?.error || "Failed to generate intelligence review.");
      }

      setReview(data.review);
      setReviewDisclaimer(data.disclaimer ?? "");
      setFeedbackMessage("Intelligence review is ready for the final download step.", "success");
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error ? error.message : "Failed to generate intelligence review.",
        "error"
      );
    } finally {
      setReviewLoading(false);
    }
  }

  async function downloadDocument() {
    setDownloadLoading(true);
    setFeedbackMessage("");
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/superadmin/csep-survey-test/export", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Failed to export Survey Test CSEP.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/i);
      const filename = match?.[1] || "Survey_Test_CSEP.docx";
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => window.URL.revokeObjectURL(url), 30_000);
      setFeedbackMessage("Survey Test CSEP downloaded successfully.", "success");
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error ? error.message : "Failed to export Survey Test CSEP.",
        "error"
      );
    } finally {
      setDownloadLoading(false);
    }
  }

  const workflowSteps = steps.map((item, index) => ({
    label: item.title,
    detail: item.detail,
    active: step === index,
    complete: index < step || (index === 5 && Boolean(review)),
  }));

  if (authLoading) {
    return (
      <div className="space-y-6">
        <PageHero
          eyebrow="Superadmin / Survey test"
          title="Survey Test CSEP"
          description="Loading the superadmin survey test workspace."
        />
        <InlineMessage>Loading access...</InlineMessage>
      </div>
    );
  }

  if (userRole !== "super_admin") {
    return (
      <div className="space-y-6">
        <PageHero
          eyebrow="Superadmin / Survey test"
          title="Survey Test CSEP"
          description="This test builder is only available to the Super Admin role."
        />
        <InlineMessage tone="warning">
          Super Admin access is required to use the survey test builder, run the intelligence review, and export the DOCX.
        </InlineMessage>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Superadmin / Survey test"
        title="Survey Test CSEP"
        description="Use the hand-drawn process as the workflow: trade selection, sub-trade, sections, tasks, intelligence enrichment, intelligence review, then finish the survey-layout document without touching the live CSEP flow."
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={form.trade} tone="info" />
            <StatusBadge
              label={`${form.selectedLayoutSections.length} sections`}
              tone={form.selectedLayoutSections.length ? "success" : "warning"}
            />
            <StatusBadge
              label={`${form.tasks.length} tasks`}
              tone={form.tasks.length ? "success" : "warning"}
            />
          </div>
        }
      />

      {feedback ? <InlineMessage tone={feedbackTone}>{feedback}</InlineMessage> : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <SectionCard
            title={`Step ${step + 1}: ${steps[step].title}`}
            description={steps[step].detail}
          >
            {step === 0 ? (
              <div className="space-y-4">
                <label className="block">
                  <div className="mb-2 text-sm font-semibold text-[var(--app-text-strong)]">
                    Trade
                  </div>
                  <select
                    className={`${appNativeSelectClassName} w-full`}
                    value={form.trade}
                    onChange={(event) => updateField("trade", event.target.value)}
                  >
                    {tradeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <InlineMessage>
                  This test builder is intentionally locked to <strong>Survey / Layout</strong> so the workflow and DOCX can be validated without touching the live multi-trade CSEP builder.
                </InlineMessage>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-4">
                <label className="block">
                  <div className="mb-2 text-sm font-semibold text-[var(--app-text-strong)]">
                    Survey sub-trade
                  </div>
                  <select
                    className={`${appNativeSelectClassName} w-full`}
                    value={form.subTrade}
                    onChange={(event) => {
                      updateField("subTrade", event.target.value);
                      updateField("tasks", []);
                    }}
                  >
                    <option value="">Choose sub-trade</option>
                    {subTradeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <InlineMessage>
                  Pick the survey sub-trade first so the selectable task list and intelligence enrichment stay tied to the correct taxonomy.
                </InlineMessage>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-3">
                {SURVEY_TEST_LAYOUT_SECTIONS.map((section) => (
                  <label
                    key={section.key}
                    className="flex items-start gap-3 rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] px-4 py-4"
                  >
                    <input
                      type="checkbox"
                      checked={form.selectedLayoutSections.includes(section.key)}
                      onChange={() => toggleArrayValue("selectedLayoutSections", section.key)}
                      className="mt-1 h-4 w-4"
                    />
                    <div>
                      <div className="text-sm font-semibold text-[var(--app-text-strong)]">
                        {section.number}. {section.title}
                      </div>
                      <div className="mt-1 text-sm text-[var(--app-text)]">{section.summary}</div>
                    </div>
                  </label>
                ))}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                {!form.subTrade ? (
                  <InlineMessage tone="warning">
                    Choose a survey sub-trade first so the task list can be loaded.
                  </InlineMessage>
                ) : (
                  <>
                    <div className="grid gap-3">
                      {taskOptions.selectable.map((task) => (
                        <label
                          key={task}
                          className="flex items-start gap-3 rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] px-4 py-4"
                        >
                          <input
                            type="checkbox"
                            checked={form.tasks.includes(task)}
                            onChange={() => toggleArrayValue("tasks", task)}
                            className="mt-1 h-4 w-4"
                          />
                          <span className="text-sm font-medium text-[var(--app-text-strong)]">
                            {task}
                          </span>
                        </label>
                      ))}
                    </div>
                    {taskOptions.reference.length ? (
                      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--semantic-neutral-bg)] px-4 py-4">
                        <div className="text-sm font-semibold text-[var(--app-text-strong)]">
                          Reference tasks
                        </div>
                        <div className="mt-2 text-sm text-[var(--app-text)]">
                          {taskOptions.reference.join(", ")}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-6">
                <Bucket title="OSHA data" items={enrichment.oshaData} />
                <Bucket title="SOR data" items={enrichment.sorData} />
                <Bucket title="Injury data" items={enrichment.injuryData} />
                <Bucket title="Required training" items={enrichment.requiredTraining} />
                <Bucket title="Permits required" items={enrichment.permitsRequired} emptyLabel="No permits currently triggered." />
                <Bucket title="Elements required" items={enrichment.elementsRequired} />
                <Bucket title="Hazards" items={enrichment.hazards} />
                <Bucket title="PPE" items={enrichment.ppe} />
              </div>
            ) : null}

            {step === 5 ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
                  <div className="text-sm font-semibold text-[var(--app-text-strong)]">
                    Review input snapshot
                  </div>
                  <div className="mt-2 text-sm text-[var(--app-text)]">
                    {enrichment.tradeLabel} / {enrichment.subTradeLabel ?? "No sub-trade selected"} with{" "}
                    {enrichment.selectedTasks.length} selected task{enrichment.selectedTasks.length === 1 ? "" : "s"}.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void runReview()}
                  disabled={reviewLoading || !enrichment.selectedTasks.length || !form.subTrade}
                  className="rounded-xl bg-[var(--app-accent-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--app-accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reviewLoading ? "Running intelligence review..." : "Run intelligence review"}
                </button>
                {review ? (
                  <div className="space-y-4">
                    <InlineMessage tone={review.overallAssessment === "sufficient" ? "success" : "warning"}>
                      {review.executiveSummary}
                    </InlineMessage>
                    <Bucket title="Strengths" items={review.regulatoryAndProgramStrengths} />
                    <Bucket title="Gaps / risks / clarifications" items={review.gapsRisksOrClarifications} />
                    <Bucket title="Recommended edits before approval" items={review.recommendedEditsBeforeApproval} />
                    {review.checklistDelta?.length ? (
                      <Bucket title="Checklist delta" items={review.checklistDelta} />
                    ) : null}
                    {reviewDisclaimer ? <InlineMessage>{reviewDisclaimer}</InlineMessage> : null}
                  </div>
                ) : (
                  <InlineMessage>
                    Run the review after checking the enrichment buckets so the finish step has a reviewer-style summary.
                  </InlineMessage>
                )}
              </div>
            ) : null}

            {step === 6 ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Project name"
                    value={form.project_name}
                    onChange={(value) => updateField("project_name", value)}
                  />
                  <Input
                    label="Project number"
                    value={form.project_number}
                    onChange={(value) => updateField("project_number", value)}
                  />
                  <Input
                    label="Project address"
                    value={form.project_address}
                    onChange={(value) => updateField("project_address", value)}
                  />
                  <Input
                    label="Owner / Client"
                    value={form.owner_client}
                    onChange={(value) => updateField("owner_client", value)}
                  />
                  <Input
                    label="GC / CM"
                    value={Array.isArray(form.gc_cm) ? form.gc_cm.join(", ") : form.gc_cm}
                    onChange={(value) => updateField("gc_cm", value)}
                  />
                  <Input
                    label="Contractor company"
                    value={form.contractor_company}
                    onChange={(value) => updateField("contractor_company", value)}
                  />
                  <Input
                    label="Contractor contact"
                    value={form.contractor_contact}
                    onChange={(value) => updateField("contractor_contact", value)}
                  />
                  <Input
                    label="Contractor phone"
                    value={form.contractor_phone}
                    onChange={(value) => updateField("contractor_phone", value)}
                  />
                  <Input
                    label="Contractor email"
                    value={form.contractor_email}
                    onChange={(value) => updateField("contractor_email", value)}
                  />
                </div>
                <TextArea
                  label="Scope of work"
                  value={form.scope_of_work}
                  onChange={(value) => updateField("scope_of_work", value)}
                />
                <TextArea
                  label="Project-Specific Safety Notes"
                  value={form.site_specific_notes}
                  onChange={(value) => updateField("site_specific_notes", value)}
                />
                <TextArea
                  label="Emergency procedures"
                  value={form.emergency_procedures}
                  onChange={(value) => updateField("emergency_procedures", value)}
                />
                <button
                  type="button"
                  onClick={() => void downloadDocument()}
                  disabled={
                    downloadLoading ||
                    !review ||
                    !form.subTrade.trim() ||
                    !form.tasks.length ||
                    !form.selectedLayoutSections.length
                  }
                  className="rounded-xl bg-[var(--app-accent-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--app-accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {downloadLoading ? "Generating DOCX..." : "Finish and download Survey Test CSEP"}
                </button>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3 border-t border-[var(--app-border)] pt-2">
              <button
                type="button"
                onClick={() => setStep((current) => Math.max(0, current - 1))}
                disabled={step === 0}
                className="rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--app-text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>
              {step < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((current) => current + 1)}
                  disabled={!canProceed(step)}
                  className="rounded-xl bg-[var(--app-accent-primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next step
                </button>
              ) : null}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <WorkflowPath
            title="Picture-driven workflow"
            description="This test route follows the hand-drawn process instead of the live single-page builder."
            steps={workflowSteps}
          />

          <StartChecklist title="Readiness checklist" items={enrichment.readinessChecklist} />

          <SectionCard
            title="Builder snapshot"
            description="Live view of what the survey test builder has assembled so far."
          >
            <Snapshot label="Sub-trade" value={enrichment.subTradeLabel ?? "Not selected"} />
            <Snapshot
              label="Tasks"
              value={
                enrichment.selectedTasks.length
                  ? `${enrichment.selectedTasks.length} selected`
                  : "None selected"
              }
            />
            <Snapshot
              label="Hazards"
              value={enrichment.hazards.length ? `${enrichment.hazards.length} derived` : "None"}
            />
            <Snapshot
              label="Permits"
              value={
                enrichment.permitsRequired.length
                  ? `${enrichment.permitsRequired.length} derived`
                  : "None"
              }
            />
            <Snapshot
              label="PPE"
              value={enrichment.ppe.length ? `${enrichment.ppe.length} listed` : "None"}
            />
            <Snapshot
              label="Sections"
              value={`${enrichment.selectedSections.length} selected`}
            />
          </SectionCard>

          <SectionCard
            title="Reference layout"
            description="The DOCX export mirrors the uploaded survey layout section structure."
          >
            <div className="space-y-3">
              {SURVEY_TEST_LAYOUT_SECTIONS.map((section) => (
                <div
                  key={section.key}
                  className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] px-4 py-3"
                >
                  <div className="text-sm font-semibold text-[var(--app-text-strong)]">
                    {section.number}. {section.title}
                  </div>
                  <div className="mt-1 text-sm text-[var(--app-text)]">{section.summary}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function Bucket({
  title,
  items,
  emptyLabel = "Nothing generated yet.",
}: {
  title: string;
  items: string[];
  emptyLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
      <div className="text-sm font-semibold text-[var(--app-text-strong)]">{title}</div>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((item) => (
            <div
              key={`${title}:${item}`}
              className="rounded-xl border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text)]"
            >
              {item}
            </div>
          ))
        ) : (
          <div className="text-sm text-[var(--app-text)]">{emptyLabel}</div>
        )}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-[var(--app-text-strong)]">{label}</div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-[var(--app-accent-primary)]"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-[var(--app-text-strong)]">{label}</div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-3 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-[var(--app-accent-primary)]"
      />
    </label>
  );
}

function Snapshot({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] px-4 py-3">
      <span className="text-sm text-[var(--app-text)]">{label}</span>
      <span className="text-sm font-semibold text-[var(--app-text-strong)]">{value}</span>
    </div>
  );
}
