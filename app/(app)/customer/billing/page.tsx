"use client";

import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TableDensityToggle } from "@/components/app-shell/TableDensityToggle";
import { useTableDensity } from "@/hooks/useTableDensity";
import { listSectionDensity } from "@/lib/tableDensityLayout";
import { EmptyState, InlineMessage, PageHero, SectionCard } from "@/components/WorkspacePrimitives";
import {
  formatBillingPeriodLabel,
  getBillingSourceLabel,
  getBillingSourceTone,
} from "@/lib/billing/invoicePresentation";

const supabase = getSupabaseBrowserClient();

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

  const today = new Date().toISOString().slice(0, 10);
  const totalBalanceDue = useMemo(
    () => invoices.reduce((sum, invoice) => sum + Math.max(0, invoice.balance_due_cents), 0),
    [invoices]
  );
  const overdueInvoices = useMemo(
    () =>
      invoices.filter(
        (invoice) =>
          invoice.balance_due_cents > 0 &&
          invoice.due_date < today &&
          !["draft", "void", "cancelled", "paid"].includes(invoice.status)
      ),
    [invoices, today]
  );

  const { density, setDensity, isCompact } = useTableDensity();
  const listD = useMemo(() => listSectionDensity(isCompact), [isCompact]);

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Your company"
        title="Billing"
        description="Invoices issued to your organization. Subscription and licensing charges are labeled so you can spot recurring company pricing quickly."
        actions={<TableDensityToggle value={density} onChange={setDensity} disabled={loading} />}
      />

      {message ? <InlineMessage tone="error">{message}</InlineMessage> : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Balance due</div>
          <div className="mt-2 text-2xl font-black text-white">{formatMoney(totalBalanceDue, "usd")}</div>
        </div>
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Overdue</div>
          <div className="mt-2 text-2xl font-black text-amber-200">{overdueInvoices.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Invoices</div>
          <div className="mt-2 text-2xl font-black text-white">{invoices.length}</div>
        </div>
      </section>

      <SectionCard title="Invoices" description="">
        {loading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : invoices.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            description="When your organization has invoices, they will appear here with status and balance."
            align="left"
            className="!p-6"
          />
        ) : (
          <ul className={listD.stackGap}>
            {invoices.map((invoice) => {
              const isOverdue =
                invoice.balance_due_cents > 0 &&
                invoice.due_date < today &&
                !["draft", "void", "cancelled", "paid"].includes(invoice.status);

              return (
                <li
                  key={invoice.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/80 ${
                    isCompact ? "px-3 py-2.5" : "px-4 py-3"
                  }`}
                >
                  <div className="space-y-1">
                    <div
                      className={`font-mono font-semibold text-white ${isCompact ? "text-xs" : "text-sm"}`}
                    >
                      {invoice.invoice_number}
                    </div>
                    <div
                      className={`text-slate-500 ${isCompact ? "text-[11px]" : "text-xs"}`}
                    >
                      Issued {formatDate(invoice.issue_date)} · Due {formatDate(invoice.due_date)}
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
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
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
                        <span className="app-badge-warning inline-flex rounded-full px-2 py-1 text-[11px] font-semibold">
                          Overdue
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-semibold text-slate-200 ${isCompact ? "text-xs" : "text-sm"}`}
                    >
                      {formatMoney(invoice.total_cents, invoice.currency)}
                    </div>
                    <div className={`text-amber-200/90 ${isCompact ? "text-[11px]" : "text-xs"}`}>
                      Balance {formatMoney(invoice.balance_due_cents, invoice.currency)}
                    </div>
                    <Link
                      href={`/customer/billing/invoices/${invoice.id}`}
                      className={isCompact ? "text-xs text-sky-400" : "text-sm text-sky-400"}
                    >
                      View
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
