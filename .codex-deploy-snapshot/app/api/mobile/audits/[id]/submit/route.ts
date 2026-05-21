import { PATCH } from "@/app/api/mobile/audits/[id]/route";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const patched = new Request(request.url, {
    method: "PATCH",
    headers: request.headers,
    body: JSON.stringify({ status: "pending_review" }),
  });
  return PATCH(patched, context);
}
