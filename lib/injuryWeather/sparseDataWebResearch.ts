import type { InjuryWeatherDashboardData, InjuryWeatherWebResearchSupplement } from "@/lib/injuryWeather/types";
import { getOpenAiApiBaseUrl, resolveOpenAiCompatibleModelId } from "@/lib/openaiClient";

const SPARSE_SIGNAL_MAX = 5;

/** Set to `0` to disable the web-search supplement entirely (avoids extra API cost). */
export function isInjuryWeatherSparseWebResearchEnabled(): boolean {
  return process.env.INJURY_WEATHER_SPARSE_WEB_RESEARCH?.trim() !== "0";
}

export function injuryWeatherNeedsWebResearchFill(data: InjuryWeatherDashboardData): boolean {
  if (data.summary.riskSignalCount <= SPARSE_SIGNAL_MAX) return true;
  if (data.summary.dataConfidence === "LOW") return true;
  if (data.summary.forecastMode === "baseline_only") return true;
  if (data.summary.likelyInjuryInsight && !data.summary.likelyInjuryInsight.hasData) return true;
  return false;
}

type UrlCitation = { url: string; title?: string };

function collectUrlCitationsFromResponse(body: unknown): UrlCitation[] {
  const found: UrlCitation[] = [];
  const visit = (x: unknown) => {
    if (!x || typeof x !== "object") return;
    const o = x as Record<string, unknown>;
    const t = o.type;
    if ((t === "url_citation" || t === "citation") && typeof o.url === "string") {
      found.push({
        url: o.url,
        title: typeof o.title === "string" ? o.title : typeof o.name === "string" ? o.name : undefined,
      });
    }
    for (const v of Object.values(o)) {
      if (Array.isArray(v)) v.forEach(visit);
      else visit(v);
    }
  };
  visit(body);
  const seen = new Set<string>();
  const deduped: UrlCitation[] = [];
  for (const c of found) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    deduped.push(c);
  }
  return deduped.slice(0, 12);
}

function extractOutputTextFromResponsesBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  if (typeof o.output_text === "string" && o.output_text.trim()) return o.output_text.trim();
  const output = o.output;
  if (!Array.isArray(output)) return null;
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (p.type === "output_text" && typeof p.text === "string") chunks.push(p.text);
    }
  }
  const joined = chunks.join("").trim();
  return joined || null;
}

function bulletsFromNarrative(text: string): string[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^[\d.\)\-\*\s]+/, "").trim())
    .filter((l) => l.length > 12 && !/^sources?:/i.test(l));
  return lines.slice(0, 8);
}

function parseSourcesFromText(fullText: string): { title: string; url: string }[] {
  const m = fullText.match(/Sources?:([\s\S]*)/i);
  if (!m) return [];
  const block = m[1];
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const out: { title: string; url: string }[] = [];
  for (const line of lines) {
    const urlMatch = line.match(/(https?:\/\/[^\s)\]]+)/);
    if (!urlMatch) continue;
    const url = urlMatch[1].replace(/[.,;]+$/, "");
    let title = line
      .replace(urlMatch[0], "")
      .replace(/^[\d.\)\-\*\s]+/, "")
      .replace(/\s*[—\-–|]\s*$/g, "")
      .trim();
    if (!title) {
      try {
        title = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        title = "Source";
      }
    }
    out.push({ title: title.slice(0, 200), url });
  }
  return out.slice(0, 10);
}

const DISCLAIMER =
  "Retrieved from public web sources to supplement this forecast—not your company’s records, not a compliance determination, and not a substitute for logging SOR, CAPA, and incidents in this system.";

/**
 * Run OpenAI Responses with web search to gather cited public context (OSHA / NIOSH / state labor pages).
 * Runs for every injury-weather AI pass when enabled—not only when workspace signals are sparse.
 * Does not fabricate employer data.
 */
export async function injuryWeatherWebResearchSupplement(
  data: InjuryWeatherDashboardData
): Promise<InjuryWeatherWebResearchSupplement | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || !isInjuryWeatherSparseWebResearchEnabled()) return null;

  const sparseWorkspace = injuryWeatherNeedsWebResearchFill(data);
  const trades = [...new Set(data.tradeForecasts.map((t) => t.trade))].slice(0, 6).join(", ") || "general construction";
  const state = data.location.stateCode
    ? `${data.location.displayName} (${data.location.stateCode})`
    : "United States (national context)";
  const month = data.summary.month;

  const roleLine = sparseWorkspace
    ? "You are assisting a construction safety forecast dashboard that has very few logged SOR/corrective-action/incident rows—supplement with authoritative public guidance."
    : "You are assisting a construction safety forecast dashboard that already has structured SOR/corrective-action/incident signals—add complementary public guidance (do not contradict the employer’s signal mix).";

  const input = [
    roleLine,
    `Forecast month: ${month}. Region context: ${state}. Trades emphasized on the dashboard: ${trades}.`,
    "Use web search. Pull current, credible public guidance relevant to Focus Four hazards and these trades (OSHA, NIOSH, CDC occupational, or official state labor/industrial sites).",
    "Write 5-7 short bullet points. Each bullet must reflect something you found in search results—paraphrase; do not invent injury rates or citations.",
    "After the bullets, add a line starting exactly with Sources: then list 3-8 page titles with their URLs (one per line, format: Title — https://...).",
    "If you cannot verify a fact from search results, omit it.",
  ].join("\n");

  const model = resolveOpenAiCompatibleModelId(
    process.env.INJURY_WEATHER_WEB_RESEARCH_MODEL?.trim() || "gpt-4o"
  );

  try {
    const res = await fetch(`${getOpenAiApiBaseUrl()}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input,
        tools: [{ type: "web_search_preview" }],
        tool_choice: "auto",
        max_output_tokens: 1200,
      }),
    });

    if (!res.ok) return null;
    const json: unknown = await res.json();
    const text = extractOutputTextFromResponsesBody(json);
    if (!text || text.length < 80) return null;

    const annotations = collectUrlCitationsFromResponse(json);
    const bullets = bulletsFromNarrative(text.split(/Sources?:/i)[0] ?? text);
    if (bullets.length < 2) return null;

    let citations = annotations.map((c) => ({
      title: c.title?.trim() || c.url.replace(/^https?:\/\//, "").split("/")[0] || "Source",
      url: c.url,
    }));
    if (citations.length === 0) citations = parseSourcesFromText(text);

    return {
      triggeredBySparseData: sparseWorkspace,
      model,
      querySummary: `Public safety context for ${month} · ${state} · ${trades}`,
      bullets,
      citations,
      disclaimer: DISCLAIMER,
    };
  } catch {
    return null;
  }
}
