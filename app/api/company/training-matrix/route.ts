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
import { OFFLINE_DEMO_EMAIL } from "@/lib/offlineDesktopSession";

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

type SalesDemoRequirementRow = TrainingRequirementInput & {
  title: string;
  sort_order: number;
  renewal_months: number | null;
  is_generated: boolean;
  generated_source_type: string | null;
  generated_source_document_id: string | null;
  generated_source_operation_key: string | null;
};

type SalesDemoUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  profile: {
    certifications: string[];
    certification_expirations: Record<string, string>;
    job_title: string;
    trade_specialty: string;
    readiness_status: string;
    years_experience: number;
  };
};

const SALES_DEMO_REQUIREMENTS: SalesDemoRequirementRow[] = [
  {
    id: "demo-req-1",
    title: "OSHA 10 (Foreman, Superintendent, Safety Manager)",
    sort_order: 1,
    match_keywords: ["OSHA 10", "OSHA 10 Construction"],
    match_fields: ["certifications"],
    apply_trades: ["Structural Steel and Erection", "General Construction"],
    apply_positions: ["Foreman", "Superintendent", "Safety Manager"],
    apply_sub_trades: ["Steel Erection and Decking"],
    apply_task_codes: ["hoisting_and_rigging", "work_at_heights"],
    renewal_months: 60,
    is_generated: false,
    generated_source_type: null,
    generated_source_document_id: null,
    generated_source_operation_key: null,
  },
  {
    id: "demo-req-2",
    title: "OSHA 30 (Safety Manager, Project Manager)",
    sort_order: 2,
    match_keywords: ["OSHA 30", "OSHA 30 Construction"],
    match_fields: ["certifications"],
    apply_trades: ["Structural Steel and Erection", "Electrical and Instrumentation"],
    apply_positions: ["Safety Manager", "Project Manager"],
    apply_sub_trades: [],
    apply_task_codes: [],
    renewal_months: 60,
    is_generated: false,
    generated_source_type: null,
    generated_source_document_id: null,
    generated_source_operation_key: null,
  },
  {
    id: "demo-req-3",
    title: "Fall Protection Competent Person (Foreman, Safety Manager)",
    sort_order: 3,
    match_keywords: ["Fall Protection Competent Person", "Fall Protection"],
    match_fields: ["certifications"],
    apply_trades: ["Structural Steel and Erection"],
    apply_positions: ["Foreman", "Safety Manager"],
    apply_sub_trades: ["Steel Erection and Decking"],
    apply_task_codes: ["work_at_heights", "steel_erection"],
    renewal_months: 24,
    is_generated: false,
    generated_source_type: null,
    generated_source_document_id: null,
    generated_source_operation_key: null,
  },
  {
    id: "demo-req-4",
    title: "LOTO Authorized Worker (Foreman, Electrician)",
    sort_order: 4,
    match_keywords: ["LOTO Authorized Worker", "Lockout/Tagout"],
    match_fields: ["certifications"],
    apply_trades: ["Electrical and Instrumentation"],
    apply_positions: ["Foreman", "Electrician"],
    apply_sub_trades: ["Panel and distribution systems"],
    apply_task_codes: ["loto_activities", "energized_work_boundaries"],
    renewal_months: 12,
    is_generated: true,
    generated_source_type: "task_scope",
    generated_source_document_id: "offline-csep-demo",
    generated_source_operation_key: "warehouse-retrofit-electrical",
  },
  {
    id: "demo-req-5",
    title: "First Aid / CPR (All positions)",
    sort_order: 5,
    match_keywords: ["First Aid / CPR", "CPR", "First Aid"],
    match_fields: ["certifications"],
    apply_trades: ["Structural Steel and Erection", "Electrical and Instrumentation", "General Construction"],
    apply_positions: ["Foreman", "Safety Manager", "Superintendent", "Project Manager", "Electrician"],
    apply_sub_trades: [],
    apply_task_codes: [],
    renewal_months: 24,
    is_generated: false,
    generated_source_type: null,
    generated_source_document_id: null,
    generated_source_operation_key: null,
  },
  {
    id: "demo-req-6",
    title: "Rigging & Signal Person (Steel crews)",
    sort_order: 6,
    match_keywords: ["Rigging and Signal Person", "Signal Person", "Qualified Rigger"],
    match_fields: ["certifications"],
    apply_trades: ["Structural Steel and Erection"],
    apply_positions: ["Foreman", "Rigger / Signal", "Apprentice Ironworker"],
    apply_sub_trades: ["Steel Erection and Decking"],
    apply_task_codes: ["hoisting_and_rigging", "critical_lift"],
    renewal_months: 24,
    is_generated: true,
    generated_source_type: "task_scope",
    generated_source_document_id: "offline-csep-demo",
    generated_source_operation_key: "north-tower-crane-picks",
  },
  {
    id: "demo-req-7",
    title: "MEWP / Aerial Lift Operator",
    sort_order: 7,
    match_keywords: ["MEWP Operator", "Aerial Lift Operator", "Scissor Lift"],
    match_fields: ["certifications"],
    apply_trades: ["Structural Steel and Erection", "General Construction"],
    apply_positions: ["Foreman", "Superintendent", "Field Technician"],
    apply_sub_trades: ["Steel Erection and Decking", "Facade and envelope works"],
    apply_task_codes: ["work_at_heights", "aerial_lift_operations"],
    renewal_months: 36,
    is_generated: false,
    generated_source_type: null,
    generated_source_document_id: null,
    generated_source_operation_key: null,
  },
  {
    id: "demo-req-8",
    title: "Excavation Competent Person",
    sort_order: 8,
    match_keywords: ["Excavation Competent Person", "Trenching and Excavation"],
    match_fields: ["certifications"],
    apply_trades: ["General Construction"],
    apply_positions: ["Foreman", "Superintendent", "Site Supervisor"],
    apply_sub_trades: ["Earthworks and trenching"],
    apply_task_codes: ["excavation_trenching", "soil_stability_checks"],
    renewal_months: 24,
    is_generated: false,
    generated_source_type: null,
    generated_source_document_id: null,
    generated_source_operation_key: null,
  },
  {
    id: "demo-req-9",
    title: "Confined Space Entry + Rescue Awareness",
    sort_order: 9,
    match_keywords: ["Confined Space Entry", "Confined Space Rescue Awareness"],
    match_fields: ["certifications"],
    apply_trades: ["Electrical and Instrumentation", "General Construction"],
    apply_positions: ["Electrician", "Foreman", "Safety Manager"],
    apply_sub_trades: ["Panel and distribution systems"],
    apply_task_codes: ["confined_space_entry", "energized_work_boundaries"],
    renewal_months: 12,
    is_generated: true,
    generated_source_type: "task_scope",
    generated_source_document_id: "offline-csep-demo",
    generated_source_operation_key: "warehouse-retrofit-confined-space",
  },
];

