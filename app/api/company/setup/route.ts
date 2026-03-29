import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

type CompanySetupPayload = {
  companyName?: string;
  industry?: string;
  phone?: string;
  website?: string;
  addressLine1?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
  country?: string;
  planName?: string;
};

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);

  if ("error" in auth) {
    return auth.error;
  }

  if (auth.permissionMap.can_access_internal_admin) {
    return NextResponse.json(
      {
        error:
          "Internal admin accounts do not create customer companies from this setup flow.",
      },
      { status: 403 }
    );
  }

  const currentScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (currentScope.companyId) {
    return NextResponse.json(
      { error: "This account is already linked to a company workspace." },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => null)) as CompanySetupPayload | null;
  const companyName = body?.companyName?.trim() ?? "";
  const industry = body?.industry?.trim() ?? "";
  const phone = body?.phone?.trim() ?? "";
  const website = body?.website?.trim() ?? "";
  const addressLine1 = body?.addressLine1?.trim() ?? "";
  const city = body?.city?.trim() ?? "";
  const stateRegion = body?.stateRegion?.trim() ?? "";
  const postalCode = body?.postalCode?.trim() ?? "";
  const country = body?.country?.trim() ?? "";
  if (
    !companyName ||
    !industry ||
    !phone ||
    !addressLine1 ||
    !city ||
    !stateRegion ||
    !postalCode ||
    !country
  ) {
    return NextResponse.json(
      {
        error:
          "Company details, contact information, and address fields are required.",
      },
      { status: 400 }
    );
  }

  const signupRequestResult = await auth.supabase.from("company_signup_requests").insert({
    company_name: companyName,
    industry,
    phone,
    website: website || null,
    address_line_1: addressLine1,
    city,
    state_region: stateRegion,
    postal_code: postalCode,
    country,
    primary_contact_name:
      (typeof auth.user.user_metadata?.full_name === "string"
        ? auth.user.user_metadata.full_name
        : typeof auth.user.user_metadata?.name === "string"
          ? auth.user.user_metadata.name
          : auth.user.email ?? "") || auth.user.email,
    primary_contact_email: auth.user.email ?? "",
    owner_user_id: auth.user.id,
    requested_role: "company_admin",
    account_status: "pending",
    status: "pending",
    notes: "Submitted from the signed-in company setup flow.",
  });

  if (signupRequestResult.error) {
    if (
      (signupRequestResult.error.message ?? "").includes(
        "company_signup_requests_pending_email_idx"
      )
    ) {
      return NextResponse.json({
        success: true,
        mode: "request",
        message:
          "Your company workspace request is already in internal review under this email.",
        warning:
          "You do not need to submit another request. Once approved, sign back in with this same account and the company workspace will open automatically.",
      });
    }

    return NextResponse.json(
      {
        error:
          signupRequestResult.error.message ||
          "Failed to submit the company workspace request.",
      },
      { status: 500 }
    );
  }

  await auth.supabase
    .from("user_roles")
    .upsert(
      {
        user_id: auth.user.id,
        role: "viewer",
        team: companyName,
        company_id: null,
        account_status: "pending",
        created_by: auth.user.id,
        updated_by: auth.user.id,
      },
      {
        onConflict: "user_id",
      }
    );

  return NextResponse.json({
    success: true,
    mode: "request",
    message:
      "Company details saved. Your workspace request is now in internal review and will be activated after approval.",
    warning:
      "Do not create another account. After approval, sign back in with this same email and the company workspace will attach automatically.",
  });
}
