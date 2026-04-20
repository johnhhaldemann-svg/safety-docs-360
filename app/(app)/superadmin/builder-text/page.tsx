"use client";

import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG,
  cloneDocumentBuilderTextConfig,
} from "@/lib/documentBuilderText";
import {
  getDefaultProgramDefinitions,
  getProgramDefinitionKey,
} from "@/lib/csepPrograms";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  appNativeSelectClassName,
} from "@/components/WorkspacePrimitives";
import type {
  DocumentBuilderId,
  DocumentBuilderSectionTemplate,
  DocumentBuilderTextConfig,
} from "@/types/document-builder-text";
import type {
  CSEPProgramConfig,
  CSEPProgramDefinition,
  CSEPProgramDefinitionContent,
  CSEPProgramSubtypeValue,
} from "@/types/csep-programs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type BuilderTab = "csep_sections" | "site_builder_sections" | "csep_programs";

type ProgramArrayField = keyof Pick<
  CSEPProgramDefinitionContent,
  | "applicableWhen"
  | "oshaRefs"
  | "responsibilities"
  | "preTaskProcedures"
  | "workProcedures"
  | "stopWorkProcedures"
  | "closeoutProcedures"
  | "training"
  | "controls"
>;

type FlattenedBuilderSection = {
  path: number[];
  pathKey: string;
  depth: number;
  label: string;
  title: string;
  key: string;
  childCount: number;
  paragraphs: string[];
  bullets: string[];
};

const ARRAY_FIELDS: Array<{
  field: ProgramArrayField;
  label: string;
  help: string;
}> = [
  { field: "applicableWhen", label: "When It Applies", help: "One bullet per line." },
  { field: "oshaRefs", label: "Applicable References", help: "One OSHA reference per line." },
  { field: "responsibilities", label: "Responsibilities", help: "One responsibility bullet per line." },
  { field: "preTaskProcedures", label: "Pre-Task Setup", help: "One procedure bullet per line." },
  { field: "workProcedures", label: "Work Execution", help: "One procedure bullet per line." },
  { field: "stopWorkProcedures", label: "Stop-Work / Escalation", help: "One procedure bullet per line." },
  { field: "closeoutProcedures", label: "Post-Task / Closeout", help: "One procedure bullet per line." },
  { field: "training", label: "Training", help: "One training bullet per line." },
  { field: "controls", label: "Minimum Required Controls", help: "One control bullet per line." },
];

function cloneProgramDefinitions(definitions: CSEPProgramDefinition[]) {
  return definitions.map((definition) => ({
    ...definition,
    oshaRefs: [...definition.oshaRefs],
    applicableWhen: [...definition.applicableWhen],
    responsibilities: [...definition.responsibilities],
    preTaskProcedures: [...definition.preTaskProcedures],
    workProcedures: [...definition.workProcedures],
    stopWorkProcedures: [...definition.stopWorkProcedures],
    closeoutProcedures: [...definition.closeoutProcedures],
    training: [...definition.training],
    controls: [...definition.controls],
    subtypeVariants: definition.subtypeVariants
      ? Object.fromEntries(
          Object.entries(definition.subtypeVariants).map(([key, value]) => [
            key,
            value
              ? {
                  ...value,
                  oshaRefs: [...(value.oshaRefs ?? [])],
                  applicableWhen: [...(value.applicableWhen ?? [])],
                  responsibilities: [...(value.responsibilities ?? [])],
                  preTaskProcedures: [...(value.preTaskProcedures ?? [])],
                  workProcedures: [...(value.workProcedures ?? [])],
                  stopWorkProcedures: [...(value.stopWorkProcedures ?? [])],
                  closeoutProcedures: [...(value.closeoutProcedures ?? [])],
                  training: [...(value.training ?? [])],
                  controls: [...(value.controls ?? [])],
                }
              : value,
          ])
        ) as CSEPProgramDefinition["subtypeVariants"]
      : undefined,
  }));
}

function linesToText(values: string[]) {
  return values.join("\n");
}

function parseLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getPathKey(path: number[]) {
  return path.join(".");
}

