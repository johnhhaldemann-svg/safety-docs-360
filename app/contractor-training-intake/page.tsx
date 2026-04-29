"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Save, X } from "lucide-react";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  appButtonPrimaryClassName,
  appNativeSelectClassName,
} from "@/components/WorkspacePrimitives";
import { CONSTRUCTION_POSITIONS, CONSTRUCTION_TRADES } from "@/lib/constructionProfileOptions";
import { PROFILE_CERTIFICATION_GROUPS } from "@/lib/constructionProfileCertifications";

type Requirement = { id: string; title: string; sort_order: number; apply_trades?: string[]; apply_positions?: string[] };
type TrainingRecord = {
  requirement_id: string | null;
  title: string;
  completed_on: string | null;
  expires_on: string | null;
  notes: string | null;
};
type IntakePayload = {
  jobsite?: { id: string; name: string } | null;
  employee?: {
    fullName: string;
    email: string;
    phone: string;
    contractorCompanyName: string;
    tradeSpecialty: string;
    jobTitle: string;
    readinessStatus: string;
    yearsExperience: number | null;
    certifications: string[];
    certificationExpirations: Record<string, string>;
  };
  requirements?: Requirement[];
  records?: TrainingRecord[];
  error?: string;
};

function recordForRequirement(records: TrainingRecord[], requirementId: string) {
  return records.find((record) => record.requirement_id === requirementId) ?? null;
}

