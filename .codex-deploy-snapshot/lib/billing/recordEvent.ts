import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingEventType } from "@/lib/billing/types";

export async function recordBillingEvent(
  supabase: SupabaseClient,
  params: {
    invoice_id: string;
    event_type: BillingEventType;
    created_by_user_id: string | null;
    event_data?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase.from("billing_events").insert({
    invoice_id: params.invoice_id,
    event_type: params.event_type,
    created_by_user_id: params.created_by_user_id,
    event_data: params.event_data ?? {},
  });
  if (error) {
    console.error("billing_events insert failed:", error.message);
  }
}
