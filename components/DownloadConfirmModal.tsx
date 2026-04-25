"use client";

import { useRef, useState } from "react";
import { DOWNLOAD_CONFIRMATION_LABEL } from "@/lib/legal";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const handleCancel = () => {
    setChecked(false);
    onCancel();
  };

  useFocusTrap(dialogRef, {
    active: open,
    onEscape: handleCancel,
    initialFocus: cancelButtonRef,
  });

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(223,233,247,0.76)] px-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-confirm-title"
        aria-describedby="download-confirm-description"
        className="w-full max-w-lg rounded-3xl border border-[var(--app-border-strong)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(241,247,255,0.96)_100%)] p-6 shadow-[0_24px_48px_rgba(38,64,106,0.18)]"
      >
        <h2
          id="download-confirm-title"
          className="text-xl font-bold text-[var(--app-text-strong)]"
        >
          Confirm Download
        </h2>
        <p
          id="download-confirm-description"
          className="mt-2 text-sm leading-6 text-[var(--app-text)]"
        >
          Before downloading this file, confirm that you accept responsibility for reviewing it and verifying compliance before use.
        </p>

        <label className="mt-5 flex items-start gap-3 rounded-2xl border border-[var(--app-border)] bg-[rgba(234,241,255,0.88)] p-4 text-sm font-medium text-[var(--app-text)]">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border border-[var(--app-border)] bg-white text-[var(--app-accent-primary)]"
          />
          <span>{DOWNLOAD_CONFIRMATION_LABEL}</span>
        </label>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={handleCancel}
            className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-accent-primary-soft)] hover:text-[var(--app-text-strong)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setChecked(false);
              onConfirm();
            }}
            disabled={!checked || Boolean(loading)}
            className="rounded-xl bg-[var(--app-accent-primary)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--app-shadow-primary-button)] transition hover:bg-[var(--app-accent-primary-hover)] disabled:opacity-60"
          >
            {loading ? "Opening..." : "Download DOCX"}
          </button>
        </div>
      </div>
    </div>
  );
}
