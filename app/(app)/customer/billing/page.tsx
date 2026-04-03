"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { InlineMessage, PageHero, SectionCard } from "@/components/WorkspacePrimitives";

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
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Your company"
        title="Billing"
        description="Invoices issued to your organization. Pay links and PDF downloads will appear here as they are enabled."
      />

      {message ? <InlineMessage tone="error">{message}</InlineMessage> : null}

      <SectionCard title="Invoices" description="">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-slate-400">No invoices yet.</p>
        ) : (
          <ul className="space-y-3">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/80 px-4 py-3"
              >
                <div>
                  <div className="font-mono text-sm font-semibold text-white">{inv.invoice_number}</div>
                  <div className="text-xs text-slate-500">
                    {inv.issue_date} → due {inv.due_date} · {inv.status}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-200">
                    {formatMoney(inv.total_cents, inv.currency)}
                  </div>
                  <div className="text-xs text-amber-200/90">
                    Balance {formatMoney(inv.balance_due_cents, inv.currency)}
                  </div>
                  <Link href={`/customer/billing/invoices/${inv.id}`} className="text-sm text-sky-400">
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
