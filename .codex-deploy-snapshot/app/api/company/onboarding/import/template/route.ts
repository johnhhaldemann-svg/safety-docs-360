import { NextResponse } from "next/server";
import {
  COMPANY_ONBOARDING_IMPORT_TYPES,
  templateCsvFor,
  type CompanyOnboardingImportType,
} from "@/lib/companyOnboardingImport";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

function isImportType(value: string | null): value is CompanyOnboardingImportType {
  return COMPANY_ONBOARDING_IMPORT_TYPES.includes(value as CompanyOnboardingImportType);
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_manage_company_users",
      "can_view_all_company_data",
      "can_view_analytics",
      "can_access_training",
    ],
  });
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (!isImportType(type)) {
    return NextResponse.json(
      { error: "Template type must be employees, jobsites, or training_records." },
      { status: 400 }
    );
  }

  return new NextResponse(templateCsvFor(type), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="company-onboarding-${type}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
