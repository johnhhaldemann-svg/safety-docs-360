import Link from "next/link";
import { getDefaultAgreementConfig } from "@/lib/legal";
import { getAgreementConfig } from "@/lib/legalSettings";

export default async function LiabilityWaiverPage() {
  const config = await getAgreementConfig().catch(() => getDefaultAgreementConfig());
  const waiver = config.liabilityWaiver;

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
              Legal
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
              {waiver.title}
            </h1>
            <p className="mt-2 text-sm text-slate-500">Version {config.version}</p>
          </div>

          <Link
            href="/login"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back
          </Link>
        </div>

        <div className="mt-8 space-y-6">
          {waiver.sections.map((section) => (
            <section key={section.heading} className="rounded-2xl border border-slate-200 p-6">
              <h2 className="text-xl font-bold text-slate-900">{section.heading}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