const SALES_DEMO_USERS: SalesDemoUser[] = [
  {
    id: "demo-user-1",
    name: "Jordan Lee",
    email: "demo.20260425@safety360docs.local",
    role: "company_admin",
    status: "Active",
    profile: {
      certifications: ["OSHA 10 Construction", "First Aid / CPR", "Fall Protection Competent Person"],
      certification_expirations: {
        "OSHA 10 Construction": "2027-08-12",
        "First Aid / CPR": "2026-11-15",
        "Fall Protection Competent Person": "2026-09-10",
      },
      job_title: "Superintendent",
      trade_specialty: "Structural Steel and Erection",
      readiness_status: "ready",
      years_experience: 12,
    },
  },
  {
    id: "demo-user-2",
    name: "Maria Chen",
    email: "maria.chen@safety360docs.local",
    role: "safety_manager",
    status: "Active",
    profile: {
      certifications: ["OSHA 30 Construction", "First Aid / CPR", "Fall Protection Competent Person"],
      certification_expirations: {
        "OSHA 30 Construction": "2028-02-20",
        "First Aid / CPR": "2026-05-06",
        "Fall Protection Competent Person": "2026-07-01",
      },
      job_title: "Safety Manager",
      trade_specialty: "Structural Steel and Erection",
      readiness_status: "ready",
      years_experience: 9,
    },
  },
  {
    id: "demo-user-3",
    name: "Eli Brooks",
    email: "eli.brooks@safety360docs.local",
    role: "field_supervisor",
    status: "Active",
    profile: {
      certifications: ["OSHA 10 Construction"],
      certification_expirations: {
        "OSHA 10 Construction": "2027-04-10",
      },
      job_title: "Foreman",
      trade_specialty: "Electrical and Instrumentation",
      readiness_status: "limited",
      years_experience: 7,
    },
  },
  {
    id: "demo-user-4",
    name: "Nora Williams",
    email: "nora.williams@safety360docs.local",
    role: "project_manager",
    status: "Active",
    profile: {
      certifications: ["OSHA 30 Construction", "First Aid / CPR"],
      certification_expirations: {
        "OSHA 30 Construction": "2027-11-30",
        "First Aid / CPR": "2025-12-15",
      },
      job_title: "Project Manager",
      trade_specialty: "General Construction",
      readiness_status: "ready",
      years_experience: 14,
    },
  },
  {
    id: "demo-user-5",
    name: "Tyler Ruiz",
    email: "tyler.ruiz@safety360docs.local",
    role: "company_user",
    status: "Active",
    profile: {
      certifications: ["LOTO Authorized Worker", "First Aid / CPR"],
      certification_expirations: {
        "LOTO Authorized Worker": "2026-05-08",
        "First Aid / CPR": "2026-10-02",
      },
      job_title: "Electrician",
      trade_specialty: "Electrical and Instrumentation",
      readiness_status: "travel_ready",
      years_experience: 5,
    },
  },
  {
    id: "demo-user-6",
    name: "Avery Patel",
    email: "avery.patel@safety360docs.local",
    role: "field_user",
    status: "Active",
    profile: {
      certifications: ["OSHA 10 Construction", "CPR", "First Aid / CPR"],
      certification_expirations: {
        "OSHA 10 Construction": "2026-12-01",
        CPR: "2026-08-20",
        "First Aid / CPR": "2026-08-20",
      },
      job_title: "Foreman",
      trade_specialty: "Structural Steel and Erection",
      readiness_status: "ready",
      years_experience: 8,
    },
  },
  {
    id: "demo-user-7",
    name: "Riley Morgan",
    email: "riley.morgan@safety360docs.local",
    role: "field_user",
    status: "Active",
    profile: {
      certifications: ["OSHA 10 Construction"],
      certification_expirations: {
        "OSHA 10 Construction": "2025-01-10",
      },
      job_title: "Apprentice Ironworker",
      trade_specialty: "Structural Steel and Erection",
      readiness_status: "limited",
      years_experience: 1,
    },
  },
  {
    id: "demo-user-8",
    name: "Sam Okonkwo",
    email: "sam.okonkwo@safety360docs.local",
    role: "field_supervisor",
    status: "Active",
    profile: {
      certifications: [
        "OSHA 10 Construction",
        "Fall Protection Competent Person",
        "First Aid / CPR",
      ],
      certification_expirations: {
        "OSHA 10 Construction": "2027-03-15",
        "Fall Protection Competent Person": "2025-12-30",
        "First Aid / CPR": "2024-02-10",
      },
      job_title: "Foreman",
      trade_specialty: "Structural Steel and Erection",
      readiness_status: "ready",
      years_experience: 11,
    },
  },
  {
    id: "demo-user-9",
    name: "Chris Nguyen",
    email: "chris.nguyen@safety360docs.local",
    role: "field_user",
    status: "Active",
    profile: {
      certifications: ["OSHA 10 Construction", "LOTO Authorized Worker", "CPR", "First Aid / CPR"],
      certification_expirations: {
        "OSHA 10 Construction": "2027-10-10",
        "LOTO Authorized Worker": "2026-05-03",
        CPR: "2025-12-01",
        "First Aid / CPR": "2025-12-01",
      },
      job_title: "Foreman",
      trade_specialty: "Electrical and Instrumentation",
      readiness_status: "ready",
      years_experience: 6,
    },
  },
  {
    id: "demo-user-10",
    name: "Dana Kline",
    email: "dana.kline@safety360docs.local",
    role: "safety_manager",
    status: "Active",
    profile: {
      certifications: [
        "OSHA 30 Construction",
        "Fall Protection Competent Person",
        "First Aid / CPR",
      ],
      certification_expirations: {
        "OSHA 30 Construction": "2026-12-20",
        "Fall Protection Competent Person": "2025-10-20",
        "First Aid / CPR": "2026-02-20",
      },
      job_title: "Safety Manager",
      trade_specialty: "General Construction",
      readiness_status: "ready",
      years_experience: 15,
    },
  },
  {
    id: "demo-user-11",
    name: "Jesse Ortega",
    email: "jesse.ortega@safety360docs.local",
    role: "field_user",
    status: "Pending",
    profile: {
      certifications: ["OSHA 10 Construction"],
      certification_expirations: {
        "OSHA 10 Construction": "2028-01-05",
      },
      job_title: "Rigger / Signal",
      trade_specialty: "Structural Steel and Erection",
      readiness_status: "onboarding",
      years_experience: 4,
    },
  },
  {
    id: "demo-user-12",
    name: "Priya Nair",
    email: "priya.nair@safety360docs.local",
    role: "company_user",
    status: "Active",
    profile: {
      certifications: ["OSHA 30 Construction", "LOTO Authorized Worker", "First Aid / CPR"],
      certification_expirations: {
        "OSHA 30 Construction": "2025-10-20",
        "LOTO Authorized Worker": "2026-10-20",
        "First Aid / CPR": "2026-10-20",
      },
      job_title: "Project Manager",
      trade_specialty: "Electrical and Instrumentation",
      readiness_status: "ready",
      years_experience: 13,
    },
  },
  {
    id: "demo-user-13",
    name: "Morgan Hill",
    email: "morgan.hill@safety360docs.local",
    role: "read_only",
    status: "Active",
    profile: {
      certifications: ["First Aid / CPR"],
      certification_expirations: {
        "First Aid / CPR": "2025-10-20",
      },
      job_title: "Field Engineer",
      trade_specialty: "General Construction",
      readiness_status: "limited",
      years_experience: 3,
    },
  },
  {
    id: "demo-user-14",
    name: "Logan Vance",
    email: "logan.vance@safety360docs.local",
    role: "field_user",
    status: "Active",
    profile: {
      certifications: [
        "OSHA 10 Construction",
        "Fall Protection Competent Person",
        "First Aid / CPR",
      ],
      certification_expirations: {
        "OSHA 10 Construction": "2026-10-20",
        "Fall Protection Competent Person": "2024-10-20",
        "First Aid / CPR": "2026-10-20",
      },
      job_title: "Foreman",
      trade_specialty: "Structural Steel and Erection",
      readiness_status: "ready",
      years_experience: 10,
    },
  },
  {
    id: "demo-user-15",
    name: "Tessa Ward",
    email: "tessa.ward@safety360docs.local",
    role: "field_user",
    status: "Active",
    profile: {
      certifications: [
        "OSHA 10 Construction",
        "OSHA 30 Construction",
        "First Aid / CPR",
      ],
      certification_expirations: {
        "OSHA 10 Construction": "2024-10-20",
        "OSHA 30 Construction": "2024-10-20",
        "First Aid / CPR": "2023-10-20",
      },
      job_title: "Superintendent",
      trade_specialty: "General Construction",
      readiness_status: "needs_training",
      years_experience: 18,
    },
  },
  {
    id: "demo-user-16",
    name: "Hayden Fisher",
    email: "hayden.fisher@safety360docs.local",
    role: "field_user",
    status: "Active",
    profile: {
      certifications: ["Rigging and Signal Person", "OSHA 10 Construction", "First Aid / CPR"],
      certification_expirations: {
        "Rigging and Signal Person": "2026-05-04",
        "OSHA 10 Construction": "2027-06-12",
        "First Aid / CPR": "2026-07-05",
      },
      job_title: "Rigger / Signal",
      trade_specialty: "Structural Steel and Erection",
      readiness_status: "ready",
      years_experience: 6,
    },
  },
  {
    id: "demo-user-17",
    name: "Priya Singh",
    email: "priya.singh@safety360docs.local",
    role: "field_supervisor",
    status: "Active",
    profile: {
      certifications: ["MEWP Operator", "OSHA 30 Construction", "Fall Protection Competent Person"],
      certification_expirations: {
        "MEWP Operator": "2026-05-02",
        "OSHA 30 Construction": "2028-01-21",
        "Fall Protection Competent Person": "2026-06-08",
      },
      job_title: "Foreman",
      trade_specialty: "Structural Steel and Erection",
      readiness_status: "travel_ready",
      years_experience: 10,
    },
  },
  {
    id: "demo-user-18",
    name: "Brandon White",
    email: "brandon.white@safety360docs.local",
    role: "field_user",
    status: "Active",
    profile: {
      certifications: ["LOTO Authorized Worker", "Confined Space Entry"],
      certification_expirations: {
        "LOTO Authorized Worker": "2025-11-03",
        "Confined Space Entry": "2025-10-01",
      },
      job_title: "Electrician",
      trade_specialty: "Electrical and Instrumentation",
      readiness_status: "needs_training",
      years_experience: 3,
    },
  },
  {
    id: "demo-user-19",
    name: "Olivia Martinez",
    email: "olivia.martinez@safety360docs.local",
    role: "company_user",
    status: "Active",
    profile: {
      certifications: ["Excavation Competent Person", "First Aid / CPR"],
      certification_expirations: {
        "Excavation Competent Person": "2026-03-14",
        "First Aid / CPR": "2025-09-20",
      },
      job_title: "Site Supervisor",
      trade_specialty: "General Construction",
      readiness_status: "limited",
      years_experience: 8,
    },
  },
  {
    id: "demo-user-20",
    name: "Noah Campbell",
    email: "noah.campbell@safety360docs.local",
    role: "field_user",
    status: "Pending",
    profile: {
      certifications: ["OSHA 10 Construction", "MEWP Operator"],
      certification_expirations: {
        "OSHA 10 Construction": "2026-05-20",
        "MEWP Operator": "2025-05-30",
      },
      job_title: "Field Technician",
      trade_specialty: "General Construction",
      readiness_status: "onboarding",
      years_experience: 2,
    },
  },
  {
    id: "demo-user-21",
    name: "Grace Kim",
    email: "grace.kim@safety360docs.local",
    role: "safety_manager",
    status: "Active",
    profile: {
      certifications: [
        "OSHA 30 Construction",
        "First Aid / CPR",
        "Confined Space Rescue Awareness",
        "Fall Protection Competent Person",
      ],
      certification_expirations: {
        "OSHA 30 Construction": "2027-12-18",
        "First Aid / CPR": "2026-05-12",
        "Confined Space Rescue Awareness": "2026-09-02",
        "Fall Protection Competent Person": "2026-08-01",
      },
      job_title: "Safety Manager",
      trade_specialty: "General Construction",
      readiness_status: "ready",
      years_experience: 13,
    },
  },
];

