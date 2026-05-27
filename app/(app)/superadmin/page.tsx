"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Gauge,
  History,
  LockKeyhole,
  Search,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
  PageHero,
  workspaceSectionEyebrowClassName,
} from "@/components/WorkspacePrimitives";
import {
  getSuperadminMostUsedTools,
  superadminToolGroups,
  type SuperadminNavItem,
} from "@/lib/superadminNavigation";

const mostUsedTools = getSuperadminMostUsedTools();

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function toolMatchesQuery(tool: SuperadminNavItem, query: string) {
  if (!query) return true;
  const haystack = [
    tool.label,
    tool.href,
    tool.short,
    tool.description,
    ...(tool.keywords ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function ToolIcon({ href }: { href: string }) {
  const className = "h-4 w-4";
  const strokeWidth = 2.25;

  if (href === "/superadmin") {
    return <Gauge className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  if (href.includes("system-health")) {
    return <Activity className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  if (href.includes("owner-validation")) {
    return <ClipboardCheck className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  if (href.includes("what-changed")) {
    return <History className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  if (href.includes("cyber-security")) {
    return <LockKeyhole className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  if (href.includes("system-test")) {
    return <ClipboardCheck className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  if (href.includes("ai-engine")) {
    return <BrainCircuit className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  if (href.includes("prediction") || href.includes("injury-weather")) {
    return <BarChart3 className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  if (href.includes("builder") || href.includes("csep-programs")) {
    return <FileText className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  if (href.includes("jurisdiction") || href.includes("osha")) {
    return <ShieldCheck className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  if (href.includes("csep")) {
    return <FileCheck2 className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  return <Settings2 className={className} strokeWidth={strokeWidth} aria-hidden />;
}

function ToolCard({
  tool,
  emphasized = false,
}: {
  tool: SuperadminNavItem;
  emphasized?: boolean;
}) {
  return (
    <Link
      href={tool.href}
      className={cx(
        "group flex h-full min-h-[142px] flex-col justify-between rounded-lg border bg-white p-4 shadow-[0_10px_22px_rgba(44,58,86,0.055)] transition hover:-translate-y-0.5 hover:border-[var(--app-accent-border-24)] hover:shadow-[0_16px_30px_rgba(44,58,86,0.09)]",
        emphasized
          ? "border-[var(--app-accent-border-24)]"
          : "border-[var(--app-border)]"
      )}
    >
      <span className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--app-accent-surface-18)] bg-[var(--app-accent-primary-soft)] text-[var(--app-accent-primary)]">
          <ToolIcon href={tool.href} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-[var(--app-text-strong)]">
            {tool.label}
          </span>
          <span className="mt-1 block text-xs leading-5 text-[var(--app-muted)]">
            {tool.description}
          </span>
        </span>
      </span>
      <span className="mt-4 flex items-center justify-between gap-3">
        <span className="rounded-md border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
          {tool.short}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--app-accent-primary)]">
          {tool.primaryActionLabel}
          <ArrowRight
            className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"
            strokeWidth={2.25}
            aria-hidden
          />
        </span>
      </span>
    </Link>
  );
}

export default function SuperadminHubPage() {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalize(query);

  const visibleGroups = useMemo(() => {
    return superadminToolGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((tool) => toolMatchesQuery(tool, normalizedQuery)),
      }))
      .filter((group) => group.items.length > 0);
  }, [normalizedQuery]);

  const matchCount = visibleGroups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Super Admin"
        title="Superadmin Hub"
        description="Restricted platform operations, diagnostics, builder controls, compliance review, and AI oversight in one place."
        actions={
          <>
            <Link href="/superadmin/system-health" className={appButtonPrimaryClassName}>
              <Activity className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              System Health
            </Link>
            <Link href="/superadmin/ai-engine" className={appButtonSecondaryClassName}>
              <BrainCircuit className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              AI Engine
            </Link>
          </>
        }
      />

      <section className="rounded-lg border border-[var(--app-border)] bg-white p-4 shadow-[0_10px_24px_rgba(44,58,86,0.055)]">
        <label htmlFor="superadmin-tool-search" className="sr-only">
          Search superadmin tools
        </label>
        <div className="flex items-center gap-3 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-panel)] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[var(--app-muted)]" strokeWidth={2.25} aria-hidden />
          <input
            id="superadmin-tool-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search CSEP, OSHA, cyber, prediction, builder, health..."
            className="w-full border-0 bg-transparent text-sm font-semibold text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-muted)]"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--app-muted)]">
          <span>
            {normalizedQuery ? `${matchCount} matching tool${matchCount === 1 ? "" : "s"}` : "All superadmin tools"}
          </span>
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="rounded-md border border-[var(--app-border)] bg-white px-3 py-1.5 font-semibold text-[var(--app-accent-primary)] transition hover:bg-[var(--app-accent-primary-soft)]"
            >
              Clear search
            </button>
          ) : null}
        </div>
      </section>

      {!normalizedQuery ? (
        <section className="space-y-4">
          <div>
            <p className={workspaceSectionEyebrowClassName}>Most Used</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-[var(--app-text-strong)]">
              Quick Actions
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {mostUsedTools.map((tool) => (
              <ToolCard key={tool.href} tool={tool} emphasized />
            ))}
          </div>
        </section>
      ) : null}

      {visibleGroups.length === 0 ? (
        <section className="rounded-lg border border-dashed border-[var(--app-border-strong)] bg-white p-8 text-center">
          <p className="text-sm font-bold text-[var(--app-text-strong)]">No tools found</p>
          <p className="mt-2 text-sm text-[var(--app-muted)]">
            Try searching for health, CSEP, OSHA, cyber, prediction, builder, or AI.
          </p>
        </section>
      ) : (
        <div className="space-y-7">
          {visibleGroups.map((group) => (
            <section key={group.title} className="space-y-4">
              <div className="flex flex-col gap-1">
                <p className={workspaceSectionEyebrowClassName}>{group.title}</p>
                <h2 className="text-lg font-bold tracking-tight text-[var(--app-text-strong)]">
                  {group.description}
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((tool) => (
                  <ToolCard key={tool.href} tool={tool} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
