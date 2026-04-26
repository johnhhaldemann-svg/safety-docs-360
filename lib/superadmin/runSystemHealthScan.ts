import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildPlatformInfrastructureChecks,
  buildPlatformInfrastructureChecksWhenAdminMissing,
} from "@/lib/superadmin/platformInfrastructureHealth";
import { getSupabaseServerEnvStatus } from "@/lib/supabaseAdmin";
import type {
  SystemHealthCheck,
  SystemHealthConnection,
  SystemHealthResponse,
  SystemHealthSection,
  SystemHealthStatus,
} from "@/lib/superadmin/systemHealthTypes";

function worstStatus(a: SystemHealthStatus, b: SystemHealthStatus): SystemHealthStatus {
  const rank: Record<SystemHealthStatus, number> = {
    critical: 0,
    warning: 1,
    unknown: 2,
    healthy: 3,
  };
  return rank[a] <= rank[b] ? a : b;
}

function statusFromChecks(checks: SystemHealthCheck[]): SystemHealthStatus {
  return checks.reduce<SystemHealthStatus>((acc, c) => worstStatus(acc, c.status), "healthy");
}

function scoreFromStatus(s: SystemHealthStatus): number {
  if (s === "healthy") return 100;
  if (s === "warning") return 55;
  if (s === "unknown") return 65;
  return 0;
}

function check(
  name: string,
  status: SystemHealthStatus,
  message: string,
  recommendedFix: string | null = null
): SystemHealthCheck {
  return { name, status, message, recommendedFix };
}

async function headCount(
  admin: SupabaseClient,
  table: string,
  filter?: (q: any) => any
): Promise<{ count: number; error: string | null }> {
  try {
    let q: any = admin.from(table).select("id", { count: "exact", head: true });
    if (filter) q = filter(q);
    const { count, error } = await q;
    return { count: count ?? 0, error: error?.message ?? null };
  } catch (e) {
    return { count: 0, error: e instanceof Error ? e.message : "query_failed" };
  }
}

function overallFromSections(sections: SystemHealthSection[]): SystemHealthStatus {
  return sections.reduce<SystemHealthStatus>((acc, s) => worstStatus(acc, s.status), "healthy");
}

/** Check names whose statuses aggregate each connection (handoff health). */
const SYSTEM_HEALTH_EDGE_CHECKS: { from: string; to: string; checkNames: readonly string[] }[] = [
  {
    from: "data_foundation",
    to: "memory_buckets",
    checkNames: [
      "Service role client",
      "Supabase database connection",
      "Supabase storage bucket: documents",
      "Required environment variables",
      "OpenAI API key (AI workflows)",
      "User roles table",
      "User profiles table",
      "Risk memory facets",
      "Company memory bank",
      "Safety data bucket (ingestion)",
      "Company bucket items",
    ],
  },
  {
    from: "memory_buckets",
    to: "prevention_logic",
    checkNames: [
      "Company bucket items",
      "Risk memory facets",
      "Safety data bucket (ingestion)",
      "Prevention logic output (rule_results on bucket items)",
      "Permit trigger rules catalog",
    ],
  },
  {
    from: "prevention_logic",
    to: "intelligence_engine",
    checkNames: [
      "Prevention logic output (rule_results on bucket items)",
      "Permit trigger rules catalog",
      "AI document review output",
      "Company risk scores (rollup)",
    ],
  },
  {
    from: "intelligence_engine",
    to: "protection_outputs",
    checkNames: [
      "AI document review output",
      "Company risk scores (rollup)",
      "Generated SI documents",
      "CSEP builder pipeline (data)",
      "PSHSEP builder pipeline (data)",
      "CSEP export API route (load)",
      "PSHSEP export API route (load)",
    ],
  },
  {
    from: "protection_outputs",
    to: "field_feedback_loop",
    checkNames: [
      "Generated SI documents",
      "Document submission (documents table)",
      "Document download paths",
      "Field submissions (company_safety_submissions)",
      "Ingestion failures (7 days)",
      "Bucket runs (feedback into SI)",
    ],
  },
  {
    from: "field_feedback_loop",
    to: "memory_buckets",
    checkNames: [
      "Ingestion failures (7 days)",
      "System error log (ingestion failures, all time)",
      "Bucket runs (feedback into SI)",
      "Field feedback → Risk Memory snapshots",
      "Risk memory facets",
      "Company memory bank",
      "Company bucket items",
    ],
  },
  {
    from: "field_feedback_loop",
    to: "intelligence_engine",
    checkNames: [
      "Bucket runs (feedback into SI)",
      "Field feedback → Risk Memory snapshots",
      "Admin review queue (pending submissions)",
      "Safety Intelligence audit activity (24h)",
      "AI document review output",
      "Company risk scores (rollup)",
    ],
  },
];

