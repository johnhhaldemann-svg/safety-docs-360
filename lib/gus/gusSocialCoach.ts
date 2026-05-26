import type { GusContext } from "@/lib/gus/gusContext";
import { sanitizeGusTriggerLanguage } from "@/lib/gus/gusSafetyGate";
import type { GusDecision, GusMessage } from "@/lib/gus/gusTypes";

const HUMOR_RATE = 10;
const VARIANT_SEPARATOR = "-auto-";

type GusLineVariant = {
  variantId: string;
  message: (params: {
    actionLabel?: string;
    baseMessage: GusMessage;
    pageName: string;
  }) => string;
  spokenPrefix: string;
};

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function compactPageName(context: GusContext) {
  return context.currentPage?.replace(/\s+/g, " ").trim() || "this page";
}

function isSafetyCritical(decision: GusDecision) {
  return (
    decision.attentionLevel === "critical" ||
    decision.attentionLevel === "high" ||
    decision.kind === "warning" ||
    decision.message.priority <= 2
  );
}

function lowercaseFirst(value: string) {
  return value ? `${value.charAt(0).toLowerCase()}${value.slice(1)}` : value;
}

function selectVariant(variants: readonly GusLineVariant[], seed: string, recentVariantIds: readonly string[] = []) {
  const recent = new Set(recentVariantIds);
  const available = variants.filter((variant) => !recent.has(variant.variantId));
  const choices = available.length > 0 ? available : variants;
  return choices[hashText(seed) % choices.length] ?? variants[0];
}

function withVariantMessage(baseMessage: GusMessage, variant: GusLineVariant, message: string, spokenText: string): GusMessage {
  return {
    ...baseMessage,
    messageId: `${baseMessage.messageId}${VARIANT_SEPARATOR}${variant.variantId}`,
    message: sanitizeGusTriggerLanguage(message),
    spokenText: sanitizeGusTriggerLanguage(spokenText),
    shouldSpeak: baseMessage.shouldSpeak !== false,
  };
}

const criticalVariants: readonly GusLineVariant[] = [
  {
    variantId: "critical-review",
    message: ({ actionLabel, baseMessage }) =>
      `I'm flagging this for review: ${baseMessage.message} The next step is immediate human safety review${actionLabel ? ` and ${actionLabel.toLowerCase()}` : ""}.`,
    spokenPrefix: "I'm flagging this for review.",
  },
  {
    variantId: "critical-pause",
    message: ({ baseMessage }) =>
      `This needs human safety review before work moves forward: ${baseMessage.message} Pause for the right reviewer to verify the controls.`,
    spokenPrefix: "This needs human safety review.",
  },
  {
    variantId: "critical-controls",
    message: ({ baseMessage }) =>
      `Here's what needs attention: ${baseMessage.message} I can help organize the review items, but a human reviewer has to make the call.`,
    spokenPrefix: "Here's what needs attention.",
  },
];

const warningVariants: readonly GusLineVariant[] = [
  {
    variantId: "warning-heads-up",
    message: ({ baseMessage }) =>
      `Heads up: ${baseMessage.message} I recommend reviewing this before the work plan moves forward.`,
    spokenPrefix: "Heads up.",
  },
  {
    variantId: "warning-pattern",
    message: ({ baseMessage }) =>
      `I'm seeing a pattern worth checking: ${baseMessage.message} A short review now can prevent a longer problem later.`,
    spokenPrefix: "I'm seeing a pattern worth checking.",
  },
  {
    variantId: "warning-next-step",
    message: ({ actionLabel, baseMessage }) =>
      `Let's review this before work moves forward: ${baseMessage.message} ${actionLabel ? `${actionLabel} is the practical next step.` : "The practical next step is human review."}`,
    spokenPrefix: "Let's review this.",
  },
];

const planningVariants: readonly GusLineVariant[] = [
  {
    variantId: "planning-check",
    message: ({ baseMessage }) =>
      `Quick planning check-in: ${baseMessage.message} I can help draft the next review notes, but the final call stays with the right human reviewer.`,
    spokenPrefix: "Quick planning check-in.",
  },
  {
    variantId: "planning-structure",
    message: ({ baseMessage }) =>
      `Let me put a frame around this: ${baseMessage.message} We can turn it into draft planning notes and keep the missing items visible.`,
    spokenPrefix: "Let me put a frame around this.",
  },
  {
    variantId: "planning-questions",
    message: ({ baseMessage }) =>
      `Good moment for planning discipline: ${baseMessage.message} I can help ask the questions a reviewer will want answered.`,
    spokenPrefix: "Good moment for planning discipline.",
  },
];

const socialVariants: readonly GusLineVariant[] = [
  {
    variantId: "social-watch",
    message: ({ baseMessage, pageName }) =>
      `Quick check-in from Gus: I'm watching ${pageName} for safety items that need attention. ${baseMessage.message}`,
    spokenPrefix: "Quick check-in from Gus.",
  },
  {
    variantId: "social-read",
    message: ({ baseMessage, pageName }) =>
      `I'm checking ${pageName}: ${baseMessage.message} If the data shifts, I'll call out the review step.`,
    spokenPrefix: "I'm checking this page.",
  },
  {
    variantId: "social-coach",
    message: ({ baseMessage }) =>
      `Coach's note: ${baseMessage.message} Small checks done early usually beat big corrections done late.`,
    spokenPrefix: "Coach's note.",
  },
  {
    variantId: "social-practical",
    message: ({ actionLabel, baseMessage }) =>
      `Practical safety thought: ${baseMessage.message} ${actionLabel ? `${actionLabel} looks like the useful place to start.` : "I can help sort the next review step."}`,
    spokenPrefix: "Practical safety thought.",
  },
];

