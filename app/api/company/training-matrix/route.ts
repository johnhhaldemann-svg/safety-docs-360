import { NextResponse } from "next/server";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import {
  canMutateCompanyTrainingRequirements,
  canViewCompanyTrainingMatrix,
} from "@/lib/companyTrainingAccess";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  loadCompanyWorkspaceUsers,
  loadCompanyWorkspaceUsersRls,
} from "@/lib/companyWorkspaceDirectory";
import { fetchCompanyTrainingRequirements } from "@/lib/companyTrainingRequirementsDb";
import {
  buildProfileCertificationInventory,
  parseCertificationExpirations,
} from "@/lib/certificationExpirations";
import {
  computeTrainingMatrixRow,
  DEFAULT_MATCH_FIELDS,
  type TrainingRequirementInput,
} from "@/lib/trainingMatrix";

export const runtime = "nodejs";

type ProfileRow = {
  user_id: string;
  certifications: string[] | null;
  certification_expirations?: Record<string, string> | null;
  job_title: string | null;
  trade_specialty: string | null;
  readiness_status: string | null;
  years_experience?: number | null;
};

export async function GET(request: Request) {
  try {
    return await getTrainingMatrix(request);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error loading training matrix.";
    console.error("[training-matrix]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function getTrainingMatrix(request: Request) {
  const auth = await authorizeRequest(request);

  if ("error" in auth) {
    return auth.error;
  }

  if (!canViewCompanyTrainingMatrix(auth.role)) {
    return NextResponse.json({ error: "You do not have access to the training matrix." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (isCompanyRole(auth.role) && !companyScope.companyId) {
    return NextResponse.json(
      { error: "This company account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }

  if (!companyScope.companyId) {
    return NextResponse.json({
      requirements: [],
      rows: [],
      warning: null,
      schemaMigrationNeeded: false,
      capabilities: { canMutate: canMutateCompanyTrainingRequirements(auth.role) },
    });
  }
  const csepBlock = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlock) return csepBlock;

  const adminClient = createSupabaseAdminClient();

  const reqFetch = await fetchCompanyTrainingRequirements(
    auth.supabase,
    companyScope.companyId,
    false
  );

  if (reqFetch.error) {
    return NextResponse.json(
      { error: reqFetch.error || "Failed to load training requirements." },
      { status: 500 }
    );
  }

  const requirements = reqFetch.rows.map((row) => ({
    id: row.id,
    title: row.title,
    sortOrder: row.sort_order,
    matchKeywords: row.match_keywords ?? [],
    matchFields: row.match_fields?.length ? row.match_fields : [...DEFAULT_MATCH_FIELDS],
    applyTrades: row.apply_trades ?? [],
    applyPositions: row.apply_positions ?? [],
    renewalMonths: row.renewal_months ?? null,
  }));

  const requirementInputs: TrainingRequirementInput[] = reqFetch.rows.map((row) => ({
    id: row.id,
    match_keywords: row.match_keywords ?? [],
    match_fields: row.match_fields?.length ? row.match_fields : [...DEFAULT_MATCH_FIELDS],
    apply_trades: row.apply_trades ?? [],
    apply_positions: row.apply_positions ?? [],
  }));

  const schemaMigrationNeeded = !reqFetch.applyColumnsAvailable;

  const scopeTeam = companyScope.companyName?.trim() || auth.team || "General";

  const directory = adminClient
    ? await loadCompanyWorkspaceUsers({
        adminClient,
        authUser: auth.user,
        companyId: companyScope.companyId,
        scopeTeam,
      })
    : await loadCompanyWorkspaceUsersRls({
        supabase: auth.supabase,
        authUser: auth.user,
        companyId: companyScope.companyId,
        scopeTeam,
      });

  if (directory.error) {
    return NextResponse.json({ error: directory.error }, { status: 500 });
  }

  const userIds = directory.users.map((u) => u.id);
  if (userIds.length === 0) {
    return NextResponse.json({
      requirements,
      rows: [],
      warning: null,
      directoryNotice: adminClient
        ? null
        : "Names, emails, and last sign-in use limited Auth data until you add SUPABASE_SERVICE_ROLE_KEY to the server environment (for example in Vercel → Settings → Environment Variables). Never expose it to the browser.",
      schemaMigrationNeeded,
      capabilities: { canMutate: canMutateCompanyTrainingRequirements(auth.role) },
    });
  }

  const profileClient = adminClient ?? auth.supabase;
  const profileSelectAttempts = [
    "user_id, certifications, certification_expirations, job_title, trade_specialty, readiness_status, years_experience",
    "user_id, certifications, job_title, trade_specialty, readiness_status, years_experience",
    "user_id, certifications, job_title, trade_specialty, readiness_status",
  ];

  let profileData: ProfileRow[] | null = null;
  let profileError: { message: string } | null = null;
  for (const columns of profileSelectAttempts) {
    const res = await profileClient.from("user_profiles").select(columns).in("user_id", userIds);
    if (!res.error) {
      profileData = res.data as unknown as ProfileRow[] | null;
      profileError = null;
      break;
    }
    profileError = res.error;
  }

  if (profileError && adminClient) {
    return NextResponse.json(
      { error: profileError.message || "Failed to load user profiles." },
      { status: 500 }
    );
  }

  const directoryNotice: string | null = adminClient
    ? null
    : "Names, emails, and last sign-in use limited Auth data until you add SUPABASE_SERVICE_ROLE_KEY to the server environment (for example in Vercel → Settings → Environment Variables). Never expose it to the browser.";

  let warning: string | null =
    profileError && !adminClient
      ? "Construction profiles could not be loaded for every row (permissions or configuration)."
      : null;

  const profileMap = new Map<string, ProfileRow>();
  for (const row of (profileData as ProfileRow[] | null) ?? []) {
    profileMap.set(row.user_id, row);
  }

  const asOf = new Date();
  const rows = directory.users.map((user) => {
    const profile = profileMap.get(user.id);
    const expMap = parseCertificationExpirations(profile?.certification_expirations ?? undefined);
    const { cells, cellDetails, unmatchedCertifications } = computeTrainingMatrixRow(
      {
        certifications: profile?.certifications ?? [],
        certificationExpirations: expMap,
        job_title: profile?.job_title ?? null,
        trade_specialty: profile?.trade_specialty ?? null,
      },
      requirementInputs,
      asOf
    );

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      cells,
      cellDetails,
      unmatchedCertifications,
      certificationInventory: buildProfileCertificationInventory(
        profile?.certifications ?? [],
        expMap,
        asOf
      ),
      profileFields: {
        tradeSpecialty: profile?.trade_specialty?.trim() || "",
        jobTitle: profile?.job_title?.trim() || "",
        readinessStatus: profile?.readiness_status?.trim() || "",
        yearsExperience: profile?.years_experience ?? null,
      },
    };
  });

  return NextResponse.json({
    requirements,
    rows,
    warning,
    directoryNotice,
    schemaMigrationNeeded,
    capabilities: { canMutate: canMutateCompanyTrainingRequirements(auth.role) },
  });
}
