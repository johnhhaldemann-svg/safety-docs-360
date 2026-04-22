import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

const featureCards = [
  {
    title: "Centralized Document Control",
    body: "Keep uploads, reviews, approvals, completed deliverables, and account access in one operating system.",
  },
  {
    title: "Built for Safety Workflows",
    body: "Support PESHEP, CSEP, compliance records, admin review, and approval-gated access without stitching tools together.",
  },
  {
    title: "Audit-Ready Visibility",
    body: "Track status, approvals, archived records, transactions, agreement acceptance, and user access activity with a clear trail.",
  },
];

const roleBenefits = [
  {
    role: "Operations Leaders",
    text: "See what is waiting, what is approved, and what teams need next without digging through email chains or shared folders.",
  },
  {
    role: "Safety Teams",
    text: "Generate plans, manage reviews, and keep project documents consistent across active jobsites and repeatable workflows.",
  },
  {
    role: "Admins",
    text: "Control approvals, archives, user access, agreements, and marketplace credit activity from one professional workspace.",
  },
];

const workflowSteps = [
  {
    title: "Upload",
    body: "Bring source files, templates, forms, and supporting jobsite records into the workspace.",
  },
  {
    title: "Submit",
    body: "Route requests and documents into a clear admin review workflow.",
  },
  {
    title: "Review",
    body: "Approve drafts, finalize files, and control account access with a true admin queue.",
  },
  {
    title: "Library",
    body: "Deliver completed documents from one searchable place your team can actually use.",
  },
];

const proofTiles = [
  "Approval-gated user access",
  "Document review queue",
  "Library-ready completed files",
  "Agreement and transaction audit trails",
];

