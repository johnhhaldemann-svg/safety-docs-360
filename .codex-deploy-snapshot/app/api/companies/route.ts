import { NextResponse } from "next/server";

export const runtime = "nodejs";

function toCompanyUrl(request: Request, targetPath: string) {
  const source = new URL(request.url);
  const target = new URL(targetPath, source.origin);
  target.search = source.search;
  return target;
}

async function proxy(request: Request, path: string) {
  const target = toCompanyUrl(request, path);
  const response = await fetch(target, {
    method: request.method,
    headers: request.headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
  });
  return new NextResponse(response.body, {
    status: response.status,
    headers: response.headers,
  });
}

export async function GET(request: Request) {
  return proxy(request, "/api/company/users");
}

export async function POST(request: Request) {
  return proxy(request, "/api/company/users");
}

export async function PATCH() {
  return NextResponse.json(
    {
      error: "Use /api/company/users/[id] for company user updates.",
      hint: "/api/company/users/[id]",
    },
    { status: 400 }
  );
}
