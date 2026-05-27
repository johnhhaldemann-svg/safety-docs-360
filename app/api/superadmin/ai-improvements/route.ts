import { NextResponse } from "next/server";
import {
  createAiImprovementRequest,
  listAiImprovementRequests,
} from "@/lib/superadmin/aiImprovementRequests";
import {
  getAiImprovementClient,
  requestIpAddress,
  requestUserAgent,
  requireAiImprovementSuperadmin,
} from "./_shared";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAiImprovementSuperadmin(request);
  if (auth instanceof Response) return auth;
  if (!auth) return NextResponse.json({ error: "Unable to verify Super Admin access." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 100);
  const client = getAiImprovementClient(auth.supabase);
  const requests = await listAiImprovementRequests(client, limit);

  return NextResponse.json(
    { requests },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const auth = await requireAiImprovementSuperadmin(request);
  if (auth instanceof Response) return auth;
  if (!auth) return NextResponse.json({ error: "Unable to verify Super Admin access." }, { status: 403 });

  try {
    const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const client = getAiImprovementClient(auth.supabase);
    const improvement = await createAiImprovementRequest({
      client,
      input,
      actor: { id: auth.user.id, type: "user", role: auth.role },
      ipAddress: requestIpAddress(request),
      userAgent: requestUserAgent(request),
    });

    return NextResponse.json({ request: improvement }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create AI improvement request." },
      { status: 400 }
    );
  }
}