function flattenBuilderSections(
  sections: DocumentBuilderSectionTemplate[],
  path: number[] = [],
  depth = 0
): FlattenedBuilderSection[] {
  return sections.flatMap((section, index) => {
    const nextPath = [...path, index];
    const current: FlattenedBuilderSection = {
      path: nextPath,
      pathKey: getPathKey(nextPath),
      depth,
      label: section.label,
      title: section.title,
      key: section.key,
      childCount: section.children.length,
      paragraphs: [...section.paragraphs],
      bullets: [...section.bullets],
    };

    return [current, ...flattenBuilderSections(section.children, nextPath, depth + 1)];
  });
}

function getArrayFieldRows(field: ProgramArrayField) {
  return field === "controls" ||
    field === "preTaskProcedures" ||
    field === "workProcedures" ||
    field === "stopWorkProcedures" ||
    field === "closeoutProcedures"
    ? 6
    : 4;
}

function updateSectionsAtPath(
  sections: DocumentBuilderSectionTemplate[],
  path: number[],
  updater: (section: DocumentBuilderSectionTemplate) => DocumentBuilderSectionTemplate
): DocumentBuilderSectionTemplate[] {
  const [index, ...rest] = path;

  return sections.map((section, sectionIndex) => {
    if (sectionIndex !== index) {
      return section;
    }

    if (rest.length === 0) {
      return updater(section);
    }

    return {
      ...section,
      children: updateSectionsAtPath(section.children, rest, updater),
    };
  });
}

