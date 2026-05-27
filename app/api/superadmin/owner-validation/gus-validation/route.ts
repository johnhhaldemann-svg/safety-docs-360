import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  type OwnerGusValidationSupabaseClient,
  loadOwnerGusValidationOverview,
  runOwnerGusValidation,
  saveOwnerGusValidationTestCase,
  validateOwnerGusRunInput,
  validateOwnerGusTestCaseInput,
} from "@/lib/superadmin/ownerGusValidation";
import { requireOwnerValidationSuperadmin } from "../route";

export const runtime = "nodejs";
export const maxDuration = 60;

function clientFromAuth(auth: Awaited<ReturnType<typeof requireOwnerValidationSuperadmin>>) {
  if (auth instanceof Response || !auth) return null;
  return (createSupabaseAdminClient() ?? auth.supabase) as unknown as OwnerGusValidationSupabaseClient;
}

export async function GET(request: Request) {
  const auth = await requireOwnerValidationSuperadmin(request);

  if (auth instanceof Response) {
    return auth;
  }

  const admin = clientFromAuth(auth);
  if (!admin) {
    return NextResponse.json({ error: "Unable to verify Super Admin access." }, { status: 403 });
  }

  const overview = await loadOwnerGusValidationOverview(admin);
  return NextResponse.json(overview, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireOwnerValidationSuperadmin(request);

  if (auth instanceof Response) {
    return auth;
  }

  const admin = clientFromAuth(auth);
  if (!admin || !auth) {
    return NextResponse.json({ error: "Unable to verify Super Admin access." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body && typeof body === "object" ? (body as Record<string, unknown>).action : null;

  if (action === "save_test_case") {
    const input = validateOwnerGusTestCaseInput(body);
    if (!input.scenario) {
      return NextResponse.json({ error: "Scenario is required." }, { status: 400 });
    }

    const testCase = await saveOwnerGusValidationTestCase({
      client: admin,
      actorUserId: auth.user.id,
      title: input.title,
      scenario: input.scenario,
      expectedFocus: input.expectedFocus,
    });

    return NextResponse.json({ testCase }, { status: 201 });
  }

  const input = validateOwnerGusRunInput(body);
  if (!input.scenario) {
    return NextResponse.json({ error: "Scenario is required." }, { status: 400 });
  }

  const result = await runOwnerGusValidation({
    client: admin,
    actorUserId: auth.user.id,
    scenario: input.scenario,
    testCaseId: input.testCaseId,
  });

  return NextResponse.json(result, { status: 201 });
}
