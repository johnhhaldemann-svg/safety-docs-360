import type { GusLearningDb } from "@/lib/gusLearning/repository";
import { insertResearchFinding, listActiveApprovedSourcesForUrl } from "@/lib/gusLearning/repository";
import { htmlToSafetyText } from "@/lib/gusLearning/sanitize";
import { sourceMatchesUrl } from "@/lib/gusLearning/sourceValidation";
import { defaultGusResearchUserAgent } from "@/lib/appBrand";

function titleFromHtml(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim().slice(0, 240) || null;
}

function summarizeText(text: string, question: string) {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 30);
  const questionTerms = new Set((question.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((term) => term.length > 3));
  const scored = sentences
    .map((sentence, index) => {
      const lower = sentence.toLowerCase();
      const score = [...questionTerms].reduce((sum, term) => sum + (lower.includes(term) ? 1 : 0), 0);
      return { sentence, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 5)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);
  const summary = (scored.length ? scored : sentences.slice(0, 5)).join(" ");
  return summary.slice(0, 4_000) || "Source fetched, but no readable text could be summarized.";
}

export async function fetchApprovedSourceResearch(
  db: GusLearningDb,
  input: {
    requestedBy: string;
    companyId: string;
    projectId?: string | null;
    topic: string;
    question: string;
    sourceUrl: string;
    affectedModules?: string[];
  },
) {
  const candidates = await listActiveApprovedSourcesForUrl(db, input.companyId, input.sourceUrl);
  if (!candidates.ok) return { ok: false as const, status: 400, error: candidates.error };

  const approved = candidates.sources
    .map((source) => sourceMatchesUrl(source, input.sourceUrl))
    .find((result) => result.ok);
  if (!approved?.ok) {
    return { ok: false as const, status: 403, error: "Gus can only research active, non-blocked approved sources." };
  }

  const response = await fetch(approved.url.toString(), {
    headers: {
      "User-Agent": defaultGusResearchUserAgent(),
      Accept: "text/html,text/plain,application/xhtml+xml",
    },
  });
  if (!response.ok) {
    return { ok: false as const, status: 502, error: `Source fetch failed (${response.status}).` };
  }

  const raw = await response.text();
  const text = htmlToSafetyText(raw).slice(0, 24_000);
  const summary = summarizeText(text, input.question);
  const title = titleFromHtml(raw) || approved.source.source_name;
  const finding = await insertResearchFinding(db, {
    requestedBy: input.requestedBy,
    companyId: input.companyId,
    projectId: input.projectId ?? null,
    approvedSourceId: approved.source.id,
    topic: input.topic,
    question: input.question,
    sourceUrl: approved.url.toString(),
    sourceTitle: title,
    sourceDomain: approved.url.hostname,
    sourceType: approved.source.source_type,
    rawSummary: summary,
    aiConfidence: approved.source.trust_level === "high" ? 0.85 : approved.source.trust_level === "medium" ? 0.65 : 0.45,
    jurisdiction: approved.source.jurisdiction,
    affectedModules: input.affectedModules,
  });
  if (!finding.ok) return { ok: false as const, status: 500, error: finding.error };
  return { ok: true as const, finding: finding.finding };
}
