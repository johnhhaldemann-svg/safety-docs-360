import { DEFAULT_DOCUMENT_CREDITS } from "@/lib/marketplace";

export type CompanyCreditTransaction = {
  id: string;
  company_id: string;
  amount: number;
  transaction_type: string;
  document_id?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

export function sumCompanyCreditBalance(transactions: CompanyCreditTransaction[]) {
  return transactions.reduce((total, tx) => total + tx.amount, 0);
}

export function purchasedCompanyDocumentIdsFromTransactions(
  transactions: CompanyCreditTransaction[]
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

export async function listCompanyCreditTransactions(
  supabase: unknown,
  companyId: string
) {
  const { data, error } = await (
    supabase as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            order: (
              column: string,
              options?: { ascending?: boolean }
            ) => PromiseLike<{
              data: CompanyCreditTransaction[] | null;
              error: { message?: string | null } | null;
            }>;
          };
        };
      };
    }
  )
    .from("company_credit_transactions")
    .select(
      "id, company_id, amount, transaction_type, document_id, description, metadata, created_at"
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  return {
    data: data ?? [],
    error,
  };
}

export async function ensureInitialCompanyCredits(params: {
  supabase: unknown;
  companyId: string;
  subscriptionStatus?: string | null;
  existingTransactions: CompanyCreditTransaction[];
}) {
  const { supabase, companyId, subscriptionStatus, existingTransactions } = params;

  if (existingTransactions.length > 0 || subscriptionStatus !== "active") {
    return { granted: false, error: null as { message?: string | null } | null };
  }

  const { error } = await (
    supabase as {
      from: (table: string) => {
        insert: (
          values: Record<string, unknown>
        ) => PromiseLike<{ error: { message?: string | null } | null }>;
      };
    }
  ).from("company_credit_transactions").insert({
    company_id: companyId,
    amount: DEFAULT_DOCUMENT_CREDITS,
    transaction_type: "grant",
    description: "Initial company subscription credit grant",
    metadata: {
      source: "company_subscription_activation",
    },
  });

  return {
    granted: !error,
    error,
  };
}

export async function getCompanySubscriptionStatus(
  supabase: unknown,
  companyId: string
) {
  const { data, error } = await (
    supabase as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            maybeSingle: () => PromiseLike<{
              data: { status?: string | null } | null;
              error: { message?: string | null } | null;
            }>;
          };
        };
      };
    }
  )
    .from("company_subscriptions")
    .select("status")
    .eq("company_id", companyId)
    .maybeSingle();

  return {
    data,
    error,
  };
}