export default function MarketingPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(79,125,243,0.14),_transparent_28%),linear-gradient(180deg,_#f7fbff_0%,_#eef5ff_46%,_#e7f0fb_100%)] text-[var(--app-text)]">
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="app-surface-shell app-radius-panel flex flex-wrap items-center justify-between gap-4 bg-[linear-gradient(180deg,_rgba(255,255,255,0.94)_0%,_rgba(241,247,255,0.92)_100%)] px-6 py-4 shadow-[0_16px_36px_rgba(38,64,106,0.12)] backdrop-blur">
          <BrandLogo className="h-[4.9rem] w-[23rem] max-w-full" imageClassName="p-0" />
          <div className="flex flex-wrap gap-3">
            <Link href="/#platform" className="app-btn-secondary px-4 py-2.5 text-sm transition">
              Platform
            </Link>
            <Link href="/#workflow" className="app-btn-secondary px-4 py-2.5 text-sm transition">
              Workflow
            </Link>
            <Link href="/login" className="app-btn-primary px-4 py-2.5 text-sm app-shadow-action transition">
              Login
            </Link>
          </div>
        </div>
      </section>

      <section
        id="platform"
        className="mx-auto grid max-w-7xl gap-8 px-6 pb-10 pt-6 xl:grid-cols-[1.05fr_0.95fr]"
      >
        <div className="app-surface-shell app-radius-panel p-8 shadow-[0_20px_40px_rgba(38,64,106,0.1)] sm:p-10">
          <div className="inline-flex rounded-full border border-[rgba(79,125,243,0.22)] bg-[rgba(234,241,255,0.9)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--app-accent-primary)]">
            Secure Safety Operations
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight text-[var(--app-text-strong)] sm:text-6xl">
            Turn safety documents into a managed workflow, not a folder problem.
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-[var(--app-text)]">
            Safety360Docs brings uploads, reviews, approvals, builders, compliance
            records, admin oversight, and completed deliverables into one clean
            workspace built for active projects and growing teams.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="app-btn-primary px-5 py-3 text-sm app-shadow-action-strong transition">
              Open Workspace
            </Link>
            <Link href="mailto:john.h.haldemann@gmail.com" className="app-btn-secondary px-5 py-3 text-sm transition">
              Book a Demo
            </Link>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ["Upload", "Capture source files and project metadata"],
              ["Review", "Route work through controlled approvals"],
              ["Library", "Open completed documents from one place"],
            ].map(([title, body]) => (
              <div
                key={title}
                className="app-surface-card rounded-2xl p-4"
              >
                <div className="text-lg font-bold text-[var(--app-text-strong)]">{title}</div>
                <div className="mt-2 text-sm leading-6 text-[var(--app-text)]">{body}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="app-surface-shell-accent app-radius-panel p-6 text-[var(--app-text-strong)] shadow-[0_22px_48px_rgba(38,64,106,0.12)] sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--app-accent-primary)]">
                Product Snapshot
              </div>
              <div className="mt-3 text-3xl font-black tracking-tight text-[var(--app-text-strong)]">
                Professional control for safety documentation at scale.
              </div>
            </div>
            <div className="rounded-full border border-[rgba(46,158,91,0.2)] bg-[rgba(231,246,236,0.96)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#2e9e5b]">
              Systems Live
            </div>
          </div>

          <div className="app-surface-card app-radius-card mt-8 bg-white/82 p-5 shadow-[0_12px_28px_rgba(38,64,106,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">
                  Admin View
                </div>
                <div className="mt-2 text-2xl font-black text-[var(--app-text-strong)]">
                  {"Today's Operations"}
                </div>
              </div>
              <div className="rounded-full bg-[rgba(79,125,243,0.12)] px-3 py-1 text-xs font-semibold text-[var(--app-accent-primary)]">
                Live Workspace
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <MockStat label="Pending Reviews" value="12" note="Need admin action" />
              <MockStat label="Pending Access" value="4" note="Waiting approval" />
              <MockStat label="Approved Files" value="38" note="Ready in library" />
              <MockStat label="Active Projects" value="17" note="Current workspace" />
            </div>

            <div className="mt-5 rounded-2xl border border-[rgba(111,138,177,0.22)] bg-[rgba(234,241,255,0.9)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-[var(--app-text-strong)]">Admin Queues</div>
                <div className="text-xs text-[var(--app-muted)]">Review and access</div>
              </div>
              <div className="mt-4 space-y-3">
                {proofTiles.map((tile, index) => (
                  <div
                    key={tile}
                  className="app-surface-card flex items-center gap-3 rounded-2xl border-[rgba(111,138,177,0.18)] px-3 py-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(79,125,243,0.12)] text-xs font-black text-[var(--app-accent-primary)]">
                      {index + 1}
                    </div>
                    <div className="text-sm text-[var(--app-text-strong)]">{tile}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-7xl px-6 py-8">
        <div className="app-surface-shell app-radius-panel p-8">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--app-accent-primary)]">
            Core Workflow
          </div>
          <div className="mt-3 text-3xl font-black tracking-tight text-[var(--app-text-strong)]">
            One clear route from source file to approved document.
          </div>
          <div className="mt-4 max-w-3xl text-sm leading-7 text-[var(--app-text)]">
            The strongest part of the product story is the workflow itself. Show teams
            exactly how documents move, who approves them, and where completed files
            live when the job is done.
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-4">
            {workflowSteps.map((step, index) => (
              <div
                key={step.title}
                className="app-surface-card rounded-3xl p-5"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-muted)]">
                  Step {index + 1}
                </div>
                <div className="mt-3 text-xl font-bold text-[var(--app-text-strong)]">{step.title}</div>
                <div className="mt-3 text-sm leading-7 text-[var(--app-text)]">{step.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {featureCards.map((feature) => (
            <div
              key={feature.title}
              className="app-surface-shell rounded-3xl p-6 shadow-[0_10px_22px_rgba(38,64,106,0.08)]"
            >
              <div className="text-xl font-bold text-[var(--app-text-strong)]">{feature.title}</div>
              <p className="mt-3 text-sm leading-7 text-[var(--app-text)]">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="app-surface-shell app-radius-panel p-8 shadow-[0_10px_22px_rgba(38,64,106,0.08)]">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--app-accent-primary)]">
              Benefits by Role
            </div>
            <div className="mt-3 text-3xl font-black tracking-tight text-[var(--app-text-strong)]">
              One platform, clearer outcomes for every team touching the process.
            </div>
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {roleBenefits.map((item) => (
                <div
                  key={item.role}
                  className="app-surface-card rounded-2xl p-5"
                >
                  <div className="text-lg font-bold text-[var(--app-text-strong)]">{item.role}</div>
                  <div className="mt-3 text-sm leading-7 text-[var(--app-text)]">{item.text}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="app-surface-shell-accent app-radius-panel p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--app-accent-primary)]">
              Why It Wins
            </div>
            <div className="mt-3 text-3xl font-black tracking-tight text-[var(--app-text-strong)]">
              Better than shared drives, disconnected builders, and scattered approvals.
            </div>
            <div className="mt-6 space-y-4">
              {[
                "Replace scattered folders and one-off templates with a workflow teams can actually follow.",
                "Give admins cleaner approval visibility and users a clearer path from submission to final file.",
                "Present a more enterprise-ready platform when clients, partners, or auditors need confidence fast.",
                "Control who gets in with approval-gated access instead of giving the full app to every new user automatically.",
              ].map((line) => (
                <div
                  key={line}
                  className="app-surface-card rounded-2xl bg-white/88 px-4 py-4 text-sm leading-7 text-[var(--app-text)]"
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8 pb-12">
        <div className="app-radius-panel bg-[linear-gradient(135deg,_#1e3a8a_0%,_#1d4ed8_52%,_#2563eb_100%)] px-8 py-10 text-white app-shadow-brand">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="text-3xl font-black tracking-tight">
                Systems live. Secure. Document. Stay Safe.
              </div>
              <div className="mt-3 max-w-3xl text-sm leading-7 text-white/95">
                Use this page as your platform overview, then guide prospects into a
                live demo, role-based benefits, and the actual workspace flow.
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/login"
                className="rounded-xl bg-[rgba(20,50,82,0.92)] px-5 py-3 text-center text-sm font-semibold text-white"
              >
                Open Workspace
              </Link>
              <Link
                href="mailto:john.h.haldemann@gmail.com"
                className="rounded-xl border border-white/20 px-5 py-3 text-center text-sm font-semibold text-white"
              >
                Contact for a Demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-7xl px-6 pb-10">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-[rgba(111,138,177,0.2)] pt-6 text-xs text-[#475569]">
          <Link href="/terms" className="font-semibold text-[var(--app-muted)] hover:text-[var(--app-text-strong)]">
            Terms
          </Link>
          <Link href="/privacy" className="font-semibold text-[var(--app-muted)] hover:text-[var(--app-text-strong)]">
            Privacy
          </Link>
        </div>
      </footer>
    </main>
  );
}

function MockStat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="app-surface-card rounded-2xl border-[rgba(111,138,177,0.18)] bg-white/88 p-4 shadow-[0_8px_20px_rgba(38,64,106,0.06)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--app-muted)]">
        {label}
      </div>
      <div className="mt-3 text-3xl font-black text-[var(--app-text-strong)]">{value}</div>
      <div className="mt-2 text-sm text-[var(--app-text)]">{note}</div>
    </div>
  );
}
