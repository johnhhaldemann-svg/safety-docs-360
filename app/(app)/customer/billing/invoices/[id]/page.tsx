"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { InlineMessage, PageHero, SectionCard } from "@/components/WorkspacePrimitives";

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

export default function CustomerInvoiceDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [checkoutFlag, setCheckoutFlag] = useState<string | null>(null);
  const [data, setData] = useState<{
    invoice: Record<string, unknown> & {
      invoice_number: string;
      billing_invoice_line_items?: Array<Record<string, unknown>>;
    };
    payments: unknown[];
  } | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setMessage("Sign in required.");
      setLoading(false);
      return;
    }
    const res = await fetch(`/api/customer/billing/invoices/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json().catch(() => null)) as typeof data & { error?: string };
    if (!res.ok) {
      setMessage(json?.error || "Failed to load.");
      setData(null);
    } else {
      setData(json as typeof data);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("checkout");
    setCheckoutFlag(q);
  }, [id]);

  if (loading) {
    return <p className="text-slate-400">Loading…</p>;
  }

  if (!data?.invoice) {
    return (
      <div className="space-y-4">
        {message ? <InlineMessage tone="error">{message}</InlineMessage> : null}
        <Link href="/customer/billing" className="text-sky-400">
          Back to billing
        </Link>
      </div>
    );
  }

  const inv = data.invoice;
  const balanceDue = Number(inv.balance_due_cents);
  const canPayOnline =
    balanceDue > 0 &&
    typeof inv.payment_link === "string" &&
    inv.payment_link.length > 0 &&
    !["paid", "void", "cancelled"].includes(String(inv.status).toLowerCase());
  const lines = (inv.billing_invoice_line_items ?? []) as Array<{
    id?: string;
    description?: string;
    quantity?: number;
    unit_price_cents?: number;
    line_total_cents?: number;
  }>;

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Invoice"
        title={inv.invoice_number}
        description={`Status: ${String(inv.status)}`}
        actions={
          <Link
            href="/customer/billing"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-300"
          >
            All invoices
          </Link>
        }
      />

      <SectionCard title="Totals" description="">
        {checkoutFlag === "success" ? (
          <div className="mb-4">
            <InlineMessage tone="success">
              Thanks — your payment is processing. This page will update once the payment is confirmed.
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
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Total</dt>
            <dd className="font-semibold text-white">
              {formatMoney(Number(inv.total_cents), String(inv.currency))}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Balance due</dt>
            <dd className="font-semibold text-amber-200">
              {formatMoney(Number(inv.balance_due_cents), String(inv.currency))}
            </dd>
          </div>
        </dl>
        {canPayOnline ? (
          <div className="mt-4">
            <a
              href={String(inv.payment_link)}
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
          {lines.map((li) => (
            <li key={li.id} className="flex justify-between gap-4 border-b border-slate-800 py-2">
              <span className="text-slate-200">{li.description}</span>
              <span className="text-slate-400">
                {formatMoney(Number(li.line_total_cents), String(inv.currency))}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Payments" description="">
        {data.payments.length === 0 ? (
          <p className="text-sm text-slate-500">No payments recorded yet.</p>
        ) : (
          <ul className="text-sm text-slate-400">
            {(data.payments as Array<{ created_at?: string; amount_cents?: number }>).map((p, i) => (
              <li key={i}>
                {p.created_at}: {formatMoney(Number(p.amount_cents), String(inv.currency))}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
