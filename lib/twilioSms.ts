import crypto from "crypto";
import { requestAiResponsesText } from "@/lib/ai/responses";

// ── Twilio Signature Validation ──────────────────────────────────────────────
// https://www.twilio.com/docs/usage/webhooks/webhooks-security#validating-signatures-from-twilio

export function validateTwilioSignature({
  authToken,
  twilioSignature,
  url,
  params,
}: {
  authToken: string;
  twilioSignature: string;
  url: string;
  params: Record<string, string>;
}): boolean {
  // Sort params alphabetically and concatenate
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map((k) => `${k}${params[k]}`).join("");
  const fullString = url + paramString;

  const hmac = crypto.createHmac("sha1", authToken);
  hmac.update(fullString, "utf8");
  const expected = hmac.digest("base64");

  // Constant-time compare to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "base64"),
      Buffer.from(twilioSignature, "base64"),
    );
  } catch {
    return false;
  }
}

// ── TwiML response builder ────────────────────────────────────────────────────

export function buildTwimlReply(message: string): string {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

// ── AI SMS parsing ────────────────────────────────────────────────────────────

export type SmsIncidentDraft = {
  title: string;
  description: string;
  category: "incident" | "near_miss" | "first_aid" | "property_damage";
  severity: "low" | "medium" | "high" | "critical";
  confidence: number; // 0-1
};

const SMS_PARSE_SYSTEM_PROMPT = `You are a safety data extraction AI for a construction safety platform.
You receive an SMS message sent by a field worker reporting an incident or safety concern.
Extract the structured fields and return ONLY valid JSON — no markdown, no explanation.

JSON format:
{
  "title": "Short incident title (max 120 chars)",
  "description": "Full description preserving all details from the message",
  "category": "incident" | "near_miss" | "first_aid" | "property_damage",
  "severity": "low" | "medium" | "high" | "critical",
  "confidence": 0.0 to 1.0
}

Category rules:
- incident: injury occurred or medical treatment needed
- near_miss: close call, no injury, could have been worse
- first_aid: minor injury treated on site, no lost time
- property_damage: equipment or property damaged, no injury

Severity rules:
- critical: fatality, life-threatening, building collapse, explosion
- high: serious injury, hospitalization likely, major equipment damage
- medium: injury needing off-site treatment, significant near-miss
- low: minor near-miss, small property damage, first aid only`;

export async function parseSmsToIncident(
  smsBody: string,
): Promise<SmsIncidentDraft | null> {
  const trimmed = smsBody.trim().slice(0, 1_600);
  if (!trimmed) return null;

  try {
    const response = await requestAiResponsesText({
      model: process.env.COMPANY_AI_MODEL?.trim() || "gpt-4o-mini",
      input: `${SMS_PARSE_SYSTEM_PROMPT}\n\n---\n\nSMS message:\n${trimmed}`,
      surface: "twilio-sms.parse-incident",
    });

    const raw = response.text ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<SmsIncidentDraft>;

    const category = (
      ["incident", "near_miss", "first_aid", "property_damage"].includes(
        String(parsed.category),
      )
        ? parsed.category
        : "near_miss"
    ) as SmsIncidentDraft["category"];

    const severity = (
      ["low", "medium", "high", "critical"].includes(String(parsed.severity))
        ? parsed.severity
        : "medium"
    ) as SmsIncidentDraft["severity"];

    return {
      title: String(parsed.title ?? "SMS Incident Report").slice(0, 120),
      description: String(parsed.description ?? trimmed).slice(0, 2_000),
      category,
      severity,
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0.7))),
    };
  } catch {
    // Fallback: create a basic incident from the raw SMS
    return {
      title: `SMS Report: ${trimmed.slice(0, 80)}`,
      description: trimmed,
      category: "near_miss",
      severity: "medium",
      confidence: 0.3,
    };
  }
}
