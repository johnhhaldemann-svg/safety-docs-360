import { NextResponse } from "next/server";
import { getDefaultAgreementConfig } from "@/lib/legal";
import { getAgreementConfig } from "@/lib/legalSettings";
import { serverLog } from "@/lib/serverLog";

export const runtime = "nodejs";

export async function GET() {
  try {
    const config = await getAgreementConfig();
    return NextResponse.json(config);
  } catch (error) {
    serverLog("error", "legal_config_load_failed", {
      errorKind: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(getDefaultAgreementConfig());
  }
}
