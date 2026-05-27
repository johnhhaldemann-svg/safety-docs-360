import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  FileCheck2,
  HardHat,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

const publicSiteName = "SafePredict Construction";
const riskEngineName = "SafePredict";

const outcomes = [
  {
    title: "Predict risk earlier",
    body: "Surface high and critical signals from jobsites, field activity, training gaps, permits, and incident history before they become the next serious event.",
    icon: AlertTriangle,
  },
  {
    title: "Control the paperwork",
    body: "Keep safety plans, JSAs, permits, incidents, corrective actions, and document reviews moving through one company workspace.",
    icon: FileCheck2,
  },
  {
    title: "Focus field execution",
    body: "Give crews and supervisors the next action that matters: inspect, review, correct, document, escalate, or pause for safety review.",
    icon: HardHat,
  },
];

const workflows = [
  "Safety documents and review history",
  "Jobsite profiles and emergency action plans",
  "JSAs, permits, field issues, and corrective actions",
  "Incidents, training matrix, and company risk memory",
];

const audiences = [
  {
    title: "Company leaders",
    body: "See whether safety work is current, where exposure is rising, and which actions need owner attention.",
  },
  {
    title: "Safety managers",
    body: "Run a daily operating rhythm around risk drivers, open work, document control, and verified follow-through.",
  },
  {
    title: "Field teams",
    body: "Use practical jobsite workflows that keep urgent safety issues visible instead of buried in folders.",
  },
];

const riskBands = [
  {
    band: "Low",
    body: "Routine controls are current.",
    className: "border-emerald-300/45 bg-emerald-400/10 text-emerald-100",
  },
  {
    band: "Moderate",
    body: "Watch repeated signals and open tasks.",
    className: "border-amber-300/45 bg-amber-300/10 text-amber-100",
  },
  {
    band: "High",
    body: "Escalate drivers and assign action owners.",
    className: "border-orange-300/45 bg-orange-300/10 text-orange-100",
  },
  {
    band: "Critical",
    body: "Review immediately and consider stop-work evaluation.",
    className: "border-red-300/45 bg-red-400/10 text-red-100",
  },
];

const heroDrivers = [
  ["Critical", "Open excavation permit without utility confirmation", "Immediate review"],
  ["High", "Two crews missing task-specific fall protection signoff", "Assign owner"],
  ["Moderate", "Training renewal due in 14 days", "Schedule"],
];

