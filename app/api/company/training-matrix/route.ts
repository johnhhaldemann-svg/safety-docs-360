import { NextResponse } from "next/server";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import {
  canMutateCompanyTrainingRequirements,
  canViewCompanyTrainingMatrix,
} from "@/lib/companyTrainingAccess";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  loadCompanyWorkspaceUsers,
  loadCompanyWorkspaceUsersRls,
} from "@/lib/companyWorkspaceDirectory";
import {
  fetchCompanyTrainingRequirements,
  TRAINING_REQUIREMENTS_SCHEMA_WARNING,
} from "@/lib/companyTrainingRequirementsDb";
import {
  computeTrainingMatrixRow,
  DEFAULT_MATCH_FIELDS,
  type TrainingRequirementInput,
} from "@/lib/trainingMatrix";

export const runtime = "nodejs";

type ProfileRow = {
  user_id: string;
  certifications: string[] | null;
  job_title: string | null;
  trade_specialty: string | null;
  readiness_status: string | null;
};

export async function GET(request: Request) {
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
      capabilities: { canMutate: canMutateCompanyTrainingRequirements(auth.role) },
    });
  }

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
  }));

  const requirementInputs: TrainingRequirementInput[] = reqFetch.rows.map((row) => ({
    id: row.id,
    match_keywords: row.match_keywords ?? [],
    match_fields: row.match_fields?.length ? row.match_fields : [...DEFAULT_MATCH_FIELDS],
    apply_trades: row.apply_trades ?? [],
    apply_positions: row.apply_positions ?? [],
  }));

  const schemaWarning = reqFetch.applyColumnsAvailable ? null : TRAINING_REQUIREMENTS_SCHEMA_WARNING;

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
    const warningOnly = schemaWarning;
    return NextResponse.json({
      requirements,
      rows: [],
      warning: warningOnly,
      capabilities: { canMutate: canMutateCompanyTrainingRequirements(auth.role) },
    });
  }

  const profileClient = adminClient ?? auth.supabase;
  const { data: profileData, error: profileError } = await profileClient
    .from("user_profiles")
    .select("user_id, certifications, job_title, trade_specialty, readiness_status")
    .in("user_id", userIds);

  if (profileError && adminClient) {
    return NextResponse.json(
      { error: profileError.message || "Failed to load user profiles." },
      { status: 500 }
    );
  }

  let warning: string | null = adminClient
    ? null
    : "Showing members from your company workspace. Add SUPABASE_SERVICE_ROLE_KEY to the server environment for full names, emails, and last sign-in from Auth.";

  if (profileError && !adminClient) {
    const suffix =
      " Construction profiles could not be loaded for every row (permissions or configuration).";
    warning = warning ? `${warning}${suffix}` : suffix.trimStart();
  }

  if (schemaWarning) {
    warning = warning ? `${warning} ${schemaWarning}` : schemaWarning;
  }

  const profileMap = new Map<string, ProfileRow>();
  for (const row of (profileData as ProfileRow[] | null) ?? []) {
    profileMap.set(row.user_id, row);
  }

  const rows = directory.users.map((user) => {
    const profile = profileMap.get(user.id);
    const { cells, unmatchedCertifications } = computeTrainingMatrixRow(
      {
        certifications: profile?.certifications ?? [],
        job_title: profile?.job_title ?? null,
        trade_specialty: profile?.trade_specialty ?? null,
      },
      requirementInputs
    );

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      cells,
      unmatchedCertifications,
      profileFields: {
        tradeSpecialty: profile?.trade_specialty?.trim() || "",
        jobTitle: profile?.job_title?.trim() || "",
        readinessStatus: profile?.readiness_status?.trim() || "",
      },
    };
  });

  return NextResponse.json({
    requirements,
    rows,
    warning,
    capabilities: { canMutate: canMutateCompanyTrainingRequirements(auth.role) },
  });
}
