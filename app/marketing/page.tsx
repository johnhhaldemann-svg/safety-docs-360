import Link from "next/link";

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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(13,148,136,0.12),_transparent_35%),linear-gradient(180deg,_#121926_0%,_#0c1730_100%)] text-slate-100">
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-700/80 bg-slate-900/85 px-6 py-4 shadow-lg backdrop-blur">
          <div>
            <div className="text-2xl font-black tracking-tight">Safety360Docs</div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Enterprise Safety Management Platform
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/#platform"
              className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300"
            >
              Platform
            </Link>
            <Link
              href="/#workflow"
              className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300"
            >
              Workflow
            </Link>
            <Link
              href="/login"
              className="rounded-xl bg-[linear-gradient(135deg,_#0d9488_0%,_#059669_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(13,148,136,0.25)]"
            >
              Login
            </Link>
          </div>
        </div>
      </section>

      <section
        id="platform"
        className="mx-auto grid max-w-7xl gap-8 px-6 pb-10 pt-6 xl:grid-cols-[1.05fr_0.95fr]"
      >
        <div className="rounded-[2.2rem] border border-slate-700/80 bg-slate-900/90 p-8 shadow-[0_20px_40px_rgba(148,163,184,0.14)] sm:p-10">
          <div className="inline-flex rounded-full border border-sky-500/35 bg-sky-950/35 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">
            Secure Safety Operations
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight text-white sm:text-6xl">
            Turn safety documents into a managed workflow, not a folder problem.
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-slate-400">
            Safety360Docs brings uploads, reviews, approvals, builders, compliance
            records, admin oversight, and completed deliverables into one clean
            workspace built for active projects and growing teams.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-[linear-gradient(135deg,_#0d9488_0%,_#059669_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(13,148,136,0.28)]"
            >
              Open Workspace
            </Link>
            <Link
              href="mailto:john.h.haldemann@gmail.com"
              className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300"
            >
              Book a Demo
            </Link>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ["Upload", "Capture source files and project metadata"],
              ["Review", "Route work through controlled approvals"],
              ["Library", "Open completed documents from one place"],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                <div className="text-lg font-bold text-slate-100">{title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">{body}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2.2rem] border border-slate-800 bg-[linear-gradient(180deg,_#0f1f3b_0%,_#152e54_100%)] p-6 text-white shadow-[0_22px_48px_rgba(15,23,42,0.24)] sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-200">
                Product Snapshot
              </div>
              <div className="mt-3 text-3xl font-black tracking-tight">
                Professional control for safety documentation at scale.
              </div>
            </div>
            <div className="rounded-full border border-emerald-400/25 bg-emerald-950/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
              Systems Live
            </div>
          </div>

          <div className="mt-8 rounded-[1.8rem] border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Admin View
                </div>
                <div className="mt-2 text-2xl font-black">Today&apos;s Operations</div>
              </div>
              <div className="rounded-full bg-sky-400/15 px-3 py-1 text-xs font-semibold text-sky-200">
                Live Workspace
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <MockStat label="Pending Reviews" value="12" note="Need admin action" />
              <MockStat label="Pending Access" value="4" note="Waiting approval" />
              <MockStat label="Approved Files" value="38" note="Ready in library" />
              <MockStat label="Active Projects" value="17" note="Current workspace" />
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-[#0d1830] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">Admin Queues</div>
                <div className="text-xs text-slate-300">Review and access</div>
              </div>
              <div className="mt-4 space-y-3">
                {proofTiles.map((tile, index) => (
                  <div
                    key={tile}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-400/15 text-xs font-black text-sky-200">
                      {index + 1}
                    </div>
                    <div className="text-sm text-slate-100">{tile}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-[2rem] border border-slate-700/80 bg-slate-900/90 p-8 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
            Core Workflow
          </div>
          <div className="mt-3 text-3xl font-black tracking-tight text-white">
            One clear route from source file to approved document.
          </div>
          <div className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">
            The strongest part of the product story is the workflow itself. Show teams
            exactly how documents move, who approves them, and where completed files
            live when the job is done.
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-4">
            {workflowSteps.map((step, index) => (
              <div key={step.title} className="rounded-3xl border border-slate-700/80 bg-slate-950/50 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Step {index + 1}
                </div>
                <div className="mt-3 text-xl font-bold text-slate-100">{step.title}</div>
                <div className="mt-3 text-sm leading-7 text-slate-400">{step.body}</div>
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
              className="rounded-3xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm"
            >
              <div className="text-xl font-bold text-slate-100">{feature.title}</div>
              <p className="mt-3 text-sm leading-7 text-slate-400">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2rem] border border-slate-700/80 bg-slate-900/90 p-8 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
              Benefits By Role
            </div>
            <div className="mt-3 text-3xl font-black tracking-tight text-white">
              One platform, clearer outcomes for every team touching the process.
            </div>
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {roleBenefits.map((item) => (
                <div
                  key={item.role}
                  className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-5"
                >
                  <div className="text-lg font-bold text-slate-100">{item.role}</div>
                  <div className="mt-3 text-sm leading-7 text-slate-400">{item.text}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-700/80 bg-slate-950/60 p-8 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-300">
              Why It Wins
            </div>
            <div className="mt-3 text-3xl font-black tracking-tight text-white">
              Better than shared drives, disconnected builders, and scattered approvals.
            </div>
            <div className="mt-6 space-y-4">
              {[
                "Replace scattered folders and one-off templates with a workflow teams can actually follow.",
                "Give admins cleaner approval visibility and users a clearer path from submission to final file.",
                "Present a more enterprise-ready platform when clients, partners, or auditors need confidence fast.",
                "Control who gets in with approval-gated access instead of giving the full app to every signup automatically.",
              ].map((line) => (
                <div
                  key={line}
                  className="rounded-2xl border border-slate-700/80 bg-slate-900/90 px-4 py-4 text-sm leading-7 text-slate-400"
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8 pb-12">
        <div className="rounded-[2rem] bg-[linear-gradient(135deg,_#10213f_0%,_#0d9488_55%,_#059669_100%)] px-8 py-10 text-white shadow-[0_20px_40px_rgba(15,23,42,0.35)]">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="text-3xl font-black tracking-tight">
                Systems live. Secure. Document. Stay Safe.
              </div>
              <div className="mt-3 max-w-3xl text-sm leading-7 text-sky-100">
                Use this page as your platform overview, then guide prospects into a
                live demo, role-based benefits, and the actual workspace flow.
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/login"
                className="rounded-xl bg-slate-900/90 px-5 py-3 text-center text-sm font-semibold text-slate-100"
              >
                Open Workspace
              </Link>
              <Link
                href="mailto:john.h.haldemann@gmail.com"
                className="rounded-xl border border-white/20 px-5 py-3 text-center text-sm font-semibold text-white"
              >
                Contact For Demo
              </Link>
            </div>
          </div>
        </div>
      </section>
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
    <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
        {label}
      </div>
      <div className="mt-3 text-3xl font-black text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-300">{note}</div>
    </div>
  );
}
