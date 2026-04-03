"use client";

import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  List,
  MapPin,
  WifiOff,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import {
  OSHA_FIELD_AUDIT_SECTIONS,
  countFieldAuditItems,
  fieldItemKey,
} from "@/lib/jobsiteAudits/oshaFieldAuditTemplate";

type RowStatus = "" | "pass" | "fail" | "na";

export function FieldAuditChecklist({
  jobsite,
  auditors,
  auditDate,
  statusMap,
  photoCounts,
  onStatus,
  onPhotoCapture,
}: {
  jobsite: string;
  auditors: string;
  auditDate: string;
  statusMap: Record<string, RowStatus>;
  photoCounts: Record<string, number>;
  onStatus: (key: string, next: RowStatus) => void;
  onPhotoCapture: (key: string) => void;
}) {
  const total = countFieldAuditItems();
  const scored = OSHA_FIELD_AUDIT_SECTIONS.flatMap((s) =>
    s.items.map((it) => statusMap[fieldItemKey(s.id, it.id)] ?? "")
  ).filter((x) => x !== "").length;
  const pct = total > 0 ? Math.round((scored / total) * 100) : 0;

  const [categoryIndex, setCategoryIndex] = useState(0);
  const section = OSHA_FIELD_AUDIT_SECTIONS[categoryIndex] ?? OSHA_FIELD_AUDIT_SECTIONS[0];
  const lastIdx = OSHA_FIELD_AUDIT_SECTIONS.length - 1;

  const goPrev = useCallback(() => {
    setCategoryIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setCategoryIndex((i) => Math.min(lastIdx, i + 1));
  }, [lastIdx]);

  const [timers, setTimers] = useState<Record<string, boolean>>({});
  const [exemplary, setExemplary] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingPhotoKey, setPendingPhotoKey] = useState<string | null>(null);

  function toggleTimer(key: string) {
    setTimers((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openCameraFor(key: string) {
    setPendingPhotoKey(key);
    fileRef.current?.click();
  }

  function onFileChange() {
    const input = fileRef.current;
    const key = pendingPhotoKey;
    if (!input?.files?.length || !key) return;
    onPhotoCapture(key);
    setPendingPhotoKey(null);
    input.value = "";
  }

  const secAnswered =
    section?.items.filter((it) => (statusMap[fieldItemKey(section.id, it.id)] ?? "") !== "").length ?? 0;

  return (
    <div className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-lg">
      <div className="rounded-t-2xl bg-gradient-to-r from-emerald-600 to-emerald-800 px-4 py-4 text-white">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/90">
          Construction / general industry
        </p>
        <h2 className="mt-1 text-lg font-black leading-tight">Field safety audit</h2>
        <p className="mt-2 text-xs text-emerald-100/95">
          OSHA-aligned checklist — one category at a time. Verify rules in force for your jurisdiction.
        </p>
      </div>

      <div className="space-y-3 border-b border-slate-700/60 bg-slate-950/50 px-4 py-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-500">Job</span>
            <p className="font-semibold text-slate-100">{jobsite.trim() || "—"}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-500">Auditors</span>
            <p className="font-semibold text-slate-100">{auditors.trim() || "—"}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-500">Date</span>
            <p className="font-semibold text-slate-100">{auditDate || "—"}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-500">Overall progress</span>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs font-bold tabular-nums text-slate-300">
                {pct}% ({scored}/{total})
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(220px,280px)_1fr]">
        <aside className="border-b border-slate-700/80 bg-slate-950/50/90 p-3 lg:border-b-0 lg:border-r">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <List className="h-3.5 w-3.5" />
            Categories ({OSHA_FIELD_AUDIT_SECTIONS.length})
          </p>
          <div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto lg:max-h-[min(70vh,640px)]">
            {OSHA_FIELD_AUDIT_SECTIONS.map((sec, idx) => {
              const answered = sec.items.filter(
                (it) => (statusMap[fieldItemKey(sec.id, it.id)] ?? "") !== ""
              ).length;
              const active = idx === categoryIndex;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setCategoryIndex(idx)}
                  className={`flex w-full flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                    active
                      ? "border-emerald-500 bg-emerald-950/35 font-semibold text-emerald-950"
                      : "border-transparent bg-slate-900/90 text-slate-300 hover:border-slate-700/80"
                  }`}
                >
                  <span className="leading-snug">{sec.title}</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    {answered}/{sec.items.length} scored
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/60 px-4 py-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-100">{section?.title}</h3>
              {section?.subtitle ? (
                <p className="text-xs text-slate-500">{section.subtitle}</p>
              ) : null}
              <p className="mt-1 text-xs text-slate-500">
                Category {categoryIndex + 1} of {OSHA_FIELD_AUDIT_SECTIONS.length} · {secAnswered}/
                {section?.items.length ?? 0} items scored here
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={categoryIndex <= 0}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 py-2 text-sm font-semibold text-slate-300 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={categoryIndex >= lastIdx}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 py-2 text-sm font-semibold text-slate-300 disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[min(70vh,640px)] overflow-y-auto px-3 py-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onFileChange}
            />

            {section ? (
              <ul className="space-y-2">
                {section.items.map((item) => {
                  const key = fieldItemKey(section.id, item.id);
                  const st = statusMap[key] ?? "";
                  const photos = photoCounts[key] ?? 0;
                  return (
                    <li
                      key={item.id}
                      className="rounded-xl border border-slate-700/80 bg-slate-900/90 p-3 shadow-sm"
                    >
                      <div className="flex gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug text-slate-100">{item.label}</p>
                          {item.oshaRef ? (
                            <p className="mt-0.5 text-[11px] text-slate-500">29 CFR {item.oshaRef}</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {st === "pass" ? (
                            <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-label="Pass" />
                          ) : st === "fail" ? (
                            <AlertCircle className="h-6 w-6 text-red-600" aria-label="Fail" />
                          ) : (
                            <span className="h-6 w-6 rounded-full border-2 border-dashed border-slate-600" />
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {(["pass", "fail", "na"] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => onStatus(key, v)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                              st === v
                                ? v === "pass"
                                  ? "bg-emerald-600 text-white"
                                  : v === "fail"
                                    ? "bg-red-600 text-white"
                                    : "bg-slate-600 text-white"
                                : "border border-slate-700/80 bg-slate-950/50 text-slate-400 hover:bg-slate-800/70"
                            }`}
                          >
                            {v === "na" ? "N/A" : v}
                          </button>
                        ))}
                        <span className="mx-1 h-4 w-px bg-slate-200" />
                        <button
                          type="button"
                          onClick={() => toggleTimer(key)}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                            timers[key]
                              ? "border-amber-400 bg-amber-950/40 text-amber-900"
                              : "border-slate-700/80 text-slate-400"
                          }`}
                        >
                          <Clock className="h-3.5 w-3.5" />
                          Time
                        </button>
                        <button
                          type="button"
                          onClick={() => openCameraFor(key)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-700/80 px-2 py-1.5 text-xs font-semibold text-slate-400"
                        >
                          <Camera className="h-3.5 w-3.5" />
                          {photos > 0 ? photos : ""}
                        </button>
                        <span className="rounded-md border border-slate-700/80 bg-slate-950/50 px-2 py-1 text-xs font-bold text-slate-300">
                          10
                        </span>
                      </div>

                      <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                        <input
                          type="checkbox"
                          checked={Boolean(exemplary[key])}
                          onChange={() =>
                            setExemplary((prev) => ({ ...prev, [key]: !prev[key] }))
                          }
                          className="rounded border-slate-600 text-emerald-600"
                        />
                        Exemplary behavior noted
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-700/60 bg-slate-950/50 px-4 py-3 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1 font-semibold text-emerald-100">
          <MapPin className="h-3.5 w-3.5" />
          GPS tag ready (browser)
        </span>
        <span className="inline-flex items-center gap-1 font-semibold text-slate-300">
          <WifiOff className="h-3.5 w-3.5" />
          Offline draft (local save)
        </span>
      </div>
    </div>
  );
}
