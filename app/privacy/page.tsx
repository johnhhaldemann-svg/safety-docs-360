import Link from "next/link";

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ?? "privacy@safety360docs.com";
const EFFECTIVE_DATE = "June 16, 2026";

export default function PrivacyPage() {
  return (
    <main id="main-content" className="min-h-screen bg-app-canvas px-6 py-10">
      <div className="mx-auto max-w-4xl rounded-3xl border border-[var(--app-border)] bg-[rgba(248,251,255,0.96)] p-8 shadow-[var(--app-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--app-accent-primary)]">Legal</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-[var(--app-text-strong)]">Privacy Policy</h1>
            <p className="mt-2 text-sm text-[var(--app-text)]">
              Effective {EFFECTIVE_DATE} &mdash; Reliance Predictive Safety Technologies LLC
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

          {/* Intro */}
          <section className="rounded-2xl border border-[var(--app-border)] bg-white/72 p-6">
            <h2 className="text-xl font-bold text-[var(--app-text-strong)]">About this policy</h2>
            <p className="mt-3">
              Reliance Predictive Safety Technologies LLC (&ldquo;SafePredict,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
              &ldquo;our&rdquo;) operates the SafePredict platform at safety360docs.com and associated mobile and API
              interfaces (collectively, the &ldquo;Service&rdquo;). This Privacy Policy explains what personal and
              business information we collect, how we use it, who we share it with, and the rights you have over your
              data. By using the Service, you agree to the practices described here.
            </p>
          </section>

          {/* Information We Collect */}
          <section className="rounded-2xl border border-[var(--app-border)] bg-white/72 p-6">
            <h2 className="text-xl font-bold text-[var(--app-text-strong)]">Information we collect</h2>
            <div className="mt-3 space-y-4">
              <div>
                <p className="font-semibold text-[var(--app-text-strong)]">Account and identity information</p>
                <p className="mt-1">
                  Name, email address, job title, and authentication credentials when you create an account or are
                  invited to a workspace.
                </p>
              </div>
              <div>
                <p className="font-semibold text-[var(--app-text-strong)]">Company and workspace data</p>
                <p className="mt-1">
                  Company name, jobsite details, workforce rosters, contractor records, organizational structure, and
                  any other information your company adds to its SafePredict workspace.
                </p>
              </div>
              <div>
                <p className="font-semibold text-[var(--app-text-strong)]">Safety program content</p>
                <p className="mt-1">
                  Incidents and observations, Job Safety Analysis (JSA) records, permit-to-work entries, inspection
                  results, toolbox-talk logs, training records, induction completions, corrective actions, documents,
                  and other safety data your team submits through the platform.
                </p>
              </div>
              <div>
                <p className="font-semibold text-[var(--app-text-strong)]">Usage and technical data</p>
                <p className="mt-1">
                  Browser type, device information, IP address, pages visited, and actions taken within the platform.
                  This helps us operate, secure, and improve the Service.
                </p>
              </div>
              <div>
                <p className="font-semibold text-[var(--app-text-strong)]">Billing information</p>
                <p className="mt-1">
                  If you subscribe to a paid plan, billing contact details and payment method are collected and
                  processed by Stripe. We do not store full card numbers.
                </p>
              </div>
            </div>
          </section>

          {/* How We Use */}
          <section className="rounded-2xl border border-[var(--app-border)] bg-white/72 p-6">
            <h2 className="text-xl font-bold text-[var(--app-text-strong)]">How we use your information</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Provide, operate, and maintain the SafePredict platform and all features your workspace has enabled.</li>
              <li>Authenticate users and enforce role-based and company-scoped access controls.</li>
              <li>Send transactional messages (invitations, alerts, billing receipts) and service-related communications.</li>
              <li>Generate AI-assisted safety insights, risk scores, and recommendations using de-identified or workspace-scoped data.</li>
              <li>Process payments and manage subscription billing.</li>
              <li>Detect security incidents, prevent abuse, and comply with legal obligations.</li>
              <li>Analyze aggregate, anonymized usage to improve platform reliability and features.</li>
            </ul>
            <p className="mt-4">
              We do not sell your personal information. We do not use your safety program data to train
              general-purpose AI models without your explicit consent.
            </p>
          </section>

          {/* Data Storage */}
          <section className="rounded-2xl border border-[var(--app-border)] bg-white/72 p-6">
            <h2 className="text-xl font-bold text-[var(--app-text-strong)]">Data storage and infrastructure</h2>
            <p className="mt-3">
              All workspace data is stored in a dedicated Supabase PostgreSQL database (hosted in the United States).
              The platform is deployed on Vercel&apos;s infrastructure, also in the United States. Data is encrypted
              in transit using TLS 1.2 or higher and encrypted at rest by our database and storage providers.
              Row-level security policies enforce company-scoped isolation so that no workspace can access another
              workspace&apos;s data.
            </p>
          </section>

          {/* Third Parties */}
          <section className="rounded-2xl border border-[var(--app-border)] bg-white/72 p-6">
            <h2 className="text-xl font-bold text-[var(--app-text-strong)]">Third-party service providers</h2>
            <p className="mt-3">
              We share data with the following sub-processors only to the extent necessary to operate the Service:
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--app-border)] text-left text-[var(--app-text-strong)]">
                    <th className="pb-2 pr-6 font-semibold">Provider</th>
                    <th className="pb-2 pr-6 font-semibold">Purpose</th>
                    <th className="pb-2 font-semibold">Data transferred</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--app-border)]">
                  <tr>
                    <td className="py-2 pr-6 font-medium">Supabase</td>
                    <td className="py-2 pr-6">Database, authentication, file storage</td>
                    <td className="py-2">All workspace data</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-6 font-medium">Vercel</td>
                    <td className="py-2 pr-6">Application hosting, CDN, edge functions</td>
                    <td className="py-2">Request metadata, application logs</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-6 font-medium">Stripe</td>
                    <td className="py-2 pr-6">Payment processing</td>
                    <td className="py-2">Billing contact, payment method tokens</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-6 font-medium">Anthropic</td>
                    <td className="py-2 pr-6">AI-assisted safety insights (when enabled)</td>
                    <td className="py-2">Workspace-scoped prompts; not used for training</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-6 font-medium">Email provider</td>
                    <td className="py-2 pr-6">Transactional and invitation emails</td>
                    <td className="py-2">Recipient email address, message content</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4">
              We do not share personal information with advertisers, data brokers, or any third party for
              marketing purposes.
            </p>
          </section>

          {/* Data Retention */}
          <section className="rounded-2xl border border-[var(--app-border)] bg-white/72 p-6">
            <h2 className="text-xl font-bold text-[var(--app-text-strong)]">Data retention</h2>
            <p className="mt-3">
              We retain workspace data for as long as your account is active. After account closure or subscription
              cancellation, data is retained for 90 days to allow for recovery, then permanently deleted from
              production systems. Backups may persist for up to an additional 30 days before being purged. You may
              request earlier deletion by contacting us at the address below.
            </p>
          </section>

          {/* Security */}
          <section className="rounded-2xl border border-[var(--app-border)] bg-white/72 p-6">
            <h2 className="text-xl font-bold text-[var(--app-text-strong)]">Security</h2>
            <p className="mt-3">
              We implement technical and organizational measures including TLS encryption in transit, AES-256
              encryption at rest, database row-level security, role-based access controls, and audit logging.
              Despite these measures, no system is completely secure. If you discover a security issue, please
              disclose it responsibly to{" "}
              <a
                className="font-semibold text-[var(--app-accent-primary)] underline-offset-2 hover:underline"
                href={`mailto:${supportEmail}`}
              >
                {supportEmail}
              </a>
              .
            </p>
          </section>

          {/* Your Rights */}
          <section className="rounded-2xl border border-[var(--app-border)] bg-white/72 p-6">
            <h2 className="text-xl font-bold text-[var(--app-text-strong)]">Your rights</h2>
            <p className="mt-3">
              Depending on where you are located, you may have rights to access, correct, export, or delete your
              personal information, or to object to or restrict certain processing. Workspace administrators can
              manage most of these requests directly within the platform. For requests you cannot fulfill in-app,
              or for questions about your rights, contact us at{" "}
              <a
                className="font-semibold text-[var(--app-accent-primary)] underline-offset-2 hover:underline"
                href={`mailto:${supportEmail}`}
              >
                {supportEmail}
              </a>
              . We will respond within 30 days.
            </p>
          </section>

          {/* Changes */}
          <section className="rounded-2xl border border-[var(--app-border)] bg-white/72 p-6">
            <h2 className="text-xl font-bold text-[var(--app-text-strong)]">Changes to this policy</h2>
            <p className="mt-3">
              We may update this Privacy Policy from time to time. When we make material changes, we will notify
              workspace administrators by email and display a notice in the platform. The effective date at the
              top of this page reflects when the current version took effect. Continued use of the Service after
              the effective date constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* Contact */}
          <section className="rounded-2xl border border-[var(--app-border)] bg-white/72 p-6">
            <h2 className="text-xl font-bold text-[var(--app-text-strong)]">Contact</h2>
            <p className="mt-3">
              For privacy-related requests, questions, or concerns, contact:
            </p>
            <p className="mt-3">
              <span className="font-semibold text-[var(--app-text-strong)]">Reliance Predictive Safety Technologies LLC</span><br />
              Privacy inquiries:{" "}
              <a
                className="font-semibold text-[var(--app-accent-primary)] underline-offset-2 hover:underline"
                href={`mailto:${supportEmail}`}
              >
                {supportEmail}
              </a>
            </p>
          </section>

          <p className="text-xs text-[var(--app-text)]">
            See also{" "}
            <Link
              href="/terms"
              className="font-semibold text-[var(--app-accent-primary)] underline underline-offset-2 decoration-[var(--app-accent-primary)]/50 hover:text-[var(--app-accent-primary-hover)]"
            >
              Terms of Service
            </Link>
            {" and your organization's agreements inside the app."}
          </p>
        </div>
      </div>
    </main>
  );
}
