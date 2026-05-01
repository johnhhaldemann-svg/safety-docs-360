import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  Download,
  FileText,
  Presentation,
  Users,
} from "lucide-react";
import {
  PageHero,
  SectionCard,
  StatusBadge,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";
import { trainingDeckCount, trainingResources } from "@/lib/trainingResources";

const totalEstimatedMinutes = trainingResources.reduce((total, resource) => {
  const minutes = Number.parseInt(resource.estimatedTime, 10);
  return total + (Number.isFinite(minutes) ? minutes : 0);
}, 0);

export default function TrainingPage() {
  return (
    <div className="space-y-8 pb-10">
      <PageHero
        eyebrow="Platform Training"
        title="Safety360Docs Training"
        description="Download editable PowerPoint walkthroughs for the workflows teams use most: onboarding, documents, field work, training readiness, and leadership reporting."
        actions={
          <>
            <a
              href={trainingResources[0]?.downloadPath ?? "/training"}
              download
              className={appButtonPrimaryClassName}
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              Start With Deck 1
            </a>
            <Link href="/dashboard" className={appButtonSecondaryClassName}>
              Open Dashboard
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/95 p-5 shadow-[var(--app-shadow-soft)]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--app-accent-primary-soft)] text-[var(--app-accent-primary)]">
            <Presentation aria-hidden="true" className="h-5 w-5" />
          </div>
          <p className="mt-4 text-2xl font-bold text-[var(--app-text-strong)]">{trainingDeckCount}</p>
          <p className="mt-1 text-sm text-[var(--app-text)]">PowerPoint modules ready to download.</p>
        </div>
        <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/95 p-5 shadow-[var(--app-shadow-soft)]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d8f1e2] text-[#247c49]">
            <Clock3 aria-hidden="true" className="h-5 w-5" />
          </div>
          <p className="mt-4 text-2xl font-bold text-[var(--app-text-strong)]">{totalEstimatedMinutes} min</p>
          <p className="mt-1 text-sm text-[var(--app-text)]">Estimated time for the full starter path.</p>
        </div>
        <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/95 p-5 shadow-[var(--app-shadow-soft)]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fdeabf] text-[#9b6b12]">
            <Users aria-hidden="true" className="h-5 w-5" />
          </div>
          <p className="mt-4 text-2xl font-bold text-[var(--app-text-strong)]">All roles</p>
          <p className="mt-1 text-sm text-[var(--app-text)]">Built for admins, supervisors, field users, and read-only viewers.</p>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        {trainingResources.map((resource, index) => (
          <article
            key={resource.id}
            className="rounded-2xl border border-[var(--app-border-strong)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(244,249,255,0.94)_100%)] p-6 shadow-[var(--app-shadow-soft)]"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={`Deck ${index + 1}`} tone="info" />
                  <StatusBadge label={resource.audience} />
                  <StatusBadge label={resource.estimatedTime} tone="success" />
                </div>
                <h2 className="mt-4 text-xl font-bold text-[var(--app-text-strong)]">{resource.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--app-text)]">{resource.description}</p>
              </div>
              <a
                href={resource.downloadPath}
                download
                className={`${appButtonPrimaryClassName} shrink-0`}
              >
                <Download aria-hidden="true" className="h-4 w-4" />
                Download PPTX
              </a>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text-strong)]">
                  <BookOpen aria-hidden="true" className="h-4 w-4 text-[var(--app-accent-primary)]" />
                  Learning Outcomes
                </div>
                <ul className="mt-3 space-y-2">
                  {resource.outcomes.map((outcome) => (
                    <li key={outcome} className="flex gap-2 text-sm leading-6 text-[var(--app-text)]">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--app-accent-primary)]" />
                      <span>{outcome}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text-strong)]">
                  <FileText aria-hidden="true" className="h-4 w-4 text-[var(--app-accent-primary)]" />
                  Related Areas
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {resource.relatedLinks.map((link) => (
                    <Link
                      key={`${resource.id}-${link.href}-${link.label}`}
                      href={link.href}
                      className="rounded-xl border border-[var(--app-border)] bg-white/82 px-3 py-2 text-xs font-semibold text-[var(--app-text-strong)] transition hover:border-[var(--app-accent-border-24)] hover:bg-[var(--app-accent-primary-soft)]"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>

      <SectionCard
        eyebrow="Rollout Tip"
        title="Use The Decks As Live Walkthroughs"
        description="The modules are designed for short team huddles, onboarding calls, and customer enablement sessions."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            "Start with the role closest to the audience.",
            "Open the matching platform page while presenting.",
            "Send the same deck afterward as the takeaway.",
          ].map((tip) => (
            <div key={tip} className="rounded-xl border border-[var(--app-border)] bg-white/84 px-4 py-3 text-sm font-medium leading-6 text-[var(--app-text)]">
              {tip}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
