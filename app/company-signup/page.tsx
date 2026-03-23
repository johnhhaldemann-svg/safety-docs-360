"use client";

import Link from "next/link";

export default function CompanySignupPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.10),_transparent_24%),linear-gradient(180deg,_#091220_0%,_#0f1726_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-white/8 bg-[#121826] p-8 shadow-[0_22px_60px_rgba(0,0,0,0.32)] sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
            Company Workspace
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Create your account first, then set up the company workspace.
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300">
            Safety360Docs now follows a simpler SaaS flow: create your personal
            account, sign in, build your construction profile, create the company
            workspace from inside the app, and then invite employees from the
            company access page.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Create account",
                body: "Every customer starts with one clean account instead of a combined company-and-admin signup form.",
              },
              {
                step: "02",
                title: "Build profile and company workspace",
                body: "After sign-in, the app first captures your construction profile, then walks you into company setup so the workspace is attached to your account.",
              },
              {
                step: "03",
                title: "Invite employees",
                body: "Company admins invite employees from Company Access and approve who can join the workspace.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-3xl border border-white/10 bg-white/5 p-5"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/16 text-sm font-black text-sky-200">
                  {item.step}
                </div>
                <div className="mt-4 text-lg font-bold text-white">{item.title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
            >
              Go to Login / Create Account
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-white/12 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
            >
              Back to Website
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
