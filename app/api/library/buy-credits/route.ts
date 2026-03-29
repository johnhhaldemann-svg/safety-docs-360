import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import {
  listCompanyCreditTransactions,
  purchasedCompanyDocumentIdsFromTransactions,
  sumCompanyCreditBalance,
} from "@/lib/companyBilling";
import { authorizeRequest } from "@/lib/rbac";
import {
  listCreditTransactions,
  purchasedDocumentIdsFromTransactions,
  sumCreditBalance,
} from "@/lib/credits";

export const runtime = "nodejs";

type BuyCreditsPayload = {
  packId?: string;
};

const TEST_CREDIT_PACKS = {
  starter: { credits: 10, label: "Starter Test Pack" },
  pro: { credits: 25, label: "Pro Test Pack" },
  max: { credits: 50, label: "Max Test Pack" },
} as const;

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_manage_billing",
  });

  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json().catch(() => null)) as BuyCreditsPayload | null;
  const packId = body?.packId?.trim().toLowerCase() ?? "";
  const selectedPack =
    TEST_CREDIT_PACKS[packId as keyof typeof TEST_CREDIT_PACKS] ?? null;

  if (!selectedPack) {
    return NextResponse.json(
      { error: "A valid credit pack is required." },
      { status: 400 }
    );
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (companyScope.companyId) {
    const { error: insertError } = await auth.supabase
      .from("company_credit_transactions")
      .insert({
        company_id: companyScope.companyId,
        amount: selectedPack.credits,
        transaction_type: "grant",
        description: `${selectedPack.label} credited from in-app test checkout`,
        metadata: {
          source: "test_checkout",
          pack_id: packId,
          credits: selectedPack.credits,
        },
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const ledgerResult = await listCompanyCreditTransactions(
      auth.supabase,
      companyScope.companyId
    );

    if (ledgerResult.error) {
      return NextResponse.json({ error: ledgerResult.error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      grantedCredits: selectedPack.credits,
      creditBalance: sumCompanyCreditBalance(ledgerResult.data),
      purchasedDocumentIds: purchasedCompanyDocumentIdsFromTransactions(
        ledgerResult.data
      ),
      transactions: ledgerResult.data.slice(0, 10),
      ledgerEnabled: true,
      billingScope: "company",
      companyId: companyScope.companyId,
      companyName: companyScope.companyName,
    });
  }

  const { error: insertError } = await auth.supabase
    .from("credit_transactions")
    .insert({
      user_id: auth.user.id,
      amount: selectedPack.credits,
      transaction_type: "grant",
      description: `${selectedPack.label} credited from in-app test checkout`,
      metadata: {
        source: "test_checkout",
        pack_id: packId,
        credits: selectedPack.credits,
      },
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const ledgerResult = await listCreditTransactions(auth.supabase, auth.user.id);

  if (ledgerResult.error) {
    return NextResponse.json({ error: ledgerResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    grantedCredits: selectedPack.credits,
    creditBalance: sumCreditBalance(ledgerResult.data),
    purchasedDocumentIds: purchasedDocumentIdsFromTransactions(ledgerResult.data),
    transactions: ledgerResult.data.slice(0, 10),
    ledgerEnabled: true,
    billingScope: "user",
  });
}