export default function MarketingPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#f6f9fc] text-[#102033]">
      <section className="relative isolate overflow-hidden bg-[#071827] text-white">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,_#06131f_0%,_#0c2630_49%,_#123719_100%)]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-28 bg-[linear-gradient(180deg,_transparent,_rgba(246,249,252,0.1))]" />

        <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <BrandLogo className="h-14 w-52 max-w-[56vw] border-white/20 bg-white/96 shadow-none" imageClassName="p-0" />
          <nav className="hidden items-center gap-6 text-sm font-semibold text-white/82 md:flex">
            <a href="#outcomes" className="hover:text-white">
              Outcomes
            </a>
            <a href="#workflows" className="hover:text-white">
              Workflows
            </a>
            <a href="#teams" className="hover:text-white">
              Teams
            </a>
          </nav>
          <Link
            href="/login"
            className="shrink-0 rounded-lg border border-white/28 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
          >
            Open Workspace
          </Link>
        </header>

        <div className="mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-10 sm:px-8 lg:min-h-[620px] lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:pb-20 lg:pt-14">
          <div className="max-w-3xl">
            <p className="inline-flex rounded-lg border border-emerald-300/28 bg-emerald-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-emerald-100">
              Risk-first safety workspace
            </p>
            <h1 className="mt-6 font-app-display text-4xl font-black leading-[1.02] tracking-normal text-white sm:text-6xl lg:text-7xl">
              {publicSiteName}
            </h1>
            <p className="mt-6 max-w-2xl text-xl font-semibold leading-8 text-white sm:text-2xl sm:leading-9">
              A safety management workspace for construction teams that need risk, compliance, and field work in one place.
            </p>
            <p className="mt-5 max-w-2xl text-base leading-8 text-white/80 sm:text-lg">
              Predict risk before incidents escalate, keep documents and approvals under control, and show the next action when safety needs attention.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="mailto:john.h.haldemann@gmail.com"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#f7c948] px-6 py-3.5 text-sm font-black text-[#102033] shadow-[0_18px_40px_rgba(247,201,72,0.22)] transition hover:bg-[#ffd861]"
              >
                Book Demo
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/company-signup"
                className="inline-flex items-center justify-center rounded-lg border border-white/32 bg-white/10 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/16"
              >
                Request Company Workspace
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-lg border border-white/16 bg-white/[0.08] p-4 shadow-[0_26px_70px_rgba(0,0,0,0.28)] backdrop-blur">
              <div className="rounded-lg border border-white/12 bg-[#f8fbff] p-5 text-[#102033]">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#d8e2ef] pb-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#53657a]">Today&apos;s safety posture</p>
                    <h2 className="mt-2 font-app-display text-3xl font-black">North Yard Expansion</h2>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-right">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-red-700">Risk</p>
                    <p className="font-app-display text-3xl font-black text-red-700">87</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    ["Open actions", "14"],
                    ["Critical", "1"],
                    ["High", "5"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-[#d8e2ef] bg-white p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#64748b]">{label}</p>
                      <p className="mt-2 font-app-display text-2xl font-black">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 space-y-3">
                  {heroDrivers.map(([band, driver, action]) => (
                    <div key={driver} className="grid gap-3 rounded-lg border border-[#d8e2ef] bg-white p-4 sm:grid-cols-[6.5rem_1fr_auto] sm:items-center">
                      <span
                        className={`w-fit rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] ${
                          band === "Critical"
                            ? "bg-red-100 text-red-700"
                            : band === "High"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {band}
                      </span>
                      <p className="text-sm font-semibold leading-6 text-[#243b55]">{driver}</p>
                      <p className="text-sm font-black text-[#1f6feb]">{action}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="outcomes" className="bg-white px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <h2 className="font-app-display text-3xl font-black tracking-normal text-[#102033] sm:text-5xl">
              Built for the work that prevents the next incident.
            </h2>
            <p className="mt-5 text-base leading-8 text-[#475569]">
              {publicSiteName} brings {riskEngineName} risk forecasting, documentation, jobsite activity, and accountability into a practical workflow for teams that cannot afford blind spots.
            </p>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {outcomes.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-lg border border-[#d8e2ef] bg-[#f8fbff] p-6 shadow-[0_10px_24px_rgba(15,32,51,0.06)]">
                  <Icon className="h-7 w-7 text-[#1f6feb]" aria-hidden="true" />
                  <h3 className="mt-5 text-xl font-black text-[#102033]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#53657a]">{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="workflows" className="px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <h2 className="font-app-display text-3xl font-black tracking-normal text-[#102033] sm:text-5xl">
              One operating layer for safety documents and field execution.
            </h2>
            <p className="mt-5 text-base leading-8 text-[#475569]">
              The platform keeps compliance work connected to what is happening on the jobsite: permits, JSAs, incidents, training, documents, and risk drivers all point back to action.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/company-signup" className="app-btn-primary px-5 py-3 text-sm app-shadow-action transition">
                Request Company Workspace
              </Link>
              <Link href="/login" className="app-btn-secondary px-5 py-3 text-sm transition">
                Open Workspace
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-[#cfdae8] bg-white shadow-[0_18px_42px_rgba(15,32,51,0.08)]">
            {workflows.map((workflow, index) => (
              <div key={workflow} className="flex items-start gap-4 border-b border-[#e6edf5] px-5 py-5 last:border-b-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e8f2ff] text-sm font-black text-[#1f6feb]">
                  {index + 1}
                </div>
                <div>
                  <p className="font-bold text-[#102033]">{workflow}</p>
                  <p className="mt-1 text-sm leading-6 text-[#64748b]">
                    Status, ownership, evidence, and next steps stay visible for the people responsible.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#102033] px-5 py-16 text-white sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div>
            <ShieldCheck className="h-9 w-9 text-[#60d394]" aria-hidden="true" />
            <h2 className="mt-5 font-app-display text-3xl font-black tracking-normal sm:text-5xl">
              Risk should be easy to understand quickly.
            </h2>
            <p className="mt-5 text-base leading-8 text-white/78">
              High and critical risks need escalation, clear drivers, and practical controls. {riskEngineName} keeps the recommendation transparent so safety professionals stay in charge.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {riskBands.map((risk) => (
              <article key={risk.band} className={`rounded-lg border p-5 ${risk.className}`}>
                <p className="text-lg font-black text-white">{risk.band}</p>
                <p className="mt-2 text-sm leading-6 text-white/72">{risk.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="teams" className="bg-white px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="max-w-3xl font-app-display text-3xl font-black tracking-normal text-[#102033] sm:text-5xl">
            The right safety action for the right role.
          </h2>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {audiences.map((item) => (
              <article key={item.title} className="rounded-lg border border-[#d8e2ef] p-6">
                <UsersRound className="h-7 w-7 text-[#167a4a]" aria-hidden="true" />
                <h3 className="mt-5 text-xl font-black text-[#102033]">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#53657a]">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl rounded-lg bg-[#1f6feb] px-6 py-10 text-white shadow-[0_18px_42px_rgba(31,111,235,0.18)] sm:px-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <ClipboardCheck className="h-8 w-8 text-[#f7c948]" aria-hidden="true" />
              <h2 className="mt-4 font-app-display text-3xl font-black tracking-normal sm:text-4xl">
                Bring your safety program into one working system.
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white">
                Book a walkthrough, request a company workspace, or open the workspace if your team is already active.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link href="mailto:john.h.haldemann@gmail.com" className="rounded-lg bg-white px-5 py-3 text-center text-sm font-black text-[#102033]">
                Book Demo
              </Link>
              <Link href="/company-signup" className="rounded-lg border border-white/32 px-5 py-3 text-center text-sm font-bold text-white">
                Request Workspace
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-7xl px-5 pb-10 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#d8e2ef] pt-6 text-sm text-[#64748b]">
          <p className="font-semibold">{publicSiteName}</p>
          <div className="flex gap-5">
            <Link href="/terms" className="font-semibold hover:text-[#102033]">
              Terms
            </Link>
            <Link href="/privacy" className="font-semibold hover:text-[#102033]">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
