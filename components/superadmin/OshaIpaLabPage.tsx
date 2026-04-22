"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import { PageHero, SectionCard } from "@/components/WorkspacePrimitives";

const supabase = getSupabaseBrowserClient();

/** Base URL for the Streamlit OSHA IPA app (e.g. http://127.0.0.1:8501). Set NEXT_PUBLIC_STREAMLIT_OSHA_URL in .env.local. */
const STREAMLIT_BASE = (process.env.NEXT_PUBLIC_STREAMLIT_OSHA_URL ?? "").trim().replace(/\/$/, "");

/**
 * Standalone superadmin tool: Streamlit OSHA compliance tracker fed by IPA workbooks.
 * Not part of Injury Weather (different data, stack, and route).
 */
export function OshaIpaLabPage() {
  const router = useRouter();
  const [gate, setGate] = useState<"loading" | "ok" | "denied">("loading");

  useEffect(() => {
    void (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          router.replace("/login");
          return;
        }
        const meRes = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
        const meData = (await meRes.json().catch(() => null)) as { user?: { role?: string } } | null;
        if (!meRes.ok) {
          router.replace("/login");
          return;
        }
        if (String(meData?.user?.role ?? "").toLowerCase() !== "super_admin") {
          router.replace("/dashboard");
          return;
        }
        setGate("ok");
      } catch {
        setGate("denied");
        router.replace("/dashboard");
      }
    })();
  }, [router]);

  if (gate === "loading") {
    return (
      <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-8 text-center text-slate-300">
        Checking access…
      </div>
    );
  }

  if (gate !== "ok") {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Superadmin · OSHA IPA"
        title="Construction injury forecaster (Streamlit + IPA)"
        description="Standalone Streamlit app (multipage): IPA-based rates and trends, trade+FTE injury forecast, optional OpenAI briefings (same OPENAI_API_KEY as Injury Weather), PDF export, plus a separate sidebar page for 5-Why root cause (not mixed with the forecaster). Runs outside Next.js — host Streamlit separately and set NEXT_PUBLIC_STREAMLIT_OSHA_URL on Vercel for embed/link."
        actions={
          STREAMLIT_BASE ? (
            <a
              href={STREAMLIT_BASE}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Open Streamlit app
            </a>
          ) : null
        }
      />

      <SectionCard
        title="Run the Streamlit app locally"
        description="Python Streamlit is its own server — not bundled with Next.js."
      >
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">
          <li>
            From the repo root:{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-100">
              npm run streamlit:osha:install
            </code>{" "}
            (installs Python deps; requires Python 3 on PATH).
          </li>
          <li>
            Optional demo data:{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5">npm run streamlit:osha:demo-data</code> writes{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5">sample_ipa_demo.xlsx</code>. For production, place{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5">2024 IPA.xlsx</code> in{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5">streamlit</code> or upload in the app sidebar.
          </li>
          <li>
            <code className="rounded bg-slate-800 px-1.5 py-0.5">npm run streamlit:osha</code> — starts Streamlit on{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5">127.0.0.1:8501</code> (see{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5">.streamlit/config.toml</code>).
          </li>
          <li>
            Set{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5">
              NEXT_PUBLIC_STREAMLIT_OSHA_URL=http://127.0.0.1:8501
            </code>{" "}
            in <code className="rounded bg-slate-800 px-1.5 py-0.5">.env.local</code>, restart{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5">npm run dev</code>, then use the button above or the
            embed below.
          </li>
        </ol>
        {!STREAMLIT_BASE ? (
          <div className="mt-4 space-y-3 text-sm text-amber-200/90">
            <p>
              The blue <strong>Open Streamlit app</strong> button and the embed are hidden until{" "}
              <code className="rounded bg-slate-900 px-1.5 py-0.5">NEXT_PUBLIC_STREAMLIT_OSHA_URL</code> is set at{" "}
              <strong>build time</strong> (Next.js inlines <code className="rounded bg-slate-900 px-1.5 py-0.5">NEXT_PUBLIC_*</code>{" "}
              into the client bundle).
            </p>
            <p>
              <strong>Local:</strong> put it in <code className="rounded bg-slate-900 px-1.5 py-0.5">.env.local</code> (e.g.{" "}
              <code className="rounded bg-slate-900 px-1.5 py-0.5">http://127.0.0.1:8501</code>), then restart{" "}
              <code className="rounded bg-slate-900 px-1.5 py-0.5">npm run dev</code>.{" "}
              <code className="rounded bg-slate-900 px-1.5 py-0.5">.env.local</code> is not pushed to GitHub, so it does{" "}
              <strong>not</strong> apply to Vercel by itself.
            </p>
            <p>
              <strong>Vercel (this website):</strong> add the same variable under Project → Settings → Environment Variables
              for Production (and Preview if needed). It must be a <strong>public HTTPS URL</strong> where Streamlit is
              actually hosted (Streamlit Community Cloud, Railway, Render, your own server, etc.). Do{" "}
              <strong>not</strong> use <code className="rounded bg-slate-900 px-1.5 py-0.5">127.0.0.1</code> there —{" "}
              {
                "that points at each visitor's own computer, not your Streamlit server. Redeploy after saving env vars."
              }
            </p>
          </div>
        ) : null}
      </SectionCard>

      {STREAMLIT_BASE ? (
        <SectionCard
          title="Embedded app"
          description="If the frame stays blank, open the app in a new tab; cross-origin Streamlit settings may need adjustment."
        >
          <iframe
            title="OSHA Compliance Streamlit"
            src={STREAMLIT_BASE}
            className="h-[min(85vh,900px)] w-full rounded-xl border border-slate-700/80 bg-slate-950"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        </SectionCard>
      ) : null}
    </div>
  );
}
