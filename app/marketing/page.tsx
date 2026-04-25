import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

const commandSignals = [
  ["Risk Memory", "Current risk band, top scopes, and repeated hazard signals."],
  ["Open Work", "Issues, incidents, permits, JSAs, and reports that need attention."],
  ["Recommended Actions", "Company-scoped next steps generated from live safety context."],
  ["Company Knowledge", "Reusable procedures and site rules kept close to the workflow."],
];

const adoptionPath = [
  {
    title: "Request the company workspace",
    body: "A new owner submits the company request once, then waits for internal approval.",
  },
  {
    title: "Launch the first-run checklist",
    body: "Complete profile details, invite the team, add a jobsite, and create the first document.",
  },
  {
    title: "Run the Command Center",
    body: "Use one operating hub for risk, open work, recommendations, and safety knowledge.",
  },
];

const roleOutcomes = [
  {
    title: "Company leaders",
    body: "See whether the workspace is adopted and where risk or approvals need attention.",
  },
  {
    title: "Safety managers",
    body: "Start with the hub, then clear permits, incidents, training gaps, and document reviews.",
  },
  {
    title: "Field teams",
    body: "Work from jobsites, JSAs, permits, incidents, reports, and completed documents.",
  },
];

export default function MarketingPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_46%,_#e7f0fb_100%)] text-[var(--app-text)]">
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="app-surface-shell app-radius-panel flex flex-wrap items-center justify-between gap-4 px-6 py-4 shadow-[0_16px_36px_rgba(38,64,106,0.12)]">
          <BrandLogo className="h-[4.9rem] w-[23rem] max-w-full" imageClassName="p-0" />
          <div className="flex flex-wrap gap-3">
            <Link href="/company-signup" className="app-btn-primary px-4 py-2.5 text-sm app-shadow-action transition">
              Request Company Workspace
            </Link>
            <Link href="/login" className="app-btn-secondary px-4 py-2.5 text-sm transition">
              Open Workspace
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 pb-10 pt-6 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="app-surface-shell app-radius-panel p-8 shadow-[0_20px_40px_rgba(38,64,106,0.1)] sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--app-accent-primary)]">
            Safety operations command center
          </p>
          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight text-[var(--app-text-strong)] sm:text-6xl">
            Safety operations command center for construction teams.
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-[var(--app-text)]">
            Safety360Docs turns safety documents, jobsites, field workflows, approvals, and risk signals into one
            operating hub. New companies get a guided launch path; active teams start each day from Command Center.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="mailto:john.h.haldemann@gmail.com" className="app-btn-primary px-5 py-3 text-sm app-shadow-action-strong transition">
              Book Demo
            </Link>
            <Link href="/company-signup" className="app-btn-secondary px-5 py-3 text-sm transition">
              Request Company Workspace
            </Link>
            <Link href="/login" className="app-btn-secondary px-5 py-3 text-sm transition">
              Open Workspace
            </Link>
          </div>
        </div>

        <div className="app-surface-shell-accent app-radius-panel p-6 shadow-[0_22px_48px_rgba(38,64,106,0.12)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--app-accent-primary)]">
            Command Center
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-[var(--app-text-strong)]">
            The first screen after launch is an operating hub, not another folder.
          </h2>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {commandSignals.map(([title, body]) => (
              <div key={title} className="app-surface-card rounded-2xl p-4">
                <p className="text-sm font-bold text-[var(--app-text-strong)]">{title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="app-surface-shell app-radius-panel p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--app-accent-primary)]">
            Adoption path
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-[var(--app-text-strong)]">
            A clearer route from prospect to active workspace.
          </h2>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {adoptionPath.map((step, index) => (
              <div key={step.title} className="app-surface-card rounded-2xl p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-muted)]">
                  Step {index + 1}
                </p>
                <p className="mt-3 text-xl font-bold text-[var(--app-text-strong)]">{step.title}</p>
                <p className="mt-3 text-sm leading-7 text-[var(--app-text)]">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {roleOutcomes.map((item) => (
            <div key={item.title} className="app-surface-shell rounded-2xl p-6 shadow-[0_10px_22px_rgba(38,64,106,0.08)]">
              <p className="text-xl font-bold text-[var(--app-text-strong)]">{item.title}</p>
              <p className="mt-3 text-sm leading-7 text-[var(--app-text)]">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8 pb-12">
        <div className="app-radius-panel bg-[#1f4fd8] px-8 py-10 text-white app-shadow-brand">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-3xl font-black tracking-tight">Launch the workspace. Start in Command Center.</p>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/95">
                Request access for a new company, book a guided walkthrough, or open the workspace if your team is already active.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link href="mailto:john.h.haldemann@gmail.com" className="rounded-xl bg-[rgba(20,50,82,0.92)] px-5 py-3 text-center text-sm font-semibold text-white">
                Book Demo
              </Link>
              <Link href="/company-signup" className="rounded-xl border border-white/30 px-5 py-3 text-center text-sm font-semibold text-white">
                Request Workspace
              </Link>
              <Link href="/login" className="rounded-xl border border-white/30 px-5 py-3 text-center text-sm font-semibold text-white">
                Open Workspace
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
