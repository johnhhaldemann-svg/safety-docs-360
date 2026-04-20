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
import { fetchCompanyTrainingRequirements } from "@/lib/companyTrainingRequirementsDb";
import {
  buildProfileCertificationInventory,
  parseCertificationExpirations,
} from "@/lib/certificationExpirations";
import {
  activatesScopedRequirement,
  computeTrainingMatrixRow,
  DEFAULT_MATCH_FIELDS,
  matchesSelectedMatrixFilter,
  type TrainingMatrixContext,
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

function humanizeTaskCode(code: string) {
  const acronyms: Record<string, string> = {
    osha: "OSHA",
    nfpa: "NFPA",
    ppe: "PPE",
    loto: "LOTO",
    jsa: "JSA",
    hazcom: "HazCom",
  };

  return code
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .map((part) => {
      const normalized = part.toLowerCase();
      if (acronyms[normalized]) return acronyms[normalized];
      if (/^\d+[a-z]*$/i.test(part)) return part.toUpperCase();
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join(" ");
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}

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

  if (!canViewCompanyTrainingMatrix(auth.role, auth.permissionMap)) {
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
      filters: { trades: [], subTrades: [], taskCodes: [] },
      capabilities: {
        canMutate: canMutateCompanyTrainingRequirements(auth.role, auth.permissionMap),
      },
    });
  }

  const url = new URL(request.url);
  const selectedTrade = (url.searchParams.get("trade") ?? "").trim() || null;
  const selectedSubTrade = (url.searchParams.get("subTrade") ?? "").trim() || null;
  const selectedTaskCode = (url.searchParams.get("taskCode") ?? "").trim() || null;
  const matrixContext: TrainingMatrixContext = {
    selectedTrade,
    selectedSubTrade,
    selectedTaskCode,
  };

  const adminClient = createSupabaseAdminClient();

  const reqFetch = await fetchCompanyTrainingRequirements(auth.supabase, companyScope.companyId, false);

  if (reqFetch.error) {
    return NextResponse.json(
      { error: reqFetch.error || "Failed to load training requirements." },
      { status: 500 }
    );
  }

  const allRequirementRows = reqFetch.rows;
  const filteredForSubTrades = allRequirementRows.filter((row) =>
    matchesSelectedMatrixFilter(row.apply_trades, selectedTrade)
  );
  const filteredForTaskCodes = filteredForSubTrades.filter((row) =>
    matchesSelectedMatrixFilter(row.apply_sub_trades, selectedSubTrade)
  );

  const availableTrades = uniqueSorted(
    allRequirementRows.flatMap((row) => row.apply_trades ?? [])
  );
  const availableSubTrades = uniqueSorted(
    filteredForSubTrades.flatMap((row) => row.apply_sub_trades ?? [])
  );
  const availableTaskCodes = uniqueSorted(
    filteredForTaskCodes.flatMap((row) => row.apply_task_codes ?? [])
  ).map((value) => ({ value, label: humanizeTaskCode(value) }));

  const visibleRequirementRows = allRequirementRows.filter((row) => {
    if (!matchesSelectedMatrixFilter(row.apply_trades, selectedTrade)) return false;
    if (!activatesScopedRequirement(row.apply_sub_trades, selectedSubTrade)) return false;
    if (!activatesScopedRequirement(row.apply_task_codes, selectedTaskCode)) return false;
    return true;
  });

  const requirements = visibleRequirementRows.map((row) => ({
    id: row.id,
    title: row.title,
    sortOrder: row.sort_order,
    matchKeywords: row.match_keywords ?? [],
    matchFields: row.match_fields?.length ? row.match_fields : [...DEFAULT_MATCH_FIELDS],
    applyTrades: row.apply_trades ?? [],
    applyPositions: row.apply_positions ?? [],
    applySubTrades: row.apply_sub_trades ?? [],
    applyTaskCodes: row.apply_task_codes ?? [],
    renewalMonths: row.renewal_months ?? null,
    isGenerated: Boolean(row.is_generated),
    generatedSourceType: row.generated_source_type ?? null,
    generatedSourceDocumentId: row.generated_source_document_id ?? null,
    generatedSourceOperationKey: row.generated_source_operation_key ?? null,
  }));

  const requirementInputs: TrainingRequirementInput[] = visibleRequirementRows.map((row) => ({
    id: row.id,
    match_keywords: row.match_keywords ?? [],
    match_fields: row.match_fields?.length ? row.match_fields : [...DEFAULT_MATCH_FIELDS],
    apply_trades: row.apply_trades ?? [],
    apply_positions: row.apply_positions ?? [],
    apply_sub_trades: row.apply_sub_trades ?? [],
    apply_task_codes: row.apply_task_codes ?? [],
  }));

  const schemaMigrationNeeded =
    !reqFetch.applyColumnsAvailable ||
    !reqFetch.taskScopeColumnsAvailable ||
    !reqFetch.generatedColumnsAvailable;

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
        : "Names, emails, and last sign-in use limited Auth data until you add SUPABASE_SERVICE_ROLE_KEY to the server environment (for example in Vercel Settings > Environment Variables). Never expose it to the browser.",
      schemaMigrationNeeded,
      filters: {
        trades: availableTrades,
        subTrades: availableSubTrades,
        taskCodes: availableTaskCodes,
      },
      selectedFilters: matrixContext,
      capabilities: {
        canMutate: canMutateCompanyTrainingRequirements(auth.role, auth.permissionMap),
      },
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
    : "Names, emails, and last sign-in use limited Auth data until you add SUPABASE_SERVICE_ROLE_KEY to the server environment (for example in Vercel Settings > Environment Variables). Never expose it to the browser.";

  const warning: string | null =
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
      asOf,
      matrixContext
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
    filters: {
      trades: availableTrades,
      subTrades: availableSubTrades,
      taskCodes: availableTaskCodes,
    },
    selectedFilters: matrixContext,
    capabilities: {
      canMutate: canMutateCompanyTrainingRequirements(auth.role, auth.permissionMap),
    },
  });
}
