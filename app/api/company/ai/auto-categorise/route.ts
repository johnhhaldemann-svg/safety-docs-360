import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { requestAiResponsesText } from "@/lib/ai/responses";

export const runtime = "nodejs";
export const maxDuration = 30;

// POST /api/company/ai/auto-categorise
// Body: { title, description, entityType: 'incident' | 'corrective_action' }
// Returns: { category, severity, confidence, reasoning }
export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as {
    title?: string;
    description?: string;
    entityType?: string;
  } | null;

  const title = body?.title?.trim().slice(0, 300) ?? "";
  const description = body?.description?.trim().slice(0, 1_500) ?? "";
  const entityType = body?.entityType === "corrective_action" ? "corrective_action" : "incident";

  if (!title && !description) {
    return NextResponse.json({ error: "title or description is required." }, { status: 400 });
  }

  const incidentCategories = ["incident", "near_miss", "first_aid", "property_damage"];
  const caCategories = ["corrective_action", "hazard", "near_miss", "observation"];

  const categories = entityType === "corrective_action" ? caCategories : incidentCategories;

  const systemPrompt =
    entityType === "corrective_action"
      ? `You are a safety data classification AI for a construction safety platform.
Given a corrective action title and description, classify it into exactly one category.
Categories: corrective_action (a specific fix or task), hazard (physical hazard identification), near_miss (close call or potential incident), observation (safety walk or inspection finding).
Also suggest severity: critical, high, medium, or low.
Return ONLY valid JSON: {"category":"<one of the categories>","severity":"<critical|high|medium|low>","confidence":0.0-1.0,"reasoning":"<one sentence>"}`
      : `You are a safety data classification AI for a construction safety platform.
Given an incident title and description, classify it into exactly one category.
Categories: incident (injury occurred or medical treatment needed), near_miss (close call, no injury), first_aid (minor injury treated on-site, no lost time), property_damage (equipment or property damaged, no injury).
Also suggest severity: critical, high, medium, or low.
Return ONLY valid JSON: {"category":"<one of the categories>","severity":"<critical|high|medium|low>","confidence":0.0-1.0,"reasoning":"<one sentence>"}`;

  const userContent = [
    title ? `Title: ${title}` : null,
    description ? `Description: ${description}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await requestAiResponsesText({
      model: process.env.COMPANY_AI_MODEL?.trim() || "gpt-4o-mini",
      input: `${systemPrompt}\n\n---\n\n${userContent}`,
      surface: "company.ai.auto-categorise",
    });

    const raw = response.text ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as {
      category?: string;
      severity?: string;
      confidence?: number;
      reasoning?: string;
    };

    const category = categories.includes(String(parsed.category ?? ""))
      ? (parsed.category as string)
      : categories[0];
    const severity = ["critical", "high", "medium", "low"].includes(String(parsed.severity ?? ""))
      ? (parsed.severity as string)
      : "medium";
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence ?? 0.7)));
    const reasoning = String(parsed.reasoning ?? "").slice(0, 300);

    return NextResponse.json({ category, severity, confidence, reasoning, entityType });
  } catch {
    // Fallback: return a neutral default
    return NextResponse.json({
      category: categories[0],
      severity: "medium",
      confidence: 0.3,
      reasoning: "Could not determine category from the provided text.",
      entityType,
    });
  }
}
