import type { GusContext } from "@/lib/gus/gusContext";
import type { GusMessage, GusRiskLevel } from "@/lib/gus/gusTypes";
import { validateGusOutput } from "@/lib/gus/gusValidation";

type SitrepSeverity = "normal" | "high" | "critical";

function cleanList(items: string[] | undefined, limit: number) {
  return [...new Set((items ?? []).map((item) => item.trim()).filter(Boolean))].slice(0, limit);
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function riskLabel(level: GusRiskLevel | undefined) {
  if (level === "severe") return "severe";
  if (level === "high") return "high";
  if (level === "moderate") return "moderate";
  return "low";
}

function severityForContext(context: GusContext): SitrepSeverity {
  if (context.riskLevel === "severe" || context.weatherRiskLevel === "severe") return "critical";
  if (
    context.riskLevel === "high" ||
    context.weatherRiskLevel === "high" ||
    (context.openHighPriorityActionCount ?? 0) > 0 ||
    (context.expiredTrainingCount ?? 0) > 0 ||
    (context.missingPermitTypes?.length ?? 0) > 0
  ) {
    return "high";
  }
  return "normal";
}

function messageIdFor(parts: string[]) {
  const key = parts.join("|").toLowerCase();
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return `gus-sitrep-${hash.toString(36)}`;
}

function sentence(parts: string[]) {
  return parts.filter(Boolean).join(" ");
}

export function isSafePredictSitrepRoute(route: string) {
  return route === "/safe-predict" || route.startsWith("/safe-predict/");
}

export function buildGusSitrepMessage(context: GusContext): GusMessage | null {
  if (!isSafePredictSitrepRoute(context.route)) return null;

  const severity = severityForContext(context);
  const risk = riskLabel(context.riskLevel);
  const drivers = cleanList(context.riskDrivers, 3);
  const permitGaps = cleanList(context.missingPermitTypes, 3);
  const observations = cleanList(context.recentObservationTypes, 3);
  const expiredTrainingCount = context.expiredTrainingCount ?? 0;
  const openActionCount = context.openCorrectiveActionCount ?? 0;
  const highActionCount = context.openHighPriorityActionCount ?? 0;

  const lead =
    severity === "critical"
      ? "SITREP: Severe risk is active."
      : severity === "high"
        ? "SITREP: Active work needs review."
        : "SITREP: Active work review is current.";

  const reviewParts = [
    drivers.length > 0 ? `Top risk drivers: ${drivers.join(", ")}.` : "",
    permitGaps.length > 0 ? `Permit items to review: ${permitGaps.join(", ")}.` : "",
    expiredTrainingCount > 0 ? `${plural(expiredTrainingCount, "expired training")} need review.` : "",
    highActionCount > 0
      ? `${plural(highActionCount, "high-priority action")} remain open.`
      : openActionCount > 0
        ? `${plural(openActionCount, "open action")} remain in the queue.`
        : "",
    observations.length > 0 ? `Recent observation themes: ${observations.join(", ")}.` : "",
  ];

  const schedule = context.scheduleUploadedToday
    ? "Schedule data is connected for this review window."
    : "Schedule data may need review if active work changed.";
  const nextStep =
    severity === "normal"
      ? "Keep reviewing changes before crews shift tasks."
      : "Have the right human reviewer verify controls before work moves forward.";
  const message = sentence([lead, `Current risk is ${risk}.`, ...reviewParts, schedule, nextStep]);
  const reason = sentence([
    "Based on SafePredict live context.",
    drivers.length > 0 ? `Drivers: ${drivers.join(", ")}.` : "",
    "Draft guidance only. Human review required.",
  ]);
  const messageId = messageIdFor([
    context.route,
    risk,
    drivers.join(","),
    permitGaps.join(","),
    String(expiredTrainingCount),
    String(openActionCount),
    String(highActionCount),
    String(context.scheduleUploadedToday === true),
  ]);
  const shouldSpeak = severity !== "normal";
  const output: GusMessage = {
    messageId,
    category: severity === "normal" ? "reminder" : "risk_alert",
    priority: severity === "critical" ? 1 : severity === "high" ? 2 : 4,
    message,
    spokenText: shouldSpeak
      ? sentence([lead, `Current risk is ${risk}.`, nextStep])
      : undefined,
    reason,
    actionLabel: severity === "normal" ? "Review dashboard" : "Review risk",
    actionHref: context.route.startsWith("/safe-predict") ? "/safe-predict/predictive-risk" : "/risk",
    actionKey: "guide_to_risk",
    confidence: severity === "normal" ? 0.72 : 0.86,
    shouldSpeak,
  };
  const validation = validateGusOutput(output);

  return validation.sanitizedOutput as GusMessage;
}

export function buildGusSteadySitrepMessage(message: GusMessage): GusMessage {
  const steadyMessage: GusMessage = {
    ...message,
    messageId: `${message.messageId}-steady`,
    message: `SITREP: No major change since my last active-work update. ${message.message}`,
    spokenText: message.spokenText
      ? `No major change since my last active-work update. ${message.spokenText}`
      : undefined,
  };
  const validation = validateGusOutput(steadyMessage);

  return validation.sanitizedOutput as GusMessage;
}
