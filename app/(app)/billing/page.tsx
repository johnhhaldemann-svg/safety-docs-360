"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { PageHero, SectionCard, StatusBadge } from "@/components/WorkspacePrimitives";

const supabase = getSupabaseBrowserClient();

type InvoiceSummary = {
  id: string;
  invoice_number: string;
  status: string;
  total_cents: number;
  balance_due_cents: number;
  due_date: string;
  billing_source?: string | null;
  billing_period_key?: string | null;
};

function formatMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase() === "USD" ? "USD" : currency,
  }).format(cents / 100);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function getStatusTone(status: string): "success" | "warning" | "error" | "neutral" {
  const normalized = status.trim().toLowerCase();
  if (["paid", "sent"].includes(normalized)) return "success";
  if (["overdue", "partial"].includes(normalized)) return "warning";
  if (["void", "cancelled"].includes(normalized)) return "error";
  return "neutral";
}

export default function BillingHubPage() {
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
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

      const res = await fetch("/api/billing/invoices", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => null)) as
        | { invoices?: InvoiceSummary[]; error?: string }
        | null;

      if (!res.ok) {
        setMessage(data?.error || "Failed to load billing data.");
        setInvoices([]);
      } else {
        setInvoices((data?.invoices ?? []).slice(0, 5));
      }

      setLoading(false);
    };

    void load();
  }, []);

  const totals = useMemo(() => {
    const outstanding = invoices.reduce(
      (sum, invoice) => sum + Math.max(0, invoice.balance_due_cents),
      0
    );
    const overdue = invoices.filter(
      (invoice) =>
        invoice.balance_due_cents > 0 &&
        invoice.due_date < new Date().toISOString().slice(0, 10) &&
        !["draft", "void", "cancelled", "paid"].includes(invoice.status.toLowerCase())
    ).length;

    return {
      outstanding,
      overdue,
      total: invoices.length,
    };
  }, [invoices]);

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Platform billing"
        title="Billing hub"
        description="Create invoices, review recurring company billing, manage marketplace credits, and keep receipts and payment links in one place."
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Outstanding</div>
          <div className="mt-2 text-2xl font-black text-white">
            {formatMoney(totals.outstanding)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Open balances across recent invoices</div>
        </div>
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Overdue</div>
          <div className="mt-2 text-2xl font-black text-amber-200">{totals.overdue}</div>
          <div className="mt-1 text-xs text-slate-500">Invoices past their due date</div>
        </div>
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Recent invoices</div>
          <div className="mt-2 text-2xl font-black text-white">{totals.total}</div>
          <div className="mt-1 text-xs text-slate-500">Latest billing records loaded here</div>
        </div>
      </section>

      {message ? <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 text-sm text-slate-300">{message}</div> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Quick actions"
          description="The main billing tasks most teams need during launch."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/billing/invoices/new"
              className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-4 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/15"
            >
              New invoice
              <span className="mt-1 block text-xs font-normal text-slate-400">
                Create a draft, then send or add a payment link.
              </span>
            </Link>
            <Link
              href="/billing/invoices"
              className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4 text-sm font-semibold text-slate-100 transition hover:bg-slate-900/90"
            >
              Invoice list
              <span className="mt-1 block text-xs font-normal text-slate-400">
                Review totals, payment status, and billing source.
              </span>
            </Link>
            <Link
              href="/purchases"
              className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-4 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/15"
            >
              Marketplace credits
              <span className="mt-1 block text-xs font-normal text-slate-400">
                Buy credits and inspect unlocked documents.
              </span>
            </Link>
            <Link
              href="/customer/billing"
              className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4 text-sm font-semibold text-slate-100 transition hover:bg-slate-900/90"
            >
              Customer billing view
              <span className="mt-1 block text-xs font-normal text-slate-400">
                See the customer-facing invoice experience.
              </span>
            </Link>
          </div>
        </SectionCard>

        <SectionCard
          title="Billing workflow"
          description="This is the launch-ready path we now support end to end."
        >
          <div className="space-y-3">
            {[
              {
                title: "Create draft",
                body: "Build a one-off invoice or company pricing draft.",
              },
              {
                title: "Send or share payment link",
                body: "Use email, Stripe checkout, or manual mark-paid when needed.",
              },
              {
                title: "Receive payment",
                body: "Stripe webhook reconciliation updates the invoice and company balance.",
              },
              {
                title: "Audit and receipt",
                body: "Receipts, resend actions, and billing events stay visible for support.",
              },
            ].map((step, index) => (
              <div
                key={step.title}
                className="flex items-start gap-4 rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sm font-bold text-sky-200">
                  {index + 1}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-100">{step.title}</div>
                  <div className="mt-1 text-sm text-slate-500">{step.body}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>

      <SectionCard
        title="Recent invoices"
        description="A quick scan of the latest billing records."
        aside={
          <Link
            href="/billing/invoices"
            className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
          >
            View all
          </Link>
        }
      >
        {loading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : invoices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-950/40 p-6 text-sm text-slate-500">
            No billing records loaded yet.
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-100">
                      {invoice.invoice_number}
                    </span>
                    <StatusBadge label={invoice.status} tone={getStatusTone(invoice.status)} />
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Due {formatDate(invoice.due_date)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-100">
                    {formatMoney(invoice.balance_due_cents)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {invoice.billing_source || "Manual invoice"}
                    {invoice.billing_period_key ? ` · ${invoice.billing_period_key}` : ""}
                  </div>
                  <Link href={`/billing/invoices/${invoice.id}`} className="mt-2 inline-block text-sm text-sky-400">
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
