import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { createCompanyNotification } from "@/lib/companyNotifications";
import { requestAiResponsesText } from "@/lib/ai/responses";
import { resolveCompanyAiDefaultModel } from "@/lib/ai/defaultModel";
import {
  buildSystemPrompt,
  buildChatMessages,
  buildStepPrompt,
  nextStep,
  parseRcaAiResponse,
  buildFindingsExtractionPrompt,
  parseRcaFindings,
  type RcaMethod,
  type RcaStepKey,
  type RcaMessage,
} from "@/lib/rcaAi";

const HSE_ROLES = ["company_admin", "safety_manager", "manager"];

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

// POST /api/company/corrective-actions/[id]/rca/chat
// Accepts a user message, persists it, calls AI, persists AI reply, returns reply
export async function POST(request: Request, { params }: RouteParams) {
  const { id: actionId } = await params;
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_field_work", "can_view_dashboards"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "Not linked to a company workspace." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    message?: string;
    advanceStep?: boolean;
  } | null;

  const userMessage = clean(body?.message);
  if (!userMessage) {
    return NextResponse.json({ error: "Message content is required." }, { status: 400 });
  }
  if (userMessage.length > 4000) {
    return NextResponse.json({ error: "Message is too long (max 4000 characters)." }, { status: 400 });
  }

  // Load the corrective action
  const actionResult = await auth.supabase
    .from("company_corrective_actions")
    .select("id, title, description, category, severity, rca_session_id")
    .eq("id", actionId)
    .eq("company_id", companyScope.companyId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (actionResult.error || !actionResult.data) {
    return NextResponse.json({ error: "Corrective action not found." }, { status: 404 });
  }

  const action = actionResult.data as {
    id: string;
    title: string;
    description: string | null;
    category: string;
    severity: string;
    rca_session_id: string | null;
  };

  if (!action.rca_session_id) {
    return NextResponse.json({ error: "No RCA session exists. Start one first." }, { status: 404 });
  }

  // Load the session
  const sessionResult = await auth.supabase
    .from("ca_rca_sessions")
    .select("id, rca_method, status, current_step")
    .eq("id", action.rca_session_id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (sessionResult.error || !sessionResult.data) {
    return NextResponse.json({ error: "RCA session not found." }, { status: 404 });
  }

  const session = sessionResult.data as {
    id: string;
    rca_method: RcaMethod;
    status: string;
    current_step: RcaStepKey;
  };

  if (session.status === "approved" || session.status === "closed") {
    return NextResponse.json(
      { error: "This RCA session is already closed." },
      { status: 409 }
    );
  }

  // Load conversation history (exclude system messages)
  const historyResult = await auth.supabase
    .from("ca_rca_messages")
    .select("role, content, step_key")
    .eq("session_id", session.id)
    .eq("company_id", companyScope.companyId)
    .neq("role", "system")
    .order("created_at", { ascending: true })
    .limit(80);

  const history = ((historyResult.data ?? []) as RcaMessage[]);

  // Persist the user message
  await auth.supabase.from("ca_rca_messages").insert({
    session_id: session.id,
    company_id: companyScope.companyId,
    role: "user",
    content: userMessage,
    step_key: session.current_step,
  });

  // Build AI request
  const systemPrompt = buildSystemPrompt({
    caTitle: action.title,
    caDescription: action.description,
    caCategory: action.category,
    caSeverity: action.severity,
    method: session.rca_method,
  });

  const shouldAdvance = Boolean(body?.advanceStep);
  let stepContext = "";
  if (shouldAdvance) {
    const next = nextStep(session.current_step, session.rca_method);
    if (next) {
      stepContext = `\n\n[INSTRUCTION: The user has indicated they are ready to move to the next step: ${next.replace(/_/g, " ")}. After acknowledging their answer, transition naturally into: ${buildStepPrompt(next, session.rca_method)}]`;
    }
  }

  const messages = buildChatMessages(
    [...history, { role: "user", content: userMessage + stepContext }],
    systemPrompt
  );

  const model =
    process.env.RCA_AI_MODEL?.trim() ||
    process.env.COMPANY_AI_MODEL?.trim() ||
    resolveCompanyAiDefaultModel("gpt-4o-mini");

  const aiResponse = await requestAiResponsesText({
    model,
    input: messages.map((m) => ({ role: m.role, content: m.content })).slice(-40),
    surface: "corrective-actions.rca-chat",
    maxAttempts: 2,
  });

  const rawAiText =
    aiResponse.text?.trim() ||
    '{"message":"I was unable to generate a response. Please try again or continue with your next answer.","suggestions":[]}';

  // Parse structured response { message, suggestions[] }
  const parsed = parseRcaAiResponse(rawAiText);
  const assistantContent = parsed.message;
  const suggestions = parsed.suggestions;

  // Determine whether the step should advance
  let newStep = session.current_step;
  if (shouldAdvance) {
    const next = nextStep(session.current_step, session.rca_method);
    if (next) newStep = next;
  }

  // Persist the assistant reply (store only the human-readable message, not JSON)
  await auth.supabase.from("ca_rca_messages").insert({
    session_id: session.id,
    company_id: companyScope.companyId,
    role: "assistant",
    content: assistantContent,
    step_key: newStep,
  });

  // Update session step if advanced
  const stepAdvanced = newStep !== session.current_step;
  const sessionUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (stepAdvanced) {
    sessionUpdate.current_step = newStep;
    if (newStep === "review") {
      sessionUpdate.status = "pending_review";
    }
  }
  await auth.supabase
    .from("ca_rca_sessions")
    .update(sessionUpdate)
    .eq("id", session.id);

  // When the investigation reaches the review step, extract structured findings
  // and notify HSE team that sign-off is needed — both run in parallel.
  if (stepAdvanced && newStep === "review") {
    // Build transcript of user responses for the AI extractor
    const userResponses = [...history, { role: "user" as const, content: userMessage, step_key: session.current_step }]
      .filter((m) => m.role === "user")
      .map((m) => `[${((m.step_key as string | null) ?? "").replace(/_/g, " ")}] ${m.content}`)
      .join("\n");

    const extractionPrompt = buildFindingsExtractionPrompt(userResponses);

    // Run findings extraction + HSE notifications in parallel — don't block the response
    void Promise.all([
      // 1. Extract and persist findings
      requestAiResponsesText({
        model,
        input: extractionPrompt,
        surface: "corrective-actions.rca-findings-extract",
        maxAttempts: 2,
      }).then(async (res) => {
        const findings = parseRcaFindings(res.text ?? "");
        if (findings.length === 0) return;
        await auth.supabase.from("ca_rca_findings").insert(
          findings.map((f) => ({
            session_id: session.id,
            company_id: companyScope.companyId,
            finding_type: f.finding_type,
            category: f.category,
            description: f.description,
            why_level: f.why_level,
            sort_order: f.sort_order,
          }))
        );
      }).catch(() => { /* non-fatal */ }),

      // 2. Notify HSE team that sign-off is ready
      auth.supabase
        .from("company_users")
        .select("user_id, role")
        .eq("company_id", companyScope.companyId)
        .eq("status", "active")
        .in("role", HSE_ROLES)
        .then(async ({ data: hseMembers }) => {
          if (!hseMembers) return;
          const rows = hseMembers as Array<{ user_id: string; role: string }>;
          for (const row of rows) {
            if (row.user_id === auth.user.id) continue;
            await createCompanyNotification({
              supabase: auth.supabase,
              companyId: companyScope.companyId,
              recipientUserId: row.user_id,
              actorUserId: auth.user.id,
              eventType: "ca_rca_pending_review",
              title: "RCA Ready for Sign-off",
              body: `The root cause analysis for "${action.title}" is complete and awaiting your HSE sign-off.`,
              priority: action.severity === "critical" || action.severity === "high" ? "high" : "normal",
              href: `/field-id-exchange?rca=${actionId}`,
              sourceTable: "company_corrective_actions",
              sourceId: actionId,
            });
          }
        }, () => { /* non-fatal */ }),
    ]);
  }

  return NextResponse.json({
    reply: assistantContent,
    suggestions,
    currentStep: newStep,
    stepAdvanced,
    meta: aiResponse.meta,
  });
}
