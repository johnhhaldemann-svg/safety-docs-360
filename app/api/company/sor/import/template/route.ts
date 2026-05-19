import { NextResponse } from "next/server";
import { sorImportTemplateCsv } from "@/lib/sor/importTemplate";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_create_documents",
      "can_submit_documents",
      "can_view_all_company_data",
      "can_view_reports",
    ],
  });
  if ("error" in auth) return auth.error;

  return new NextResponse(sorImportTemplateCsv(), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sor-import-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
