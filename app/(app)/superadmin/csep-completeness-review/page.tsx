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
} from "@/components/WorkspacePrimitives";
import type {
  BuilderProgramAiReview,
  BuilderProgramAiReviewFinding,
  BuilderProgramAiReviewSectionNote,
} from "@/lib/builderDocumentAiReview";
import {
  formatCsepFindingNote,
  getCsepSectionNoteFields,
} from "@/lib/csepReviewNoteFormat";
import {
  parseContentDispositionFilename,
  triggerBrowserDownload,
} from "@/lib/browserDownload";

const supabase = getSupabaseBrowserClient();

const steps = [
  {
    title: "Upload completed CSEP",
    detail: "Add the completed PDF or DOCX you want the AI to review for missing content.",
  },
  {
    title: "Add context",
    detail: "Optionally add reviewer notes and a GC/site reference file for comparison.",
  },
  {
    title: "Run missing-items review",
    detail: "Generate the checklist of missing, incomplete, or weak CSEP content.",
  },
] as const;

type FeedbackTone = "neutral" | "success" | "warning" | "error";
type ExtractionMeta =
  | { ok: true; method: string; truncated: boolean; annotations: Array<{ note: string }> }
  | { ok: false; error: string };
type SiteExtractionMeta = Array<{
  fileName: string;
  ok: true;
  method: string;
  truncated: boolean;
}>;

