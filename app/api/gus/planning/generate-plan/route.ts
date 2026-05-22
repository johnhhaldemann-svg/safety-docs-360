import { NextResponse } from "next/server";
import {
  generateSafeWorkPlan,
  type GusSafeWorkPlanInput,
} from "@/lib/gus/plans/generateSafeWorkPlan";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function answerRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string")
      .map(([key, item]) => [key.trim(), item.trim()]),
  );
}

function parseGeneratePlanInput(value: unknown):
  | { ok: true; input: GusSafeWorkPlanInput }
  | { ok: false; errors: string[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["Request body must be an object."] };
  }

  const body = value as Record<string, unknown>;
  const taskDescription = stringValue(body.taskDescription);
  const errors: string[] = [];

  if (!taskDescription) {
    errors.push("taskDescription is required.");
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    input: {
      taskDescription,
      workArea: stringValue(body.workArea),
      crewTrades: stringValue(body.crewTrades),
      equipmentToolsMaterials: stringValue(body.equipmentToolsMaterials),
      answers: answerRecord(body.answers),
      selectedModuleIds: stringArray(body.selectedModuleIds),
      ppe: stringArray(body.ppe),
      environmentalConditions: stringArray(body.environmentalConditions),
      emergencyResponse: stringArray(body.emergencyResponse),
    },
  };
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = parseGeneratePlanInput(body);

  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid Gus safe work plan request.", details: parsed.errors }, { status: 400 });
  }

  const result = generateSafeWorkPlan(parsed.input);

  return NextResponse.json({
    plan: result.plan,
    validationFindings: result.validationFindings,
  });
}

