import { DEFAULT_DOCUMENT_CREDITS } from "@/lib/marketplace";

export type CreditTransaction = {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: string;
  document_id?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

export function sumCreditBalance(transactions: CreditTransaction[]) {
  return transactions.reduce((total, tx) => total + tx.amount, 0);
}

export function purchasedDocumentIdsFromTransactions(
  transactions: CreditTransaction[]
) {
  return Array.from(
    new Set(
      transactions
        .filter(
          (tx) =>
            tx.transaction_type === "purchase" &&
            typeof tx.document_id === "string" &&
            tx.document_id.length > 0
        )
        .map((tx) => tx.document_id as string)
    )
  );
}

export async function listCreditTransactions(
  supabase: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string
        ) => {
          order: (
            column: string,
            options?: { ascending?: boolean }
          ) => Promise<{ data: CreditTransaction[] | null; error: { message: string } | null }>;
        };
      };
    };
  },
  userId: string
) {
  const { data, error } = await supabase
    .from("credit_transactions")
    .select(
      "id, user_id, amount, transaction_type, document_id, description, metadata, created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return {
    data: data ?? [],
    error,
  };
}

export async function ensureInitialCredits(params: {
  supabase: {
    from: (table: string) => {
      insert: (values: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    };
  };
  userId: string;
  subscriptionStatus?: string | null;
  existingTransactions: CreditTransaction[];
}) {
  const { supabase, userId, subscriptionStatus, existingTransactions } = params;

  if (existingTransactions.length > 0 || subscriptionStatus !== "active") {
    return { granted: false, error: null as { message: string } | null };
  }

  const { error } = await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount: DEFAULT_DOCUMENT_CREDITS,
    transaction_type: "grant",
    description: "Initial subscription credit grant",
    metadata: {
      source: "subscription_activation",
    },
  });

  return {
    granted: !error,
    error,
  };
}
