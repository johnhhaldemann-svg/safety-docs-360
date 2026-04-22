function extractErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "");
}

export function isCsepExportValidationError(error: unknown) {
  return extractErrorMessage(error)
    .toLowerCase()
    .startsWith("csep export validation failed:");
}

export function getCsepExportValidationDetail(error: unknown) {
  const message = extractErrorMessage(error).trim();
  if (!message) {
    return "the final CSEP export could not be validated.";
  }

  return message.replace(/^csep export validation failed:\s*/i, "").trim() || message;
}
