"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InlineMessage, PageHero, SectionCard } from "@/components/WorkspacePrimitives";
import {
  type InvoiceLineItemLike,
  formatBillingEventLabel,
  getInvoiceSourceSummary,
  summarizeBillingCharges,
} from "@/lib/billing/invoicePresentation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase() === "USD" ? "USD" : currency,
  }).format(cents / 100);
}

function formatActivityTime(value?: string | null) {
  if (!value) {
    return "Unknown time";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function CustomerInvoiceDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [checkoutFlag, setCheckoutFlag] = useState<string | null>(null);
  const [permissionMap, setPermissionMap] = useState<{ can_manage_billing?: boolean } | null>(
    null
  );
  const [data, setData] = useState<{
    invoice: Record<string, unknown> & {
      invoice_number: string;
      status: string;
      currency: string;
      total_cents: number;
      subtotal_cents: number;
      tax_cents: number;
      discount_cents: number;
      balance_due_cents: number;
      payment_link?: string | null;
      billing_source?: string | null;
      billing_period_key?: string | null;
      billing_period_start?: string | null;
      billing_period_end?: string | null;
      billing_invoice_line_items?: Array<Record<string, unknown>>;
    };
    payments: unknown[];
    events: unknown[];
  } | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "neutral">("neutral");
  const [loading, setLoading] = useState(true);
  const [resendingReceipt, setResendingReceipt] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessageTone("neutral");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setMessage("Sign in required.");
      setLoading(false);
      return;
    }

    const [meResponse, res] = await Promise.all([
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`/api/customer/billing/invoices/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    const meData = (await meResponse.json().catch(() => null)) as
      | { user?: { permissionMap?: { can_manage_billing?: boolean } } }
      | null;
    if (meResponse.ok) {
      setPermissionMap(meData?.user?.permissionMap ?? null);
    }
    const json = (await res.json().catch(() => null)) as typeof data & { error?: string };
    if (!res.ok) {
      setMessageTone("error");
      setMessage(json?.error || "Failed to load.");
      setData(null);
    } else {
      setData(json as typeof data);
    }
    setLoading(false);
  }, [id]);

  async function resendReceipt() {
    setResendingReceipt(true);
    setMessage("");
    setMessageTone("neutral");

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setMessageTone("error");
      setResendingReceipt(false);
      return;
    }

    const res = await fetch(`/api/customer/billing/invoices/${id}/resend-receipt`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (!res.ok) {
      setMessageTone("error");
      setMessage(json?.error || "Receipt resend failed.");
      setResendingReceipt(false);
      return;
    }

    setMessageTone("success");
    setMessage(json?.message || "Receipt resent.");
    setResendingReceipt(false);
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const q = new URLSearchParams(window.location.search).get("checkout");
      setCheckoutFlag(q);
    }, 0);
    return () => window.clearTimeout(t);
  }, [id]);

  const invoice = data?.invoice ?? null;
  const lines = useMemo(
    () =>
      ((invoice?.billing_invoice_line_items ?? []) as InvoiceLineItemLike[]),
    [invoice?.billing_invoice_line_items]
  );
  const chargeSummary = useMemo(() => summarizeBillingCharges(lines), [lines]);
  const sourceSummary = useMemo(() => getInvoiceSourceSummary(invoice ?? {}), [invoice]);
  const payments = data?.payments ?? [];
  const events = data?.events ?? [];
  const canManageBilling = Boolean(permissionMap?.can_manage_billing);

  if (loading) {
    return <p className="text-slate-400">Loading...</p>;
  }

  if (!invoice) {
    return (
      <div className="space-y-4">
        {message ? (
          <InlineMessage tone={messageTone === "success" ? "success" : "error"}>{message}</InlineMessage>
        ) : null}
        <Link href="/customer/billing" className="text-sky-400">
          Back to billing
        </Link>
      </div>
    );
  }

  const balanceDue = Number(invoice.balance_due_cents);
  const canPayOnline =
    balanceDue > 0 &&
    typeof invoice.payment_link === "string" &&
    invoice.payment_link.length > 0 &&
    !["paid", "void", "cancelled"].includes(String(invoice.status).toLowerCase());

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Invoice"
        title={invoice.invoice_number}
        description={`Status: ${String(invoice.status)}`}
        actions={
          <Link
            href="/customer/billing"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-300"
          >
            All invoices
          </Link>
        }
      />

      <SectionCard
        title="Billing summary"
        description="Subscription and licensing charges are surfaced separately so the company can see what the recurring bill contains."
      >
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Source</div>
            <div className="mt-2 text-sm font-semibold text-slate-100">{sourceSummary.source}</div>
          </div>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Period</div>
            <div className="mt-2 text-sm font-semibold text-slate-100">
              {sourceSummary.period ?? "Not recurring"}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Subscription</div>
            <div className="mt-2 text-sm font-semibold text-slate-100">
              {formatMoney(chargeSummary.subscription_cents, String(invoice.currency))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Licensing</div>
            <div className="mt-2 text-sm font-semibold text-slate-100">
              {formatMoney(chargeSummary.licensing_cents, String(invoice.currency))}
            </div>
          </div>
        </div>
        {sourceSummary.isRecurring ? (
          <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">
            This invoice was generated automatically from company subscription and licensed-seat pricing.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard title="Totals" description="">
        {checkoutFlag === "success" ? (
          <div className="mb-4">
            <InlineMessage tone="success">
              Thanks - your payment is processing. This page will update once the payment is confirmed.
            </InlineMessage>
          </div>
        ) : null}
        {checkoutFlag === "cancelled" ? (
          <div className="mb-4">
            <InlineMessage tone="neutral">
              Checkout was cancelled. You can try again when you are ready.
            </InlineMessage>
          </div>
        ) : null}
        {sourceSummary.isMarketplaceCreditPack && canManageBilling && (invoice.status.toLowerCase() === "paid" || balanceDue <= 0) ? (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => void resendReceipt()}
              disabled={resendingReceipt}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-500 px-4 py-2 text-sm font-semibold text-amber-200 disabled:opacity-60"
            >
              {resendingReceipt ? "Resending..." : "Resend receipt"}
            </button>
          </div>
        ) : null}
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Total</dt>
            <dd className="font-semibold text-white">
              {formatMoney(Number(invoice.total_cents), String(invoice.currency))}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Balance due</dt>
            <dd className="font-semibold text-amber-200">
              {formatMoney(Number(invoice.balance_due_cents), String(invoice.currency))}
            </dd>
          </div>
        </dl>
        {canPayOnline ? (
          <div className="mt-4">
            <a
              href={String(invoice.payment_link)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Pay now
            </a>
          </div>
        ) : balanceDue > 0 ? (
          <p className="mt-4 text-xs text-slate-500">
            A payment link will appear here once your invoice is sent from billing.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard title="Line items" description="">
        <ul className="space-y-2 text-sm">
          {lines.map((line, index) => {
            const component = String(line.metadata?.billing_component ?? "").trim().toLowerCase();
            const tag =
              component === "company_subscription"
                ? "Subscription"
                : component === "licensed_seats"
                  ? "Licensing"
                  : line.item_type === "subscription"
                    ? "Subscription"
                    : "Other";

            return (
              <li
                key={`line-${index}`}
                className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 py-2"
              >
                <div className="space-y-1">
                  <div className="text-slate-200">{line.description}</div>
                  <span className="inline-flex rounded-full bg-slate-800 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                    {tag}
                  </span>
                </div>
                <span className="text-slate-400">
                  {formatMoney(Number(line.line_total_cents), String(invoice.currency))}
                </span>
              </li>
            );
          })}
        </ul>
      </SectionCard>

      <SectionCard title="Payments" description="">
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">No payments recorded yet.</p>
        ) : (
          <ul className="text-sm text-slate-400">
            {(payments as Array<{ created_at?: string; amount_cents?: number }>).map((payment, index) => (
              <li key={index}>
                {formatActivityTime(payment.created_at)}: {formatMoney(Number(payment.amount_cents), String(invoice.currency))}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Billing activity" description="A short history of billing changes on this invoice.">
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">No billing events recorded yet.</p>
        ) : (
          <ul className="space-y-2 text-xs text-slate-400">
            {(events as Array<{ event_type?: string; created_at?: string }>).map((event, index) => (
              <li
                key={index}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-3"
              >
                <span className="inline-flex rounded-full bg-slate-800 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                  {formatBillingEventLabel(event.event_type)}
                </span>
                <span className="text-slate-400">{formatActivityTime(event.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