export default function SuperadminCsepCompletenessReviewPage() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [siteDocumentFiles, setSiteDocumentFiles] = useState<File[]>([]);
  const [reviewerContext, setReviewerContext] = useState("");
  const [review, setReview] = useState<BuilderProgramAiReview | null>(null);
  const [reviewDisclaimer, setReviewDisclaimer] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("neutral");
  const [extraction, setExtraction] = useState<ExtractionMeta | null>(null);
  const [siteExtraction, setSiteExtraction] = useState<SiteExtractionMeta>([]);

  const readinessChecklist = useMemo(
    () => [
      {
        label: documentFile
          ? `Completed CSEP ready: ${documentFile.name}`
          : "Upload a completed CSEP PDF or DOCX.",
        done: Boolean(documentFile),
      },
      {
        label: siteDocumentFiles.length
          ? `${siteDocumentFiles.length} reference file${siteDocumentFiles.length === 1 ? "" : "s"} attached`
          : "Optional: attach GC/site reference files for comparison.",
        done: siteDocumentFiles.length > 0,
      },
      {
        label: review
          ? "AI completeness review is ready."
          : "Run the review to generate the missing-items checklist.",
        done: Boolean(review),
      },
    ],
    [documentFile, review, siteDocumentFiles]
  );

  const workflowSteps = steps.map((item, index) => ({
    label: item.title,
    detail: item.detail,
    active: step === index,
    complete: index < step || (index === 2 && Boolean(review)),
  }));

  const setFeedbackMessage = useCallback(
    (message: string, tone: FeedbackTone = "neutral") => {
      setFeedback(message);
      setFeedbackTone(tone);
    },
    []
  );

  const extractionSummary = useMemo(() => {
    if (!extraction) return "";
    if (!extraction.ok) return `Extraction warning: ${extraction.error}`;
    return `Completed CSEP extracted via ${extraction.method}${extraction.truncated ? " (truncated)" : ""}.`;
  }, [extraction]);

  const siteExtractionSummary = useMemo(() => {
    if (!siteExtraction.length) return "";
    return siteExtraction
      .map(
        (item) =>
          `Reference file ${item.fileName} extracted via ${item.method}${item.truncated ? " (truncated)" : ""}.`
      )
      .join(" ");
  }, [siteExtraction]);

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

  async function runReview() {
    if (!documentFile) {
      setFeedbackMessage("Upload a completed CSEP file before running the review.", "warning");
      return;
    }

    setReviewLoading(true);
    setFeedbackMessage("");
    setReview(null);
    setReviewDisclaimer("");
    setExtraction(null);
    setSiteExtraction([]);

    try {
      const token = await getAccessToken();
      const formData = new FormData();
      formData.append("document", documentFile);
      formData.append("additionalReviewerContext", reviewerContext);
      for (const siteDocumentFile of siteDocumentFiles) {
        formData.append("siteDocument", siteDocumentFile);
      }

      const response = await fetch("/api/superadmin/csep-completeness-review", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            disclaimer?: string;
            extraction?: ExtractionMeta;
            siteReferenceExtractions?: SiteExtractionMeta;
            review?: BuilderProgramAiReview;
          }
        | null;

      if (!response.ok || !data?.review) {
        throw new Error(data?.error || "Failed to run completed CSEP review.");
      }

      setReview(data.review);
      setReviewDisclaimer(data.disclaimer ?? "");
      setExtraction(data.extraction ?? null);
      setSiteExtraction(data.siteReferenceExtractions ?? []);
      setFeedbackMessage("Completed CSEP review is ready.", "success");
      setStep(2);
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error ? error.message : "Failed to run completed CSEP review.",
        "error"
      );
    } finally {
      setReviewLoading(false);
    }
  }

  async function downloadNotesDocument() {
    if (!review || !documentFile) {
      setFeedbackMessage("Run the completed CSEP review before downloading notes.", "warning");
      return;
    }

    setDownloadLoading(true);

    try {
      const token = await getAccessToken();
      const shouldRequestInlineComments = documentFile.name.toLowerCase().endsWith(".docx");
      const response = shouldRequestInlineComments
        ? await (async () => {
            const formData = new FormData();
            formData.append("document", documentFile);
            formData.append("fileName", documentFile.name);
            formData.append("review", JSON.stringify(review));
            return fetch("/api/superadmin/csep-completeness-review/download-notes", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
              },
              body: formData,
            });
          })()
        : await fetch("/api/superadmin/csep-completeness-review/download-notes", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fileName: documentFile.name,
              disclaimer: reviewDisclaimer,
              reviewerContext,
              extractionSummary,
              siteReferenceSummary: siteExtractionSummary,
              review,
            }),
          });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Failed to download the review notes document.");
      }

      const blob = await response.blob();
      const fallbackName = documentFile.name.toLowerCase().endsWith(".docx")
        ? `${documentFile.name.replace(/\.[^.]+$/, "")}_annotated_review.docx`
        : `${documentFile.name.replace(/\.[^.]+$/, "")}_review_notes.docx`;
      const fileName =
        parseContentDispositionFilename(response.headers.get("Content-Disposition")) ??
        fallbackName;
      triggerBrowserDownload(blob, fileName);
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error ? error.message : "Failed to download the review notes document.",
        "error"
      );
    } finally {
      setDownloadLoading(false);
    }
  }

  async function downloadRebuiltDocument() {
    if (!documentFile) {
      setFeedbackMessage("Upload a completed CSEP file before rebuilding it.", "warning");
      return;
    }

    setRebuildLoading(true);

    try {
      const token = await getAccessToken();
      const formData = new FormData();
      formData.append("document", documentFile);
      formData.append("additionalReviewerContext", reviewerContext);
      for (const siteDocumentFile of siteDocumentFiles) {
        formData.append("siteDocument", siteDocumentFile);
      }

      const response = await fetch("/api/superadmin/csep-completeness-review/rebuild", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Failed to rebuild the completed CSEP.");
      }

      const blob = await response.blob();
      const fileName =
        parseContentDispositionFilename(response.headers.get("Content-Disposition")) ??
        `${documentFile.name.replace(/\.[^.]+$/, "")}_Safety360_rebuilt.docx`;
      triggerBrowserDownload(blob, fileName);
      setFeedbackMessage(
        "Rebuilt Safety360 CSEP is ready. Review it and make sure the project-specific facts look right before issue.",
        "success"
      );
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error ? error.message : "Failed to rebuild the completed CSEP.",
        "error"
      );
    } finally {
      setRebuildLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="space-y-6">
        <PageHero
          eyebrow="Superadmin / CSEP review"
          title="Completed CSEP Review"
          description="Loading the completed-CSEP review workspace."
        />
        <InlineMessage>Loading access...</InlineMessage>
      </div>
    );
  }

  if (userRole !== "super_admin") {
    return (
      <div className="space-y-6">
        <PageHero
          eyebrow="Superadmin / CSEP review"
          title="Completed CSEP Review"
          description="This review tool is only available to the Super Admin role."
        />
        <InlineMessage tone="warning">
          Super Admin access is required to upload a completed CSEP and run the missing-items review.
        </InlineMessage>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Superadmin / CSEP review"
        title="Completed CSEP Missing-Items Review"
        description="Upload a completed external CSEP, optionally attach site/GC requirements, and have AI call out what appears missing, incomplete, or unclear relative to the current CSEP process."
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              label={documentFile ? "Document attached" : "No CSEP uploaded"}
              tone={documentFile ? "success" : "warning"}
            />
            <StatusBadge
              label={
                siteDocumentFiles.length
                  ? `${siteDocumentFiles.length} reference${siteDocumentFiles.length === 1 ? "" : "s"} attached`
                  : "No reference files"
              }
              tone={siteDocumentFiles.length ? "info" : "neutral"}
            />
            <StatusBadge
              label={review ? "Review ready" : "Review pending"}
              tone={review ? "success" : "warning"}
            />
          </div>
        }
      />

      {feedback ? <InlineMessage tone={feedbackTone}>{feedback}</InlineMessage> : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <SectionCard
            title={`Step ${step + 1}: ${steps[step].title}`}
            description={steps[step].detail}
          >
            {step === 0 ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--app-text-strong)]">
                    Completed CSEP file
                  </label>
                  <p className="mt-1 text-xs text-[var(--app-text)]">
                    Upload a completed contractor CSEP in PDF or DOCX format.
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="mt-3 block w-full max-w-xl text-sm text-[var(--app-text)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--app-panel)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--app-text-strong)]"
                    onChange={(event) => {
                      setDocumentFile(event.target.files?.[0] ?? null);
                      setReview(null);
                    }}
                  />
                </div>
                {documentFile ? (
                  <InlineMessage tone="success">{documentFile.name}</InlineMessage>
                ) : (
                  <InlineMessage>
                    This is an ad hoc superadmin diagnostic tool. It does not create a document record or touch the live CSEP builder flow.
                  </InlineMessage>
                )}
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-5">
                <label className="block">
                  <div className="mb-2 text-sm font-semibold text-[var(--app-text-strong)]">
                    Reviewer context
                  </div>
                  <textarea
                    rows={5}
                    value={reviewerContext}
                    onChange={(event) => setReviewerContext(event.target.value)}
                    placeholder="Optional: owner redlines, project-specific requirements, suspected gaps to verify, or expected CSEP sections."
                    className="w-full rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] px-4 py-3 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-[var(--app-accent-primary)]"
                  />
                </label>
                <div>
                  <label className="block text-sm font-semibold text-[var(--app-text-strong)]">
                    Site / GC reference documents
                  </label>
                  <p className="mt-1 text-xs text-[var(--app-text)]">
                    Optional PDF or DOCX files. The AI will compare the completed CSEP against all uploaded references as well as baseline CSEP expectations.
                  </p>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="mt-3 block w-full max-w-xl text-sm text-[var(--app-text)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--app-panel)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--app-text-strong)]"
                    onChange={(event) => {
                      setSiteDocumentFiles(Array.from(event.target.files ?? []));
                      setReview(null);
                    }}
                  />
                </div>
                {siteDocumentFiles.length ? (
                  <InlineMessage tone="success">
                    {siteDocumentFiles.length} reference file
                    {siteDocumentFiles.length === 1 ? "" : "s"} attached:{" "}
                    {siteDocumentFiles.map((file) => file.name).join(", ")}
                  </InlineMessage>
                ) : (
                  <InlineMessage>
                    No site references attached. The review will focus on the uploaded CSEP and baseline completeness checks.
                  </InlineMessage>
                )}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <button
                  type="button"
                  onClick={() => void runReview()}
                  disabled={reviewLoading || !documentFile}
                  className="rounded-xl bg-[var(--app-accent-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--app-accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reviewLoading ? "Running missing-items review..." : "Run missing-items review"}
                </button>

                {extraction ? (
                  <p className="text-xs text-[var(--app-text)]">
                    {extraction.ok
                      ? `Completed CSEP text extracted (${extraction.method}${extraction.truncated ? ", truncated" : ""}).`
                      : `Extraction warning: ${extraction.error}`}
                  </p>
                ) : null}
                {siteExtraction.length ? (
                  <div className="space-y-1 text-xs text-[var(--app-text)]">
                    {siteExtraction.map((item) => (
                      <p key={item.fileName}>
                        Reference file ({item.fileName}) extracted via {item.method}
                        {item.truncated ? ", truncated" : ""}.
                      </p>
                    ))}
                  </div>
                ) : null}
                {reviewDisclaimer ? <InlineMessage>{reviewDisclaimer}</InlineMessage> : null}

                {review ? (
                  <div className="space-y-4">
                    <InlineMessage tone={review.overallAssessment === "sufficient" ? "success" : "warning"}>
                      {review.executiveSummary}
                    </InlineMessage>
                    <Bucket
                      title="Missing items checklist"
                      items={review.missingItemsChecklist}
                      emptyLabel="No missing items were identified."
                    />
                    <Bucket
                      title="Builder review notes"
                      items={review.builderAlignmentNotes}
                      emptyLabel="No builder alignment notes were returned."
                    />
                    <SectionAuditBucket items={review.sectionReviewNotes} />
                    <FindingBucket items={review.detailedFindings} />
                    <Bucket
                      title="Gaps / ambiguities / weak sections"
                      items={review.gapsRisksOrClarifications}
                    />
                    <Bucket
                      title="Recommended edits before approval"
                      items={review.recommendedEditsBeforeApproval}
                    />
                    <Bucket
                      title="Document quality issues"
                      items={review.documentQualityIssues ?? []}
                      emptyLabel="No document quality issues flagged."
                    />
                    <Bucket
                      title="Checklist delta"
                      items={review.checklistDelta ?? []}
                      emptyLabel="No checklist delta items flagged."
                    />
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void downloadNotesDocument()}
                        disabled={downloadLoading}
                        className="rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--app-text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {downloadLoading
                          ? "Preparing review download..."
                          : documentFile?.name.toLowerCase().endsWith(".docx")
                            ? "Download annotated DOCX"
                            : "Download notes packet"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void downloadRebuiltDocument()}
                        disabled={rebuildLoading}
                        className="rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--app-text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {rebuildLoading
                          ? "Rebuilding Safety360 CSEP..."
                          : "Download rebuilt Safety360 CSEP"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <InlineMessage>
                    Run the review to generate the missing-items checklist for the uploaded completed CSEP.
                  </InlineMessage>
                )}
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
                  disabled={(step === 0 && !documentFile) || reviewLoading}
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
            title="Completed-CSEP review flow"
            description="Upload the finished file, add any reference context, and run the checklist review without entering the live builder flow."
            steps={workflowSteps}
          />

          <StartChecklist title="Readiness checklist" items={readinessChecklist} />

          <SectionCard
            title="Review focus"
            description="What the AI prioritizes in this mode."
          >
            <Bucket
              title="Primary checks"
              items={[
                "Missing or incomplete CSEP sections",
                "Weak scope, hazard, control, PPE, and permit coverage",
                "Missing responsibilities, emergency procedures, training, inspections, and environmental controls",
              ]}
            />
            <Bucket
              title="Rebuild mode"
              items={[
                "Uses the uploaded completed CSEP as the source document",
                "Runs the builder-style review first so the rebuild fixes the main gaps",
                "Returns a Safety360-formatted DOCX you can review and issue",
              ]}
            />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function Bucket({
  title,
  items,
  emptyLabel = "No items to show.",
}: {
  title: string;
  items: string[];
  emptyLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
      <div className="text-sm font-semibold text-[var(--app-text-strong)]">{title}</div>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm text-[var(--app-text)]">
          {items.map((item) => (
            <li key={item} className="rounded-xl bg-[var(--semantic-neutral-bg)] px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--app-text)]">{emptyLabel}</p>
      )}
    </div>
  );
}

function FindingBucket({ items }: { items: BuilderProgramAiReviewFinding[] }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
      <div className="text-sm font-semibold text-[var(--app-text-strong)]">
        Document review findings
      </div>
      {items.length ? (
        <div className="mt-3 space-y-3">
          {items.map((item, index) => (
            <div
              key={`${item.sectionLabel}-${index}`}
              className="rounded-2xl border border-[var(--app-border)] bg-white p-4"
            >
              <div className="text-sm font-semibold text-[var(--app-text-strong)]">
                {index + 1}. {item.sectionLabel}
              </div>
              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-[var(--semantic-neutral-bg)] px-3 py-3 text-sm leading-6 text-[var(--app-text)]">
                {buildHumanFindingParagraph(item)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--app-text)]">
          No detailed findings were returned.
        </p>
      )}
    </div>
  );
}

function buildHumanFindingParagraph(item: BuilderProgramAiReviewFinding) {
  return formatCsepFindingNote(item);
}

function SectionAuditBucket({ items }: { items: BuilderProgramAiReviewSectionNote[] }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
      <div className="text-sm font-semibold text-[var(--app-text-strong)]">
        Section-by-section builder audit
      </div>
      {items.length ? (
        <div className="mt-3 space-y-3">
          {items.map((item, index) => (
            <div
              key={`${item.sectionLabel}-${index}`}
              className="rounded-2xl border border-[var(--app-border)] bg-white p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold text-[var(--app-text-strong)]">
                  {index + 1}. {item.sectionLabel}
                </div>
                <StatusBadge
                  label={
                    item.status === "present"
                      ? "Present"
                      : item.status === "missing"
                        ? "Missing"
                        : "Partial"
                  }
                  tone={
                    item.status === "present"
                      ? "success"
                      : item.status === "missing"
                        ? "warning"
                        : "info"
                  }
                />
              </div>
              <div className="mt-3 space-y-3 text-sm text-[var(--app-text)]">
                {getCsepSectionNoteFields(item).map((field) => (
                  <FindingField key={field.label} label={field.label} value={field.value} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--app-text)]">
          No section-by-section builder audit was returned.
        </p>
      )}
    </div>
  );
}

function FindingField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--semantic-neutral-bg)] px-3 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-text-muted)]">
        {label}
      </div>
      <div className="mt-1 whitespace-pre-wrap text-sm text-[var(--app-text)]">{value}</div>
    </div>
  );
}
