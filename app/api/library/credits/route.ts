import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import {
  ensureInitialCompanyCredits,
  getCompanySubscriptionStatus,
  listCompanyCreditTransactions,
  purchasedCompanyDocumentIdsFromTransactions,
  sumCompanyCreditBalance,
} from "@/lib/companyBilling";
import { normalizeCompanySubscriptionStatus } from "@/lib/companySeats";
import { authorizeRequest } from "@/lib/rbac";
import { DEFAULT_DOCUMENT_CREDITS, normalizePurchasedIds } from "@/lib/marketplace";
import {
  ensureInitialCredits,
  listCreditTransactions,
  purchasedDocumentIdsFromTransactions,
  sumCreditBalance,
} from "@/lib/credits";

export const runtime = "nodejs";

function deriveCreditBalance(user: {
  id: string;
  user_metadata?: Record<string, unknown>;
}, subscriptionStatus?: string | null) {
  const rawBalance = user.user_metadata?.credit_balance;

  if (typeof rawBalance === "number" && Number.isFinite(rawBalance)) {
    return Math.max(0, Math.round(rawBalance));
  }

  return subscriptionStatus === "active" ? DEFAULT_DOCUMENT_CREDITS : 0;
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request);

  if ("error" in auth) {
    return auth.error;
  }

  const { user, supabase } = auth;
  const companyScope = await getCompanyScope({
    supabase,
    userId: user.id,
    fallbackTeam: auth.team,
    authUser: user,
  });

  if (companyScope.companyId) {
    const companySubscription = await getCompanySubscriptionStatus(
      supabase,
      companyScope.companyId
    );
    const companySubStatus = normalizeCompanySubscriptionStatus(
      companySubscription.data?.status ?? null
    );

    const companyTransactionResult = await listCompanyCreditTransactions(
      supabase,
      companyScope.companyId
    );

    if (!companyTransactionResult.error) {
      const initialGrant = await ensureInitialCompanyCredits({
        supabase,
        companyId: companyScope.companyId,
        subscriptionStatus: companySubscription.data?.status ?? null,
        existingTransactions: companyTransactionResult.data,
      });

      const ledgerResult =
        initialGrant.granted && !initialGrant.error
          ? await listCompanyCreditTransactions(supabase, companyScope.companyId)
          : companyTransactionResult;

      if (!ledgerResult.error) {
        return NextResponse.json({
          creditBalance: sumCompanyCreditBalance(ledgerResult.data),
          purchasedDocumentIds: purchasedCompanyDocumentIdsFromTransactions(
            ledgerResult.data
          ),
          subscriptionStatus: companySubStatus,
          transactions: ledgerResult.data.slice(0, 10),
          ledgerEnabled: true,
          billingScope: "company",
          companyId: companyScope.companyId,
          companyName: companyScope.companyName,
        });
      }
    }

    // Company scope is known but the credit ledger could not be read (e.g. RLS with a
    // user-scoped client). Still report subscription from company_subscriptions so UI
    // does not fall back to the per-user subscriptions table.
    return NextResponse.json({
      creditBalance: 0,
      purchasedDocumentIds: [],
      subscriptionStatus: companySubStatus,
      transactions: [],
      ledgerEnabled: false,
      billingScope: "company",
      companyId: companyScope.companyId,
      companyName: companyScope.companyName,
    });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  const transactionResult = await listCreditTransactions(supabase, user.id);

  if (!transactionResult.error) {
    const initialGrant = await ensureInitialCredits({
      supabase,
      userId: user.id,
      subscriptionStatus: subscription?.status ?? null,
      existingTransactions: transactionResult.data,
    });

    const ledgerResult =
      initialGrant.granted && !initialGrant.error
        ? await listCreditTransactions(supabase, user.id)
        : transactionResult;

    if (!ledgerResult.error) {
      return NextResponse.json({
        creditBalance: sumCreditBalance(ledgerResult.data),
        purchasedDocumentIds: purchasedDocumentIdsFromTransactions(
          ledgerResult.data
        ),
        subscriptionStatus: subscription?.status ?? "inactive",
        transactions: ledgerResult.data.slice(0, 10),
        ledgerEnabled: true,
      });
    }
  }

  const purchasedDocumentIds = normalizePurchasedIds(user.user_metadata?.purchased_document_ids);
  const creditBalance = deriveCreditBalance(user, subscription?.status ?? null);

  return NextResponse.json({
    creditBalance,
    purchasedDocumentIds,
    subscriptionStatus: subscription?.status ?? "inactive",
    transactions: [],
    ledgerEnabled: false,
    billingScope: "user",
    companyId: companyScope.companyId,
    companyName: companyScope.companyName,
  });
}
