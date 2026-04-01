"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  INJURY_RISK_FINAL_ENGINE,
  INJURY_RISK_OUTPUT,
  INJURY_RISK_TREE_LAYERS,
} from "@/lib/injuryWeather/injuryRiskDeterminationTree";

function CollapsibleStep({
  stepLabel,
  title,
  leadsTo,
  children,
}: {
  stepLabel: string;
  title: string;
  leadsTo: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-lg border border-slate-700/60 bg-slate-950/35 open:border-cyan-700/45 open:bg-slate-950/55">
      <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2.5 font-mono text-[11px] leading-snug text-slate-200 marker:hidden [&::-webkit-details-marker]:hidden">
        <ChevronDown
          aria-hidden
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400/90 transition-transform duration-200 group-open:rotate-180"
        />
        <span className="min-w-0 flex-1">
          <span className="text-cyan-400/90">{stepLabel}</span> {title}
          <span className="mt-0.5 block text-[10px] font-normal text-slate-500">
            leads to <span className="font-semibold text-cyan-200/90">{leadsTo}</span>
          </span>
        </span>
      </summary>
      <div className="border-t border-slate-800/80 px-3 pb-3 pl-9 pt-1">{children}</div>
    </details>
  );
}

export function InjuryRiskTreePanel() {
  return (
    <section className="rounded-2xl border border-cyan-900/40 bg-[linear-gradient(165deg,_#0a1629_0%,_#0c1220_55%,_#090f18_100%)] p-5 text-sm text-slate-200 shadow-lg">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300/90">Risk determination tree</p>
      <h3 className="mt-1 text-lg font-bold text-cyan-50">How the injury factor is built (target model)</h3>
      <p className="mt-2 rounded-lg border border-cyan-800/35 bg-cyan-950/40 px-3 py-2 text-xs leading-relaxed text-cyan-100/90">
        Purpose: help prevent injuries and support the month ahead—turn signals into training priorities, engineered controls, and
        where to focus in the field. Below is the logic tree; notes show how each layer maps to this Safety Forecast tool today.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        START → layers feed multipliers → final score → banded output.
      </p>

      <div className="mt-4 space-y-2 font-mono text-[11px] leading-relaxed text-slate-300">
        <p className="text-cyan-200/90">START</p>
        {INJURY_RISK_TREE_LAYERS.map((layer) => (
          <CollapsibleStep key={layer.step} stepLabel={`${layer.step}.`} title={layer.title} leadsTo={layer.leadsTo}>
            <ul className="list-none space-y-0.5 text-slate-400">
              {layer.inputs.map((line) => (
                <li key={line}>├── {line}</li>
              ))}
            </ul>
            <p className="mt-2 rounded border border-slate-700/80 bg-slate-950/50 px-2 py-1.5 text-[10px] leading-snug text-slate-500">
              In this app: {layer.inCodeSummary}
            </p>
          </CollapsibleStep>
        ))}

        <CollapsibleStep stepLabel="7." title={INJURY_RISK_FINAL_ENGINE.title} leadsTo={INJURY_RISK_FINAL_ENGINE.leadsTo}>
          <ul className="list-none space-y-0.5 text-slate-400">
            {INJURY_RISK_FINAL_ENGINE.factors.map((f) => (
              <li key={f}>├── {f}</li>
            ))}
          </ul>
        </CollapsibleStep>

        <CollapsibleStep stepLabel="8." title={INJURY_RISK_OUTPUT.title} leadsTo="Banded risk label">
          <ul className="list-none space-y-0.5 text-slate-400">
            {INJURY_RISK_OUTPUT.bands.map((b) => (
              <li key={b}>├── {b}</li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{INJURY_RISK_OUTPUT.bandNote}</p>
        </CollapsibleStep>
      </div>
    </section>
  );
}
