/** Billing domain — money in integer cents; Stripe fields optional. */

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partial"
  | "paid"
  | "overdue"
  | "void"
  | "cancelled";

export type InvoiceLineItemType =
  | "subscription"
  | "document_review"
  | "credit_pack"
  | "consulting"
  | "custom";

export type PaymentMethod = "stripe" | "ach" | "check" | "cash" | "manual" | "other";

export type BillingEventType =
  | "created"
  | "updated"
  | "sent"
  | "viewed"
  | "reminder_sent"
  | "payment_received"
  | "marked_paid"
  | "voided"
  | "cancelled"
  | "payment_failed";

export type BillingCustomer = {
  id: string;
  company_id: string;
  company_name: string;
  billing_contact_name: string | null;
  billing_email: string;
  billing_address_1: string | null;
  billing_address_2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  phone: string | null;
  tax_id: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Invoice = {
  id: string;
  invoice_number: string;
  customer_id: string;
  company_id: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  subtotal_cents: number;
  tax_cents: number;
  discount_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  balance_due_cents: number;
  currency: string;
  notes: string | null;
  terms: string | null;
  created_by_user_id: string;
  sent_at: string | null;
  viewed_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  cancelled_at: string | null;
  payment_provider: string | null;
  payment_link: string | null;
  pdf_path: string | null;
  stripe_customer_id: string | null;
  stripe_invoice_id: string | null;
  stripe_checkout_session_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type InvoiceLineItem = {
  id: string;
  invoice_id: string;
  sort_order: number;
  item_type: InvoiceLineItemType;
  description: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type InvoicePayment = {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount_cents: number;
  payment_method: PaymentMethod;
  external_payment_id: string | null;
  notes: string | null;
  created_by_user_id: string | null;
  created_at: string;
};

export type BillingEvent = {
  id: string;
  invoice_id: string;
  event_type: BillingEventType;
  event_data: Record<string, unknown>;
  created_by_user_id: string | null;
  created_at: string;
};

export type InvoiceTotals = {
  subtotal_cents: number;
  discount_cents: number;
  taxable_cents: number;
  tax_cents: number;
  total_cents: number;
};

export type LineItemInput = {
  item_type?: InvoiceLineItemType;
  description: string;
  quantity: number;
  unit_price_cents: number;
  sort_order?: number;
  metadata?: Record<string, unknown>;
};

export type CreateInvoiceInput = {
  customer_id: string;
  company_id: string;
  status?: InvoiceStatus;
  issue_date: string;
  due_date: string;
  tax_rate_bps?: number;
  discount_cents?: number;
  currency?: string;
  notes?: string | null;
  terms?: string | null;
  line_items: LineItemInput[];
  metadata?: Record<string, unknown>;
};

export type UpdateInvoiceInput = {
  status?: InvoiceStatus;
  issue_date?: string;
  due_date?: string;
  tax_rate_bps?: number;
  discount_cents?: number;
  notes?: string | null;
  terms?: string | null;
  line_items?: LineItemInput[] | null;
  metadata?: Record<string, unknown>;
};

export type SendInvoiceInput = {
  /** Optional override recipient */
  billing_email?: string;
};
