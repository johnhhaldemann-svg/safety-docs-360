import { NextResponse } from "next/server";
import { getKnowledgeGraphPayload } from "@/lib/aiKnowledgeMap/repository";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { authorizeSuperadminAiEngineRequest } from "@/lib/superadmin/aiEngineAuth";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const payload = await getKnowledgeGraphPayload(createSupabaseAdminClient(), {
    companyId: searchParams.get("companyId"),
  });
  const node = payload.nodes.find((item) => item.id === id || item.sourceId === id);
  if (!node) return NextResponse.json({ error: "Knowledge node not found." }, { status: 404 });
  const connectedEdges = payload.edges.filter((edge) => edge.sourceNodeId === node.id || edge.targetNodeId === node.id || edge.fromNodeId === node.id || edge.toNodeId === node.id);
  const relatedIds = new Set(connectedEdges.flatMap((edge) => [edge.sourceNodeId ?? edge.fromNodeId, edge.targetNodeId ?? edge.toNodeId]).filter(Boolean));
  relatedIds.delete(node.id);

  return NextResponse.json({
    node,
    connectedEdges,
    relatedRecords: payload.nodes.filter((item) => item.id && relatedIds.has(item.id)),
    sourceLinks: [{ sourceTable: node.sourceTable, sourceId: node.sourceId, href: node.sourceUrl }],
    validationStatus: node.validationStatus,
    demo: payload.demo,
  });
}
