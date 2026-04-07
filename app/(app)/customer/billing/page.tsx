"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { InlineMessage, PageHero, SectionCard } from "@/components/WorkspacePrimitives";
import {
  formatBillingPeriodLabel,
  getBillingSourceLabel,
  getBillingSourceTone,
} from "@/lib/billing/invoicePresentation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Row = {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string;
  total_cents: number;
  balance_due_cents: number;
  currency: string;
  billing_source?: string | null;
  billing_period_key?: string | null;
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase() === "USD" ? "USD" : currency,
  }).format(cents / 100);
}

export default function CustomerBillingPage() {
  const [invoices, setInvoices] = useState<Row[]>([]);
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

    const res = await fetch("/api/customer/billing/invoices", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => null)) as { invoices?: Row[]; error?: string } | null;
    if (!res.ok) {
      setMessage(data?.error || "Failed to load invoices.");
      setInvoices([]);
    } else {
      setInvoices(data?.invoices ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Your company"
        title="Billing"
        description="Invoices issued to your organization. Subscription and licensing charges are labeled so you can spot recurring company pricing quickly."
      />

      {message ? <InlineMessage tone="error">{message}</InlineMessage> : null}

      <SectionCard title="Invoices" description="">
        {loading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-slate-400">No invoices yet.</p>
        ) : (
          <ul className="space-y-3">
            {invoices.map((invoice) => (
              <li
                key={invoice.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/80 px-4 py-3"
              >
                <div className="space-y-1">
                  <div className="font-mono text-sm font-semibold text-white">{invoice.invoice_number}</div>
                  <div className="text-xs text-slate-500">
                    {invoice.issue_date} {"-> due"} {invoice.due_date} · {invoice.status}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                        getBillingSourceTone(invoice.billing_source) === "success"
                          ? "bg-emerald-500/15 text-emerald-200"
                          : getBillingSourceTone(invoice.billing_source) === "info"
                            ? "bg-sky-500/15 text-sky-200"
                            : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {getBillingSourceLabel(invoice.billing_source)}
                    </span>
                    {formatBillingPeriodLabel(invoice.billing_period_key) ? (
                      <span className="text-xs text-slate-500">
                        {formatBillingPeriodLabel(invoice.billing_period_key)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-200">
                    {formatMoney(invoice.total_cents, invoice.currency)}
                  </div>
                  <div className="text-xs text-amber-200/90">
                    Balance {formatMoney(invoice.balance_due_cents, invoice.currency)}
                  </div>
                  <Link href={`/customer/billing/invoices/${invoice.id}`} className="text-sm text-sky-400">
                    View
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
