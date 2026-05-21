import { NextResponse } from "next/server";
import { buildBucketedWorkItem } from "@/lib/safety-intelligence/buckets";
import { detectConflicts } from "@/lib/safety-intelligence/conflicts";
import { authorizeSafetyIntelligenceRequest, type SafetyIntelligenceAuthorized } from "@/lib/safety-intelligence/http";
import { evaluateRules } from "@/lib/safety-intelligence/rules";
import { parseRawTaskInput } from "@/lib/safety-intelligence/validation/intake";
import { parseCompanyBucketItemPeerRow } from "@/lib/safety-intelligence/validation/companyBucketPeers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeSafetyIntelligenceRequest(request);
  if ("error" in auth) return auth.error;
  const resolved = auth as SafetyIntelligenceAuthorized;
  if (!resolved.companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace linked." }, { status: 400 });
  }

  try {
    const input = parseRawTaskInput(await request.json());
    const bucket = buildBucketedWorkItem(input);
    const rules = evaluateRules(input, bucket);
    const peersResult = await resolved.supabase
      .from("company_bucket_items")
      .select("bucket_payload, rule_results")
      .eq("company_id", resolved.companyScope.companyId)
      .order("updated_at", { ascending: false })
      .limit(25);

    const peers = (peersResult.data ?? [])
      .map((row) => parseCompanyBucketItemPeerRow(row))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    const peerBuckets = peers.map((row) => row.bucket);
    const peerRules = peers.map((row) => row.rules);

    const conflicts = detectConflicts(
      bucket,
      rules,
      [bucket, ...peerBuckets],
      [rules, ...peerRules]
    );

    return NextResponse.json({ bucket, rules, conflicts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to scan conflicts." },
      { status: 400 }
    );
  }
}
