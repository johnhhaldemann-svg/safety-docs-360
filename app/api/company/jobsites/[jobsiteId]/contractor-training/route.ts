import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope, normalizeWorkspaceUuid } from "@/lib/companyScope";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  buildContractorIntakeUrl,
  contractorTrainingStatus,
  generateIntakeToken,
  hashIntakeToken,
  normalizeEmail,
  normalizePhone,
  normalizeTrainingTitle,
  parseExpirationMap,
  parseStringArray,
  sendContractorIntakeEmail,
  sendContractorIntakeSms,
} from "@/lib/contractorTraining";
import {
  filterAllowedPositions,
  filterAllowedTrades,
  isAllowedConstructionPosition,
  isAllowedConstructionTrade,
} from "@/lib/constructionProfileOptions";

export const runtime = "nodejs";

type Params = { jobsiteId: string };

function canManage(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager" || role === "safety_manager";
}

function asString(value: unknown) {
  return String(value ?? "").trim();
}

function asNullableString(value: unknown) {
  const text = asString(value);
  return text || null;
}

function asDateString(value: unknown) {
  const text = asString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function summarizeDelivery(results: Array<{ channel: string; sent?: boolean; warning?: string | null }>) {
  const sentChannels = results.filter((result) => result.sent).map((result) => result.channel);
  const warnings = results
    .filter((result) => !result.sent && result.warning)
    .map((result) => `${result.channel}: ${result.warning}`);
  return {
    sent: sentChannels.length > 0,
    delivery: {
      sentChannels,
      warnings,
    },
    warning: sentChannels.length > 0 ? null : warnings.join(" ") || "Invite link created, but delivery failed.",
  };
}

function isRequirementInScope(
  requirement: { apply_trades?: string[] | null; apply_positions?: string[] | null },
  employee: Record<string, unknown>
) {
  const trades = Array.isArray(requirement.apply_trades) ? requirement.apply_trades : [];
  const positions = Array.isArray(requirement.apply_positions) ? requirement.apply_positions : [];
  const employeeTrade = String(employee.trade_specialty ?? "").trim();
  const employeePosition = String(employee.job_title ?? "").trim();
  const tradeApplies = trades.length === 0 || trades.includes(employeeTrade);
  const positionApplies = positions.length === 0 || positions.includes(employeePosition);
  return tradeApplies && positionApplies;
}

async function resolveScope(request: Request, jobsiteId: string) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_dashboards",
      "can_manage_company_users",
      "can_view_analytics",
    ],
  });
  if ("error" in auth) return { error: auth.error } as const;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return { error: NextResponse.json({ error: "No company workspace linked." }, { status: 400 }) } as const;
  }

  const db = createSupabaseAdminClient() ?? auth.supabase;
  const jobsiteResult = await db
    .from("company_jobsites")
    .select("id, company_id, name, status")
    .eq("id", jobsiteId)
    .maybeSingle();

  if (jobsiteResult.error) {
    return {
      error: NextResponse.json(
        { error: jobsiteResult.error.message || "Failed to load jobsite." },
        { status: 500 }
      ),
    } as const;
  }
  const jobsite = jobsiteResult.data as { id: string; company_id: string; name: string; status: string } | null;
  if (!jobsite || normalizeWorkspaceUuid(jobsite.company_id) !== normalizeWorkspaceUuid(companyScope.companyId)) {
    return { error: NextResponse.json({ error: "Jobsite not found in your company scope." }, { status: 404 }) } as const;
  }

  return { auth, companyScope, db, jobsite } as const;
}

