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

export default function BillingInvoiceDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");

  const [payload, setPayload] = useState<{
    invoice: Record<string, unknown> & {
      id: string;
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
    setMessage("");
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

    const res = await fetch(`/api/billing/invoices/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => null)) as typeof payload & { error?: string };
    if (!res.ok) {
      setMessageTone("error");
      setMessage(data?.error || "Failed to load.");
      setPayload(null);
      setLoading(false);
      return;
    }
    setPayload(data as typeof payload);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function postJson(path: string, body: Record<string, unknown>) {
    setMessage("");
    setMessageTone("neutral");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const res = await fetch(path, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as { error?: string };
    if (!res.ok) {
      setMessageTone("error");
      setMessage(data?.error || "Action failed.");
      return;
    }
    void load();
  }

  async function createPaymentLink() {
    setMessage("");
    setMessageTone("neutral");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const res = await fetch(`/api/billing/invoices/${id}/payment-link`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => null)) as { error?: string; payment_link?: string };
    if (!res.ok) {
      setMessageTone("error");
      setMessage(data?.error || "Could not create payment link.");
      return;
    }
    if (data.payment_link) {
      void navigator.clipboard.writeText(data.payment_link).catch(() => {});
    }
    void load();
  }

  async function sendInvoice() {
    setMessage("");
    setMessageTone("neutral");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const res = await fetch(`/api/billing/invoices/${id}/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => null)) as { error?: string };
    if (!res.ok) {
      setMessageTone("error");
      setMessage(data?.error || "Send failed.");
      return;
    }
    void load();
  }

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

    const res = await fetch(`/api/billing/invoices/${id}/resend-receipt`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (!res.ok) {
      setMessageTone("error");
      setMessage(data?.error || "Receipt resend failed.");
      setResendingReceipt(false);
      return;
    }

    setMessageTone("success");
    setMessage(data?.message || "Receipt resent.");
    void load();
    setResendingReceipt(false);
  }

  const invoice = payload?.invoice ?? null;
  const lines = useMemo(
    () =>
      ((invoice?.billing_invoice_line_items ?? []) as InvoiceLineItemLike[]),
    [invoice?.billing_invoice_line_items]
  );
  const chargeSummary = useMemo(() => summarizeBillingCharges(lines), [lines]);
  const sourceSummary = useMemo(() => getInvoiceSourceSummary(invoice ?? {}), [invoice]);
  const events = payload?.events ?? [];

  if (loading) {
    return <p className="text-slate-400">Loading...</p>;
  }

  if (!invoice) {
    return (
      <div className="space-y-4">
        {message ? <InlineMessage tone="error">{message}</InlineMessage> : null}
        <Link href="/billing/invoices" className="text-sky-400">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Invoice"
        title={invoice.invoice_number}
        description={`Status: ${invoice.status}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/billing/invoices"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-300"
            >
              List
            </Link>
            {invoice.status === "draft" ? (
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => void sendInvoice()}
              >
                Mark sent
              </button>
            ) : null}
            {invoice.status !== "draft" &&
            invoice.status !== "paid" &&
            invoice.status !== "void" &&
            invoice.status !== "cancelled" &&
            Number(invoice.balance_due_cents) > 0 ? (
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-500 px-4 py-2 text-sm font-semibold text-violet-200"
                onClick={() => void createPaymentLink()}
              >
                Stripe payment link
              </button>
            ) : null}
            {invoice.status !== "paid" &&
            invoice.status !== "void" &&
            invoice.status !== "cancelled" ? (
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-200"
                onClick={() =>
                  void postJson(`/api/billing/invoices/${id}/mark-paid`, {
                    mark_full: true,
                    payment_method: "manual",
                  })
                }
              >
                Mark paid (full balance)
              </button>
            ) : null}
            {sourceSummary.isMarketplaceCreditPack &&
            (invoice.status === "paid" || Number(invoice.balance_due_cents) <= 0) ? (
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-500 px-4 py-2 text-sm font-semibold text-amber-200 disabled:opacity-60"
                onClick={() => void resendReceipt()}
                disabled={resendingReceipt}
              >
                {resendingReceipt ? "Resending..." : "Resend receipt"}
              </button>
            ) : null}
          </div>
        }
      />

      {message ? <InlineMessage tone={messageTone === "success" ? "success" : "error"}>{message}</InlineMessage> : null}

      <SectionCard
        title="Billing summary"
        description="Recurring company pricing is surfaced separately so subscription and licensed-seat charges are easy to review."
      >
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Source</div>
            <div className="mt-2">
              <span
                className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                  sourceSummary.tone === "success"
                    ? "bg-emerald-500/15 text-emerald-200"
                    : sourceSummary.tone === "info"
                      ? "bg-sky-500/15 text-sky-200"
                      : "bg-slate-800 text-slate-300"
                }`}
              >
                {sourceSummary.source}
              </span>
            </div>
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
        ) : sourceSummary.isCompanyPricing ? (
          <p className="mt-4 rounded-xl border border-sky-500/20 bg-sky-950/30 px-4 py-3 text-sm text-sky-100">
            This invoice uses company pricing overrides for subscription and licensing.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard title="Amounts" description="All figures in cents are computed server-side.">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Subtotal</dt>
            <dd className="font-semibold text-white">
              {formatMoney(Number(invoice.subtotal_cents), String(invoice.currency))}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Tax</dt>
            <dd className="font-semibold text-white">
              {formatMoney(Number(invoice.tax_cents), String(invoice.currency))}
            </dd>
          </div>
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
        {typeof invoice.payment_link === "string" && invoice.payment_link ? (
          <p className="mt-3 break-all text-xs text-slate-400">
            Payment link:{" "}
            <a
              href={invoice.payment_link}
              className="text-sky-400 underline"
              target="_blank"
              rel="noreferrer"
            >
              {invoice.payment_link}
            </a>
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
              <li key={`line-${index}`} className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 py-2">
                <div className="space-y-1">
                  <div className="text-slate-200">{line.description}</div>
                  <span className="inline-flex rounded-full bg-slate-800 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                    {tag}
                  </span>
                </div>
                <span className="text-slate-400">
                  {line.quantity} x {formatMoney(Number(line.unit_price_cents), String(invoice.currency))} ={" "}
                  {formatMoney(Number(line.line_total_cents), String(invoice.currency))}
                </span>
              </li>
            );
          })}
        </ul>
      </SectionCard>

      <SectionCard title="Audit" description="Recent billing events.">
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
