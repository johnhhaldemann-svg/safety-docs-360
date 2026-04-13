import Link from "next/link";
import { getDefaultAgreementConfig } from "@/lib/legal";
import { getAgreementConfig } from "@/lib/legalSettings";

export default async function LiabilityWaiverPage() {
  const config = await getAgreementConfig().catch(() => getDefaultAgreementConfig());
  const waiver = config.liabilityWaiver;

  return (
    <main className="min-h-screen bg-app-canvas px-6 py-10">
      <div className="mx-auto max-w-4xl rounded-3xl border border-[var(--app-border)] bg-[rgba(248,251,255,0.96)] p-8 shadow-[var(--app-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--app-accent-primary)]">
              Legal
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-[var(--app-text-strong)]">
              {waiver.title}
            </h1>
            <p className="mt-2 text-sm text-[var(--app-muted)]">Version {config.version}</p>
          </div>

          <Link
            href="/login"
            className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-accent-primary-soft)]"
          >
            Back
          </Link>
        </div>

        <div className="mt-8 space-y-6">
          {waiver.sections.map((section) => (
            <section key={section.heading} className="rounded-2xl border border-[var(--app-border)] bg-white/72 p-6">
              <h2 className="text-xl font-bold text-[var(--app-text-strong)]">{section.heading}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--app-text)]">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
