import Link from "next/link";

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();

export default function PrivacyPage() {
  return (
    <main id="main-content" className="min-h-screen bg-app-canvas px-6 py-10">
      <div className="mx-auto max-w-4xl rounded-3xl border border-[var(--app-border)] bg-[rgba(248,251,255,0.96)] p-8 shadow-[var(--app-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--app-accent-primary)]">Legal</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-[var(--app-text-strong)]">Privacy overview</h1>
            <p className="mt-2 text-sm text-[var(--app-text)]">
              Customize this page before a public or paid launch. It is a starting point, not legal advice.
            </p>
          </div>
          <Link
            href="/login"
            className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-accent-primary-soft)]"
          >
            Back
          </Link>
        </div>

        <div className="mt-8 space-y-6 text-sm leading-7 text-[var(--app-text)]">
          <section className="rounded-2xl border border-[var(--app-border)] bg-white/72 p-6">
            <h2 className="text-xl font-bold text-[var(--app-text-strong)]">What this workspace processes</h2>
            <p className="mt-3">
              Safety360Docs stores account, company, and safety-program data you submit (including documents and
              workflow metadata) in order to provide the service. Authentication is handled through Supabase Auth.
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--app-border)] bg-white/72 p-6">
            <h2 className="text-xl font-bold text-[var(--app-text-strong)]">Where data lives</h2>
            <p className="mt-3">
              Production deployments use Supabase (database and authentication) and hosting on Vercel. Optional
              features may call other providers (for example intelligence-assisted insights, email delivery for
              invites, or Stripe for billing) when those integrations are enabled in your environment.
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--app-border)] bg-white/72 p-6">
            <h2 className="text-xl font-bold text-[var(--app-text-strong)]">Analytics</h2>
            <p className="mt-3">
              If you enable performance or analytics tools (such as Vercel Speed Insights), describe them here and
              link to vendor privacy policies. Remove this section if you do not use analytics.
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--app-border)] bg-white/72 p-6">
            <h2 className="text-xl font-bold text-[var(--app-text-strong)]">Contact</h2>
            <p className="mt-3">
              {supportEmail ? (
                <>
                  For privacy-related requests about this deployment, contact{" "}
                  <a className="font-semibold text-[var(--app-accent-primary)] underline-offset-2 hover:underline" href={`mailto:${supportEmail}`}>
                    {supportEmail}
                  </a>
                  .
                </>
              ) : (
                <>
                  Set <code className="rounded bg-[var(--app-panel)] px-1.5 py-0.5 text-[var(--app-text-strong)]">NEXT_PUBLIC_SUPPORT_EMAIL</code> in
                  your environment to show a contact address. Until then, use the same channel your organization uses for
                  workspace support.
                </>
              )}
            </p>
          </section>

          <p className="text-xs text-[var(--app-text)]">
            See also <Link href="/terms" className="font-semibold text-[var(--app-accent-primary)] underline underline-offset-2 decoration-[var(--app-accent-primary)]/50 hover:text-[var(--app-accent-primary-hover)]">Terms of Service</Link>
            {" "}
            {"and your organization's agreements inside the app."}
          </p>
        </div>
      </div>
    </main>
  );
}
