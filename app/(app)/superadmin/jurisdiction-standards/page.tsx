"use client";

import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_JURISDICTION_STANDARDS_CONFIG,
  normalizeJurisdictionStandardsConfig,
} from "@/lib/jurisdictionStandards/catalog";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  appNativeSelectClassName,
} from "@/components/WorkspacePrimitives";
import type {
  JurisdictionStandard,
  JurisdictionStandardContent,
  JurisdictionStandardMapping,
  JurisdictionStandardsConfig,
} from "@/types/jurisdiction-standards";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function cloneConfig(config: JurisdictionStandardsConfig): JurisdictionStandardsConfig {
  return JSON.parse(JSON.stringify(config)) as JurisdictionStandardsConfig;
}

function linesToText(values: string[] | undefined) {
  return (values ?? []).join("\n");
}

function parseLines(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function formatJson(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2);
}

function parseJsonObject(value: string) {
  if (!value.trim()) {
    return {};
  }
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Applicability must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

const CONTENT_FIELDS: Array<{
  key: keyof Pick<
    JurisdictionStandardContent,
    | "bullets"
    | "oshaRefs"
    | "requiredControls"
    | "responsibilitiesTraining"
    | "permitNotes"
    | "trainingNotes"
  >;
  label: string;
  help: string;
}> = [
  { key: "bullets", label: "Bullets", help: "One line per bullet." },
  { key: "oshaRefs", label: "References", help: "One reference per line." },
  { key: "requiredControls", label: "Required Controls", help: "One control per line." },
  {
    key: "responsibilitiesTraining",
    label: "Responsibilities & Training",
    help: "One line per note.",
  },
  { key: "permitNotes", label: "Permit Notes", help: "One line per note." },
  { key: "trainingNotes", label: "Training Notes", help: "One line per note." },
];

export default function SuperadminJurisdictionStandardsPage() {
  const [config, setConfig] = useState<JurisdictionStandardsConfig>(
    cloneConfig(DEFAULT_JURISDICTION_STANDARDS_CONFIG)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "error">("neutral");
  const [selectedJurisdiction, setSelectedJurisdiction] = useState("federal");
  const [selectedSurface, setSelectedSurface] = useState<"csep" | "peshep" | "both">("both");
  const [selectedStandardId, setSelectedStandardId] = useState("std_federal_baseline");
  const [applicabilityDraft, setApplicabilityDraft] = useState("{}");

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

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const token = await getAccessToken();
      const res = await fetch("/api/superadmin/jurisdiction-standards/config", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => null)) as
        | (JurisdictionStandardsConfig & { error?: string })
        | null;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load jurisdiction standards.");
      }

      const normalized = normalizeJurisdictionStandardsConfig(data);
      setConfig(cloneConfig(normalized));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load jurisdiction standards.");
      setMessageTone("error");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const filteredStandards = useMemo(() => {
    return config.standards.filter((standard) => {
      if (standard.jurisdictionCode !== selectedJurisdiction) {
        return false;
      }
      return selectedSurface === "both"
        ? true
        : standard.surfaceScope === "both" || standard.surfaceScope === selectedSurface;
    });
  }, [config.standards, selectedJurisdiction, selectedSurface]);

  useEffect(() => {
    if (!filteredStandards.some((standard) => standard.id === selectedStandardId)) {
      setSelectedStandardId(filteredStandards[0]?.id ?? "");
    }
  }, [filteredStandards, selectedStandardId]);

  const selectedStandard =
    filteredStandards.find((standard) => standard.id === selectedStandardId) ??
    filteredStandards[0] ??
    null;

  const selectedMappings = useMemo(() => {
    if (!selectedStandard) return [];
    return config.mappings.filter((mapping) => mapping.standardId === selectedStandard.id);
  }, [config.mappings, selectedStandard]);

  useEffect(() => {
    if (!selectedStandard) {
      setApplicabilityDraft("{}");
      return;
    }
    setApplicabilityDraft(formatJson(selectedStandard.applicability));
  }, [selectedStandard]);

  function updateStandard(
    standardId: string,
    updater: (current: JurisdictionStandard) => JurisdictionStandard
  ) {
    setConfig((current) => ({
      ...current,
      standards: current.standards.map((standard) =>
        standard.id === standardId ? updater(standard) : standard
      ),
    }));
  }

  function updateContentField(
    contentKey: keyof Pick<
      JurisdictionStandardContent,
      | "body"
      | "builderGuidance"
      | "adminReviewNote"
      | "bullets"
      | "oshaRefs"
      | "requiredControls"
      | "responsibilitiesTraining"
      | "permitNotes"
      | "trainingNotes"
    >,
    value: string
  ) {
    if (!selectedStandard) return;
    updateStandard(selectedStandard.id, (current) => ({
      ...current,
      content: {
        ...current.content,
        [contentKey]:
          contentKey === "body" ||
          contentKey === "builderGuidance" ||
          contentKey === "adminReviewNote"
            ? value.trim() || null
            : parseLines(value),
      },
    }));
  }

  function updateChecklistField(field: "requiredFields" | "note", value: string) {
    if (!selectedStandard) return;
    updateStandard(selectedStandard.id, (current) => ({
      ...current,
      content: {
        ...current.content,
        checklist: {
          requiredFields:
            field === "requiredFields"
              ? parseLines(value)
              : current.content.checklist?.requiredFields ?? [],
          note: field === "note" ? value.trim() || null : current.content.checklist?.note ?? null,
        },
      },
    }));
  }

  function updateMapping(
    mappingId: string,
    field: "mappingType" | "mappingKey",
    value: string
  ) {
    setConfig((current) => ({
      ...current,
      mappings: current.mappings.map((mapping, mappingIndex) =>
        current.mappings[mappingIndex]?.id === mappingId
          ? {
              ...mapping,
              [field]: value,
            }
          : mapping
      ),
    }));
  }

  function addMapping() {
    if (!selectedStandard) return;
    setConfig((current) => ({
      ...current,
      mappings: [
        ...current.mappings,
        {
          id: `${selectedStandard.id}_mapping_${crypto.randomUUID().slice(0, 8)}`,
          standardId: selectedStandard.id,
          mappingType: "section_key",
          mappingKey: "jurisdiction_profile",
          metadata: {},
        },
      ],
    }));
  }

  function removeMapping(mappingId: string) {
    setConfig((current) => ({
      ...current,
      mappings: current.mappings.filter((mapping) => mapping.id !== mappingId),
    }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    try {
      const nextConfig = normalizeJurisdictionStandardsConfig({
        ...config,
        standards: config.standards.map((standard) =>
          standard.id === selectedStandard?.id
            ? {
                ...standard,
                applicability: parseJsonObject(applicabilityDraft),
              }
            : standard
        ),
      });

      const token = await getAccessToken();
      const res = await fetch("/api/superadmin/jurisdiction-standards/config", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(nextConfig),
      });
      const data = (await res.json().catch(() => null)) as
        | (JurisdictionStandardsConfig & { error?: string })
        | null;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save jurisdiction standards.");
      }

      setConfig(cloneConfig(normalizeJurisdictionStandardsConfig(data)));
      setMessage(
        "Jurisdiction standards saved. New CSEP and PESHEP drafts will use the updated guidance and mappings."
      );
      setMessageTone("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save jurisdiction standards.");
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRefresh() {
    await loadConfig();
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Super Admin"
        title="Jurisdiction Standards"
        description="Manage the seeded federal OSHA baseline plus state-plan overlays used by the CSEP and PESHEP builders. All-state building and environmental supplements are also available in the draft workflow, while source citations, checklist requirements, and builder mappings remain editable without a redeploy."
        actions={
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || saving}
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Jurisdiction Standards"}
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading || saving}
              className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50 disabled:opacity-60"
            >
              Reload
            </button>
          </>
        }
      />

      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.6fr]">
        <SectionCard
          title="Jurisdiction Picker"
          description="Filter the standards bank to the state-plan or federal profile you want to review."
        >
          <label className="block text-sm font-semibold text-slate-300">
            Jurisdiction
            <select
              value={selectedJurisdiction}
              onChange={(event) => setSelectedJurisdiction(event.target.value)}
              className={`mt-2 w-full ${appNativeSelectClassName}`}
            >
              {config.jurisdictions.map((jurisdiction) => (
                <option key={jurisdiction.code} value={jurisdiction.code}>
                  {jurisdiction.displayName}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-300">
            Surface
            <select
              value={selectedSurface}
              onChange={(event) =>
                setSelectedSurface(event.target.value as "csep" | "peshep" | "both")
              }
              className={`mt-2 w-full ${appNativeSelectClassName}`}
            >
              <option value="both">Both builders</option>
              <option value="csep">CSEP only</option>
              <option value="peshep">PESHEP only</option>
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-300">
            Standard
            <select
              value={selectedStandardId}
              onChange={(event) => setSelectedStandardId(event.target.value)}
              className={`mt-2 w-full ${appNativeSelectClassName}`}
            >
              {filteredStandards.map((standard) => (
                <option key={standard.id} value={standard.id}>
                  {standard.title}
                </option>
              ))}
            </select>
          </label>

          {selectedStandard ? (
            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 text-sm text-slate-400">
              <div>
                <span className="font-semibold text-slate-200">Type:</span>{" "}
                {selectedStandard.standardType}
              </div>
              <div className="mt-2">
                <span className="font-semibold text-slate-200">Source:</span>{" "}
                {selectedStandard.sourceAuthority}
              </div>
              <div className="mt-2">
                <span className="font-semibold text-slate-200">Last reviewed:</span>{" "}
                {selectedStandard.lastReviewedDate}
              </div>
              <div className="mt-2">
                <span className="font-semibold text-slate-200">Surface scope:</span>{" "}
                {selectedStandard.surfaceScope}
              </div>
            </div>
          ) : null}
        </SectionCard>

        {selectedStandard ? (
          <div className="space-y-6">
            <SectionCard
              title="Guidance Editor"
              description="Edit the live summary text, checklist requirements, and builder-facing guidance for the selected standard."
            >
              <Field label="Title">
                <input
                  type="text"
                  value={selectedStandard.title}
                  onChange={(event) =>
                    updateStandard(selectedStandard.id, (current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
                />
              </Field>

              <Field label="Summary">
                <textarea
                  value={selectedStandard.summary}
                  onChange={(event) =>
                    updateStandard(selectedStandard.id, (current) => ({
                      ...current,
                      summary: event.target.value,
                    }))
                  }
                  rows={4}
                  className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
                />
              </Field>

              <Field label="Applicability JSON" help="Structured applicability tags used by future rule routing.">
                <textarea
                  value={applicabilityDraft}
                  onChange={(event) => setApplicabilityDraft(event.target.value)}
                  rows={6}
                  className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 font-mono text-sm text-slate-200 outline-none focus:border-sky-500"
                />
              </Field>

              <Field label="Body">
                <textarea
                  value={selectedStandard.content.body ?? ""}
                  onChange={(event) => updateContentField("body", event.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
                />
              </Field>

              <Field label="Builder Guidance">
                <textarea
                  value={selectedStandard.content.builderGuidance ?? ""}
                  onChange={(event) => updateContentField("builderGuidance", event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
                />
              </Field>

              <Field label="Admin Review Note">
                <textarea
                  value={selectedStandard.content.adminReviewNote ?? ""}
                  onChange={(event) => updateContentField("adminReviewNote", event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
                />
              </Field>

              {CONTENT_FIELDS.map((field) => (
                <Field key={field.key} label={field.label} help={field.help}>
                  <textarea
                    value={linesToText(selectedStandard.content[field.key])}
                    onChange={(event) => updateContentField(field.key, event.target.value)}
                    rows={field.key === "requiredControls" ? 6 : 4}
                    className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
                  />
                </Field>
              ))}

              <Field
                label="Checklist Required Fields"
                help="Use form-data field keys such as inspection_process_text or site_specific_notes."
              >
                <textarea
                  value={linesToText(selectedStandard.content.checklist?.requiredFields)}
                  onChange={(event) => updateChecklistField("requiredFields", event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
                />
              </Field>

              <Field label="Checklist Note">
                <textarea
                  value={selectedStandard.content.checklist?.note ?? ""}
                  onChange={(event) => updateChecklistField("note", event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
                />
              </Field>
            </SectionCard>

            <SectionCard
              title="Mappings"
              description="Control which section keys or program items receive this standard during generation."
              aside={
                <button
                  type="button"
                  onClick={addMapping}
                  className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
                >
                  Add Mapping
                </button>
              }
            >
              {selectedMappings.length ? (
                <div className="space-y-4">
                  {selectedMappings.map((mapping, index) => (
                    <div
                      key={mapping.id}
                      className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4"
                    >
                      <div className="grid gap-4 md:grid-cols-[0.7fr_1.4fr_auto] md:items-end">
                        <label className="block text-sm font-semibold text-slate-300">
                          Mapping Type
                          <select
                            value={mapping.mappingType}
                            onChange={(event) =>
                              updateMapping(mapping.id, "mappingType", event.target.value)
                            }
                            className={`mt-2 w-full ${appNativeSelectClassName}`}
                          >
                            <option value="section_key">Section key</option>
                            <option value="program_item">Program item</option>
                            <option value="pshsep_catalog">PESHEP catalog</option>
                            <option value="checklist_field">Checklist field</option>
                          </select>
                        </label>

                        <Field label="Mapping Key">
                          <input
                            type="text"
                            value={mapping.mappingKey}
                            onChange={(event) =>
                              updateMapping(mapping.id, "mappingKey", event.target.value)
                            }
                            className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
                          />
                        </Field>

                        <button
                          type="button"
                          onClick={() => removeMapping(mapping.id)}
                          className="rounded-xl border border-rose-500/40 px-4 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-950/30"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  No mappings yet. Add one to route this standard into a section or program block.
                </p>
              )}
            </SectionCard>

            <SectionCard
              title="Source Traceability"
              description="Official primary-source references stay visible here for review and audit."
            >
              <dl className="grid gap-4 md:grid-cols-2">
                <InfoRow label="Source title" value={selectedStandard.sourceTitle} />
                <InfoRow label="Source authority" value={selectedStandard.sourceAuthority} />
                <InfoRow label="Source URL" value={selectedStandard.sourceUrl} />
                <InfoRow
                  label="Effective date"
                  value={selectedStandard.effectiveDate ?? "Not listed"}
                />
                <InfoRow label="Last reviewed" value={selectedStandard.lastReviewedDate} />
              </dl>
            </SectionCard>
          </div>
        ) : (
          <SectionCard
            title="No Standard Selected"
            description="Choose a jurisdiction and surface to begin editing the standards bank."
          >
            <p className="text-sm text-slate-400">
              No standards match the current filter.
            </p>
          </SectionCard>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-300">{label}</span>
      {help ? <p className="text-xs text-slate-500">{help}</p> : null}
      {children}
    </label>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-950/35 p-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</dt>
      <dd className="mt-2 break-all text-sm text-slate-200">{value}</dd>
    </div>
  );
}
