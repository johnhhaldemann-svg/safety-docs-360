import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import {
  DEFAULT_DOCUMENT_CREDITS,
  getDocumentCreditCost,
  isMarketplaceEnabled,
  normalizePurchasedIds,
} from "@/lib/marketplace";
import {
  ensureInitialCredits,
  listCreditTransactions,
  purchasedDocumentIdsFromTransactions,
  sumCreditBalance,
} from "@/lib/credits";

export const runtime = "nodejs";

type PurchasePayload = {
  documentId?: string;
};

function deriveCreditBalance(user: {
  user_metadata?: Record<string, unknown>;
}, subscriptionStatus?: string | null) {
  const rawBalance = user.user_metadata?.credit_balance;

  if (typeof rawBalance === "number" && Number.isFinite(rawBalance)) {
    return Math.max(0, Math.round(rawBalance));
  }

  return subscriptionStatus === "active" ? DEFAULT_DOCUMENT_CREDITS : 0;
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_manage_billing",
  });

  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, user, role } = auth;
  const body = (await request.json()) as PurchasePayload;
  const documentId = body.documentId?.trim();

  if (!documentId) {
    return NextResponse.json({ error: "Document ID is required." }, { status: 400 });
  }

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("id, user_id, project_name, notes, status, final_file_path")
    .eq("id", documentId)
    .single();

  if (documentError || !document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  if (document.status?.trim().toLowerCase() === "archived") {
    return NextResponse.json(
      { error: "This document is no longer available." },
      { status: 400 }
    );
  }

  if (!document.final_file_path) {
    return NextResponse.json(
      { error: "This document is not available for purchase yet." },
      { status: 400 }
    );
  }

  if (
    document.status?.trim().toLowerCase() !== "approved" &&
    !document.final_file_path
  ) {
    return NextResponse.json(
      { error: "Only approved documents can be purchased." },
      { status: 400 }
    );
  }

  if (!isMarketplaceEnabled(document.notes)) {
    return NextResponse.json(
      { error: "This document is not currently listed in the marketplace." },
      { status: 400 }
    );
  }

  const purchasedDocumentIds = normalizePurchasedIds(
    user.user_metadata?.purchased_document_ids
  );

  if (
    purchasedDocumentIds.includes(documentId) ||
    document.user_id === user.id ||
    isAdminRole(role)
  ) {
    return NextResponse.json({
      success: true,
      alreadyOwned: true,
      creditBalance: deriveCreditBalance(user),
      purchasedDocumentIds,
    });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  const transactionResult = await listCreditTransactions(supabase, user.id);
  const cost = getDocumentCreditCost(document.notes);

  if (!transactionResult.error) {
    await ensureInitialCredits({
      supabase,
      userId: user.id,
      subscriptionStatus: subscription?.status ?? null,
      existingTransactions: transactionResult.data,
    });

    const ledgerResult = await listCreditTransactions(supabase, user.id);

    if (!ledgerResult.error) {
      const ledgerPurchasedIds =
        purchasedDocumentIdsFromTransactions(ledgerResult.data);
      const ledgerBalance = sumCreditBalance(ledgerResult.data);

      if (
        ledgerPurchasedIds.includes(documentId) ||
        document.user_id === user.id ||
        isAdminRole(role)
      ) {
        return NextResponse.json({
          success: true,
          alreadyOwned: true,
          creditBalance: ledgerBalance,
          purchasedDocumentIds: ledgerPurchasedIds,
          ledgerEnabled: true,
        });
      }

      if (ledgerBalance < cost) {
        return NextResponse.json(
          {
            error: "Not enough credits.",
            requiredCredits: cost,
            creditBalance: ledgerBalance,
          },
          { status: 400 }
        );
      }

      const { error: insertError } = await (
        supabase as {
          rpc: (
            fn: string,
            args: Record<string, unknown>
          ) => PromiseLike<{ error: { message?: string | null } | null }>;
        }
      ).rpc("record_marketplace_purchase", {
        p_document_id: documentId,
        p_amount: -cost,
        p_description: `Unlocked ${document.project_name || "completed document"}`,
        p_metadata: {
          document_id: documentId,
          project_name: document.project_name,
          credit_cost: cost,
        },
      });

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message || "Failed to record purchase." },
          { status: 500 }
        );
      }

      const nextLedger = await listCreditTransactions(supabase, user.id);

      if (!nextLedger.error) {
        return NextResponse.json({
          success: true,
          purchasedDocumentIds: purchasedDocumentIdsFromTransactions(
            nextLedger.data
          ),
          creditBalance: sumCreditBalance(nextLedger.data),
          cost,
          ledgerEnabled: true,
        });
      }
    }
  }

  const creditBalance = deriveCreditBalance(user, subscription?.status ?? null);

  if (creditBalance < cost) {
    return NextResponse.json(
      {
        error: "Not enough credits.",
        requiredCredits: cost,
        creditBalance,
      },
      { status: 400 }
    );
  }

  const nextPurchasedIds = [...purchasedDocumentIds, documentId];
  const nextCreditBalance = creditBalance - cost;

  const { error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    {
      user_metadata: {
        ...(user.user_metadata ?? {}),
        credit_balance: nextCreditBalance,
        purchased_document_ids: nextPurchasedIds,
      },
    }
  );

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    purchasedDocumentIds: nextPurchasedIds,
    creditBalance: nextCreditBalance,
    cost,
    ledgerEnabled: false,
  });
}
