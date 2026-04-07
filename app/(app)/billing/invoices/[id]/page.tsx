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

export default function BillingInvoiceDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");

  const [payload, setPayload] = useState<{
    invoice: Record<string, unknown> & {
      id: string;
      invoice_number: string;
      status: string;
      billing_invoice_line_items?: Array<Record<string, unknown>>;
    };
    payments: unknown[];
    events: unknown[];
  } | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
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
      setMessage(data?.error || "Action failed.");
      return;
    }
    void load();
  }

  async function createPaymentLink() {
    setMessage("");
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
      setMessage(data?.error || "Send failed.");
      return;
    }
    void load();
  }

  if (loading) {
    return <p className="text-slate-400">Loading…</p>;
  }

  if (!payload?.invoice) {
    return (
      <div className="space-y-4">
        {message ? <InlineMessage tone="error">{message}</InlineMessage> : null}
        <Link href="/billing/invoices" className="text-sky-400">
          Back
        </Link>
      </div>
    );
  }

  const inv = payload.invoice;
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
        description={`Status: ${inv.status}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/billing/invoices"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-300"
            >
              List
            </Link>
            {inv.status === "draft" ? (
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => void sendInvoice()}
              >
                Mark sent
              </button>
            ) : null}
            {inv.status !== "draft" &&
            inv.status !== "paid" &&
            inv.status !== "void" &&
            inv.status !== "cancelled" &&
            Number(inv.balance_due_cents) > 0 ? (
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-500 px-4 py-2 text-sm font-semibold text-violet-200"
                onClick={() => void createPaymentLink()}
              >
                Stripe payment link
              </button>
            ) : null}
            {inv.status !== "paid" && inv.status !== "void" && inv.status !== "cancelled" ? (
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
          </div>
        }
      />

      {message ? <InlineMessage tone="error">{message}</InlineMessage> : null}

      <SectionCard title="Amounts" description="All figures in cents are computed server-side.">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Subtotal</dt>
            <dd className="font-semibold text-white">
              {formatMoney(Number(inv.subtotal_cents), String(inv.currency))}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Tax</dt>
            <dd className="font-semibold text-white">
              {formatMoney(Number(inv.tax_cents), String(inv.currency))}
            </dd>
          </div>
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
        {typeof inv.payment_link === "string" && inv.payment_link ? (
          <p className="mt-3 break-all text-xs text-slate-400">
            Payment link:{" "}
            <a href={inv.payment_link} className="text-sky-400 underline" target="_blank" rel="noreferrer">
              {inv.payment_link}
            </a>
          </p>
        ) : null}
      </SectionCard>

      <SectionCard title="Line items" description="">
        <ul className="space-y-2 text-sm">
          {lines.map((li) => (
            <li key={li.id} className="flex justify-between gap-4 border-b border-slate-800 py-2">
              <span className="text-slate-200">{li.description}</span>
              <span className="text-slate-400">
                {li.quantity} × {formatMoney(Number(li.unit_price_cents), String(inv.currency))} ={" "}
                {formatMoney(Number(li.line_total_cents), String(inv.currency))}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Audit" description="Recent billing events.">
        <ul className="space-y-2 text-xs text-slate-400">
          {(payload.events as Array<{ event_type?: string; created_at?: string }>).map((e, i) => (
            <li key={i}>
              {e.created_at} — {e.event_type}
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
