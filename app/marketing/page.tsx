import Link from "next/link";

const featureCards = [
  {
    title: "Centralized Document Control",
    body: "Keep uploads, reviews, approvals, and completed deliverables in one clean operating system.",
  },
  {
    title: "Built for Safety Workflows",
    body: "Support PESHEP, CSEP, compliance records, admin review, and credit-based access without stitching tools together.",
  },
  {
    title: "Audit-Ready Visibility",
    body: "Track status, approvals, transactions, and agreement acceptance with clearer operational history.",
  },
];

const roleBenefits = [
  {
    role: "Operations Leaders",
    text: "See what is waiting, what is approved, and what teams need next without digging through email chains.",
  },
  {
    role: "Safety Teams",
    text: "Generate plans, manage reviews, and keep project documents consistent across active jobsites.",
  },
  {
    role: "Admins",
    text: "Control approvals, archives, users, agreements, and marketplace credit activity from one workspace.",
  },
];

export default function MarketingPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#f8fbff_0%,_#eef4ff_100%)] text-slate-900">
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white/90 px-6 py-4 shadow-sm backdrop-blur">
          <div>
            <div className="text-2xl font-black tracking-tight">Safety360Docs</div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Enterprise Safety Management Platform
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/marketing"
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Platform
            </Link>
            <Link
              href="/login"
              className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Login
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 pb-10 pt-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <div className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-700">
            Secure Safety Operations
          </div>
          <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">
            Run project safety documents like an actual system, not a folder dump.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
            Safety360Docs brings uploads, reviews, approvals, builders, compliance records,
            and completed deliverables into one professional workspace built for active projects.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-[linear-gradient(135deg,_#0ea5e9_0%,_#2563eb_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(37,99,235,0.2)]"
            >
              Open Workspace
            </Link>
            <Link
              href="/marketing#features"
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700"
            >
              View Features
            </Link>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ["Upload", "Capture source files and metadata"],
              ["Review", "Route requests through approval"],
              ["Library", "Open completed documents quickly"],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-lg font-bold text-slate-900">{title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">{body}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-800 bg-[linear-gradient(180deg,_#10213f_0%,_#13284b_100%)] p-8 text-white shadow-[0_20px_40px_rgba(15,23,42,0.22)]">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200">
            What Buyers Need To Hear
          </div>
          <div className="mt-4 text-3xl font-black tracking-tight">
            Professional control for safety documentation at scale.
          </div>
          <div className="mt-6 space-y-4">
            {[
              "Replace scattered folders and one-off templates with a workflow teams can actually follow.",
              "Give admins cleaner approval visibility and users a clearer path from submission to final file.",
              "Present a more enterprise-ready platform when clients, partners, or auditors need confidence fast.",
            ].map((line) => (
              <div key={line} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-6 text-slate-200">
                {line}
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-4 text-sm leading-6 text-emerald-100">
            Demo path: Upload {"->"} Submit {"->"} Review {"->"} Library. That workflow is now reflected directly in the product experience.
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {featureCards.map((feature) => (
            <div key={feature.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-xl font-bold text-slate-900">{feature.title}</div>
              <p className="mt-3 text-sm leading-7 text-slate-600">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
            Benefits By Role
          </div>
          <div className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            One platform, clearer outcomes for every team touching the process.
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {roleBenefits.map((item) => (
              <div key={item.role} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="text-lg font-bold text-slate-900">{item.role}</div>
                <div className="mt-3 text-sm leading-7 text-slate-600">{item.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-[2rem] bg-[linear-gradient(135deg,_#0f172a_0%,_#1d4ed8_100%)] px-8 py-10 text-white shadow-[0_20px_40px_rgba(15,23,42,0.24)]">
          <div className="text-3xl font-black tracking-tight">
            Want this to sell better?
          </div>
          <div className="mt-3 max-w-3xl text-sm leading-7 text-sky-100">
            Use this page as your platform overview, then point users into the live workspace, demo screenshots, and role-specific benefits.
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900"
            >
              Login
            </Link>
            <Link
              href="mailto:john.h.haldemann@gmail.com"
              className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white"
            >
              Contact for Demo
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