const humorVariants: readonly GusLineVariant[] = [
  {
    variantId: "humor-surprise",
    message: ({ baseMessage, pageName }) =>
      `Tiny joke, serious point: the best surprise on a jobsite is no surprise. I'm checking ${pageName} and ${lowercaseFirst(baseMessage.message)}`,
    spokenPrefix: "Tiny joke, serious point.",
  },
  {
    variantId: "humor-clipboard",
    message: ({ baseMessage }) =>
      `Light humor, steel-toe level: clipboards do not fix risk, but good follow-through does. ${baseMessage.message}`,
    spokenPrefix: "Light humor, steel-toe level.",
  },
  {
    variantId: "humor-future",
    message: ({ baseMessage }) =>
      `Small grin, serious review: future-you likes it when present-you checks the safety details. ${baseMessage.message}`,
    spokenPrefix: "Small grin, serious review.",
  },
];

export function shouldUseGusLightHumor(seed: string) {
  return hashText(seed) % HUMOR_RATE === 0;
}

export function gusHumorRatio() {
  return 0.1;
}

export function getGusSocialLineId(message: Pick<GusMessage, "messageId">) {
  const [, variantId] = message.messageId.split(VARIANT_SEPARATOR);
  return variantId || message.messageId;
}

export function createGusAutonomousMessage(
  decision: GusDecision,
  context: GusContext,
  seed: string,
  recentVariantIds: readonly string[] = [],
): GusMessage {
  const baseMessage = decision.message;
  const actionLabel = decision.actions[0]?.label || baseMessage.actionLabel;
  const pageName = compactPageName(context);
  const useHumor = !isSafetyCritical(decision) && shouldUseGusLightHumor(seed);

  if (decision.attentionLevel === "critical") {
    const variant = selectVariant(criticalVariants, seed, recentVariantIds);
    return withVariantMessage(
      baseMessage,
      variant,
      variant.message({ actionLabel, baseMessage, pageName }),
      `${variant.spokenPrefix} ${baseMessage.spokenText ?? baseMessage.message}`,
    );
  }

  if (decision.attentionLevel === "high" || decision.kind === "warning") {
    const variant = selectVariant(warningVariants, seed, recentVariantIds);
    return withVariantMessage(
      baseMessage,
      variant,
      variant.message({ actionLabel, baseMessage, pageName }),
      `${variant.spokenPrefix} ${baseMessage.spokenText ?? baseMessage.message}`,
    );
  }

  if (useHumor) {
    const variant = selectVariant(humorVariants, seed, recentVariantIds);
    return withVariantMessage(
      baseMessage,
      variant,
      variant.message({ actionLabel, baseMessage, pageName }),
      `${variant.spokenPrefix} ${baseMessage.spokenText ?? baseMessage.message}`,
    );
  }

  if (decision.kind === "planning_offer") {
    const variant = selectVariant(planningVariants, seed, recentVariantIds);
    return withVariantMessage(
      baseMessage,
      variant,
      variant.message({ actionLabel, baseMessage, pageName }),
      `${variant.spokenPrefix} ${baseMessage.spokenText ?? baseMessage.message}`,
    );
  }

  const variant = selectVariant(socialVariants, seed, recentVariantIds);
  return withVariantMessage(
    baseMessage,
    variant,
    variant.message({ actionLabel, baseMessage, pageName }),
    `${variant.spokenPrefix} ${baseMessage.spokenText ?? baseMessage.message}`,
  );
}

export function createGusProactiveConversationLine(decision: GusDecision, context: GusContext, seed: string) {
  const action = decision.actions[0]?.label || decision.message.actionLabel;
  const signals = decision.signals.slice(0, 2).map((signal) => signal.label).filter(Boolean);
  const autonomous = createGusAutonomousMessage(decision, context, seed);

  if (decision.attentionLevel === "critical") {
    return sanitizeGusTriggerLanguage(`${autonomous.message} I can help organize what needs a safety check, but a safety lead has to make the call.`);
  }

  if (decision.attentionLevel === "high" || decision.kind === "warning") {
    return sanitizeGusTriggerLanguage(`${autonomous.message} ${signals.length > 0 ? `I'm watching ${signals.join(" and ")}.` : ""}`);
  }

  if (decision.kind === "planning_offer") {
    return sanitizeGusTriggerLanguage("I can help turn this into a draft safe work plan. I'll keep it draft-only and call out what information is still missing for a human safety check.");
  }

  if (signals.length > 0) {
    return sanitizeGusTriggerLanguage(`I'm keeping an eye on ${signals.join(" and ")}. If the pattern changes, I'll call out the safety step. ${action ? `${action} is the next useful place to look.` : ""}`.trim());
  }

  return autonomous.message;
}
