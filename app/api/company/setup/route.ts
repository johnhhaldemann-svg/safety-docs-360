import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
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

type CompanySetupRpcRow = {
  company_id: string;
  company_name: string;
  team_key: string;
};

function buildCompanyKeyBase(companyName: string) {
  const normalized = companyName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);

  return normalized || "company";
}

function buildUniqueCompanyKey(companyName: string) {
  return `${buildCompanyKeyBase(companyName)}-${randomUUID().slice(0, 8)}`;
}

async function createCompanyWorkspaceViaRpc(params: {
  supabase: {
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message?: string | null; code?: string | null } | null }>;
  };
  companyName: string;
  industry: string;
  phone: string;
  website: string;
  addressLine1: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
  planName: string;
}) {
  const rpcResult = await params.supabase.rpc("create_company_workspace", {
    p_company_name: params.companyName,
    p_industry: params.industry,
    p_phone: params.phone,
    p_website: params.website || null,
    p_address_line_1: params.addressLine1,
    p_city: params.city,
    p_state_region: params.stateRegion,
    p_postal_code: params.postalCode,
    p_country: params.country,
    p_plan_name: params.planName,
  });

  const rpcRow = ((rpcResult.data as CompanySetupRpcRow[] | null) ?? [])[0] ?? null;

  return {
    data: rpcRow,
    error: rpcResult.error,
  };
}

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
  });

  if (currentScope.companyId) {
    return NextResponse.json(
      { error: "This account is already linked to a company workspace." },
      { status: 400 }
    );
  }

  const adminClient = createSupabaseAdminClient();

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
  const planName = body?.planName?.trim() ?? "Pro";

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

  if (!adminClient) {
    const rpcResult = await createCompanyWorkspaceViaRpc({
      supabase: auth.supabase as never,
      companyName,
      industry,
      phone,
      website,
      addressLine1,
      city,
      stateRegion,
      postalCode,
      country,
      planName,
    });

    if (!rpcResult.error && rpcResult.data?.company_id) {
      return NextResponse.json({
        success: true,
        mode: "live",
        company: {
          id: rpcResult.data.company_id,
          name: rpcResult.data.company_name,
          planName,
        },
        message:
          "Company workspace created. You can now invite employees and manage company access from your workspace.",
      });
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
      requested_role: "company_admin",
      account_status: "active",
      status: "pending",
      notes:
        "Submitted from the in-app company setup flow because direct workspace activation was unavailable at runtime.",
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
            "Your company setup request is already in internal review under this email.",
          warning:
            "You do not need to submit another request. Once approved, sign back in with this same account and the company workspace will open automatically.",
        });
      }

      return NextResponse.json(
        {
          error:
            rpcResult.error?.message ||
            signupRequestResult.error.message ||
            "Failed to launch the company workspace.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      mode: "request",
      message:
        "Company details saved. Your workspace request is now in internal review and will be activated shortly.",
      warning:
        "You can leave this page for now. We will finish activating the shared company workspace before you start inviting employees.",
    });
  }

  let companyData: { id: string; name: string } | null = null;
  let companyError: { message?: string | null } | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await adminClient
      .from("companies")
      .insert({
        name: companyName,
        team_key: buildUniqueCompanyKey(companyName),
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
              : auth.user.email ?? ""
          ) || auth.user.email,
        primary_contact_email: auth.user.email ?? "",
        created_by: auth.user.id,
        updated_by: auth.user.id,
      })
      .select("id, name")
      .single();

    companyData = result.data;
    companyError = result.error;

    if (!companyError) {
      break;
    }
  }

  if (companyError || !companyData?.id) {
    return NextResponse.json(
      {
        error: companyError?.message || "Failed to create the company workspace.",
      },
      { status: 500 }
    );
  }

  const mergedUserMetadata = {
    ...(auth.user.user_metadata ?? {}),
    role: "company_admin",
    team: companyName,
    company_id: companyData.id,
    account_status: "active",
    company_name: companyName,
  };
  const mergedAppMetadata = {
    ...(auth.user.app_metadata ?? {}),
    role: "company_admin",
    team: companyName,
    company_id: companyData.id,
    account_status: "active",
  };

  const [metadataResult, roleResult, membershipResult, subscriptionResult] =
    await Promise.all([
      adminClient.auth.admin.updateUserById(auth.user.id, {
        user_metadata: mergedUserMetadata,
        app_metadata: mergedAppMetadata,
      }),
      adminClient.from("user_roles").upsert(
        {
          user_id: auth.user.id,
          role: "company_admin",
          team: companyName,
          company_id: companyData.id,
          account_status: "active",
          created_by: auth.user.id,
          updated_by: auth.user.id,
        },
        {
          onConflict: "user_id",
        }
      ),
      adminClient.from("company_memberships").upsert(
        {
          user_id: auth.user.id,
          company_id: companyData.id,
          role: "company_admin",
          status: "active",
          created_by: auth.user.id,
          updated_by: auth.user.id,
        },
        {
          onConflict: "user_id,company_id",
        }
      ),
      adminClient.from("company_subscriptions").upsert(
        {
          company_id: companyData.id,
          status: "active",
          plan_name: planName,
          updated_by: auth.user.id,
        },
        {
          onConflict: "company_id",
        }
      ),
    ]);

  if (metadataResult.error || roleResult.error || membershipResult.error) {
    return NextResponse.json(
      {
        error:
          metadataResult.error?.message ||
          roleResult.error?.message ||
          membershipResult.error?.message ||
          "The company workspace was created, but the account could not be linked cleanly.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    mode: "live",
    company: {
      id: companyData.id,
      name: companyData.name,
      planName,
    },
    warning: subscriptionResult.error
      ? "The workspace is live, but the company subscription record still needs attention."
      : null,
    message:
      "Company workspace created. You can now invite employees and manage company access from your workspace.",
  });
}
