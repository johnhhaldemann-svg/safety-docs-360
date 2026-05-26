export type TrainingDeliveryType = "online" | "internal";

export type TrainingRequirementResource = {
  trainingDeliveryType: TrainingDeliveryType | null;
  trainingResourceTitle: string | null;
  trainingResourceUrl: string | null;
  trainingResourceInstructions: string | null;
};

type ValidateResourceParams = {
  deliveryType?: unknown;
  resourceTitle?: unknown;
  resourceUrl?: unknown;
  resourceInstructions?: unknown;
  fallbackTitle?: string;
  requireResource: boolean;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanLongText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function normalizeTrainingDeliveryType(value: unknown): TrainingDeliveryType | null {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "online" || raw === "online_training" || raw === "external") return "online";
  if (raw === "internal" || raw === "company_internal" || raw === "company") return "internal";
  return null;
}

export function isSafeTrainingResourceUrl(value: string, deliveryType: TrainingDeliveryType) {
  const url = value.trim();
  if (!url || /[\u0000-\u001f\u007f\s]/.test(url)) return false;

  if (deliveryType === "internal") {
    return url.startsWith("/") && !url.startsWith("//") && !url.includes("\\");
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateTrainingRequirementResource(
  params: ValidateResourceParams
): { resource: TrainingRequirementResource; error: string | null } {
  const rawUrl = cleanText(params.resourceUrl, 2048);
  const inferredType = rawUrl.startsWith("/") ? "internal" : "online";
  const deliveryType = normalizeTrainingDeliveryType(params.deliveryType) ?? (rawUrl ? inferredType : null);
  const resourceTitle = cleanText(params.resourceTitle, 180) || cleanText(params.fallbackTitle, 180);
  const resourceInstructions = cleanLongText(params.resourceInstructions, 1200);

  if (params.requireResource && !rawUrl) {
    return {
      resource: {
        trainingDeliveryType: deliveryType,
        trainingResourceTitle: resourceTitle || null,
        trainingResourceUrl: null,
        trainingResourceInstructions: resourceInstructions || null,
      },
      error: "Training resource URL is required before this requirement can be assigned.",
    };
  }

  if (!rawUrl) {
    return {
      resource: {
        trainingDeliveryType: null,
        trainingResourceTitle: resourceTitle || null,
        trainingResourceUrl: null,
        trainingResourceInstructions: resourceInstructions || null,
      },
      error: null,
    };
  }

  if (!deliveryType) {
    return {
      resource: {
        trainingDeliveryType: null,
        trainingResourceTitle: resourceTitle || null,
        trainingResourceUrl: rawUrl,
        trainingResourceInstructions: resourceInstructions || null,
      },
      error: "Training delivery type must be online or internal.",
    };
  }

  if (!isSafeTrainingResourceUrl(rawUrl, deliveryType)) {
    return {
      resource: {
        trainingDeliveryType: deliveryType,
        trainingResourceTitle: resourceTitle || null,
        trainingResourceUrl: rawUrl,
        trainingResourceInstructions: resourceInstructions || null,
      },
      error:
        deliveryType === "internal"
          ? "Internal training resources must be same-origin app paths such as /training/module."
          : "Online training resources must use a secure https:// URL.",
    };
  }

  return {
    resource: {
      trainingDeliveryType: deliveryType,
      trainingResourceTitle: resourceTitle || params.fallbackTitle || "Training resource",
      trainingResourceUrl: rawUrl,
      trainingResourceInstructions: resourceInstructions || null,
    },
    error: null,
  };
}

export function trainingRequirementResourceFromRow(row: {
  training_delivery_type?: string | null;
  training_resource_title?: string | null;
  training_resource_url?: string | null;
  training_resource_instructions?: string | null;
  title?: string | null;
}): TrainingRequirementResource {
  return {
    trainingDeliveryType: normalizeTrainingDeliveryType(row.training_delivery_type) ?? null,
    trainingResourceTitle: cleanText(row.training_resource_title, 180) || cleanText(row.title, 180) || null,
    trainingResourceUrl: cleanText(row.training_resource_url, 2048) || null,
    trainingResourceInstructions: cleanLongText(row.training_resource_instructions, 1200) || null,
  };
}
