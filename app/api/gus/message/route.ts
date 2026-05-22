import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import {
  isValidGusUuid,
  parseGusMessageRequest,
  selectGusMessage,
} from "@/lib/gus/gusMessageSelector";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = parseGusMessageRequest(body);

  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid Gus message request.", details: parsed.errors }, { status: 400 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  const requestedCompanyId = parsed.request.companyId;
  const companyId = requestedCompanyId ?? companyScope.companyId ?? undefined;

  if (
    requestedCompanyId &&
    companyScope.companyId &&
    requestedCompanyId.toLowerCase() !== companyScope.companyId.toLowerCase() &&
    !isAdminRole(auth.role)
  ) {
    return NextResponse.json({ error: "Requested company is not available for this account." }, { status: 403 });
  }

  const requestedUserId = parsed.request.userId;
  const userId = requestedUserId && isValidGusUuid(requestedUserId) ? requestedUserId : auth.user.id;

  if (requestedUserId && requestedUserId.toLowerCase() !== auth.user.id.toLowerCase() && !isAdminRole(auth.role)) {
    return NextResponse.json({ error: "Requested user is not available for this account." }, { status: 403 });
  }

  const message = selectGusMessage({
    ...parsed.request,
    companyId,
    userId,
  });

  return NextResponse.json({
    messageId: message.messageId,
    category: message.category,
    priority: message.priority,
    message: message.message,
    spokenText: message.spokenText,
    shouldSpeak: message.shouldSpeak ?? false,
    actionLabel: message.actionLabel,
    actionHref: message.actionHref,
    actionKey: message.actionKey,
    reason: message.reason,
    confidence: message.confidence,
  });
}

