import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getDocumentCreditCost, isMarketplaceEnabled } from "@/lib/marketplace";

export const runtime = "nodejs";

type DocumentRow = {
  id: string;
  created_at: string;
  project_name: string | null;
  document_type: string | null;
  status?: string | null;
  notes?: string | null;
  final_file_path?: string | null;
};

type PurchaseRow = {
  document_id: string | null;
  amount: number;
};

function isArchivedStatus(status?: string | null) {
  return status?.trim().toLowerCase() === "archived";
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, { requireAdmin: true });

  if ("error" in auth) {
    return auth.error;
  }

  const { data: documents, error: documentError } = await auth.supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (documentError) {
    return NextResponse.json({ error: documentError.message }, { status: 500 });
  }

  let purchases: PurchaseRow[] = [];
  let ledgerEnabled = true;

  const { data: purchaseData, error: purchaseError } = await auth.supabase
    .from("credit_transactions")
    .select("document_id, amount")
    .eq("transaction_type", "purchase");

  if (purchaseError) {
    ledgerEnabled = false;
  } else {
    purchases = (purchaseData ?? []) as PurchaseRow[];
  }

  const purchaseByDocumentId = new Map<string, { purchaseCount: number; creditsEarned: number }>();

  for (const purchase of purchases) {
    if (!purchase.document_id) continue;

    const existing = purchaseByDocumentId.get(purchase.document_id) ?? {
      purchaseCount: 0,
      creditsEarned: 0,
    };

    existing.purchaseCount += 1;
    existing.creditsEarned += Math.abs(Number(purchase.amount ?? 0));
    purchaseByDocumentId.set(purchase.document_id, existing);
  }

  const completedDocuments = ((documents ?? []) as DocumentRow[])
    .filter(
      (doc) =>
        !isArchivedStatus(doc.status) &&
        (doc.status?.trim().toLowerCase() === "approved" || Boolean(doc.final_file_path))
    )
    .map((doc) => {
      const purchaseStats = purchaseByDocumentId.get(doc.id) ?? {
        purchaseCount: 0,
        creditsEarned: 0,
      };

      return {
        ...doc,
        marketplaceEnabled: isMarketplaceEnabled(doc.notes),
        creditCost: getDocumentCreditCost(doc.notes),
        purchaseCount: purchaseStats.purchaseCount,
        creditsEarned: purchaseStats.creditsEarned,
      };
    });

  return NextResponse.json({
    documents: completedDocuments,
    ledgerEnabled,
  });
}
