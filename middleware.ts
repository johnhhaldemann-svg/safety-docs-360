import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // #region agent log
  fetch("http://127.0.0.1:7613/ingest/cee4d426-76d4-454a-9d6d-950241152e62", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "690b86" },
    body: JSON.stringify({
      sessionId: "690b86",
      runId: "baseline-3",
      hypothesisId: "H9",
      location: "middleware.ts:middleware",
      message: "Incoming request observed by middleware",
      data: {
        method: request.method,
        pathname: request.nextUrl.pathname,
        search: request.nextUrl.search,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

