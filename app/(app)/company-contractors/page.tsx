"use client";

import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useEffect, useState } from "react";
import { EmptyState, InlineMessage, PageHero, SectionCard } from "@/components/WorkspacePrimitives";

const supabase = getSupabaseBrowserClient();

type Row = { id: string; name: string };

export default function CompanyContractorsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Not signed in.");
        const res = await fetch("/api/company/contractors", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = (await res.json().catch(() => null)) as { contractors?: Row[]; error?: string } | null;
        if (!res.ok) throw new Error(data?.error || "Failed to load.");
        setRows(data?.contractors ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed.");
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Company workspace"
        title="Contractor compliance"
        description="Open a subcontractor to manage COI, licenses, expirations, and prequal evaluations."
      />
      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
      <SectionCard title="Active contractors">
        {loading ? (
          <InlineMessage>Loading…</InlineMessage>
        ) : rows.length === 0 ? (
          <EmptyState title="No contractors" description="Add contractors from team workflows or the API." />
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/company-contractors/${encodeURIComponent(r.id)}`}
                  className="text-sm font-semibold text-sky-400 hover:underline"
                >
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
