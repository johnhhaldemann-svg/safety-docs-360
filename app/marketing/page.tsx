import Image from "next/image";
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

const publicSiteName = "SafePredictConstrution";
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
  ["Low", "Routine controls are current."],
  ["Moderate", "Watch repeated signals and open tasks."],
  ["High", "Escalate drivers and assign action owners."],
  ["Critical", "Review immediately and consider stop-work evaluation."],
];

export default function MarketingPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#f6f9fc] text-[#102033]">
      <section className="relative isolate overflow-hidden bg-[#071827] text-white">
        <Image
          src="/login-hero.svg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-20 object-cover object-center opacity-45"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,_rgba(7,24,39,0.97)_0%,_rgba(7,24,39,0.86)_44%,_rgba(7,24,39,0.38)_100%)]" />

        <header className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-5 sm:px-8">
          <BrandLogo className="h-16 w-60 max-w-[68vw] border-white/20 bg-white/95 shadow-none" imageClassName="p-0" />
          <nav className="hidden items-center gap-7 text-sm font-semibold text-white/82 md:flex">
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

        <div className="mx-auto grid min-h-[76vh] max-w-7xl content-center px-5 pb-16 pt-12 sm:px-8 lg:min-h-[82vh] lg:grid-cols-[0.72fr_0.28fr]">
          <div className="max-w-4xl">
            <h1 className="font-app-display text-5xl font-black leading-[0.98] tracking-normal text-white sm:text-7xl lg:text-8xl">
              {publicSiteName}
            </h1>
            <p className="mt-7 max-w-2xl text-xl font-semibold leading-8 text-white sm:text-2xl sm:leading-9">
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
            {riskBands.map(([band, body]) => (
              <article key={band} className="rounded-lg border border-white/14 bg-white/[0.06] p-5">
                <p className="text-lg font-black text-white">{band}</p>
                <p className="mt-2 text-sm leading-6 text-white/72">{body}</p>
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
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/88">
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
