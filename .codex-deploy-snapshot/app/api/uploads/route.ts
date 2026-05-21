import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    uploadEndpoints: [
      "/upload",
      "/api/company/corrective-actions/[id]/evidence",
      "/api/company/safety-submissions",
    ],
    note: "Use feature-specific upload endpoints to preserve company scope and audit trails.",
  });
}

export async function POST() {
  return NextResponse.json(
    {
      error: "Direct /api/uploads POST is not enabled.",
      hint: "Use module-specific upload endpoints for evidence and submissions.",
    },
    { status: 400 }
  );
}
