import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  acceptUserAgreement,
  getClientIpAddress,
  getDefaultAgreementConfig,
} from "@/lib/legal";
import { getAgreementConfig } from "@/lib/legalSettings";
import {
  createSupabaseAdminClient,
  getSupabaseAnonKey,
  getSupabaseServerUrl,
} from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type RegisterPayload = {
  companyName?: string;
  industry?: string;
  phone?: string;
  website?: string;
  addressLine1?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
  country?: string;
  fullName?: string;
  email?: string;
  password?: string;
  agreed?: boolean;
};

function createPublicClient() {
  const supabaseUrl = getSupabaseServerUrl();
  const anonKey = getSupabaseAnonKey();

  if (!supabaseUrl || !anonKey) {
    return null;
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(request: Request) {
  const publicClient = createPublicClient();
  const adminClient = createSupabaseAdminClient();

  if (!publicClient || !adminClient) {
    return NextResponse.json(
      { error: "Company registration is not configured correctly." },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as RegisterPayload | null;
  const companyName = body?.companyName?.trim() ?? "";
  const industry = body?.industry?.trim() ?? "";
  const phone = body?.phone?.trim() ?? "";
  const website = body?.website?.trim() ?? "";
  const addressLine1 = body?.addressLine1?.trim() ?? "";
  const city = body?.city?.trim() ?? "";
  const stateRegion = body?.stateRegion?.trim() ?? "";
  const postalCode = body?.postalCode?.trim() ?? "";
  const country = body?.country?.trim() ?? "";
  const fullName = body?.fullName?.trim() ?? "";
  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password?.trim() ?? "";
  const agreed = body?.agreed === true;

  if (
    !companyName ||
    !industry ||
    !phone ||
    !addressLine1 ||
    !city ||
    !stateRegion ||
    !postalCode ||
    !country ||
    !fullName ||
    !email ||
    !password
  ) {
    return NextResponse.json(
      {
        error:
          "Company details, primary contact details, and address fields are required.",
      },
      { status: 400 }
    );
  }

  if (!agreed) {
    return NextResponse.json(
      { error: "You must accept the agreement before creating a company account." },
      { status: 400 }
    );
  }

  const { data: companyData, error: companyError } = await adminClient
    .from("companies")
    .upsert(
      {
        name: companyName,
        team_key: companyName,
        industry,
        phone,
        website: website || null,
        address_line_1: addressLine1,
        city,
        state_region: stateRegion,
        postal_code: postalCode,
        country,
        primary_contact_name: fullName,
        primary_contact_email: email,
      },
      {
        onConflict: "team_key",
        ignoreDuplicates: false,
      }
    )
    .select("id, name")
    .single();

  if (companyError || !companyData?.id) {
    return NextResponse.json(
      { error: companyError?.message || "Failed to create the company workspace." },
      { status: 500 }
    );
  }

  const pendingMetadata = {
    role: "company_admin",
    team: companyName,
    company_id: companyData.id,
    account_status: "pending",
    full_name: fullName,
    company_name: companyName,
    company_industry: industry,
    company_phone: phone,
    company_website: website || null,
    company_address_line_1: addressLine1,
    company_city: city,
    company_state_region: stateRegion,
    company_postal_code: postalCode,
    company_country: country,
  };

  const { data, error } = await publicClient.auth.signUp({
    email,
    password,
    options: {
      data: pendingMetadata,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data.user?.id) {
    return NextResponse.json(
      { error: "Account created, but no user record was returned." },
      { status: 500 }
    );
  }

  const userId = data.user.id;
  const mergedUserMetadata = {
    ...(data.user.user_metadata ?? {}),
    ...pendingMetadata,
  };
  const mergedAppMetadata = {
    ...(data.user.app_metadata ?? {}),
    ...pendingMetadata,
  };

  const [metadataResult, roleResult, membershipResult] = await Promise.all([
    adminClient.auth.admin.updateUserById(userId, {
      user_metadata: mergedUserMetadata,
      app_metadata: mergedAppMetadata,
    }),
    adminClient.from("user_roles").upsert(
      {
        user_id: userId,
        role: "company_admin",
        team: companyName,
        company_id: companyData.id,
        account_status: "pending",
        created_by: userId,
        updated_by: userId,
      },
      {
        onConflict: "user_id",
      }
    ),
    adminClient.from("company_memberships").upsert(
      {
        user_id: userId,
        company_id: companyData.id,
        role: "company_admin",
        status: "pending",
        created_by: userId,
        updated_by: userId,
      },
      {
        onConflict: "user_id,company_id",
      }
    ),
  ]);

  const agreementConfig = await getAgreementConfig(adminClient).catch(() =>
    getDefaultAgreementConfig()
  );
  const agreementAcceptResult = await acceptUserAgreement({
    supabase: adminClient,
    userId,
    ipAddress: getClientIpAddress(request),
    termsVersion: agreementConfig.version,
  });

  return NextResponse.json({
    success: true,
    message:
      "Company account created. An internal administrator must approve your company workspace before you can enter the platform.",
    warning:
      metadataResult.error || roleResult.error || membershipResult.error || agreementAcceptResult.error
        ? "The company account was created, but some profile details may finish syncing during admin approval."
        : null,
  });
}
