"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { InlineMessage, PageHero, SectionCard } from "@/components/WorkspacePrimitives";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type InvoiceRow = {
  id: string;
  invoice_number: string;
  company_id: string;
  status: string;
  issue_date: string;
  due_date: string;
  total_cents: number;
  balance_due_cents: number;
  currency: string;
  created_by_user_id: string;
  billing_customers?: { company_name?: string; billing_email?: string } | null;
  companies?: { name?: string } | null;
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase() === "USD" ? "USD" : currency,
  }).format(cents / 100);
}

export default function BillingInvoicesListPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setMessage("Sign in required.");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/billing/invoices", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => null)) as
        | { invoices?: InvoiceRow[]; error?: string }
        | null;
      if (!res.ok) {
        setMessage(data?.error || "Failed to load invoices.");
        setInvoices([]);
        setLoading(false);
        return;
      }
      setInvoices(data?.invoices ?? []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Load failed.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const outstanding = invoices.reduce((s, i) => s + (i.balance_due_cents > 0 ? i.balance_due_cents : 0), 0);
  const overdue = invoices.filter(
    (i) =>
      i.balance_due_cents > 0 &&
      i.due_date < new Date().toISOString().slice(0, 10) &&
      !["draft", "void", "cancelled", "paid"].includes(i.status)
  );

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Platform billing"
        title="Invoices"
        description="Create, send, and track customer invoices. Super Admins see all companies; Admins only see assigned companies."
        actions={
          <Link
            href="/billing/invoices/new"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-700"
          >
            New invoice
          </Link>
        }
      />

      {message ? (
        <InlineMessage tone="error">{message}</InlineMessage>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Outstanding</div>
          <div className="mt-2 text-2xl font-black text-white">{formatMoney(outstanding, "usd")}</div>
        </div>
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Overdue count</div>
          <div className="mt-2 text-2xl font-black text-amber-200">{overdue.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Total invoices</div>
          <div className="mt-2 text-2xl font-black text-white">{invoices.length}</div>
        </div>
      </section>

      <SectionCard title="All invoices" description="Latest first. Use New invoice to add a draft.">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-slate-400">No invoices yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-500">
                  <th className="py-2 pr-3">Number</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Issue</th>
                  <th className="py-2 pr-3">Due</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Balance</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-800/80">
                    <td className="py-3 pr-3 font-mono text-slate-200">{inv.invoice_number}</td>
                    <td className="py-3 pr-3 text-slate-300">
                      {inv.billing_customers?.company_name ?? inv.companies?.name ?? "—"}
                    </td>
                    <td className="py-3 pr-3 text-slate-400">{inv.issue_date}</td>
                    <td className="py-3 pr-3 text-slate-400">{inv.due_date}</td>
                    <td className="py-3 pr-3 text-slate-200">
                      {formatMoney(inv.total_cents, inv.currency)}
                    </td>
                    <td className="py-3 pr-3 text-slate-200">
                      {formatMoney(inv.balance_due_cents, inv.currency)}
                    </td>
                    <td className="py-3 pr-3">
                      <span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300">
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/billing/invoices/${inv.id}`}
                        className="font-semibold text-sky-400 hover:text-sky-300"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
