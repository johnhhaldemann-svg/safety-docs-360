import { NextResponse } from "next/server";
import { getAiApiBaseUrl, resolveAiModelId } from "@/lib/ai/platform";
import {
  GUS_TTS_MODEL,
  gusSpeechContentType,
  normalizeGusSpeechFormat,
  normalizeGusSpeechSpeed,
  normalizeGusTtsVoice,
  sanitizeGusSpeechText,
} from "@/lib/gus/gusVoice";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as unknown;
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  }

  const input = sanitizeGusSpeechText(body.text);
  if (!input) {
    return NextResponse.json({ error: "Speech text is required after safety cleanup." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });
  }

  const voice = normalizeGusTtsVoice(body.voice);
  const responseFormat = normalizeGusSpeechFormat(body.format);
  const speed = normalizeGusSpeechSpeed(body.speed);
  const upstream = await fetch(`${getAiApiBaseUrl()}/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: resolveAiModelId(GUS_TTS_MODEL),
      input,
      voice,
      speed,
      response_format: responseFormat,
      instructions:
        "Speak as Gus, a calm construction safety coach. Use a clear, concise, practical tone.",
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      {
        error: "Failed to generate Gus speech audio.",
        status: upstream.status,
        detail: detail.slice(0, 500),
      },
      { status: 502 },
    );
  }

  const audio = await upstream.arrayBuffer();
  return new Response(audio, {
    status: 200,
    headers: {
      "Content-Type": gusSpeechContentType(responseFormat),
      "Cache-Control": "no-store",
      "Content-Disposition": `inline; filename="gus-speech.${responseFormat}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