export default function SuperadminBuilderTextPage() {
  const [activeTab, setActiveTab] = useState<BuilderTab>("csep_sections");
  const [builderConfig, setBuilderConfig] = useState<DocumentBuilderTextConfig>(
    cloneDocumentBuilderTextConfig(DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG)
  );
  const [programConfig, setProgramConfig] = useState<CSEPProgramConfig>({
    definitions: getDefaultProgramDefinitions(),
  });
  const [loading, setLoading] = useState(true);
  const [builderSaving, setBuilderSaving] = useState(false);
  const [programSaving, setProgramSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedKey, setSelectedKey] = useState(
    getProgramDefinitionKey(getDefaultProgramDefinitions()[0])
  );
  const [selectedSectionKeys, setSelectedSectionKeys] = useState<Record<DocumentBuilderId, string>>({
    csep: "0",
    site_builder: "0",
  });

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

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const token = await getAccessToken();
      const [builderRes, programRes] = await Promise.all([
        fetch("/api/superadmin/builder-text/config", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/superadmin/csep-programs/config", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const builderData = (await builderRes.json().catch(() => null)) as
        | (DocumentBuilderTextConfig & { error?: string })
        | null;
      const programData = (await programRes.json().catch(() => null)) as
        | (CSEPProgramConfig & { error?: string })
        | null;

      if (!builderRes.ok) {
        throw new Error(builderData?.error || "Failed to load builder text settings.");
      }

      if (!programRes.ok) {
        throw new Error(programData?.error || "Failed to load CSEP program settings.");
      }

      if (builderData?.builders) {
        setBuilderConfig(cloneDocumentBuilderTextConfig(builderData));
      }

      if (programData?.definitions) {
        setProgramConfig({
          definitions: cloneProgramDefinitions(programData.definitions),
        });
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to load builder text settings."
      );
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!programConfig.definitions.some((definition) => getProgramDefinitionKey(definition) === selectedKey)) {
      const first = programConfig.definitions[0];
      if (first) {
        setSelectedKey(getProgramDefinitionKey(first));
      }
    }
  }, [programConfig.definitions, selectedKey]);

  const selectedProgram =
    programConfig.definitions.find((definition) => getProgramDefinitionKey(definition) === selectedKey) ??
    programConfig.definitions[0] ??
    null;

  const activeBuilderId: DocumentBuilderId =
    activeTab === "csep_sections" ? "csep" : "site_builder";

  const flattenedSections = useMemo(
    () => ({
      csep: flattenBuilderSections(builderConfig.builders.csep.sections),
      site_builder: flattenBuilderSections(builderConfig.builders.site_builder.sections),
    }),
    [builderConfig]
  );

  useEffect(() => {
    setSelectedSectionKeys((current) => {
      const next = { ...current };
      (["csep", "site_builder"] as DocumentBuilderId[]).forEach((builderId) => {
        const sections = flattenedSections[builderId];
        if (!sections.length) {
          next[builderId] = "";
        } else if (!sections.some((section) => section.pathKey === current[builderId])) {
          next[builderId] = sections[0].pathKey;
        }
      });
      return next;
    });
  }, [flattenedSections]);

  const selectedSection =
    activeTab === "csep_programs"
      ? null
      : flattenedSections[activeBuilderId].find(
          (section) => section.pathKey === selectedSectionKeys[activeBuilderId]
        ) ?? flattenedSections[activeBuilderId][0] ?? null;

  function updateBuilderSection(
    builderId: DocumentBuilderId,
    path: number[],
    updater: (section: DocumentBuilderSectionTemplate) => DocumentBuilderSectionTemplate
  ) {
    setBuilderConfig((prev) => ({
      builders: {
        ...prev.builders,
        [builderId]: {
          sections: updateSectionsAtPath(prev.builders[builderId].sections, path, updater),
        },
      },
    }));
  }

  function updateProgram(
    key: string,
    updater: (definition: CSEPProgramDefinition) => CSEPProgramDefinition
  ) {
    setProgramConfig((prev) => ({
      definitions: prev.definitions.map((definition) =>
        getProgramDefinitionKey(definition) === key ? updater(definition) : definition
      ),
    }));
  }

  async function handleSaveBuilderText() {
    setBuilderSaving(true);
    setMessage("");

    try {
      const token = await getAccessToken();
      const res = await fetch("/api/superadmin/builder-text/config", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(builderConfig),
      });
      const data = (await res.json().catch(() => null)) as
        | (DocumentBuilderTextConfig & { error?: string })
        | null;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save builder text settings.");
      }

      if (data?.builders) {
        setBuilderConfig(cloneDocumentBuilderTextConfig(data));
      }

      setMessage("Builder text settings saved. New documents will use the updated section text.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to save builder text settings."
      );
    } finally {
      setBuilderSaving(false);
    }
  }

  async function handleSavePrograms() {
    setProgramSaving(true);
    setMessage("");

    try {
      const token = await getAccessToken();
      const res = await fetch("/api/superadmin/csep-programs/config", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(programConfig),
      });

      const data = (await res.json().catch(() => null)) as
        | (CSEPProgramConfig & { error?: string })
        | null;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save CSEP program settings.");
      }

      if (data?.definitions) {
        setProgramConfig({ definitions: cloneProgramDefinitions(data.definitions) });
      }

      setMessage("CSEP program blocks saved. New documents will use the updated program text.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to save CSEP program settings."
      );
    } finally {
      setProgramSaving(false);
    }
  }

  async function handleReload() {
    await loadSettings();
  }

  const actions: ReactNode =
    activeTab === "csep_programs" ? (
      <>
        <button
          type="button"
          onClick={handleSavePrograms}
          disabled={loading || programSaving}
          className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
        >
          {programSaving ? "Saving..." : "Save CSEP Program Blocks"}
        </button>
        <button
          type="button"
          onClick={handleReload}
          disabled={loading || programSaving}
          className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
        >
          Reload
        </button>
      </>
    ) : (
      <>
        <button
          type="button"
          onClick={handleSaveBuilderText}
          disabled={loading || builderSaving}
          className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
        >
          {builderSaving ? "Saving..." : "Save Builder Text"}
        </button>
        <button
          type="button"
          onClick={handleReload}
          disabled={loading || builderSaving}
          className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
        >
          Reload
        </button>
      </>
    );

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Super Admin"
        title="Builder Text Settings"
        description="Manage the system-authored text used by the builder-generated CSEP and site safety documents. Company-entered builder answers stay in the builder forms; changes here apply to newly generated docs."
        actions={actions}
      />

      {message ? <InlineMessage>{message}</InlineMessage> : null}

      <SectionCard title="Editor Scope" description="Choose which builder text set you want to manage.">
        <div className="flex flex-wrap gap-3">
          {[
            ["csep_sections", "CSEP Sections"],
            ["site_builder_sections", "Site Builder Sections"],
            ["csep_programs", "CSEP Program Blocks"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value as BuilderTab)}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                activeTab === value
                  ? "bg-sky-600 text-white"
                  : "border border-slate-600 text-slate-300 hover:bg-slate-950/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </SectionCard>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.6fr]">
        {activeTab === "csep_programs" ? (
        <>
        <SectionCard title="Program Picker" description="Choose the exact reusable program block you want to review or rewrite.">
          <label className="block text-sm font-semibold text-slate-300">
            Program
            <select
              value={selectedKey}
              onChange={(event) => setSelectedKey(event.target.value)}
              className={`mt-2 w-full ${appNativeSelectClassName}`}
            >
              {programConfig.definitions.map((definition) => (
                <option key={getProgramDefinitionKey(definition)} value={getProgramDefinitionKey(definition)}>
                  {definition.category.toUpperCase()} · {definition.title}
                </option>
              ))}
            </select>
          </label>

          {selectedProgram ? (
            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 text-sm text-slate-400">
              <div>
                <span className="font-semibold text-slate-200">Trigger item:</span>{" "}
                {selectedProgram.item}
              </div>
              <div className="mt-2">
                <span className="font-semibold text-slate-200">Category:</span>{" "}
                {selectedProgram.category}
              </div>
              <div className="mt-2">
                <span className="font-semibold text-slate-200">Subtype group:</span>{" "}
                {selectedProgram.subtypeGroup ?? "None"}
              </div>
            </div>
          ) : null}
        </SectionCard>

        {selectedProgram ? (
          <div className="space-y-6">
            <ProgramEditor
              selectedProgram={selectedProgram}
              updateProgram={updateProgram}
            />
          </div>
        ) : (
          <SectionCard
            title="No Program Selected"
            description="Choose a program block to start editing the catalog-backed CSEP text."
          >
            <p className="text-sm text-slate-400">No program blocks are available.</p>
          </SectionCard>
        )}
        </>
      ) : (
        <>
          <SectionCard
            title="Section Picker"
            description="Pick the exact generated section you want to manage for the active builder."
          >
            <label className="block text-sm font-semibold text-slate-300">
              Builder
              <select
                value={activeTab}
                onChange={(event) => setActiveTab(event.target.value as BuilderTab)}
                className={`mt-2 w-full ${appNativeSelectClassName}`}
              >
                <option value="csep_sections">CSEP Sections</option>
                <option value="site_builder_sections">Site Builder Sections</option>
              </select>
            </label>

            <label className="block text-sm font-semibold text-slate-300">
              Section
              <select
                value={selectedSectionKeys[activeBuilderId] ?? ""}
                onChange={(event) =>
                  setSelectedSectionKeys((current) => ({
                    ...current,
                    [activeBuilderId]: event.target.value,
                  }))
                }
                className={`mt-2 w-full ${appNativeSelectClassName}`}
              >
                {flattenedSections[activeBuilderId].map((section) => (
                  <option key={section.pathKey} value={section.pathKey}>
                    {"  ".repeat(section.depth)}
                    {section.label}
                  </option>
                ))}
              </select>
            </label>

            {selectedSection ? (
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 text-sm text-slate-400">
                <div>
                  <span className="font-semibold text-slate-200">Stable key:</span>{" "}
                  {selectedSection.key}
                </div>
                <div className="mt-2">
                  <span className="font-semibold text-slate-200">Export title:</span>{" "}
                  {selectedSection.title}
                </div>
                <div className="mt-2">
                  <span className="font-semibold text-slate-200">Depth:</span>{" "}
                  {selectedSection.depth}
                </div>
                <div className="mt-2">
                  <span className="font-semibold text-slate-200">Child sections:</span>{" "}
                  {selectedSection.childCount}
                </div>
              </div>
            ) : null}
          </SectionCard>

          {selectedSection ? (
            <div className="space-y-6">
              <BuilderSectionEditor
                section={selectedSection}
                builderId={activeBuilderId}
                onSelectPath={(pathKey) =>
                  setSelectedSectionKeys((current) => ({
                    ...current,
                    [activeBuilderId]: pathKey,
                  }))
                }
                onUpdateSection={updateBuilderSection}
                options={flattenedSections[activeBuilderId]}
              />
            </div>
          ) : (
            <SectionCard
              title="No Section Selected"
              description="Choose a builder section to begin editing the generated text."
            >
              <p className="text-sm text-slate-400">No builder sections are available.</p>
            </SectionCard>
          )}
        </>
        )}
      </section>
    </div>
  );
}

