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
  getSupabaseServerEnvStatus,
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
  const envStatus = getSupabaseServerEnvStatus();
  const agreementConfig = await getAgreementConfig(adminClient ?? undefined).catch(() =>
    getDefaultAgreementConfig()
  );

  if (!publicClient) {
    return NextResponse.json(
      {
        error: "Company registration is not configured correctly.",
        details: envStatus,
      },
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

  const pendingMetadata = {
    role: "viewer",
    team: companyName,
    company_id: null,
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
    const errorMessage = error.message ?? "";
    if (
      errorMessage.toLowerCase().includes("already registered") ||
      errorMessage.toLowerCase().includes("user already registered")
    ) {
      return NextResponse.json(
        {
          error:
            "An account already exists for this email. Sign in with that same email instead of creating another account.",
        },
        { status: 400 }
      );
    }

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

  const metadataResult = adminClient
    ? await adminClient.auth.admin.updateUserById(userId, {
        user_metadata: mergedUserMetadata,
        app_metadata: mergedAppMetadata,
      })
    : { error: null };

  const roleResult = adminClient
    ? await adminClient.from("user_roles").upsert(
        {
          user_id: userId,
          role: "viewer",
          team: companyName,
          company_id: null,
          account_status: "pending",
          created_by: userId,
          updated_by: userId,
        },
        {
          onConflict: "user_id",
        }
      )
    : { error: null };

  const signupRequestResult = await (adminClient ?? publicClient)
    .from("company_signup_requests")
    .insert({
      company_name: companyName,
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
      requested_role: "company_admin",
      account_status: "pending",
      status: "pending",
      notes: "Created from the company owner signup flow.",
    });

  if (roleResult.error) {
    return NextResponse.json(
      { error: roleResult.error.message || "Failed to create the pending owner account." },
      { status: 500 }
    );
  }

  if (signupRequestResult.error) {
    if (
      (signupRequestResult.error.message ?? "").includes(
        "company_signup_requests_pending_email_idx"
      )
    ) {
      return NextResponse.json(
        {
          success: true,
          message:
            "A company workspace request is already pending for this email. You do not need to sign up again.",
          agreementVersion: agreementConfig.version,
          warning:
            "Sign in with this same email after approval and the company workspace will be attached to that account automatically.",
        },
        { status: 200 }
      );
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

  if (adminClient) {
    await acceptUserAgreement({
      supabase: adminClient,
      userId,
      ipAddress: getClientIpAddress(request),
      termsVersion: agreementConfig.version,
    });
  }

  return NextResponse.json({
    success: true,
    message:
      "Company account created and sent for internal approval. After approval, sign in with this same email and the company workspace will attach automatically.",
    warning:
      metadataResult.error
        ? "The owner account was created, but some profile details may finish syncing during internal approval."
        : null,
  });
}