function buildSalesDemoTrainingMatrixResponse(
  matrixContext: TrainingMatrixContext,
  canMutate: boolean
) {
  const allRequirementRows = SALES_DEMO_REQUIREMENTS;
  const filteredForSubTrades = allRequirementRows.filter((row) =>
    matchesSelectedMatrixFilter(row.apply_trades, matrixContext.selectedTrade)
  );
  const filteredForTaskCodes = filteredForSubTrades.filter((row) =>
    matchesSelectedMatrixFilter(row.apply_sub_trades, matrixContext.selectedSubTrade)
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
    if (!matchesSelectedMatrixFilter(row.apply_trades, matrixContext.selectedTrade)) return false;
    if (!activatesScopedRequirement(row.apply_sub_trades, matrixContext.selectedSubTrade)) return false;
    if (!activatesScopedRequirement(row.apply_task_codes, matrixContext.selectedTaskCode)) return false;
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

  const asOf = new Date();
  const rows = SALES_DEMO_USERS.map((user) => {
    const expMap = parseCertificationExpirations(user.profile.certification_expirations);
    const { cells, cellDetails, unmatchedCertifications } = computeTrainingMatrixRow(
      {
        certifications: user.profile.certifications,
        certificationExpirations: expMap,
        job_title: user.profile.job_title,
        trade_specialty: user.profile.trade_specialty,
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
        user.profile.certifications,
        expMap,
        asOf
      ),
      profileFields: {
        tradeSpecialty: user.profile.trade_specialty,
        jobTitle: user.profile.job_title,
        readinessStatus: user.profile.readiness_status,
        yearsExperience: user.profile.years_experience,
      },
    };
  });

  return NextResponse.json({
    requirements,
    rows,
    warning: null,
    directoryNotice: null,
    schemaMigrationNeeded: false,
    filters: {
      trades: availableTrades,
      subTrades: availableSubTrades,
      taskCodes: availableTaskCodes,
    },
    selectedFilters: matrixContext,
    capabilities: {
      canMutate,
    },
  });
}

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

  const isDemoAccountEmail = (auth.user.email ?? "").trim().toLowerCase() === OFFLINE_DEMO_EMAIL.toLowerCase();
  if (auth.role === "sales_demo" || isDemoAccountEmail) {
    return buildSalesDemoTrainingMatrixResponse(
      matrixContext,
      canMutateCompanyTrainingRequirements(auth.role, auth.permissionMap)
    );
  }

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
