import { handleGusDraftRecordRequest } from "@/lib/gus/gusDraftRecordRoutes";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleGusDraftRecordRequest(request, {
    type: "jsa",
    responseKey: "draftJsa",
  });
}
