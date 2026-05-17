import {
  COMPANY_DATA_REQUEST_SCOPES,
  COMPANY_DATA_REQUEST_STATUSES,
  COMPANY_DATA_REQUEST_TYPES,
  type CompanyDataRequestScope,
  type CompanyDataRequestStatus,
  type CompanyDataRequestType,
} from "@/types/enterprise-readiness";

type MessageError = { message?: string | null };

function includesString<const T extends readonly string[]>(items: T, value: string): value is T[number] {
  return (items as readonly string[]).includes(value);
}

export function isMissingCompanyDataRequestsError(error?: MessageError | null) {
  const message = (error?.message ?? "").toLowerCase();

  return (
    message.includes("company_data_requests") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("could not find") ||
      message.includes("relation"))
  );
}

export function normalizeCompanyDataRequestType(
  value: unknown
): CompanyDataRequestType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return includesString(COMPANY_DATA_REQUEST_TYPES, normalized) ? normalized : null;
}

export function normalizeCompanyDataRequestScope(
  value: unknown
): CompanyDataRequestScope | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return includesString(COMPANY_DATA_REQUEST_SCOPES, normalized) ? normalized : null;
}

export function normalizeCompanyDataRequestStatus(
  value: unknown
): CompanyDataRequestStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return includesString(COMPANY_DATA_REQUEST_STATUSES, normalized) ? normalized : null;
}
