"use client";

import { useEffect, useState } from "react";
import { DOWNLOAD_CONFIRMATION_LABEL } from "@/lib/legal";

export function DownloadConfirmModal({
  open,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (open) {
      setChecked(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold text-slate-900">Confirm Download</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Before downloading this file, confirm that you accept responsibility for reviewing it and verifying compliance before use.
        </p>

        <label className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>{DOWNLOAD_CONFIRMATION_LABEL}</span>
        </label>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!checked || Boolean(loading)}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            {loading ? "Opening..." : "Download DOCX"}
          </button>
        </div>
      </div>
    </div>
  );
}
