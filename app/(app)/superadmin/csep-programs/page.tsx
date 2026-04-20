"use client";

import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
  CSEPProgramConfig,
  CSEPProgramDefinition,
  CSEPProgramDefinitionContent,
  CSEPProgramSubtypeValue,
} from "@/types/csep-programs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

const ARRAY_FIELDS: Array<{
  field: ProgramArrayField;
  label: string;
  help: string;
}> = [
  {
    field: "applicableWhen",
    label: "When It Applies",
    help: "One bullet per line.",
  },
  {
    field: "oshaRefs",
    label: "Applicable References",
    help: "One OSHA reference per line.",
  },
  {
    field: "responsibilities",
    label: "Responsibilities",
    help: "One responsibility bullet per line.",
  },
  {
    field: "preTaskProcedures",
    label: "Pre-Task Setup",
    help: "One procedure bullet per line.",
  },
  {
    field: "workProcedures",
    label: "Work Execution",
    help: "One procedure bullet per line.",
  },
  {
    field: "stopWorkProcedures",
    label: "Stop-Work / Escalation",
    help: "One procedure bullet per line.",
  },
  {
    field: "closeoutProcedures",
    label: "Post-Task / Closeout",
    help: "One procedure bullet per line.",
  },
  {
    field: "training",
    label: "Training",
    help: "One training bullet per line.",
  },
  {
    field: "controls",
    label: "Minimum Required Controls",
    help: "One control bullet per line.",
  },
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
  return Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export default function SuperadminCsepProgramsPage() {
  const [config, setConfig] = useState<CSEPProgramConfig>({
    definitions: getDefaultProgramDefinitions(),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "error">("neutral");
  const [selectedKey, setSelectedKey] = useState(
    getProgramDefinitionKey(getDefaultProgramDefinitions()[0])
  );

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
      const res = await fetch("/api/superadmin/csep-programs/config", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await res.json().catch(() => null)) as
        | (CSEPProgramConfig & { error?: string })
        | null;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load CSEP program settings.");
      }

      if (data?.definitions) {
        setConfig({
          definitions: cloneProgramDefinitions(data.definitions),
        });
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to load CSEP program settings."
      );
      setMessageTone("error");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (!config.definitions.some((definition) => getProgramDefinitionKey(definition) === selectedKey)) {
      const first = config.definitions[0];
      if (first) {
        setSelectedKey(getProgramDefinitionKey(first));
      }
    }
  }, [config.definitions, selectedKey]);

  const selectedProgram = useMemo(() => {
    return (
      config.definitions.find((definition) => getProgramDefinitionKey(definition) === selectedKey) ??
      config.definitions[0] ??
      null
    );
  }, [config.definitions, selectedKey]);

  function updateProgram(
    key: string,
    updater: (definition: CSEPProgramDefinition) => CSEPProgramDefinition
  ) {
    setConfig((prev) => ({
      definitions: prev.definitions.map((definition) =>
        getProgramDefinitionKey(definition) === key ? updater(definition) : definition
      ),
    }));
  }

  function updateSelectedTextField(
    field: keyof Pick<CSEPProgramDefinitionContent, "title" | "summary">,
    value: string
  ) {
    if (!selectedProgram) return;
    const key = getProgramDefinitionKey(selectedProgram);
    updateProgram(key, (definition) => ({
      ...definition,
      [field]: value,
    }));
  }

  function updateSelectedArrayField(
    field: ProgramArrayField,
    value: string
  ) {
    if (!selectedProgram) return;
    const key = getProgramDefinitionKey(selectedProgram);
    updateProgram(key, (definition) => ({
      ...definition,
      [field]: parseLines(value),
    }));
  }

  function updateSubtypeTextField(
    subtype: CSEPProgramSubtypeValue,
    field: keyof Pick<CSEPProgramDefinitionContent, "title" | "summary">,
    value: string
  ) {
    if (!selectedProgram?.subtypeVariants?.[subtype]) return;
    const key = getProgramDefinitionKey(selectedProgram);
    updateProgram(key, (definition) => ({
      ...definition,
      subtypeVariants: {
        ...definition.subtypeVariants,
        [subtype]: {
          ...definition.subtypeVariants?.[subtype],
          [field]: value,
        },
      },
    }));
  }

  function updateSubtypeArrayField(
    subtype: CSEPProgramSubtypeValue,
    field: ProgramArrayField,
    value: string
  ) {
    if (!selectedProgram?.subtypeVariants?.[subtype]) return;
    const key = getProgramDefinitionKey(selectedProgram);
    updateProgram(key, (definition) => ({
      ...definition,
      subtypeVariants: {
        ...definition.subtypeVariants,
        [subtype]: {
          ...definition.subtypeVariants?.[subtype],
          [field]: parseLines(value),
        },
      },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    try {
      const token = await getAccessToken();
      const res = await fetch("/api/superadmin/csep-programs/config", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });
      const data = (await res.json().catch(() => null)) as
        | (CSEPProgramConfig & { error?: string })
        | null;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save CSEP program settings.");
      }

      if (data?.definitions) {
        setConfig({
          definitions: cloneProgramDefinitions(data.definitions),
        });
      }

      setMessage("CSEP program settings saved. New documents will use the updated program blocks.");
      setMessageTone("success");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to save CSEP program settings."
      );
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
        title="CSEP Program Settings"
        description="Edit the live contractor safety plan program blocks used by the document generator. Changes here control the section title, summary, references, responsibilities, procedures, training, and controls for each program."
        actions={
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || saving}
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Program Settings"}
            </button>
            <button
              type="button"
              onClick={() =>
                setConfig({
                  definitions: getDefaultProgramDefinitions(),
                })
              }
              disabled={loading || saving}
              className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Reset to Defaults
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading || saving}
              className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Reload
            </button>
          </>
        }
      />

      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.6fr]">
        <SectionCard
          title="Program Picker"
          description="Choose the exact program block you want to review or rewrite."
        >
          <div className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-slate-300">
              Program
              <select
                value={selectedKey}
                onChange={(event) => setSelectedKey(event.target.value)}
                className={`mt-2 w-full ${appNativeSelectClassName}`}
              >
                {config.definitions.map((definition) => (
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
                {selectedProgram.subtypeGroup ? (
                  <div className="mt-2">
                    <span className="font-semibold text-slate-200">Subtype group:</span>{" "}
                    {selectedProgram.subtypeGroup}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </SectionCard>

        {selectedProgram ? (
          <div className="space-y-6">
            <ProgramEditorCard
              title="Base Program Block"
              description="This is the default text used for the selected program."
              definition={selectedProgram}
              onTextChange={updateSelectedTextField}
              onArrayChange={updateSelectedArrayField}
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
                      onTextChange={updateSubtypeTextField}
                      onArrayChange={updateSubtypeArrayField}
                    />
                  ) : null
                )
              : null}
          </div>
        ) : null}
      </section>
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
      <div className="mt-6 space-y-5">
        <Field label="Program Title">
          <input
            type="text"
            value={definition.title}
            onChange={(event) => onTextChange("title", event.target.value)}
            className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
          />
        </Field>

        <Field label="Summary">
          <textarea
            value={definition.summary}
            onChange={(event) => onTextChange("summary", event.target.value)}
            rows={4}
            className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
          />
        </Field>

        {ARRAY_FIELDS.map((field) => (
          <Field key={field.field} label={field.label} help={field.help}>
            <textarea
              value={linesToText(definition[field.field])}
              onChange={(event) => onArrayChange(field.field, event.target.value)}
              rows={
                field.field === "controls" ||
                field.field === "preTaskProcedures" ||
                field.field === "workProcedures" ||
                field.field === "stopWorkProcedures" ||
                field.field === "closeoutProcedures"
                  ? 6
                  : 4
              }
              className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
            />
          </Field>
        ))}
      </div>
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
    <SectionCard
      title={`Subtype Override · ${subtype}`}
      description="These values override the base program block when this subtype is selected."
    >
      <div className="mt-6 space-y-5">
        <Field label="Subtype Title">
          <input
            type="text"
            value={value.title ?? ""}
            onChange={(event) => onTextChange(subtype, "title", event.target.value)}
            className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
          />
        </Field>

        <Field label="Subtype Summary">
          <textarea
            value={value.summary ?? ""}
            onChange={(event) => onTextChange(subtype, "summary", event.target.value)}
            rows={4}
            className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
          />
        </Field>

        {ARRAY_FIELDS.map((field) => (
          <Field key={`${subtype}-${field.field}`} label={field.label} help={field.help}>
            <textarea
              value={linesToText(value[field.field] ?? [])}
              onChange={(event) => onArrayChange(subtype, field.field, event.target.value)}
              rows={
                field.field === "controls" ||
                field.field === "preTaskProcedures" ||
                field.field === "workProcedures" ||
                field.field === "stopWorkProcedures" ||
                field.field === "closeoutProcedures"
                  ? 6
                  : 4
              }
              className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
            />
          </Field>
        ))}
      </div>
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
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-slate-300">{label}</div>
      {children}
      {help ? <div className="mt-2 text-xs text-slate-500">{help}</div> : null}
    </label>
  );
}
