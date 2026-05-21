"use client";

import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TableDensityToggle } from "@/components/app-shell/TableDensityToggle";
import { useTableDensity } from "@/hooks/useTableDensity";
import { wideInvoiceTableLayout } from "@/lib/tableDensityLayout";
import { EmptyState, InlineMessage, PageHero, SectionCard } from "@/components/WorkspacePrimitives";
import {
  formatBillingPeriodLabel,
  getBillingSourceLabel,
  getBillingSourceTone,
} from "@/lib/billing/invoicePresentation";

const supabase = getSupabaseBrowserClient();

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
  billing_source?: string | null;
  billing_period_key?: string | null;
  billing_period_start?: string | null;
  billing_period_end?: string | null;
  billing_customers?: { company_name?: string; billing_email?: string } | null;
  companies?: { name?: string } | null;
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase() === "USD" ? "USD" : currency,
  }).format(cents / 100);
}

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date);
}

function getStatusTone(status: string) {
  const normalized = status.trim().toLowerCase();
  if (["paid", "sent"].includes(normalized)) {
    return "success";
  }
  if (["draft", "void", "cancelled"].includes(normalized)) {
    return "neutral";
  }
  return "warning";
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

  const today = new Date().toISOString().slice(0, 10);
  const totalBalanceDue = invoices.reduce(
    (sum, invoice) => sum + Math.max(0, invoice.balance_due_cents),
    0
  );
  const overdue = invoices.filter(
    (invoice) =>
      invoice.balance_due_cents > 0 &&
      invoice.due_date < today &&
      !["draft", "void", "cancelled", "paid"].includes(invoice.status)
  );

  const { density, setDensity, isCompact } = useTableDensity();
  const invTable = useMemo(() => wideInvoiceTableLayout(isCompact), [isCompact]);

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Platform billing"
        title="Invoices"
        description="Create, send, and track customer invoices. Recurring company pricing is labeled clearly so subscription and licensing charges are easy to audit."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <TableDensityToggle value={density} onChange={setDensity} disabled={loading} />
            <Link
              href="/billing/invoices/new"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-700"
            >
              New invoice
            </Link>
          </div>
        }
      />

      {message ? <InlineMessage tone="error">{message}</InlineMessage> : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Outstanding</div>
          <div className="mt-2 text-2xl font-black text-white">{formatMoney(totalBalanceDue, "usd")}</div>
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
          <p className="text-sm text-slate-400">Loading...</p>
        ) : invoices.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            description="Create a draft with New invoice, then send and track it from the detail view."
            actionHref="/billing/invoices/new"
            actionLabel="New invoice"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className={invTable.table}>
              <thead>
                <tr className="border-b border-slate-700 text-slate-500">
                  <th className={invTable.th}>Number</th>
                  <th className={invTable.th}>Customer</th>
                  <th className={invTable.th}>Billing</th>
                  <th className={invTable.th}>Issue</th>
                  <th className={invTable.th}>Due</th>
                  <th className={invTable.th}>Total</th>
                  <th className={invTable.th}>Balance</th>
                  <th className={invTable.th}>Status</th>
                  <th className={isCompact ? "py-1.5" : "py-2"}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const isOverdue =
                    invoice.balance_due_cents > 0 &&
                    invoice.due_date < today &&
                    !["draft", "void", "cancelled", "paid"].includes(invoice.status);

                  return (
                    <tr key={invoice.id} className="border-b border-slate-800/80">
                      <td className={`${invTable.td} font-mono text-slate-200`}>{invoice.invoice_number}</td>
                      <td className={`${invTable.td} text-slate-300`}>
                        {invoice.billing_customers?.company_name ?? invoice.companies?.name ?? "—"}
                      </td>
                      <td className={invTable.td}>
                        <div className="space-y-1">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              getBillingSourceTone(invoice.billing_source) === "success"
                                ? "app-badge-success"
                                : getBillingSourceTone(invoice.billing_source) === "info"
                                  ? "app-badge-info"
                                  : "app-badge-neutral"
                            }`}
                          >
                            {getBillingSourceLabel(invoice.billing_source)}
                          </span>
                          {formatBillingPeriodLabel(invoice.billing_period_key) ? (
                            <div className="text-xs text-slate-500">
                              {formatBillingPeriodLabel(invoice.billing_period_key)}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className={`${invTable.td} text-slate-400`}>{formatDate(invoice.issue_date)}</td>
                      <td className={`${invTable.td} text-slate-400`}>{formatDate(invoice.due_date)}</td>
                      <td className={`${invTable.td} text-slate-200`}>
                        {formatMoney(invoice.total_cents, invoice.currency)}
                      </td>
                      <td className={`${invTable.td} text-slate-200`}>
                        {formatMoney(invoice.balance_due_cents, invoice.currency)}
                      </td>
                      <td className={invTable.td}>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            getStatusTone(invoice.status) === "success"
                              ? "app-badge-success"
                              : getStatusTone(invoice.status) === "warning"
                                ? "app-badge-warning"
                                : "app-badge-neutral"
                          }`}
                        >
                          {invoice.status}
                        </span>
                        {isOverdue ? (
                          <div className="mt-2 text-xs font-semibold text-amber-200">Overdue</div>
                        ) : null}
                      </td>
                      <td className={isCompact ? "py-2" : "py-3"}>
                        <Link
                          href={`/billing/invoices/${invoice.id}`}
                          className="font-semibold text-sky-400 hover:text-sky-300"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