function BuilderSectionEditor({
  section,
  builderId,
  onSelectPath,
  onUpdateSection,
  options,
}: {
  section: FlattenedBuilderSection;
  builderId: DocumentBuilderId;
  onSelectPath: (pathKey: string) => void;
  onUpdateSection: (
    builderId: DocumentBuilderId,
    path: number[],
    updater: (section: DocumentBuilderSectionTemplate) => DocumentBuilderSectionTemplate
  ) => void;
  options: FlattenedBuilderSection[];
}) {
  return (
    <SectionCard
      title={section.label}
      description={`Stable key: ${section.key}`}
    >
      <Field label="Export Title">
        <input
          type="text"
          value={section.title}
          onChange={(event) =>
            onUpdateSection(builderId, section.path, (current) => ({
              ...current,
              title: event.target.value,
            }))
          }
          className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
        />
      </Field>

      <Field label="Paragraphs" help="One paragraph per line. Leave blank if this section should only use bullets or child sections.">
        <textarea
          value={linesToText(section.paragraphs)}
          onChange={(event) =>
            onUpdateSection(builderId, section.path, (current) => ({
              ...current,
              paragraphs: parseLines(event.target.value),
            }))
          }
          rows={Math.max(3, section.paragraphs.length || 3)}
          className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
        />
      </Field>

      <Field label="Bullets" help="One bullet per line.">
        <textarea
          value={linesToText(section.bullets)}
          onChange={(event) =>
            onUpdateSection(builderId, section.path, (current) => ({
              ...current,
              bullets: parseLines(event.target.value),
            }))
          }
          rows={Math.max(3, section.bullets.length || 3)}
          className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
        />
      </Field>

      {options.some((option) => getPathKey(option.path.slice(0, -1)) === section.pathKey) ? (
        <div className="space-y-5 rounded-2xl border border-slate-700/80 bg-slate-950/30 p-4">
          <div className="text-sm font-semibold text-slate-200">Child Sections</div>
          <div className="grid gap-3">
            {options
              .filter((option) => getPathKey(option.path.slice(0, -1)) === section.pathKey)
              .map((child) => (
                <button
                  key={child.pathKey}
                  type="button"
                  onClick={() => onSelectPath(child.pathKey)}
                  className="rounded-xl border border-slate-700/70 bg-slate-950/40 px-4 py-3 text-left text-sm text-slate-300 transition hover:bg-slate-900/60"
                >
                  <span className="block font-semibold text-slate-100">{child.label}</span>
                  <span className="mt-1 block text-xs text-slate-400">{child.key}</span>
                </button>
              ))}
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

function ProgramEditor({
  selectedProgram,
  updateProgram,
}: {
  selectedProgram: CSEPProgramDefinition;
  updateProgram: (
    key: string,
    updater: (definition: CSEPProgramDefinition) => CSEPProgramDefinition
  ) => void;
}) {
  const key = getProgramDefinitionKey(selectedProgram);

  return (
    <div className="space-y-6">
      <ProgramEditorCard
        title="Base Program Block"
        description="Default text used for the selected program."
        definition={selectedProgram}
        onTextChange={(field, value) =>
          updateProgram(key, (definition) => ({ ...definition, [field]: value }))
        }
        onArrayChange={(field, value) =>
          updateProgram(key, (definition) => ({ ...definition, [field]: parseLines(value) }))
        }
      />
      {selectedProgram.subtypeVariants
        ? (Object.entries(selectedProgram.subtypeVariants) as Array<
            [CSEPProgramSubtypeValue, NonNullable<CSEPProgramDefinition["subtypeVariants"]>[CSEPProgramSubtypeValue]]
          >).map(([subtype, value]) =>
            value ? (
              <ProgramVariantEditorCard
                key={subtype}
                subtype={subtype}
                value={value}
                onTextChange={(nextSubtype, field, nextValue) =>
                  updateProgram(key, (definition) => ({
                    ...definition,
                    subtypeVariants: {
                      ...definition.subtypeVariants,
                      [nextSubtype]: {
                        ...definition.subtypeVariants?.[nextSubtype],
                        [field]: nextValue,
                      },
                    },
                  }))
                }
                onArrayChange={(nextSubtype, field, nextValue) =>
                  updateProgram(key, (definition) => ({
                    ...definition,
                    subtypeVariants: {
                      ...definition.subtypeVariants,
                      [nextSubtype]: {
                        ...definition.subtypeVariants?.[nextSubtype],
                        [field]: parseLines(nextValue),
                      },
                    },
                  }))
                }
              />
            ) : null
          )
        : null}
    </div>
  );
}

function ProgramEditorCard({
  title,
  description,
  definition,
  onTextChange,
  onArrayChange,
}: {
  title: string;
  description: string;
  definition: CSEPProgramDefinition;
  onTextChange: (
    field: keyof Pick<CSEPProgramDefinitionContent, "title" | "summary">,
    value: string
  ) => void;
  onArrayChange: (field: ProgramArrayField, value: string) => void;
}) {
  return (
    <SectionCard title={title} description={description}>
      <Field label="Program Title">
        <input type="text" value={definition.title} onChange={(event) => onTextChange("title", event.target.value)} className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500" />
      </Field>
      <Field label="Summary">
        <textarea value={definition.summary} onChange={(event) => onTextChange("summary", event.target.value)} rows={4} className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500" />
      </Field>
      {ARRAY_FIELDS.map((field) => (
        <Field key={field.field} label={field.label} help={field.help}>
          <textarea value={linesToText(definition[field.field])} onChange={(event) => onArrayChange(field.field, event.target.value)} rows={getArrayFieldRows(field.field)} className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500" />
        </Field>
      ))}
    </SectionCard>
  );
}

function ProgramVariantEditorCard({
  subtype,
  value,
  onTextChange,
  onArrayChange,
}: {
  subtype: CSEPProgramSubtypeValue;
  value: Partial<CSEPProgramDefinitionContent>;
  onTextChange: (
    subtype: CSEPProgramSubtypeValue,
    field: keyof Pick<CSEPProgramDefinitionContent, "title" | "summary">,
    value: string
  ) => void;
  onArrayChange: (subtype: CSEPProgramSubtypeValue, field: ProgramArrayField, value: string) => void;
}) {
  return (
    <SectionCard title={`Subtype Override · ${subtype}`} description="Overrides applied when this subtype is selected.">
      <Field label="Subtype Title">
        <input type="text" value={value.title ?? ""} onChange={(event) => onTextChange(subtype, "title", event.target.value)} className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500" />
      </Field>
      <Field label="Subtype Summary">
        <textarea value={value.summary ?? ""} onChange={(event) => onTextChange(subtype, "summary", event.target.value)} rows={4} className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500" />
      </Field>
      {ARRAY_FIELDS.map((field) => (
        <Field key={field.field} label={field.label} help={field.help}>
          <textarea value={linesToText(value[field.field] ?? [])} onChange={(event) => onArrayChange(subtype, field.field, event.target.value)} rows={getArrayFieldRows(field.field)} className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500" />
        </Field>
      ))}
    </SectionCard>
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
    <label className="block space-y-2 text-sm font-semibold text-slate-300">
      <span>{label}</span>
      {help ? <p className="text-xs font-normal text-slate-400">{help}</p> : null}
      {children}
    </label>
  );
}
