import { Packer } from "docx";
import {
  createBlueprintDocument,
  safeFilePart,
} from "@/lib/blueprintDocxTheme";
import { getSafetyBlueprintDraftFilename } from "@/lib/safetyBlueprintLabels";
import type { GeneratedSafetyPlanDraft } from "@/types/safety-intelligence";

export async function renderSafetyPlanDocx(draft: GeneratedSafetyPlanDraft) {
  const doc = await createBlueprintDocument(draft);
  const buffer = await Packer.toBuffer(doc);
  const projectPart = safeFilePart(draft.projectOverview.projectName, "Project");

  return {
    body: new Uint8Array(buffer),
    filename: getSafetyBlueprintDraftFilename(projectPart, draft.documentType),
  };
}
