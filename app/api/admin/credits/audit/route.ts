import { NextResponse } from "next/server";
import { authorizeRequest, formatAppRole, getUserRoleContext } from "@/lib/rbac";

export const runtime = "nodejs";

type CreditTransactionRow = {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: string;
  document_id?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

type DocumentRow = {
  id: string;
  project_name: string | null;
  document_type: string | null;
};

function getDisplayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : "";

  if (metadataName.trim()) {
    return metadataName.trim();
  }

  if (user.email) {
    return user.email.split("@")[0];
  }

  return "Unnamed User";
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_view_analytics",
  });

  if ("error" in auth) {
    return auth.error;
  }

  const [{ data: usersResult, error: usersError }, { data: txResult, error: txError }] =
    await Promise.all([
      auth.supabase.auth.admin.listUsers(),
      auth.supabase
        .from("credit_transactions")
        .select(
          "id, user_id, amount, transaction_type, document_id, description, metadata, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(250),
    ]);

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  if (txError) {
    return NextResponse.json(
      {
        error: txError.message,
        ledgerEnabled: false,
      },
      { status: 500 }
    );
  }

  const transactions = (txResult ?? []) as CreditTransactionRow[];
  const documentIds = Array.from(
    new Set(
      transactions
        .map((tx) => tx.document_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );

  let documentMap = new Map<string, DocumentRow>();

  if (documentIds.length > 0) {
    const { data: documents, error: documentsError } = await auth.supabase
      .from("documents")
      .select("id, project_name, document_type")
      .in("id", documentIds);

    if (documentsError) {
      return NextResponse.json({ error: documentsError.message }, { status: 500 });
    }

    documentMap = new Map(
      ((documents ?? []) as DocumentRow[]).map((doc) => [doc.id, doc])
    );
  }

  const users = await Promise.all(
    (usersResult.users ?? []).map(async (user) => {
      const roleContext = await getUserRoleContext({
        supabase: auth.supabase,
        user,
      });

      return {
        id: user.id,
        email: user.email ?? "",
        name: getDisplayName(user),
        role: formatAppRole(roleContext.role),
        team: roleContext.team,
      };
    })
  );

  const usersById = new Map(users.map((user) => [user.id, user]));

  const enrichedTransactions = transactions.map((tx) => {
    const user = usersById.get(tx.user_id);
    const document = tx.document_id ? documentMap.get(tx.document_id) : null;

    return {
      ...tx,
      user_name: user?.name ?? "Unknown User",
      user_email: user?.email ?? "",
      user_role: user?.role ?? "Viewer",
      user_team: user?.team ?? "General",
      document_title:
        document?.project_name ?? document?.document_type ?? "Completed document",
      document_type: document?.document_type ?? null,
    };
  });

  const summary = {
    totalTransactions: enrichedTransactions.length,
    totalCreditsGranted: enrichedTransactions
      .filter((tx) => tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0),
    totalCreditsSpent: enrichedTransactions
      .filter((tx) => tx.amount < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
    totalPurchases: enrichedTransactions.filter(
      (tx) => tx.transaction_type === "purchase"
    ).length,
  };

  return NextResponse.json({
    ledgerEnabled: true,
    summary,
    transactions: enrichedTransactions,
  });
}