function connectionLabel(st: SystemHealthStatus): string {
  if (st === "critical") return "Broken";
  if (st === "warning") return "Needs review";
  if (st === "unknown") return "Unverified";
  return "Connected";
}

function buildConnections(sections: SystemHealthSection[]): SystemHealthConnection[] {
  const statusByCheckName = new Map<string, SystemHealthStatus>();
  for (const s of sections) {
    for (const c of s.checks) {
      if (!statusByCheckName.has(c.name)) statusByCheckName.set(c.name, c.status);
    }
  }

  function edgeStatusForNames(names: readonly string[]): SystemHealthStatus {
    if (names.length === 0) return "unknown";
    const statuses = names
      .map((n) => statusByCheckName.get(n))
      .filter((x): x is SystemHealthStatus => x !== undefined);
    if (statuses.length === 0) return "unknown";
    return statuses.reduce<SystemHealthStatus>((acc, st) => worstStatus(acc, st), "healthy");
  }

  return SYSTEM_HEALTH_EDGE_CHECKS.map(({ from, to, checkNames }) => {
    const st = edgeStatusForNames(checkNames);
    return { from, to, status: st, label: connectionLabel(st) };
  });
}

/**
 * Runs Smart Safety system health checks using the service-role client (cross-tenant reads).
 * Call only from trusted superadmin API routes.
 */
