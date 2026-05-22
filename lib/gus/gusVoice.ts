import { isGusAllowedRoute, isGusDisabledRoute, gusRouteMatches } from "@/components/gus/gusConfig";
import type { GusMessage } from "@/lib/gus/gusTypes";

export const GUS_TTS_MODEL = "gpt-4o-mini-tts";
export const GUS_DEFAULT_VOICE = "marin";
export const GUS_DEFAULT_SPEECH_FORMAT = "mp3";
export const GUS_MAX_SPEECH_CHARS = 220;
export const GUS_DEFAULT_SPEECH_BASE_URL = "https://api.openai.com/v1";

export const GUS_TTS_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
] as const;

export const GUS_SPEECH_FORMATS = ["mp3", "opus", "aac", "flac", "wav", "pcm"] as const;

export type GusTtsVoice = (typeof GUS_TTS_VOICES)[number];
export type GusSpeechFormat = (typeof GUS_SPEECH_FORMATS)[number];

export type GusSpeechApiConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  unavailableReason?: string;
};

export type GusVoiceSafetyInput = {
  route: string;
  message: Pick<GusMessage, "category" | "priority" | "actionHref" | "shouldSpeak">;
  voiceEnabled: boolean;
  textOnlyMode: boolean;
  disabledUntilMs: number;
  isUserTyping: boolean;
};

function asTrimmed(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanEnvValue(value: unknown) {
  const trimmed = asTrimmed(value);
  if (!trimmed) return "";
  return trimmed.replace(/^["']|["']$/g, "").trim();
}

function isVercelAiGatewayBaseUrl(value: string) {
  return value.toLowerCase().includes("ai-gateway.vercel.sh");
}

export function resolveGusSpeechApiConfig(
  env: Record<string, string | undefined> = process.env,
): GusSpeechApiConfig {
  const ttsApiKey = cleanEnvValue(env.OPENAI_TTS_API_KEY);
  const defaultApiKey = cleanEnvValue(env.OPENAI_API_KEY);
  const requestedBaseUrl = cleanEnvValue(env.OPENAI_TTS_BASE_URL || env.OPENAI_BASE_URL);
  const model = cleanEnvValue(env.OPENAI_TTS_MODEL) || GUS_TTS_MODEL;

  if (ttsApiKey) {
    return {
      apiKey: ttsApiKey,
      baseUrl: (cleanEnvValue(env.OPENAI_TTS_BASE_URL) || GUS_DEFAULT_SPEECH_BASE_URL).replace(/\/$/, ""),
      model,
    };
  }

  if (!defaultApiKey) {
    return {
      apiKey: "",
      baseUrl: GUS_DEFAULT_SPEECH_BASE_URL,
      model,
      unavailableReason: "OPENAI_API_KEY is not configured.",
    };
  }

  if (defaultApiKey.startsWith("vck_") || isVercelAiGatewayBaseUrl(requestedBaseUrl)) {
    return {
      apiKey: "",
      baseUrl: GUS_DEFAULT_SPEECH_BASE_URL,
      model,
      unavailableReason:
        "Gus speech needs an OpenAI API key for the audio speech endpoint. Set OPENAI_TTS_API_KEY or use an OpenAI OPENAI_API_KEY.",
    };
  }

  return {
    apiKey: defaultApiKey,
    baseUrl: (requestedBaseUrl || GUS_DEFAULT_SPEECH_BASE_URL).replace(/\/$/, ""),
    model,
  };
}

export function normalizeGusTtsVoice(value: unknown): GusTtsVoice {
  const requested = asTrimmed(value).toLowerCase();
  return GUS_TTS_VOICES.includes(requested as GusTtsVoice) ? (requested as GusTtsVoice) : GUS_DEFAULT_VOICE;
}

export function normalizeGusSpeechFormat(value: unknown): GusSpeechFormat {
  const requested = asTrimmed(value).toLowerCase();
  return GUS_SPEECH_FORMATS.includes(requested as GusSpeechFormat)
    ? (requested as GusSpeechFormat)
    : GUS_DEFAULT_SPEECH_FORMAT;
}

export function normalizeGusSpeechSpeed(value: unknown) {
  const speed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(speed)) return 1;
  return Math.min(4, Math.max(0.25, Number(speed.toFixed(2))));
}

function firstTwoSentences(text: string) {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) ?? [];
  return sentences.slice(0, 2).join(" ").trim();
}

export function sanitizeGusSpeechText(input: unknown) {
  const raw = asTrimmed(input);
  if (!raw) return "";

  const withoutCodeBlocks = raw.replace(/```[\s\S]*?```/g, " ");
  const lines = withoutCodeBlocks
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (trimmed.includes("|")) return false;
      if (/^[-:| ]{3,}$/.test(trimmed)) return false;
      return true;
    });

  const stripped = lines
    .join(" ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\bwww\.\S+/gi, " ")
    .replace(/\[[^\]]{0,80}]/g, " ")
    .replace(/\((?:source|citation|ref|reference):[^)]*\)/gi, " ")
    .replace(/[*_~`>#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const shortSpeech = firstTwoSentences(stripped) || stripped;
  return shortSpeech.length > GUS_MAX_SPEECH_CHARS
    ? `${shortSpeech.slice(0, GUS_MAX_SPEECH_CHARS - 3).trim()}...`
    : shortSpeech;
}

export function isGusCriticalVoiceWarning(message: Pick<GusMessage, "category" | "priority">) {
  return (
    message.priority <= 1 ||
    message.category === "warning" ||
    message.category === "permit_alert" ||
    message.category === "risk_alert"
  );
}

function isRelatedCompanyOrJobsiteRoute(route: string, actionHref?: string) {
  if (!actionHref) return true;
  if (actionHref.startsWith("/companies")) return gusRouteMatches(route, "/companies");
  if (actionHref.startsWith("/jobsites")) return gusRouteMatches(route, "/jobsites");
  return true;
}

export function canGusSpeak(input: GusVoiceSafetyInput) {
  if (!input.voiceEnabled) return false;
  if (input.textOnlyMode) return false;
  if (Date.now() < input.disabledUntilMs) return false;
  if (!isGusAllowedRoute(input.route) || isGusDisabledRoute(input.route)) return false;
  if (input.message.shouldSpeak === false) return false;
  if (!isRelatedCompanyOrJobsiteRoute(input.route, input.message.actionHref)) return false;
  if (input.isUserTyping && !isGusCriticalVoiceWarning(input.message)) return false;
  return true;
}

export function gusSpeechContentType(format: GusSpeechFormat) {
  if (format === "wav") return "audio/wav";
  if (format === "aac") return "audio/aac";
  if (format === "flac") return "audio/flac";
  if (format === "opus") return "audio/ogg";
  if (format === "pcm") return "audio/L16";
  return "audio/mpeg";
}

export function resolveGusReplaySpeechText(lastSpokenText: unknown, currentSpeechText: unknown) {
  return sanitizeGusSpeechText(lastSpokenText) || sanitizeGusSpeechText(currentSpeechText);
}
