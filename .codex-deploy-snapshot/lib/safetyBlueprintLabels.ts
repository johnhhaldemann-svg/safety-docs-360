export const CONTRACTOR_SAFETY_BLUEPRINT_TITLE = "Contractor Safety Plan (CSEP)";
export const SITE_SAFETY_BLUEPRINT_TITLE = "Site Safety Plan (PSHSEP)";

export const CONTRACTOR_SAFETY_BLUEPRINT_NAV_LABEL =
  "Contractor Safety Plan";
export const SITE_SAFETY_BLUEPRINT_NAV_LABEL =
  "Site Safety Plan";

export const CONTRACTOR_SAFETY_BLUEPRINT_BUILDER_LABEL = `${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} Builder`;
export const SITE_SAFETY_BLUEPRINT_BUILDER_LABEL = `${SITE_SAFETY_BLUEPRINT_TITLE} Builder`;

export function formatSafetyBlueprintDocumentType(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().toUpperCase();

  if (normalized === "CSEP") {
    return CONTRACTOR_SAFETY_BLUEPRINT_TITLE;
  }

  if (normalized === "PSHSEP" || normalized === "PESHEP" || normalized === "PESHEPS") {
    return SITE_SAFETY_BLUEPRINT_TITLE;
  }

  return (value ?? "").trim() || "Unknown";
}

export function getSafetyBlueprintDraftFilename(
  projectPart: string,
  documentType: "csep" | "pshsep"
): string {
  return documentType === "csep"
    ? `${projectPart}_CSEP_Draft.docx`
    : `${projectPart}_PSHSEP_Draft.docx`;
}
