import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { getGusMemory, updateGusMemoryPatterns } from "@/lib/gus/gusMemory";
import type { GusLearningSignalInput } from "@/lib/gus/gusLearning";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

async function getRequestScope(auth: Awaited<ReturnType<typeof authorizeRequest>>) {
  if ("error" in auth) return { companyId: null, userId: null };

  try {
    const companyScope = await getCompanyScope({
      supabase: auth.supabase,
      userId: auth.user.id,
      fallbackTeam: auth.team,
      authUser: auth.user,
    });

    return {
      companyId: companyScope.companyId,
      userId: auth.user.id,
    };
  } catch {
    return {
      companyId: null,
      userId: auth.user.id,
    };
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function arrayOrUndefined<T>(value: unknown): T[] | undefined {
  return Array.isArray(value) ? (value as T[]) : undefined;
}

function parseLearningSignals(value: unknown): GusLearningSignalInput | null {
  if (!isObject(value)) return null;

  return {
    observations: arrayOrUndefined(value.observations),
    permits: arrayOrUndefined(value.permits),
    trainings: arrayOrUndefined(value.trainings),
    jsas: arrayOrUndefined(value.jsas),
    weather: arrayOrUndefined(value.weather),
  };
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  const scope = await getRequestScope(auth);
  return NextResponse.json({ memory: getGusMemory(scope) });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as unknown;
  const signals = parseLearningSignals(body);

  if (!signals) {
    return NextResponse.json(
      {
        error: "Invalid Gus memory payload.",
        details: "Send an object with optional observations, permits, trainings, jsas, and weather arrays.",
      },
      { status: 400 },
    );
  }

  const scope = await getRequestScope(auth);
  const memory = updateGusMemoryPatterns(scope, signals);

  return NextResponse.json({
    success: true,
    memory,
    learning: {
      patterns: memory.patterns,
      mayPrioritizeMessages: true,
      mayOverrideSafetyRules: false,
      mayApproveWork: false,
      maySuppressCriticalWarnings: false,
    },
  });
}

