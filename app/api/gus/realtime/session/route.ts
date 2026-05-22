import { NextResponse } from "next/server";
import {
  getDisabledGusRealtimeSessionResponse,
  isGusRealtimeVoiceEnabled,
} from "@/lib/gus/gusRealtimeTools";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isGusRealtimeVoiceEnabled()) {
    return NextResponse.json(getDisabledGusRealtimeSessionResponse(), {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  return NextResponse.json(
    {
      enabled: false,
      error: "Gus realtime voice session creation is reserved for a future release.",
    },
    {
      status: 501,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
