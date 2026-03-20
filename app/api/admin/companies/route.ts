import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
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

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_view_all_company_data",
  });

  if ("error" in auth) {
    return auth.error;
  }

  const adminClient = createSupabaseAdminClient() ?? auth.supabase;

  const [companiesResult, membershipsResult, invitesResult, documentsResult] = await Promise.all([
    adminClient
      .from("companies")
      .select(
        "id, name, team_key, industry, phone, website, address_line_1, city, state_region, postal_code, country, primary_contact_name, primary_contact_email, status, created_at"
      )
      .order("name"),
    adminClient.from("company_memberships").select("company_id, role, status"),
    adminClient.from("company_invites").select("company_id, consumed_at"),
    adminClient.from("documents").select("company_id, status, final_file_path"),
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

  return NextResponse.json({ companies });
}
