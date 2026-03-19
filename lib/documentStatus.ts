export function normalizeDocumentStatus(
  status?: string | null,
  hasFinalFile = false
) {
  const normalized = status?.trim().toLowerCase();

  if (normalized === "archived") return "archived";
  if (normalized === "approved" || hasFinalFile) return "approved";
  if (normalized === "submitted") return "submitted";
  if (!normalized) return "draft";

  return normalized;
}

export function isArchivedDocumentStatus(status?: string | null) {
  return normalizeDocumentStatus(status) === "archived";
}

export function isApprovedDocumentStatus(
  status?: string | null,
  hasFinalFile = false
) {
  return normalizeDocumentStatus(status, hasFinalFile) === "approved";
}

export function isSubmittedDocumentStatus(
  status?: string | null,
  hasFinalFile = false
) {
  return normalizeDocumentStatus(status, hasFinalFile) === "submitted";
}

export function getDocumentStatusLabel(
  status?: string | null,
  hasFinalFile = false
) {
  const normalized = normalizeDocumentStatus(status, hasFinalFile);

  if (normalized === "approved") return "Approved";
  if (normalized === "submitted") return "In Review";
  if (normalized === "archived") return "Archived";
  if (normalized === "draft") return "Draft";

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function getDocumentStatusTone(
  status?: string | null,
  hasFinalFile = false
) {
  const normalized = normalizeDocumentStatus(status, hasFinalFile);

  if (normalized === "approved") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (normalized === "submitted") {
    return "bg-amber-100 text-amber-700";
  }

  if (normalized === "archived") {
    return "bg-slate-200 text-slate-700";
  }

  return "bg-sky-100 text-sky-700";
}
