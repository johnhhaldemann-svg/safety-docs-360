const DEFAULT_ADMIN_EMAILS = ["john.h.haldemann@gmail.com"];

function normalizeEmail(email?: string | null) {
  return (email ?? "").trim().toLowerCase();
}

export function getAdminEmails() {
  const configured = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);

  return configured.length > 0 ? configured : DEFAULT_ADMIN_EMAILS;
}

export function isAdminEmail(email?: string | null) {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return false;
  }

  return getAdminEmails().includes(normalized);
}
