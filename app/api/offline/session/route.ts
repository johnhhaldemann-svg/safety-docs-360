import { NextResponse } from "next/server";
import {
  getOfflineDemoCookieName,
  getOfflineDemoSessionPayload,
  isOfflineDesktopEnabled,
} from "@/lib/offlineDesktopSession";

export const runtime = "nodejs";

export async function POST() {
  if (!isOfflineDesktopEnabled()) {
    return NextResponse.json({ error: "Offline desktop mode is disabled." }, { status: 404 });
  }

  const payload = getOfflineDemoSessionPayload();
  const response = NextResponse.json(payload, { status: 200 });
  response.cookies.set(getOfflineDemoCookieName(), payload.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
    maxAge: 60 * 60 * 24,
  });
  return response;
}
