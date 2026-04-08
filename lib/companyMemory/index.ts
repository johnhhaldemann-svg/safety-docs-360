export type {
  CompanyMemoryItemRow,
  CompanyMemorySource,
  SimilarMemoryCandidate,
  SimilarMemoryCandidateReason,
} from "@/lib/companyMemory/types";
export {
  deleteCompanyMemoryItem,
  findSimilarCompanyMemoryDraft,
  getCompanyMemoryItem,
  insertCompanyMemoryItem,
  listCompanyMemoryItems,
  matchCompanyMemorySemantic,
  memorySearchTokensFromQuery,
  normalizeMemorySource,
  retrieveMemoryForQuery,
  searchCompanyMemoryKeyword,
  updateCompanyMemoryItem,
} from "@/lib/companyMemory/repository";
export { createEmbedding } from "@/lib/companyMemory/embed";
export {
  buildSurfaceSystemPrompt,
  COMPANY_AI_ASSIST_DISCLAIMER,
  runCompanyAiAssist,
  type CompanyAiAssistInput,
} from "@/lib/companyMemory/assist";
