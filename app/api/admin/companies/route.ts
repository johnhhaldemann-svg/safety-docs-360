import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { sendCompanyInviteEmail } from "@/lib/inviteEmail";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

type CompanyRow = {
  id: string;
  name: string | null;
  team_key: string | null;
  industry: string | null;
  phone: string | null;
  website: string | null;
  address_line_1: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  status: string | null;
  created_at: string | null;
};

type MembershipRow = {
  company_id: string;
  role: string | null;
  status: string | null;
};

type InviteRow = {
  company_id: string;
  consumed_at: string | null;
};

type CompanyDocumentRow = {
  company_id: string | null;
  status: string | null;
  final_file_path: string | null;
};

type CompanySignupRequestRow = {
  id: string;
  company_name: string | null;
  industry: string | null;
  website: string | null;
  address_line_1: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  phone: string | null;
  requested_role: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  notes: string | null;
  account_status: string | null;
  status: string | null;
  created_at: string | null;
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

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_view_all_company_data",
  });

  if ("error" in auth) {
    return auth.error;
  }

  const adminClient = createSupabaseAdminClient() ?? auth.supabase;

  const [companiesResult, membershipsResult, invitesResult, documentsResult, signupRequestsResult] =
    await Promise.all([
    adminClient
      .from("companies")
      .select(
        "id, name, team_key, industry, phone, website, address_line_1, city, state_region, postal_code, country, primary_contact_name, primary_contact_email, status, created_at"
      )
      .order("name"),
    adminClient.from("company_memberships").select("company_id, role, status"),
    adminClient.from("company_invites").select("company_id, consumed_at"),
    adminClient.from("documents").select("company_id, status, final_file_path"),
    adminClient
      .from("company_signup_requests")
      .select(
        "id, company_name, industry, website, address_line_1, city, state_region, postal_code, country, primary_contact_name, primary_contact_email, phone, requested_role, reviewed_at, reviewed_by, notes, account_status, status, created_at"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    ]);

  if (companiesResult.error) {
    return NextResponse.json(
      { error: companiesResult.error.message || "Failed to load companies." },
      { status: 500 }
    );
  }

  const memberships = (membershipsResult.data as MembershipRow[] | null) ?? [];
  const invites = (invitesResult.data as InviteRow[] | null) ?? [];
  const documents = (documentsResult.data as CompanyDocumentRow[] | null) ?? [];
  const signupRequests =
    (signupRequestsResult.data as CompanySignupRequestRow[] | null) ?? [];

  const companies = ((companiesResult.data as CompanyRow[] | null) ?? []).map((company) => {
    const companyMemberships = memberships.filter((row) => row.company_id === company.id);
    const companyInvites = invites.filter(
      (row) => row.company_id === company.id && !row.consumed_at
    );
    const companyDocuments = documents.filter((row) => row.company_id === company.id);

    return {
      id: company.id,
      name: company.name?.trim() || company.team_key?.trim() || "Unnamed Company",
      teamKey: company.team_key?.trim() || "General",
      industry: company.industry?.trim() || "",
      phone: company.phone?.trim() || "",
      website: company.website?.trim() || "",
      addressLine1: company.address_line_1?.trim() || "",
      city: company.city?.trim() || "",
      stateRegion: company.state_region?.trim() || "",
      postalCode: company.postal_code?.trim() || "",
      country: company.country?.trim() || "",
      primaryContactName: company.primary_contact_name?.trim() || "",
      primaryContactEmail: company.primary_contact_email?.trim() || "",
      status: company.status?.trim() || "active",
      createdAt: company.created_at,
      totalUsers: companyMemberships.length,
      companyAdmins: companyMemberships.filter((row) => row.role === "company_admin").length,
      activeUsers: companyMemberships.filter((row) => row.status === "active").length,
      pendingUsers: companyMemberships.filter((row) => row.status === "pending").length,
      pendingInvites: companyInvites.length,
      completedDocuments: companyDocuments.filter(
        (row) =>
          row.status?.trim().toLowerCase() === "approved" || Boolean(row.final_file_path)
      ).length,
      submittedDocuments: companyDocuments.filter(
        (row) => row.status?.trim().toLowerCase() === "submitted"
      ).length,
    };
  });

  return NextResponse.json({ companies, signupRequests });
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_view_all_company_data",
  });

  if ("error" in auth) {
    return auth.error;
  }

  const supabase = createSupabaseAdminClient() ?? auth.supabase;
  const body = (await request.json().catch(() => null)) as
    | { requestId?: string; action?: string; notes?: string }
    | null;
  const requestId = body?.requestId?.trim() ?? "";
  const action = body?.action?.trim().toLowerCase() ?? "";
  const notes = body?.notes?.trim() ?? null;

  if (!requestId || (action !== "approve" && action !== "reject")) {
    return NextResponse.json(
      { error: "A valid company signup request action is required." },
      { status: 400 }
    );
  }

  const signupRequestResult = await supabase
    .from("company_signup_requests")
    .select(
      "id, company_name, industry, website, address_line_1, city, state_region, postal_code, country, primary_contact_name, primary_contact_email, phone, requested_role, notes, account_status, status, created_at"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (signupRequestResult.error) {
    return NextResponse.json(
      {
        error:
          signupRequestResult.error.message ||
          "Failed to load the company signup request.",
      },
      { status: 500 }
    );
  }

  const signupRequest = signupRequestResult.data as CompanySignupRequestRow | null;

  if (!signupRequest) {
    return NextResponse.json(
      { error: "That company signup request could not be found." },
      { status: 404 }
    );
  }

  if ((signupRequest.status ?? "").toLowerCase() !== "pending") {
    return NextResponse.json(
      { error: "This company signup request has already been reviewed." },
      { status: 400 }
    );
  }

  if (action === "reject") {
    const rejectResult = await supabase
      .from("company_signup_requests")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: auth.user.id,
        notes,
      })
      .eq("id", requestId);

    if (rejectResult.error) {
      return NextResponse.json(
        {
          error:
            rejectResult.error.message ||
            "Failed to reject the company signup request.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Company signup request rejected.",
    });
  }

  const companyName = signupRequest.company_name?.trim() || "New Company";
  const primaryContactEmail = signupRequest.primary_contact_email?.trim().toLowerCase() || "";
  const primaryContactName = signupRequest.primary_contact_name?.trim() || "Company Admin";
  const requestedRole =
    signupRequest.requested_role?.trim().toLowerCase() === "company_owner"
      ? "company_admin"
      : "company_admin";

  if (!primaryContactEmail) {
    return NextResponse.json(
      { error: "The signup request is missing the primary contact email." },
      { status: 400 }
    );
  }

  let companyData:
    | {
        id: string;
        name: string | null;
        team_key: string | null;
      }
    | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const insertResult = await supabase
      .from("companies")
      .insert({
        name: companyName,
        team_key: buildUniqueCompanyKey(companyName),
        industry: signupRequest.industry?.trim() || null,
        phone: signupRequest.phone?.trim() || null,
        website: signupRequest.website?.trim() || null,
        address_line_1: signupRequest.address_line_1?.trim() || null,
        city: signupRequest.city?.trim() || null,
        state_region: signupRequest.state_region?.trim() || null,
        postal_code: signupRequest.postal_code?.trim() || null,
        country: signupRequest.country?.trim() || null,
        primary_contact_name: primaryContactName,
        primary_contact_email: primaryContactEmail,
        status: "active",
        created_by: auth.user.id,
        updated_by: auth.user.id,
      })
      .select("id, name, team_key")
      .single();

    if (!insertResult.error && insertResult.data) {
      companyData = insertResult.data;
      break;
    }
  }

  if (!companyData?.id) {
    return NextResponse.json(
      {
        error:
          "Failed to activate the company workspace. Confirm the companies table allows internal admin inserts.",
      },
      { status: 500 }
    );
  }

  const inviteResult = await supabase.from("company_invites").insert({
    email: primaryContactEmail,
    role: requestedRole,
    team: companyName,
    company_id: companyData.id,
    account_status: "active",
    created_by: auth.user.id,
    updated_by: auth.user.id,
  });

  if (inviteResult.error) {
    return NextResponse.json(
      {
        error:
          inviteResult.error.message ||
          "The company workspace was created, but the first company admin invite could not be created.",
      },
      { status: 500 }
    );
  }

  const approveResult = await supabase
    .from("company_signup_requests")
    .update({
      status: "approved",
      account_status: "active",
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.user.id,
      notes,
    })
    .eq("id", requestId);

  if (approveResult.error) {
    return NextResponse.json(
      {
        error:
          approveResult.error.message ||
          "The company workspace was created, but the signup request could not be marked approved.",
      },
      { status: 500 }
    );
  }

  const emailResult = await sendCompanyInviteEmail({
    toEmail: primaryContactEmail,
    companyName,
    roleLabel: "Company Admin",
    invitedByName: auth.user.email?.trim() || "Internal Admin",
  });

  return NextResponse.json({
    success: true,
    message: emailResult.sent
      ? "Company workspace approved and the first company admin invite was emailed."
      : "Company workspace approved and the first company admin invite was created.",
    warning: emailResult.sent ? null : emailResult.warning,
  });
}
