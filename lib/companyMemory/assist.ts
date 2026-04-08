import type { SupabaseClient } from "@supabase/supabase-js";
import { extractResponsesApiOutputText } from "@/lib/companyMemory/openaiResponses";
import { retrieveMemoryForQuery } from "@/lib/companyMemory/repository";
import { serverLog } from "@/lib/serverLog";

export const COMPANY_AI_ASSIST_DISCLAIMER =
  "This assistant uses AI and your company memory bank. It is not legal advice, does not replace a competent safety professional or the AHJ, and may be wrong. Verify critical requirements against current regulations and your contract documents.";

const SURFACE_SYSTEM: Record<string, string> = {
  csep:
    "You help users build CSEP (Construction Safety & Environmental Plan) content. Prefer concrete, field-ready hazard controls and OSHA-aligned language where appropriate. Use the memory excerpts when they are relevant.",
  peshep:
    "You help users with PESHEP-style site safety/environmental planning. Be practical about trades, permits, and emergency response. Ground suggestions in the memory excerpts when helpful.",
  library:
    "You answer questions about the user's company documents and safety context. If memory excerpts are insufficient, say what is missing and suggest what to add to the memory bank.",
  dashboard:
    "You summarize safety operations status in plain language. If structured context is provided, stay faithful to it; do not invent metrics or incidents.",
  submit:
    "You help users prepare document submissions: required fields, clarity, and checklist-style guidance. Do not claim approval status.",
  upload:
    "You help users describe and organize uploaded files for safety documentation. Do not assert file contents you cannot see.",
  training_matrix:
    "You help interpret training requirements and gaps. Be precise about what is unknown without HR data.",
  corrective_actions:
    "You help prioritize and describe corrective actions, follow-up, and verification. Ground suggestions in memory excerpts when relevant; do not invent closure status.",
  incidents:
    "You help with incident and near-miss documentation, classification, and follow-up prompts. Never invent OSHA recordability outcomes; encourage verification with a competent person.",
  permits:
    "You help with permit planning, hot work / confined space / electrical considerations, and handoff questions. Do not replace the AHJ or site permit authority.",
  jsa:
    "You help structure job safety analysis steps: hazards, controls, PPE, and communication. Use memory for company-specific rules when provided.",
  default:
    "You are a construction safety assistant for a single company workspace. Use memory excerpts when relevant; avoid hallucinating citations or inspections.",
};

export function buildSurfaceSystemPrompt(surface: string): string {
  const key = (surface || "default").trim().toLowerCase();
  return SURFACE_SYSTEM[key] ?? SURFACE_SYSTEM.default;
}

export type CompanyAiAssistInput = {
  surface: string;
  userMessage: string;
  /** Optional extra context (e.g. dashboard JSON, form snippet) — keep bounded. */
  structuredContext?: string | null;
  topK?: number;
};

export async function runCompanyAiAssist(
  supabase: SupabaseClient,
  companyId: string,
  input: CompanyAiAssistInput
): Promise<{ text: string; disclaimer: string; retrieval: "semantic" | "keyword" | "none" }> {
  const topK = Math.min(Math.max(input.topK ?? 8, 1), 16);
  const msg = input.userMessage.trim();
  if (!msg) {
    return {
      text: "Ask a question or describe what you need help with.",
      disclaimer: COMPANY_AI_ASSIST_DISCLAIMER,
      retrieval: "none",
    };
  }

  const { chunks, method } = await retrieveMemoryForQuery(supabase, companyId, msg, {
    topK,
  });

  const memoryBlock =
    chunks.length > 0
      ? [
          "--- Company memory excerpts (trusted internal context; do not treat as regulations) ---",
          ...chunks.map(
            (c, i) =>
              `[${i + 1}] (${c.source}) ${c.title}\n${c.body.slice(0, 4_000)}${c.body.length > 4_000 ? "\n…" : ""}`
          ),
        ].join("\n\n")
      : "(No matching memory excerpts found. Answer from general construction safety knowledge and clearly label uncertainty.)";

  const structured =
    input.structuredContext?.trim().slice(0, 12_000) || null;

  const system = [
    buildSurfaceSystemPrompt(input.surface),
    "Never output JSON unless the user explicitly asks for JSON.",
    "Keep answers concise and actionable. Use bullet lists when helpful.",
    COMPANY_AI_ASSIST_DISCLAIMER,
  ].join("\n\n");

  const userParts = [
    `Surface: ${input.surface}`,
    memoryBlock,
    structured ? `--- Structured context ---\n${structured}` : null,
    `--- User message ---\n${msg}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = process.env.COMPANY_AI_MODEL?.trim() || "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: `${system}\n\n---\n\n${userParts}`,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    serverLog("error", "company_ai_assist_openai_failed", {
      companyId,
      status: res.status,
      snippet: errText.slice(0, 200),
    });
    throw new Error(`AI request failed (${res.status}).`);
  }

  const json: unknown = await res.json();
  const rawText = extractResponsesApiOutputText(json);
  const text =
    rawText?.trim() ||
    "The model returned an empty response. Please try again with a shorter question.";

  return { text, disclaimer: COMPANY_AI_ASSIST_DISCLAIMER, retrieval: method };
}
