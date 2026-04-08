import Link from "next/link";

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-app-canvas px-6 py-10">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-700/80 bg-slate-900/90 p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-300">Legal</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-100">Privacy overview</h1>
            <p className="mt-2 text-sm text-slate-300">
              Customize this page before a public or paid launch. It is a starting point, not legal advice.
            </p>
          </div>
          <Link
            href="/login"
            className="rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
          >
            Back
          </Link>
        </div>

        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-400">
          <section className="rounded-2xl border border-slate-700/80 p-6">
            <h2 className="text-xl font-bold text-slate-100">What this workspace processes</h2>
            <p className="mt-3">
              Safety360Docs stores account, company, and safety-program data you submit (including documents and
              workflow metadata) in order to provide the service. Authentication is handled through Supabase Auth.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-700/80 p-6">
            <h2 className="text-xl font-bold text-slate-100">Where data lives</h2>
            <p className="mt-3">
              Production deployments use Supabase (database and authentication) and hosting on Vercel. Optional
              features may call other providers (for example OpenAI for AI-assisted insights, email delivery for
              invites, or Stripe for billing) when those integrations are enabled in your environment.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-700/80 p-6">
            <h2 className="text-xl font-bold text-slate-100">Analytics</h2>
            <p className="mt-3">
              If you enable performance or analytics tools (such as Vercel Speed Insights), describe them here and
              link to vendor privacy policies. Remove this section if you do not use analytics.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-700/80 p-6">
            <h2 className="text-xl font-bold text-slate-100">Contact</h2>
            <p className="mt-3">
              {supportEmail ? (
                <>
                  For privacy-related requests about this deployment, contact{" "}
                  <a className="font-semibold text-teal-300 underline-offset-2 hover:underline" href={`mailto:${supportEmail}`}>
                    {supportEmail}
                  </a>
                  .
                </>
              ) : (
                <>
                  Set <code className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-200">NEXT_PUBLIC_SUPPORT_EMAIL</code> in
                  your environment to show a contact address. Until then, use the same channel your organization uses for
                  workspace support.
                </>
              )}
            </p>
          </section>

          <p className="text-xs text-slate-300">
            See also <Link href="/terms" className="font-semibold text-white underline underline-offset-2 decoration-white/70 hover:text-slate-100">Terms of Service</Link>
            {" "}and your organization&apos;s agreements inside the app.
          </p>
        </div>
      </div>
    </main>
  );
}
