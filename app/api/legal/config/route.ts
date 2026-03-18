import { NextResponse } from "next/server";
import { getAgreementConfig } from "@/lib/legalSettings";

export const runtime = "nodejs";

export async function GET() {
  try {
    const config = await getAgreementConfig();
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load agreement configuration.",
      },
      { status: 500 }
    );
  }
}
