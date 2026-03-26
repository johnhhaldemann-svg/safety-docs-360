import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function proxy(request: Request, path: string) {
  const source = new URL(request.url);
  const target = new URL(path, source.origin);
  target.search = source.search;
  const response = await fetch(target, {
    method: request.method,
    headers: request.headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
  });
  return new NextResponse(response.body, { status: response.status, headers: response.headers });
}

export async function GET(request: Request) {
  return proxy(request, "/api/company/corrective-actions");
}

export async function POST(request: Request) {
  return proxy(request, "/api/company/safety-submissions");
}

export async function PATCH(request: Request) {
  return proxy(request, "/api/company/corrective-actions");
}