export default function ContractorTrainingIntakePage() {
  const [token, setToken] = useState("");
  const [payload, setPayload] = useState<IntakePayload>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"neutral" | "success" | "warning" | "error">("neutral");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contractorCompanyName, setContractorCompanyName] = useState("");
  const [tradeSpecialty, setTradeSpecialty] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [certName, setCertName] = useState("");
  const [certExpiresOn, setCertExpiresOn] = useState("");
  const [certifications, setCertifications] = useState<string[]>([]);
  const [certificationExpirations, setCertificationExpirations] = useState<Record<string, string>>({});
  const [trainingDrafts, setTrainingDrafts] = useState<Record<string, { completedOn: string; expiresOn: string; notes: string }>>({});

  const requirements = payload.requirements ?? [];
  const scopedRequirements = requirements.filter((requirement) => {
    const trades = Array.isArray(requirement.apply_trades) ? requirement.apply_trades : [];
    const positions = Array.isArray(requirement.apply_positions) ? requirement.apply_positions : [];
    const tradeApplies = trades.length === 0 || trades.includes(tradeSpecialty);
    const positionApplies = positions.length === 0 || positions.includes(jobTitle);
    return tradeApplies && positionApplies;
  });
  const records = useMemo(() => payload.records ?? [], [payload.records]);

  useEffect(() => {
    const nextToken = new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
    setToken(nextToken);
    if (!nextToken) {
      setTone("error");
      setMessage("This intake link is missing a token.");
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const res = await fetch(`/api/contractor-training-intake?token=${encodeURIComponent(nextToken)}`, {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => null)) as IntakePayload | null;
        if (!res.ok) throw new Error(data?.error || "Failed to load intake form.");
        const employee = data?.employee;
        setPayload(data ?? {});
        setFullName(employee?.fullName ?? "");
        setEmail(employee?.email ?? "");
        setPhone(employee?.phone ?? "");
        setContractorCompanyName(employee?.contractorCompanyName ?? "");
        setTradeSpecialty(employee?.tradeSpecialty ?? "");
        setJobTitle(employee?.jobTitle ?? "");
        setCertifications(employee?.certifications ?? []);
        setCertificationExpirations(employee?.certificationExpirations ?? {});
      } catch (error) {
        setTone("error");
        setMessage(error instanceof Error ? error.message : "Failed to load intake form.");
      }
      setLoading(false);
    })();
  }, []);

  function addCertification() {
    const title = certName.trim();
    if (!title) return;
    setCertifications((current) => (current.includes(title) ? current : [...current, title]));
    if (certExpiresOn) {
      setCertificationExpirations((current) => ({ ...current, [title]: certExpiresOn }));
    }
    setCertName("");
    setCertExpiresOn("");
  }

  function removeCertification(title: string) {
    setCertifications((current) => current.filter((item) => item !== title));
    setCertificationExpirations((current) => {
      const next = { ...current };
      delete next[title];
      return next;
    });
  }

  async function submit() {
    setMessage("");
    try {
      const trainingRecords = scopedRequirements.map((requirement) => {
        const record = recordForRequirement(records, requirement.id);
        const draft = trainingDrafts[requirement.id] ?? {
          completedOn: record?.completed_on ?? "",
          expiresOn: record?.expires_on ?? "",
          notes: record?.notes ?? "",
        };
        return {
          requirementId: requirement.id,
          title: requirement.title,
          completedOn: draft.completedOn,
          expiresOn: draft.expiresOn,
          notes: draft.notes,
        };
      });
      const res = await fetch("/api/contractor-training-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          fullName,
          email,
          phone,
          contractorCompanyName,
          tradeSpecialty,
          jobTitle,
          readinessStatus: "ready",
          certifications,
          certificationExpirations,
          trainingRecords,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Failed to submit intake.");
      setTone("success");
      setMessage("Training information submitted. You can close this page.");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to submit intake.");
    }
  }

  return (
    <main className="min-h-screen bg-[var(--app-bg)] p-4 text-[var(--app-text)] sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHero
          eyebrow="Safety360Docs"
          title="Contractor Training Intake"
          description={`Submit training information${payload.jobsite?.name ? ` for ${payload.jobsite.name}` : ""}.`}
        />

        {message ? <InlineMessage tone={tone}>{message}</InlineMessage> : null}
        {loading ? <InlineMessage>Loading intake form...</InlineMessage> : null}

        {!loading && !payload.employee && !message ? (
          <InlineMessage tone="error">This intake link is invalid or expired.</InlineMessage>
        ) : null}

        {payload.employee ? (
          <>
            <SectionCard title="Your Information">
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name" className="rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2 text-sm" />
                <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2 text-sm" />
                <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone" className="rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2 text-sm" />
                <input value={contractorCompanyName} onChange={(event) => setContractorCompanyName(event.target.value)} placeholder="Contractor company" className="rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2 text-sm" />
                <select value={tradeSpecialty} onChange={(event) => setTradeSpecialty(event.target.value)} className={appNativeSelectClassName}>
                  <option value="">Select trade</option>
                  {CONSTRUCTION_TRADES.map((trade) => (
                    <option key={trade} value={trade}>
                      {trade}
                    </option>
                  ))}
                </select>
                <select value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} className={appNativeSelectClassName}>
                  <option value="">Select position</option>
                  {CONSTRUCTION_POSITIONS.map((position) => (
                    <option key={position} value={position}>
                      {position}
                    </option>
                  ))}
                </select>
              </div>
            </SectionCard>

            <SectionCard title="Jobsite Training">
              <div className="grid gap-4">
                {requirements.length === 0 ? (
                  <InlineMessage>No jobsite training requirements have been configured yet.</InlineMessage>
                ) : scopedRequirements.length === 0 ? (
                  <InlineMessage>Select your trade and position to show required jobsite training.</InlineMessage>
                ) : (
                  scopedRequirements.map((requirement) => {
                    const record = recordForRequirement(records, requirement.id);
                    const draft = trainingDrafts[requirement.id] ?? {
                      completedOn: record?.completed_on ?? "",
                      expiresOn: record?.expires_on ?? "",
                      notes: record?.notes ?? "",
                    };
                    return (
                      <div key={requirement.id} className="rounded-2xl border border-[var(--app-border)] bg-white/80 p-4">
                        <p className="font-semibold text-[var(--app-text-strong)]">{requirement.title}</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <label className="text-xs font-semibold text-slate-500">
                            Completed
                            <input type="date" value={draft.completedOn} onChange={(event) => setTrainingDrafts((current) => ({ ...current, [requirement.id]: { ...draft, completedOn: event.target.value } }))} className="mt-1 block w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2 text-sm" />
                          </label>
                          <label className="text-xs font-semibold text-slate-500">
                            Expires
                            <input type="date" value={draft.expiresOn} onChange={(event) => setTrainingDrafts((current) => ({ ...current, [requirement.id]: { ...draft, expiresOn: event.target.value } }))} className="mt-1 block w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2 text-sm" />
                          </label>
                          <label className="text-xs font-semibold text-slate-500">
                            Notes
                            <input value={draft.notes} onChange={(event) => setTrainingDrafts((current) => ({ ...current, [requirement.id]: { ...draft, notes: event.target.value } }))} className="mt-1 block w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2 text-sm" />
                          </label>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </SectionCard>

            <SectionCard title="Additional Certifications">
              <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
                <select value={certName} onChange={(event) => setCertName(event.target.value)} className={appNativeSelectClassName}>
                  <option value="">Select certification</option>
                  {PROFILE_CERTIFICATION_GROUPS.map((group) => {
                    const available = group.items.filter((item) => !certifications.includes(item));
                    if (available.length === 0) return null;
                    return (
                      <optgroup key={group.title} label={group.title}>
                        {available.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                <input type="date" value={certExpiresOn} onChange={(event) => setCertExpiresOn(event.target.value)} className="rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2 text-sm" />
                <button type="button" onClick={addCertification} className={appButtonPrimaryClassName}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Add
                </button>
              </div>
              {certifications.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-2 text-sm">
                  {certifications.map((certification) => (
                    <li key={certification} className="inline-flex max-w-full items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                      <span className="truncate">
                        {certification}
                        {certificationExpirations[certification] ? ` / ${certificationExpirations[certification]}` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeCertification(certification)}
                        className="rounded-full p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                        aria-label={`Remove ${certification}`}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </SectionCard>

            <div className="flex justify-end">
              <button type="button" onClick={() => void submit()} className={appButtonPrimaryClassName}>
                <Save className="h-4 w-4" aria-hidden />
                Submit Training Information
              </button>
            </div>

            {tone === "success" ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                <Check className="mr-2 inline h-4 w-4" aria-hidden />
                Submission received.
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
