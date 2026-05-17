"use client";

import Link from "next/link";
import { PageHero, SectionCard } from "@/components/WorkspacePrimitives";

export default function PurchasesPage() {
  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Billing"
        title="Purchases"
        description="Marketplace purchases are now handled through invoice billing."
        actions={
          <Link
            href="/billing/invoices"
            className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            Open invoices
          </Link>
        }
      />

      <SectionCard
        title="Invoice-backed purchases"
        description="Credits have been retired. Use draft invoices, sent invoices, and payment links for customer purchases."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/billing/invoices/new"
            className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-4 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/15"
          >
            Create invoice
            <span className="mt-1 block text-xs font-normal text-slate-400">
              Build a draft invoice for review before sending.
            </span>
          </Link>
          <Link
            href="/customer/billing"
            className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4 text-sm font-semibold text-slate-100 transition hover:bg-slate-900/90"
          >
            Customer billing
            <span className="mt-1 block text-xs font-normal text-slate-400">
              Review the customer-facing billing and payment experience.
            </span>
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