async function loadMatrix(db: any, companyId: string, jobsiteId: string) {
  const [requirementsResult, assignmentsResult, contractorsResult] = await Promise.all([
    db
      .from("jobsite_contractor_training_requirements")
      .select("id, title, sort_order, apply_trades, apply_positions, created_at")
      .eq("company_id", companyId)
      .eq("jobsite_id", jobsiteId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    db
      .from("contractor_employee_jobsite_assignments")
      .select("id, contractor_id, contractor_employee_id, status, archived_at, created_at")
      .eq("company_id", companyId)
      .eq("jobsite_id", jobsiteId)
      .order("created_at", { ascending: false }),
    db
      .from("company_contractors")
      .select("id, name")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("name", { ascending: true }),
  ]);

  for (const result of [requirementsResult, assignmentsResult, contractorsResult]) {
    if (result.error) throw new Error(result.error.message || "Failed to load contractor training data.");
  }

  const requirements = (requirementsResult.data ?? []) as Array<{
    id: string;
    title: string;
    sort_order: number;
    apply_trades?: string[] | null;
    apply_positions?: string[] | null;
  }>;
  const assignments = (assignmentsResult.data ?? []) as Array<{
    id: string;
    contractor_id: string | null;
    contractor_employee_id: string;
    status: string;
    archived_at: string | null;
    created_at: string;
  }>;
  const employeeIds = assignments.map((row) => row.contractor_employee_id);

  const [employeesResult, recordsResult, tokenResult] = employeeIds.length
    ? await Promise.all([
        db
          .from("contractor_employee_profiles")
          .select("id, full_name, email, phone, contractor_company_name, trade_specialty, job_title, readiness_status, years_experience, certifications, certification_expirations")
          .in("id", employeeIds),
        db
          .from("contractor_employee_training_records")
          .select("id, contractor_employee_id, requirement_id, title, completed_on, expires_on, notes")
          .in("contractor_employee_id", employeeIds),
        db
          .from("contractor_employee_intake_tokens")
          .select("assignment_id, expires_at, used_at, revoked_at, created_at")
          .in("assignment_id", assignments.map((row) => row.id))
          .order("created_at", { ascending: false }),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];

  for (const result of [employeesResult, recordsResult, tokenResult]) {
    if (result.error) throw new Error(result.error.message || "Failed to load contractor employee details.");
  }

  const employeeById = new Map(((employeesResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.id), row]));
  const records = (recordsResult.data ?? []) as Array<{
    id: string;
    contractor_employee_id: string;
    requirement_id: string | null;
    title: string;
    completed_on: string | null;
    expires_on: string | null;
    notes: string | null;
  }>;
  const recordsByEmployee = new Map<string, typeof records>();
  for (const record of records) {
    const list = recordsByEmployee.get(record.contractor_employee_id) ?? [];
    list.push(record);
    recordsByEmployee.set(record.contractor_employee_id, list);
  }

  const latestTokenByAssignment = new Map<string, unknown>();
  for (const token of (tokenResult.data ?? []) as Array<{ assignment_id: string }>) {
    if (!latestTokenByAssignment.has(token.assignment_id)) latestTokenByAssignment.set(token.assignment_id, token);
  }

  return {
    requirements: requirements.map((row) => ({
      id: row.id,
      title: row.title,
      sortOrder: row.sort_order,
      applyTrades: Array.isArray(row.apply_trades) ? row.apply_trades : [],
      applyPositions: Array.isArray(row.apply_positions) ? row.apply_positions : [],
    })),
    contractors: ((contractorsResult.data ?? []) as Array<{ id: string; name: string }>).map((row) => ({
      id: row.id,
      name: row.name,
    })),
    assignments: assignments.map((assignment) => {
      const employee = employeeById.get(assignment.contractor_employee_id) ?? {};
      const employeeRecords = recordsByEmployee.get(assignment.contractor_employee_id) ?? [];
      const recordByRequirement = new Map(
        employeeRecords
          .filter((record) => record.requirement_id)
          .map((record) => [record.requirement_id as string, record])
      );
      const cells = Object.fromEntries(
        requirements.map((requirement) => {
          if (!isRequirementInScope(requirement, employee)) return [requirement.id, "na"];
          const record = recordByRequirement.get(requirement.id) ?? null;
          return [requirement.id, contractorTrainingStatus(record)];
        })
      );
      return {
        id: assignment.id,
        contractorId: assignment.contractor_id,
        employeeId: assignment.contractor_employee_id,
        status: assignment.status,
        archivedAt: assignment.archived_at,
        employee: {
          fullName: String(employee.full_name ?? ""),
          email: String(employee.email ?? ""),
          phone: String(employee.phone ?? ""),
          contractorCompanyName: String(employee.contractor_company_name ?? ""),
          tradeSpecialty: String(employee.trade_specialty ?? ""),
          jobTitle: String(employee.job_title ?? ""),
          readinessStatus: String(employee.readiness_status ?? "ready"),
          yearsExperience: employee.years_experience ?? null,
          certifications: Array.isArray(employee.certifications) ? employee.certifications : [],
          certificationExpirations:
            employee.certification_expirations && typeof employee.certification_expirations === "object"
              ? employee.certification_expirations
              : {},
        },
        cells,
        records: employeeRecords,
        latestIntake: latestTokenByAssignment.get(assignment.id) ?? null,
      };
    }),
  };
}

export async function GET(request: Request, { params }: { params: Promise<Params> }) {
  const { jobsiteId } = await params;
  const scoped = await resolveScope(request, jobsiteId);
  if ("error" in scoped) return scoped.error;

  try {
    const payload = await loadMatrix(scoped.db, scoped.companyScope.companyId, scoped.jobsite.id);
    return NextResponse.json({
      jobsite: scoped.jobsite,
      ...payload,
      capabilities: { canManage: canManage(scoped.auth.role) },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load contractor training." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<Params> }) {
  const { jobsiteId } = await params;
  const scoped = await resolveScope(request, jobsiteId);
  if ("error" in scoped) return scoped.error;
  if (!canManage(scoped.auth.role)) {
    return NextResponse.json({ error: "Only company admins, managers, and safety managers can manage contractor training." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = asString(body?.action);
  const companyId = scoped.companyScope.companyId;

  try {
    if (action === "addRequirement") {
      const title = normalizeTrainingTitle(asString(body?.title));
      if (!title) return NextResponse.json({ error: "title is required." }, { status: 400 });
      const applyTrades = filterAllowedTrades(body?.applyTrades);
      const applyPositions = filterAllowedPositions(body?.applyPositions);
      if (applyTrades.length === 0) return NextResponse.json({ error: "Select at least one trade." }, { status: 400 });
      if (applyPositions.length === 0) return NextResponse.json({ error: "Select at least one position." }, { status: 400 });
      const sortOrder = Number.isFinite(Number(body?.sortOrder)) ? Number(body?.sortOrder) : 0;
      const result = await scoped.db.from("jobsite_contractor_training_requirements").insert({
        company_id: companyId,
        jobsite_id: scoped.jobsite.id,
        title,
        sort_order: sortOrder,
        apply_trades: applyTrades,
        apply_positions: applyPositions,
        created_by: scoped.auth.user.id,
        updated_by: scoped.auth.user.id,
      });
      if (result.error) throw new Error(result.error.message);
    } else if (action === "addEmployee") {
      const fullName = asString(body?.fullName);
      const email = asNullableString(body?.email);
      const phone = asNullableString(body?.phone);
      const emailNormalized = normalizeEmail(email);
      const phoneNormalized = normalizePhone(phone);
      if (!fullName) return NextResponse.json({ error: "fullName is required." }, { status: 400 });
      if (!emailNormalized && !phoneNormalized) {
        return NextResponse.json({ error: "Email or phone is required to reuse contractor training history." }, { status: 400 });
      }

      let matchQuery = scoped.db
        .from("contractor_employee_profiles")
        .select("id, certifications, certification_expirations")
        .limit(1);
      if (emailNormalized) {
        matchQuery = matchQuery.eq("email_normalized", emailNormalized);
      } else {
        matchQuery = matchQuery.eq("phone_normalized", phoneNormalized);
      }
      const existing = await matchQuery.maybeSingle();
      if (existing.error) throw new Error(existing.error.message);

      const certifications = parseStringArray(body?.certifications);
      const certificationExpirations = parseExpirationMap(body?.certificationExpirations);
      const profilePayload = {
        full_name: fullName,
        email,
        email_normalized: emailNormalized,
        phone,
        phone_normalized: phoneNormalized,
        contractor_company_name: asNullableString(body?.contractorCompanyName),
        trade_specialty: isAllowedConstructionTrade(asString(body?.tradeSpecialty)) ? asString(body?.tradeSpecialty) : null,
        job_title: isAllowedConstructionPosition(asString(body?.jobTitle)) ? asString(body?.jobTitle) : null,
        readiness_status: asString(body?.readinessStatus) || "ready",
        years_experience: Number.isFinite(Number(body?.yearsExperience)) ? Number(body?.yearsExperience) : null,
        certifications,
        certification_expirations: certificationExpirations,
        updated_by: scoped.auth.user.id,
      };

      const employeeId = existing.data?.id
        ? String(existing.data.id)
        : String(
            (
              await scoped.db
                .from("contractor_employee_profiles")
                .insert({ ...profilePayload, created_by: scoped.auth.user.id })
                .select("id")
                .single()
            ).data?.id
          );
      if (existing.data?.id) {
        const update = await scoped.db
          .from("contractor_employee_profiles")
          .update(profilePayload)
          .eq("id", employeeId);
        if (update.error) throw new Error(update.error.message);
      }

      const assignment = await scoped.db
        .from("contractor_employee_jobsite_assignments")
        .upsert(
          {
            company_id: companyId,
            jobsite_id: scoped.jobsite.id,
            contractor_id: asNullableString(body?.contractorId),
            contractor_employee_id: employeeId,
            status: "active",
            archived_at: null,
            created_by: scoped.auth.user.id,
            updated_by: scoped.auth.user.id,
          },
          { onConflict: "company_id,jobsite_id,contractor_employee_id" }
        );
      if (assignment.error) throw new Error(assignment.error.message);

      for (const cert of certifications) {
        const title = normalizeTrainingTitle(cert);
        if (!title) continue;
        await scoped.db.from("contractor_employee_training_records").insert({
          contractor_employee_id: employeeId,
          title,
          completed_on: null,
          expires_on: certificationExpirations[title] ?? null,
          updated_by: scoped.auth.user.id,
        });
      }
    } else if (action === "updateTraining") {
      const employeeId = asString(body?.employeeId);
      const requirementId = asString(body?.requirementId);
      const title = normalizeTrainingTitle(asString(body?.title));
      if (!employeeId || !title) return NextResponse.json({ error: "employeeId and title are required." }, { status: 400 });
      const recordPayload = {
        contractor_employee_id: employeeId,
        requirement_id: requirementId || null,
        title,
        completed_on: asDateString(body?.completedOn),
        expires_on: asDateString(body?.expiresOn),
        notes: asNullableString(body?.notes),
        updated_by: scoped.auth.user.id,
      };
      const result = requirementId
        ? await scoped.db
            .from("contractor_employee_training_records")
            .upsert(recordPayload, { onConflict: "contractor_employee_id,requirement_id" })
        : await scoped.db.from("contractor_employee_training_records").insert(recordPayload);
      if (result.error) throw new Error(result.error.message);
    } else if (action === "archiveAssignment") {
      const assignmentId = asString(body?.assignmentId);
      if (!assignmentId) return NextResponse.json({ error: "assignmentId is required." }, { status: 400 });
      const result = await scoped.db
        .from("contractor_employee_jobsite_assignments")
        .update({
          status: "archived",
          archived_at: new Date().toISOString(),
          archived_by: scoped.auth.user.id,
          updated_by: scoped.auth.user.id,
        })
        .eq("id", assignmentId)
        .eq("company_id", companyId)
        .eq("jobsite_id", scoped.jobsite.id);
      if (result.error) throw new Error(result.error.message);
    } else if (action === "inviteByPhone") {
      const phone = asNullableString(body?.phone);
      const email = asNullableString(body?.email);
      const phoneNormalized = normalizePhone(phone);
      const emailNormalized = normalizeEmail(email);
      if (!phoneNormalized && !emailNormalized) {
        return NextResponse.json({ error: "Phone number or email is required." }, { status: 400 });
      }

      const existingByEmail = emailNormalized
        ? await scoped.db
            .from("contractor_employee_profiles")
            .select("id")
            .eq("email_normalized", emailNormalized)
            .maybeSingle()
        : { data: null, error: null };
      if (existingByEmail.error) throw new Error(existingByEmail.error.message);
      const existing = existingByEmail.data
        ? existingByEmail
        : phoneNormalized
          ? await scoped.db
              .from("contractor_employee_profiles")
              .select("id")
              .eq("phone_normalized", phoneNormalized)
              .maybeSingle()
          : { data: null, error: null };
      if (existing.error) throw new Error(existing.error.message);

      let employeeId = existing.data?.id ? String(existing.data.id) : "";
      if (!employeeId) {
        const insertProfile = await scoped.db
          .from("contractor_employee_profiles")
          .insert({
            full_name: "Pending Contractor",
            phone,
            email,
            email_normalized: emailNormalized,
            phone_normalized: phoneNormalized,
            readiness_status: "onboarding",
            created_by: scoped.auth.user.id,
            updated_by: scoped.auth.user.id,
          })
          .select("id")
          .single();
        if (insertProfile.error) throw new Error(insertProfile.error.message);
        employeeId = String(insertProfile.data?.id ?? "");
      }
      if (!employeeId || employeeId === "undefined") {
        throw new Error("Failed to create contractor invite profile.");
      }
      if (existing.data?.id) {
        const updateProfile = await scoped.db
          .from("contractor_employee_profiles")
          .update({ phone, email, email_normalized: emailNormalized, phone_normalized: phoneNormalized, updated_by: scoped.auth.user.id })
          .eq("id", employeeId);
        if (updateProfile.error) throw new Error(updateProfile.error.message);
      }

      const assignmentResult = await scoped.db
        .from("contractor_employee_jobsite_assignments")
        .upsert(
          {
            company_id: companyId,
            jobsite_id: scoped.jobsite.id,
            contractor_id: null,
            contractor_employee_id: employeeId,
            status: "active",
            archived_at: null,
            created_by: scoped.auth.user.id,
            updated_by: scoped.auth.user.id,
          },
          { onConflict: "company_id,jobsite_id,contractor_employee_id" }
        )
        .select("id")
        .single();
      if (assignmentResult.error) throw new Error(assignmentResult.error.message);

      const token = generateIntakeToken();
      const intakeUrl = buildContractorIntakeUrl(token);
      if (!intakeUrl) return NextResponse.json({ error: "Set NEXT_PUBLIC_SITE_URL or SITE_URL to create intake links." }, { status: 500 });
      const tokenInsert = await scoped.db.from("contractor_employee_intake_tokens").insert({
        token_hash: hashIntakeToken(token),
        company_id: companyId,
        jobsite_id: scoped.jobsite.id,
        assignment_id: assignmentResult.data.id,
        contractor_employee_id: employeeId,
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
        created_by: scoped.auth.user.id,
      });
      if (tokenInsert.error) throw new Error(tokenInsert.error.message);

      const companyName = scoped.companyScope.companyName ?? "Your company";
      const deliveryResults = [];
      if (phone) {
        const smsResult = await sendContractorIntakeSms({
          toPhone: phone,
          companyName,
          jobsiteName: scoped.jobsite.name,
          intakeUrl,
        });
        deliveryResults.push({ channel: "sms", ...smsResult });
      }
      if (email) {
        const emailResult = await sendContractorIntakeEmail({
          toEmail: email,
          employeeName: "Contractor employee",
          companyName,
          jobsiteName: scoped.jobsite.name,
          intakeUrl,
        });
        deliveryResults.push({ channel: "email", ...emailResult });
      }
      const deliverySummary = summarizeDelivery(deliveryResults);
      const payload = await loadMatrix(scoped.db, companyId, scoped.jobsite.id);
      return NextResponse.json({ success: true, intakeUrl, ...deliverySummary, ...payload });
    } else if (action === "sendIntake") {
      const assignmentId = asString(body?.assignmentId);
      if (!assignmentId) return NextResponse.json({ error: "assignmentId is required." }, { status: 400 });
      const assignmentResult = await scoped.db
        .from("contractor_employee_jobsite_assignments")
        .select("id, contractor_employee_id")
        .eq("id", assignmentId)
        .eq("company_id", companyId)
        .eq("jobsite_id", scoped.jobsite.id)
        .maybeSingle();
      if (assignmentResult.error) throw new Error(assignmentResult.error.message);
      if (!assignmentResult.data) return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
      const employeeResult = await scoped.db
        .from("contractor_employee_profiles")
        .select("id, full_name, email, phone")
        .eq("id", assignmentResult.data.contractor_employee_id)
        .maybeSingle();
      if (employeeResult.error) throw new Error(employeeResult.error.message);
      const employee = employeeResult.data as { id: string; full_name: string; email: string | null; phone: string | null } | null;
      if (!employee?.phone && !employee?.email) {
        return NextResponse.json({ error: "This contractor employee needs a phone number or email before an intake link can be sent." }, { status: 400 });
      }

      const token = generateIntakeToken();
      const intakeUrl = buildContractorIntakeUrl(token);
      if (!intakeUrl) return NextResponse.json({ error: "Set NEXT_PUBLIC_SITE_URL or SITE_URL to create intake links." }, { status: 500 });
      const tokenInsert = await scoped.db.from("contractor_employee_intake_tokens").insert({
        token_hash: hashIntakeToken(token),
        company_id: companyId,
        jobsite_id: scoped.jobsite.id,
        assignment_id: assignmentId,
        contractor_employee_id: employee.id,
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
        created_by: scoped.auth.user.id,
      });
      if (tokenInsert.error) throw new Error(tokenInsert.error.message);
      const companyName = scoped.companyScope.companyName ?? "Your company";
      const deliveryResults = [];
      if (employee.phone) {
        const smsResult = await sendContractorIntakeSms({
          toPhone: employee.phone,
          companyName,
          jobsiteName: scoped.jobsite.name,
          intakeUrl,
        });
        deliveryResults.push({ channel: "sms", ...smsResult });
      }
      if (employee.email) {
        const emailResult = await sendContractorIntakeEmail({
          toEmail: employee.email,
          employeeName: employee.full_name || "Contractor employee",
          companyName,
          jobsiteName: scoped.jobsite.name,
          intakeUrl,
        });
        deliveryResults.push({ channel: "email", ...emailResult });
      }
      return NextResponse.json({ success: true, intakeUrl, ...summarizeDelivery(deliveryResults) });
    } else {
      return NextResponse.json({ error: "Unknown contractor training action." }, { status: 400 });
    }

    const payload = await loadMatrix(scoped.db, companyId, scoped.jobsite.id);
    return NextResponse.json({ success: true, ...payload });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Contractor training action failed." },
      { status: 500 }
    );
  }
}