export async function runSystemHealthScan(admin: SupabaseClient | null): Promise<SystemHealthResponse> {
  const lastCheckedAt = new Date().toISOString();
  const env = getSupabaseServerEnvStatus();

  if (!admin) {
    const msg =
      "Supabase service role client is not configured. Set SUPABASE_SERVICE_ROLE_KEY (or equivalent) on the server.";
    const c = check("Service role client", "critical", msg, "Configure service role key in deployment secrets.");
    const section: SystemHealthSection = {
      id: "data_foundation",
      title: "Data Foundation",
      status: "critical",
      score: 0,
      lastSuccessfulCheck: null,
      recordsChecked: 0,
      failedChecks: 1,
      message: msg,
      recommendedFix: c.recommendedFix,
      checks: [c],
    };
    const skippedSections: SystemHealthSection[] = [
      section,
      ...["memory_buckets", "prevention_logic", "intelligence_engine", "protection_outputs", "field_feedback_loop"].map(
        (id) =>
          ({
            id,
            title: id.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase()),
            status: "unknown" as const,
            score: 65,
            lastSuccessfulCheck: null,
            recordsChecked: 0,
            failedChecks: 0,
            message: "Skipped because the database admin client is unavailable.",
            recommendedFix: "Fix service role configuration, then re-run the scan.",
            checks: [
              check(
                "Scan prerequisites",
                "unknown",
                "Not evaluated without service role.",
                "Configure SUPABASE_SERVICE_ROLE_KEY."
              ),
            ],
          }) satisfies SystemHealthSection
      ),
    ];
    const platformInfrastructure = buildPlatformInfrastructureChecksWhenAdminMissing(
      lastCheckedAt,
      "Supabase admin client is not configured."
    );
    const mergedChecks = [...skippedSections.flatMap((s) => s.checks), ...platformInfrastructure];
    const summary = {
      totalChecks: mergedChecks.length,
      healthy: mergedChecks.filter((c) => c.status === "healthy").length,
      warning: mergedChecks.filter((c) => c.status === "warning").length,
      critical: mergedChecks.filter((c) => c.status === "critical").length,
      unknown: mergedChecks.filter((c) => c.status === "unknown").length,
    };
    const healthScore = Math.round(
      mergedChecks.reduce((acc, c) => acc + scoreFromStatus(c.status), 0) / Math.max(1, mergedChecks.length)
    );
    return {
      overallStatus: "critical",
      healthScore,
      lastCheckedAt,
      summary,
      platformInfrastructure,
      sections: skippedSections,
      connections: buildConnections(skippedSections),
    };
  }

  const checksDataFoundation: SystemHealthCheck[] = [];
  let recordsDataFoundation = 0;

  // 1 Database
  const companies = await headCount(admin, "companies");
  if (companies.error) {
    checksDataFoundation.push(
      check(
        "Supabase database connection",
        "critical",
        `Cannot query companies: ${companies.error}`,
        "Verify Supabase URL, service role key, and network access to the database."
      )
    );
  } else {
    recordsDataFoundation += companies.count;
    checksDataFoundation.push(
      check(
        "Supabase database connection",
        "healthy",
        `Connected. ${companies.count} company row(s) visible to service role.`,
        null
      )
    );
  }

  // 2 Storage bucket documents
  try {
    const { data, error } = await admin.storage.listBuckets();
    if (error) {
      checksDataFoundation.push(
        check(
          "Supabase storage bucket: documents",
          "critical",
          `Cannot list buckets: ${error.message}`,
          "Verify storage is enabled and the service role can access the Storage API."
        )
      );
    } else {
      const found = (data ?? []).some((b) => b.name === "documents");
      if (!found) {
        checksDataFoundation.push(
          check(
            "Supabase storage bucket: documents",
            "critical",
            'No bucket named "documents" was found.',
            'Create a "documents" bucket in Supabase Storage and align policies with the app.'
          )
        );
      } else {
        checksDataFoundation.push(
          check("Supabase storage bucket: documents", "healthy", 'Bucket "documents" exists.', null)
        );
      }
    }
  } catch (e) {
    checksDataFoundation.push(
      check(
        "Supabase storage bucket: documents",
        "warning",
        `Storage check threw: ${e instanceof Error ? e.message : String(e)}`,
        "Confirm @supabase/supabase-js version and Storage API availability."
      )
    );
  }

  // 3 Required env vars (never expose values)
  const missingEnv: string[] = [];
  if (!env.url) missingEnv.push("Supabase URL");
  if (!env.anonKey) missingEnv.push("Anon key");
  if (!env.serviceRoleKey) missingEnv.push("Service role key");
  if (missingEnv.length) {
    checksDataFoundation.push(
      check(
        "Required environment variables",
        "critical",
        `Missing: ${missingEnv.join(", ")}.`,
        "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in the deployment environment."
      )
    );
  } else {
    checksDataFoundation.push(
      check("Required environment variables", "healthy", "Core Supabase URL and keys are present.", null)
    );
  }
  const openAiPresent = Boolean(process.env.OPENAI_API_KEY?.trim());
  checksDataFoundation.push(
    check(
      "OpenAI API key (AI workflows)",
      openAiPresent ? "healthy" : "warning",
      openAiPresent
        ? "OPENAI_API_KEY is set (value not shown)."
        : "OPENAI_API_KEY is not set; Smart Safety LLM and assist features will fail or fall back.",
      openAiPresent ? null : "Set OPENAI_API_KEY for production AI document review and risk intelligence."
    )
  );

  // 4 user_roles
  const roles = await headCount(admin, "user_roles");
  recordsDataFoundation += roles.count;
  checksDataFoundation.push(
    roles.error
      ? check(
          "User roles table",
          "critical",
          `Cannot read user_roles: ${roles.error}`,
          "Apply pending migrations and verify RLS/service role grants on user_roles."
        )
      : check(
          "User roles table",
          roles.count > 0 ? "healthy" : "warning",
          roles.count > 0
            ? `${roles.count} role row(s) indexed.`
            : "user_roles is empty—no users have persisted roles.",
          roles.count > 0 ? null : "Provision at least one user role row for access control to function."
        )
  );

  // 5 user_profiles
  const profiles = await headCount(admin, "user_profiles");
  recordsDataFoundation += profiles.count;
  checksDataFoundation.push(
    profiles.error
      ? check(
          "User profiles table",
          "unknown",
          `user_profiles query: ${profiles.error}`,
          "If the table was renamed, update migrations and this health check."
        )
      : check(
          "User profiles table",
          profiles.count > 0 ? "healthy" : "warning",
          `${profiles.count} profile row(s).`,
          profiles.count > 0 ? null : "Profiles may still work via metadata only—confirm onboarding writes user_profiles."
        )
  );

  const checksMemory: SystemHealthCheck[] = [];
  let recordsMemory = 0;

  const facets = await headCount(admin, "company_risk_memory_facets");
  recordsMemory += facets.count;
  checksMemory.push(
    facets.error
      ? check(
          "Risk memory facets",
          facets.error.toLowerCase().includes("does not exist") ? "unknown" : "critical",
          facets.error,
          "Run Risk Memory migrations (company_risk_memory_facets) if this table should exist."
        )
      : check(
          "Risk memory facets",
          facets.count > 0 ? "healthy" : "warning",
          `${facets.count} facet row(s) in the rolling window tables.`,
          facets.count > 0 ? null : "No facets yet—field signals may not be feeding Risk Memory."
        )
  );

  const memItems = await headCount(admin, "company_memory_items");
  recordsMemory += memItems.count;
  checksMemory.push(
    memItems.error
      ? check("Company memory bank", "unknown", memItems.error, null)
      : check(
          "Company memory bank",
          "healthy",
          `${memItems.count} company memory item(s).`,
          memItems.count === 0 ? "Upload or sync content into the memory bank for RAG-assisted answers." : null
        )
  );

  const sdb = await headCount(admin, "safety_data_bucket");
  recordsMemory += sdb.count;
  checksMemory.push(
    sdb.error
      ? check("Safety data bucket (ingestion)", "unknown", sdb.error, null)
      : check(
          "Safety data bucket (ingestion)",
          sdb.count > 0 ? "healthy" : "warning",
          `${sdb.count} ingested safety bucket row(s).`,
          sdb.count === 0 ? "No Smart Safety intake rows yet—pipelines may be unused." : null
        )
  );

  const bucketItems = await headCount(admin, "company_bucket_items");
  recordsMemory += bucketItems.count;
  checksMemory.push(
    bucketItems.error
      ? check("Company bucket items", "critical", bucketItems.error, "Apply safety_intelligence_platform migration.")
      : check(
          "Company bucket items",
          bucketItems.count > 0 ? "healthy" : "warning",
          `${bucketItems.count} bucket item row(s) for Safety Intelligence.`,
          bucketItems.count === 0 ? "Run a Safety Intelligence workflow to populate bucket items." : null
        )
  );

  const checksPrevention: SystemHealthCheck[] = [];
  let recordsPrevention = 0;
  const itemsWithRules = await headCount(admin, "company_bucket_items", (q) =>
    q.not("rule_results", "is", null)
  );
  recordsPrevention += itemsWithRules.count;
  checksPrevention.push(
    itemsWithRules.error
      ? check("Prevention logic output (rule_results on bucket items)", "unknown", itemsWithRules.error, null)
      : check(
          "Prevention logic output (rule_results on bucket items)",
          itemsWithRules.count > 0 ? "healthy" : "warning",
          `${itemsWithRules.count} bucket item(s) carry persisted rule evaluations.`,
          itemsWithRules.count === 0
            ? "Generate documents or bucket runs so rule_results populate for prevention logic."
            : null
        )
  );

  const permitRules = await headCount(admin, "company_permit_trigger_rules");
  recordsPrevention += permitRules.count;
  checksPrevention.push(
    permitRules.error
      ? check("Permit trigger rules catalog", "unknown", permitRules.error, null)
      : check(
          "Permit trigger rules catalog",
          "healthy",
          `${permitRules.count} company-scoped permit trigger rule row(s).`,
          null
        )
  );

  const checksEngine: SystemHealthCheck[] = [];
  let recordsEngine = 0;
  const aiReviews = await headCount(admin, "company_ai_reviews");
  recordsEngine += aiReviews.count;
  checksEngine.push(
    aiReviews.error
      ? check("AI document review output", "critical", aiReviews.error, "Verify company_ai_reviews exists.")
      : check(
          "AI document review output",
          aiReviews.count > 0 ? "healthy" : "warning",
          `${aiReviews.count} persisted AI review row(s) (document + risk outputs).`,
          aiReviews.count === 0 ? "Run combined document + risk review from Safety Intelligence." : null
        )
  );

  const riskScores = await headCount(admin, "company_risk_scores");
  recordsEngine += riskScores.count;
  checksEngine.push(
    riskScores.error
      ? check("Company risk scores (rollup)", "unknown", riskScores.error, null)
      : check(
          "Company risk scores (rollup)",
          "healthy",
          `${riskScores.count} persisted risk score row(s).`,
          riskScores.count === 0 ? "Cron or inline rollup may not have run yet." : null
        )
  );

  const checksOutputs: SystemHealthCheck[] = [];
  let recordsOutputs = 0;
  const genDocs = await headCount(admin, "company_generated_documents");
  recordsOutputs += genDocs.count;
  checksOutputs.push(
    genDocs.error
      ? check("Generated SI documents", "critical", genDocs.error, null)
      : check(
          "Generated SI documents",
          genDocs.count > 0 ? "healthy" : "warning",
          `${genDocs.count} generated document row(s).`,
          genDocs.count === 0 ? "Generate a JSA/CSEP draft from Safety Intelligence." : null
        )
  );

  const csepGen = await headCount(admin, "company_generated_documents", (q) => q.eq("document_type", "csep"));
  recordsOutputs += csepGen.count;
  checksOutputs.push(
    csepGen.error
      ? check("CSEP builder pipeline (data)", "unknown", csepGen.error, null)
      : check(
          "CSEP builder pipeline (data)",
          csepGen.count > 0 ? "healthy" : "warning",
          `${csepGen.count} CSEP generated document row(s).`,
          csepGen.count === 0 ? "No CSEP outputs in SI tables yet." : null
        )
  );
  try {
    await import("@/app/api/csep/export/route");
    checksOutputs.push(check("CSEP export API route (load)", "healthy", "CSEP export route module resolves on server.", null));
  } catch (e) {
    checksOutputs.push(
      check(
        "CSEP export API route (load)",
        "critical",
        `Cannot load CSEP export route: ${e instanceof Error ? e.message : String(e)}`,
        "Fix build errors or path aliases for app/api/csep/export/route."
      )
    );
  }

  const pshGen = await headCount(admin, "company_generated_documents", (q) => q.eq("document_type", "pshsep"));
  recordsOutputs += pshGen.count;
  checksOutputs.push(
    pshGen.error
      ? check("PSHSEP builder pipeline (data)", "unknown", pshGen.error, null)
      : check(
          "PSHSEP builder pipeline (data)",
          pshGen.count > 0 ? "healthy" : "warning",
          `${pshGen.count} PSHSEP generated document row(s).`,
          pshGen.count === 0 ? "No PSHSEP outputs in SI tables yet." : null
        )
  );
  try {
    await import("@/app/api/pshsep/export/route");
    checksOutputs.push(check("PSHSEP export API route (load)", "healthy", "PSHSEP export route module resolves on server.", null));
  } catch (e) {
    checksOutputs.push(
      check(
        "PSHSEP export API route (load)",
        "critical",
        `Cannot load PSHSEP export route: ${e instanceof Error ? e.message : String(e)}`,
        "Fix build errors or path aliases for app/api/pshsep/export/route."
      )
    );
  }

  const docs = await headCount(admin, "documents");
  recordsOutputs += docs.count;
  checksOutputs.push(
    docs.error
      ? check("Document submission (documents table)", "unknown", docs.error, null)
      : check(
          "Document submission (documents table)",
          docs.count > 0 ? "healthy" : "warning",
          `${docs.count} document submission row(s).`,
          docs.count === 0 ? "No rows in documents—submit flow may be unused in this environment." : null
        )
  );

  const draftPaths = await headCount(admin, "documents", (q) => q.not("draft_file_path", "is", null));
  const finalPaths = await headCount(admin, "documents", (q) => q.not("final_file_path", "is", null));
  const pathCount = Math.max(draftPaths.count, finalPaths.count);
  const pathErr = draftPaths.error ?? finalPaths.error;
  checksOutputs.push(
    pathErr
      ? check("Document download paths", "unknown", pathErr, null)
      : check(
          "Document download paths",
          pathCount > 0 ? "healthy" : "warning",
          `${draftPaths.count} with draft path, ${finalPaths.count} with final path.`,
          pathCount === 0 ? "No file paths recorded—verify submit → storage upload path." : null
        )
  );

  const submissions = await headCount(admin, "company_safety_submissions");
  recordsOutputs += submissions.count;
  checksOutputs.push(
    submissions.error
      ? check("Field submissions (company_safety_submissions)", "unknown", submissions.error, null)
      : check(
          "Field submissions (company_safety_submissions)",
          "healthy",
          `${submissions.count} submission row(s).`,
          null
        )
  );

  const checksFeedback: SystemHealthCheck[] = [];
  let recordsFeedback = 0;

  const ingestFail = await headCount(admin, "ingestion_audit_log", (q) =>
    q.eq("insert_status", "failed").gte("received_at", new Date(Date.now() - 7 * 86400000).toISOString())
  );
  recordsFeedback += ingestFail.count;
  checksFeedback.push(
    ingestFail.error
      ? check("Ingestion failures (7 days)", "unknown", ingestFail.error, null)
      : check(
          "Ingestion failures (7 days)",
          ingestFail.count > 5 ? "warning" : "healthy",
          `${ingestFail.count} failed ingestion attempt(s) in the last 7 days.`,
          ingestFail.count > 5 ? "Review ingestion_audit_log.insert_error for recurring validation or DB issues." : null
        )
  );

  const ingestFailAll = await headCount(admin, "ingestion_audit_log", (q) => q.eq("insert_status", "failed"));
  checksFeedback.push(
    ingestFailAll.error
      ? check("System error log (ingestion failures, all time)", "unknown", ingestFailAll.error, null)
      : check(
          "System error log (ingestion failures, all time)",
          ingestFailAll.count > 25 ? "warning" : "healthy",
          `${ingestFailAll.count} failed ingestion row(s) on record.`,
          ingestFailAll.count > 25 ? "Investigate recurring ingestion failures; they block the feedback loop." : null
        )
  );

  const bucketRuns = await headCount(admin, "company_bucket_runs");
  recordsFeedback += bucketRuns.count;
  checksFeedback.push(
    bucketRuns.error
      ? check("Bucket runs (feedback into SI)", "critical", bucketRuns.error, null)
      : check(
          "Bucket runs (feedback into SI)",
          bucketRuns.count > 0 ? "healthy" : "warning",
          `${bucketRuns.count} bucket run(s) recorded.`,
          bucketRuns.count === 0 ? "No bucket runs—Safety Intelligence may not have been exercised." : null
        )
  );

  const riskSnaps = await headCount(admin, "company_risk_memory_snapshots");
  recordsFeedback += riskSnaps.count;
  checksFeedback.push(
    riskSnaps.error
      ? check("Field feedback → Risk Memory snapshots", "unknown", riskSnaps.error, null)
      : check(
          "Field feedback → Risk Memory snapshots",
          riskSnaps.count > 0 ? "healthy" : "warning",
          `${riskSnaps.count} rollup snapshot row(s) stored.`,
          riskSnaps.count === 0 ? "Cron rollup may not have run, or facets table is empty." : null
        )
  );

  const pendingReview = await headCount(admin, "company_safety_submissions", (q) => q.eq("review_status", "pending"));
  recordsFeedback += pendingReview.count;
  checksFeedback.push(
    pendingReview.error
      ? check("Admin review queue (pending submissions)", "unknown", pendingReview.error, null)
      : check(
          "Admin review queue (pending submissions)",
          pendingReview.count > 50 ? "warning" : "healthy",
          `${pendingReview.count} submission(s) awaiting review.`,
          pendingReview.count > 50 ? "Clear or triage the review queue to reduce backlog risk." : null
        )
  );

  const siAudit = await headCount(admin, "company_safety_intelligence_audit_log", (q) =>
    q.gte("occurred_at", new Date(Date.now() - 24 * 3600000).toISOString())
  );
  recordsFeedback += siAudit.count;
  checksFeedback.push(
    siAudit.error
      ? check("Safety Intelligence audit activity (24h)", "unknown", siAudit.error, null)
      : check(
          "Safety Intelligence audit activity (24h)",
          "healthy",
          `${siAudit.count} SI audit event(s) in the last 24 hours.`,
          siAudit.count === 0 ? "No recent SI mutations logged—expected on idle staging." : null
        )
  );

  // --- Workflow table checks (mapped to closest layer) ---
  const jsa = await headCount(admin, "company_jsas");
  checksMemory.push(
    jsa.error
      ? check("JSA workflow (company_jsas)", "unknown", jsa.error, null)
      : check(
          "JSA workflow (company_jsas)",
          jsa.count > 0 ? "healthy" : "warning",
          `${jsa.count} JSA record(s).`,
          jsa.count === 0 ? "No JSAs yet—workflow may be unused." : null
        )
  );
  recordsMemory += jsa.count;

  const permits = await headCount(admin, "company_permits");
  checksMemory.push(
    permits.error
      ? check("Permit workflow (company_permits)", "unknown", permits.error, null)
      : check(
          "Permit workflow (company_permits)",
          permits.count > 0 ? "healthy" : "warning",
          `${permits.count} permit record(s).`,
          permits.count === 0 ? "No permits logged." : null
        )
  );
  recordsMemory += permits.count;

  const trainingReq = await headCount(admin, "company_training_matrix_requirements");
  checksMemory.push(
    trainingReq.error
      ? check("Training matrix requirements", "unknown", trainingReq.error, null)
      : check(
          "Training matrix requirements",
          trainingReq.count > 0 ? "healthy" : "warning",
          `${trainingReq.count} training matrix requirement row(s).`,
          trainingReq.count === 0 ? "Populate the training matrix for training-gap detection." : null
        )
  );
  recordsMemory += trainingReq.count;

  const sor = await headCount(admin, "company_sor_records");
  checksMemory.push(
    sor.error
      ? check("SOR / observation records", "unknown", sor.error, null)
      : check(
          "SOR / observation records",
          sor.count > 0 ? "healthy" : "warning",
          `${sor.count} SOR record(s).`,
          sor.count === 0 ? "No SORs—observation loop may be idle." : null
        )
  );
  recordsMemory += sor.count;

  const incidents = await headCount(admin, "company_incidents");
  checksMemory.push(
    incidents.error
      ? check("Incident / near-miss records", "unknown", incidents.error, null)
      : check(
          "Incident / near-miss records",
          incidents.count > 0 ? "healthy" : "warning",
          `${incidents.count} incident row(s).`,
          incidents.count === 0 ? "No incidents logged (may be normal for new tenants)." : null
        )
  );
  recordsMemory += incidents.count;

  const capa = await headCount(admin, "company_corrective_actions");
  checksMemory.push(
    capa.error
      ? check("Corrective action records", "unknown", capa.error, null)
      : check(
          "Corrective action records",
          capa.count > 0 ? "healthy" : "warning",
          `${capa.count} corrective action row(s).`,
          capa.count === 0 ? "No corrective actions yet." : null
        )
  );
  recordsMemory += capa.count;

  const buildSection = (
    id: string,
    title: string,
    checks: SystemHealthCheck[],
    recordsChecked: number
  ): SystemHealthSection => {
    const st = statusFromChecks(checks);
    const failed = checks.filter((c) => c.status === "critical" || c.status === "warning").length;
    const worstFix =
      checks.find((c) => c.status === "critical")?.recommendedFix ??
      checks.find((c) => c.status === "warning")?.recommendedFix ??
      null;
    const summaryMsg =
      checks.find((c) => c.status === "critical")?.message ??
      checks.find((c) => c.status === "warning")?.message ??
      "All checks in this area passed.";
    return {
      id,
      title,
      status: st,
      score: Math.round(checks.reduce((s, c) => s + scoreFromStatus(c.status), 0) / Math.max(1, checks.length)),
      lastSuccessfulCheck: st === "critical" ? null : lastCheckedAt,
      recordsChecked,
      failedChecks: failed,
      message: summaryMsg,
      recommendedFix: worstFix,
      checks,
    };
  };

  const sections: SystemHealthSection[] = [
    buildSection("data_foundation", "Data Foundation", checksDataFoundation, recordsDataFoundation),
    buildSection("memory_buckets", "Safety Memory Buckets", checksMemory, recordsMemory),
    buildSection("prevention_logic", "Prevention Logic Layer", checksPrevention, recordsPrevention),
    buildSection("intelligence_engine", "Smart Safety Intelligence Engine", checksEngine, recordsEngine),
    buildSection("protection_outputs", "Protection Outputs", checksOutputs, recordsOutputs),
    buildSection("field_feedback_loop", "Field Feedback Loop", checksFeedback, recordsFeedback),
  ];

  const platformInfrastructure = await buildPlatformInfrastructureChecks(admin, lastCheckedAt);
  const sectionChecks = sections.flatMap((s) => s.checks);
  const allChecks = [...sectionChecks, ...platformInfrastructure];
  const summary = {
    totalChecks: allChecks.length,
    healthy: allChecks.filter((c) => c.status === "healthy").length,
    warning: allChecks.filter((c) => c.status === "warning").length,
    critical: allChecks.filter((c) => c.status === "critical").length,
    unknown: allChecks.filter((c) => c.status === "unknown").length,
  };

  const healthScore = Math.round(
    allChecks.reduce((acc, c) => acc + scoreFromStatus(c.status), 0) / Math.max(1, allChecks.length)
  );

  const platformOverall = statusFromChecks(platformInfrastructure);
  const overallStatus = worstStatus(overallFromSections(sections), platformOverall);

  return {
    overallStatus,
    healthScore,
    lastCheckedAt,
    summary,
    platformInfrastructure,
    sections,
    connections: buildConnections(sections),
  };
}
