"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InlineMessage, PageHero, SectionCard } from "@/components/WorkspacePrimitives";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type CustomerRow = { id: string; company_id: string; company_name: string; billing_email: string };

type InvoiceLineDraft = {
  description: string;
  quantity: string;
  unit_price_cents: string;
};

export default function NewInvoicePage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [taxBps, setTaxBps] = useState("0");
  const [discountCents, setDiscountCents] = useState("0");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("Net 30");
  const [lines, setLines] = useState<InvoiceLineDraft[]>([
    { description: "", quantity: "1", unit_price_cents: "0" },
  ]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [creatingCompanyDraft, setCreatingCompanyDraft] = useState(false);

  const loadCustomers = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    const res = await fetch("/api/billing/customers", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => null)) as { customers?: CustomerRow[] } | null;
    if (res.ok) {
      setCustomers(data?.customers ?? []);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadCustomers();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadCustomers]);

  const selectedCustomer = useMemo(
    () => customers.find((item) => item.id === customerId) ?? null,
    [customerId, customers]
  );

  async function submitInvoice(target: "draft" | "company") {
    const isCompanyDraft = target === "company";
    setSaving(isCompanyDraft ? false : true);
    setCreatingCompanyDraft(isCompanyDraft);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setMessage("Sign in required.");
        return;
      }

      const line_items = lines
        .map((row) => ({
          description: row.description.trim(),
          quantity: Number(row.quantity) || 1,
          unit_price_cents: Math.max(0, Math.floor(Number(row.unit_price_cents) || 0)),
          item_type: "custom" as const,
        }))
        .filter((row) => row.description.length > 0);

      const endpoint = target === "company" ? "/api/billing/company-invoices" : "/api/billing/invoices";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: customerId,
          company_id: selectedCustomer?.company_id ?? "",
          status: "draft",
          issue_date: issueDate,
          due_date: dueDate,
          tax_rate_bps: Math.max(0, Math.floor(Number(taxBps) || 0)),
          discount_cents: Math.max(0, Math.floor(Number(discountCents) || 0)),
          notes: notes.trim() || null,
          terms: terms.trim() || null,
          line_items,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { error?: string; invoice?: { id?: string } }
        | null;

      if (!res.ok) {
        setMessage(data?.error || "Save failed.");
        return;
      }

      if (data?.invoice?.id) {
        router.push(`/billing/invoices/${data.invoice.id}`);
      }
    } finally {
      setSaving(false);
      setCreatingCompanyDraft(false);
    }
  }

  const canCreateCompanyDraft = Boolean(selectedCustomer?.company_id);

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Platform billing"
        title="New invoice"
        description="Create a draft invoice here, then send it, add a payment link, or mark it paid from the invoice detail page."
        actions={
          <Link
            href="/billing/invoices"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-950/50"
          >
            Back to list
          </Link>
        }
      />

      {message ? <InlineMessage tone="error">{message}</InlineMessage> : null}

      <SectionCard
        title="Invoice"
        description="Choose a billing customer, add line items, and save the draft for review."
        aside={
          selectedCustomer ? (
            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-3 text-xs text-slate-400">
              <div className="font-semibold text-slate-200">{selectedCustomer.company_name}</div>
              <div>{selectedCustomer.billing_email}</div>
            </div>
          ) : null
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="bill-customer" className="text-sm font-semibold text-slate-300">
              Billing customer
            </label>
            <select
              id="bill-customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-sm text-slate-200"
            >
              <option value="">Select...</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.company_name} - {customer.billing_email}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              If this customer belongs to a company, company pricing drafts are available here too.
            </p>
          </div>

          <div>
            <label htmlFor="bill-issue" className="text-sm font-semibold text-slate-300">
              Issue date
            </label>
            <input
              id="bill-issue"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-sm text-slate-200"
            />
          </div>

          <div>
            <label htmlFor="bill-due" className="text-sm font-semibold text-slate-300">
              Due date
            </label>
            <input
              id="bill-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-sm text-slate-200"
            />
          </div>

          <div>
            <label htmlFor="bill-tax" className="text-sm font-semibold text-slate-300">
              Tax (basis points, e.g. 825 = 8.25%)
            </label>
            <input
              id="bill-tax"
              type="number"
              min={0}
              value={taxBps}
              onChange={(e) => setTaxBps(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-sm text-slate-200"
            />
          </div>

          <div>
            <label htmlFor="bill-discount" className="text-sm font-semibold text-slate-300">
              Discount (cents)
            </label>
            <input
              id="bill-discount"
              type="number"
              min={0}
              value={discountCents}
              onChange={(e) => setDiscountCents(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-sm text-slate-200"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="bill-notes" className="text-sm font-semibold text-slate-300">
              Notes
            </label>
            <textarea
              id="bill-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-sm text-slate-200"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="bill-terms" className="text-sm font-semibold text-slate-300">
              Terms
            </label>
            <input
              id="bill-terms"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-sm text-slate-200"
            />
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <div className="text-sm font-semibold text-slate-200">Line items</div>
          {lines.map((row, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-xl border border-slate-700/80 p-3 md:grid-cols-12"
            >
              <input
                placeholder="Description"
                value={row.description}
                onChange={(e) => {
                  const next = [...lines];
                  next[index] = { ...next[index], description: e.target.value };
                  setLines(next);
                }}
                className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-200 md:col-span-5"
              />
              <input
                type="number"
                placeholder="Qty"
                value={row.quantity}
                onChange={(e) => {
                  const next = [...lines];
                  next[index] = { ...next[index], quantity: e.target.value };
                  setLines(next);
                }}
                className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-200 md:col-span-2"
              />
              <input
                type="number"
                placeholder="Unit (cents)"
                value={row.unit_price_cents}
                onChange={(e) => {
                  const next = [...lines];
                  next[index] = { ...next[index], unit_price_cents: e.target.value };
                  setLines(next);
                }}
                className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-200 md:col-span-3"
              />
              <button
                type="button"
                className="rounded-lg border border-slate-600 text-sm text-slate-400 hover:bg-slate-900 md:col-span-2"
                onClick={() => setLines(lines.filter((_, lineIndex) => lineIndex !== index))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            onClick={() =>
              setLines([...lines, { description: "", quantity: "1", unit_price_cents: "0" }])
            }
          >
            Add line
          </button>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={saving || !customerId}
            onClick={() => void submitInvoice("draft")}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save draft"}
          </button>
          <button
            type="button"
            disabled={creatingCompanyDraft || !customerId || !canCreateCompanyDraft}
            onClick={() => void submitInvoice("company")}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-400/60 px-5 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-950/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creatingCompanyDraft ? "Creating..." : "Generate company billing draft"}
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Company billing drafts pull in the selected workspace&apos;s subscription and seat pricing
          automatically. You can still add manual line items on top.
        </p>
      </SectionCard>
    </div>
  );
}
