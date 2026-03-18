import { NextResponse } from "next/server";
import { getDefaultAgreementConfig } from "@/lib/legal";
import { getAgreementConfig } from "@/lib/legalSettings";

export const runtime = "nodejs";

export async function GET() {
  try {
    const config = await getAgreementConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("Failed to load agreement configuration:", error);
    return NextResponse.json(getDefaultAgreementConfig());
  }
}
