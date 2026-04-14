import { NextResponse } from "next/server";
import { buildBucketedWorkItem } from "@/lib/safety-intelligence/buckets";
import { authorizeSafetyIntelligenceRequest } from "@/lib/safety-intelligence/http";
import { evaluateRules } from "@/lib/safety-intelligence/rules";
import { parseRawTaskInput } from "@/lib/safety-intelligence/validation/intake";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeSafetyIntelligenceRequest(request);
  if ("error" in auth) return auth.error;
  try {
    const input = parseRawTaskInput(await request.json());
    const bucket = buildBucketedWorkItem(input);
    const rules = evaluateRules(input, bucket);
    return NextResponse.json({ bucket, rules });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to evaluate rules." },
      { status: 400 }
    );
  }
}

