import type { SupabaseClient } from "@supabase/supabase-js";
import type { SystemHealthCheck, SystemHealthStatus } from "@/lib/superadmin/systemHealthTypes";

function check(
  name: string,
  status: SystemHealthStatus,
  message: string,
  recommendedFix: string | null,
  lastCheckedAt: string
): SystemHealthCheck {
  return { name, status, message, recommendedFix, lastCheckedAt };
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

async function routeModuleLoads(
  importPath: string,
  label: string
): Promise<{ ok: boolean; message: string }> {
  try {
    await import(importPath);
    return { ok: true, message: `${label} module loads on the server.` };
  } catch (e) {
    return {
      ok: false,
      message: `Cannot load ${label}: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Flat, product-named probes for the Superadmin infrastructure grid.
 * Read-only: HEAD counts, list buckets, optional storage list, Auth Admin listUsers(page 1),
 * and dynamic imports of API route modules (no HTTP self-calls, no inserts).
 */
export async function buildPlatformInfrastructureChecks(
  admin: SupabaseClient,
  lastCheckedAt: string
): Promise<SystemHealthCheck[]> {
  const out: SystemHealthCheck[] = [];

  // 1 Supabase connection
  const companies = await headCount(admin, "companies");
  if (companies.error) {
    out.push(
      check(
        "Supabase connection",
        "critical",
        `Cannot reach the database (companies probe): ${companies.error}`,
        "Verify NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and network access to Supabase.",
        lastCheckedAt
      )
    );
  } else {
    out.push(
      check(
        "Supabase connection",
        "healthy",
        `Database responded. ${companies.count} company row(s) visible to the service role.`,
        null,
        lastCheckedAt
      )
    );
  }

  // 2 Supabase Auth (read-only list)
  try {
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) {
      out.push(
        check(
          "Supabase Auth",
          "critical",
          `Auth Admin API error: ${error.message}`,
          "Confirm the service role key is valid and the Auth service is enabled for this project.",
          lastCheckedAt
        )
      );
    } else {
      out.push(
        check(
          "Supabase Auth",
          "healthy",
          "Auth Admin API responded; user directory is reachable.",
          null,
          lastCheckedAt
        )
      );
    }
  } catch (e) {
    out.push(
      check(
        "Supabase Auth",
        "critical",
        `Auth check failed: ${e instanceof Error ? e.message : String(e)}`,
        "Review Supabase project Auth settings and server SDK version.",
        lastCheckedAt
      )
    );
  }

  // 3 Supabase Storage (list buckets)
  let buckets: { name: string }[] | null = null;
  let storageListError: string | null = null;
  try {
    const { data, error } = await admin.storage.listBuckets();
    if (error) {
      storageListError = error.message;
    } else {
      buckets = data ?? [];
    }
  } catch (e) {
    storageListError = e instanceof Error ? e.message : String(e);
  }

  if (storageListError) {
    out.push(
      check(
        "Supabase storage",
        "critical",
        `Cannot list storage buckets: ${storageListError}`,
        "Enable Storage for the project and ensure the service role can call the Storage API.",
        lastCheckedAt
      )
    );
  } else {
    out.push(
      check(
        "Supabase storage",
        "healthy",
        `Storage API OK. ${buckets?.length ?? 0} bucket(s) returned.`,
        null,
        lastCheckedAt
      )
    );
  }

  // 4 documents bucket
  const hasDocumentsBucket = (buckets ?? []).some((b) => b.name === "documents");
  if (storageListError) {
    out.push(
      check(
        "documents bucket",
        "unknown",
        "Skipped because the bucket list failed.",
        "Fix the Supabase storage check first.",
        lastCheckedAt
      )
    );
  } else if (!hasDocumentsBucket) {
    out.push(
      check(
        "documents bucket",
        "critical",
        'No bucket named "documents" exists in this project.',
        'Create a public or private "documents" bucket and align storage policies with the app.',
        lastCheckedAt
      )
    );
  } else {
    try {
      const { data: files, error: listErr } = await admin.storage.from("documents").list("", {
        limit: 1,
      });
      if (listErr) {
        out.push(
          check(
            "documents bucket",
            "warning",
            `Bucket exists but listing objects failed: ${listErr.message}`,
            "Check bucket policies so the service role can list/read as required by uploads.",
            lastCheckedAt
          )
        );
      } else if (!files || files.length === 0) {
        out.push(
          check(
            "documents bucket",
            "warning",
            'The "documents" bucket exists but appears empty (no objects at root prefix).',
            "This can be normal for a new environment. Upload a test file via the app when ready.",
            lastCheckedAt
          )
        );
      } else {
        out.push(
          check(
            "documents bucket",
            "healthy",
            'Bucket "documents" exists and accepts list operations.',
            null,
            lastCheckedAt
          )
        );
      }
    } catch (e) {
      out.push(
        check(
          "documents bucket",
          "warning",
          `Bucket exists but probe threw: ${e instanceof Error ? e.message : String(e)}`,
          "Verify storage RLS/policies and bucket name spelling.",
          lastCheckedAt
        )
      );
    }
  }

  // 5–9 API route modules
  const routes: { name: string; path: string; label: string; fix: string }[] = [
    {
      name: "dashboard API route",
      path: "@/app/api/dashboard/overview/route",
      label: "Dashboard overview API",
      fix: "Fix TypeScript/build errors under app/api/dashboard/overview/route.ts.",
    },
    {
      name: "document export route",
      path: "@/app/api/documents/submit/route",
      label: "Document submit / export pipeline",
      fix: "Fix imports and types in app/api/documents/submit/route.ts.",
    },
    {
      name: "CSEP export route",
      path: "@/app/api/csep/export/route",
      label: "CSEP export API",
      fix: "Fix build errors in app/api/csep/export/route.ts.",
    },
    {
      name: "PSHSEP export route",
      path: "@/app/api/pshsep/export/route",
      label: "PSHSEP export API",
      fix: "Fix build errors in app/api/pshsep/export/route.ts.",
    },
    {
      name: "AI review route",
      path: "@/app/api/company/safety-intelligence/ai/review/route",
      label: "Safety Intelligence AI review API",
      fix: "Fix build errors in app/api/company/safety-intelligence/ai/review/route.ts.",
    },
  ];

  for (const r of routes) {
    const { ok, message } = await routeModuleLoads(r.path, r.label);
    out.push(
      check(
        r.name,
        ok ? "healthy" : "critical",
        message,
        ok ? null : r.fix,
        lastCheckedAt
      )
    );
  }

  // 10–17 Tables
  const tables: {
    name: string;
    table: string;
    emptyHint: string;
    existsHint: string;
  }[] = [
    {
      name: "observations table",
      table: "company_sor_records",
      emptyHint: "No SOR / observation rows yet—normal for a brand-new tenant.",
      existsHint: "If this table was renamed, update migrations and this health probe.",
    },
    {
      name: "corrective actions table",
      table: "company_corrective_actions",
      emptyHint: "No corrective actions logged yet.",
      existsHint: "Apply corrective-actions migrations if the query fails unexpectedly.",
    },
    {
      name: "incidents table",
      table: "company_incidents",
      emptyHint: "No incidents logged (often expected when no events have been recorded).",
      existsHint: "Verify company_incidents exists and service role can read it.",
    },
    {
      name: "permits table",
      table: "company_permits",
      emptyHint: "No permit rows—workflow may be unused.",
      existsHint: "Verify company_permits migration is applied.",
    },
    {
      name: "JSA table",
      table: "company_jsas",
      emptyHint: "No JSAs—field workflow may be unused.",
      existsHint: "Verify company_jsas migration is applied.",
    },
    {
      name: "training table",
      table: "company_training_requirements",
      emptyHint: "No training requirement rows—matrix may not be configured.",
      existsHint: "Run training-requirements migrations if this table should exist.",
    },
    {
      name: "documents table",
      table: "documents",
      emptyHint: "No document submission rows—submit flow may not have run in this environment.",
      existsHint: "Verify the documents table and RLS/service grants.",
    },
    {
      name: "contractors table",
      table: "company_contractors",
      emptyHint: "No contractor rows—directory may be empty.",
      existsHint: "Verify company_contractors migration is applied.",
    },
    {
      name: "jobsites table",
      table: "company_jobsites",
      emptyHint: "No jobsites—locations may not be provisioned yet.",
      existsHint: "Verify company_jobsites migration is applied.",
    },
  ];

  for (const t of tables) {
    const r = await headCount(admin, t.table);
    if (r.error) {
      const missing = r.error.toLowerCase().includes("does not exist");
      out.push(
        check(
          t.name,
          missing ? "critical" : "unknown",
          `Query failed: ${r.error}`,
          missing ? `Apply migrations so ${t.table} exists.` : t.existsHint,
          lastCheckedAt
        )
      );
    } else if (r.count === 0) {
      out.push(
        check(
          t.name,
          "warning",
          `Table is reachable but has 0 rows.`,
          t.emptyHint,
          lastCheckedAt
        )
      );
    } else {
      out.push(
        check(
          t.name,
          "healthy",
          `${r.count} row(s) counted (head estimate).`,
          null,
          lastCheckedAt
        )
      );
    }
  }

  return out;
}

export function buildPlatformInfrastructureChecksWhenAdminMissing(
  lastCheckedAt: string,
  reason: string
): SystemHealthCheck[] {
  const names = [
    "Supabase connection",
    "Supabase Auth",
    "Supabase storage",
    "documents bucket",
    "dashboard API route",
    "document export route",
    "CSEP export route",
    "PSHSEP export route",
    "AI review route",
    "observations table",
    "corrective actions table",
    "incidents table",
    "permits table",
    "JSA table",
    "training table",
    "documents table",
    "contractors table",
    "jobsites table",
  ];
  return names.map((name) =>
    check(
      name,
      "critical",
      `Not evaluated: ${reason}`,
      "Configure SUPABASE_SERVICE_ROLE_KEY and redeploy, then run the scan again.",
      lastCheckedAt
    )
  );
}
