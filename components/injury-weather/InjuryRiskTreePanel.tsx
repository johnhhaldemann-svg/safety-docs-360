"use client";

import type { ReactNode } from "react";
import {
  INJURY_RISK_FINAL_ENGINE,
  INJURY_RISK_OUTPUT,
  INJURY_RISK_TREE_LAYERS,
} from "@/lib/injuryWeather/injuryRiskDeterminationTree";

function TreeBranch({ children }: { children: ReactNode }) {
  return <div className="border-l border-slate-600/80 pl-3">{children}</div>;
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

      <div className="mt-4 font-mono text-[11px] leading-relaxed text-slate-300">
        <p className="text-cyan-200/90">START</p>
        {INJURY_RISK_TREE_LAYERS.map((layer) => (
          <TreeBranch key={layer.step}>
            <p className="pt-2 text-slate-100">
              <span className="text-cyan-400/90">{layer.step}.</span> {layer.title}
            </p>
            <ul className="mt-1 list-none space-y-0.5 pl-2 text-slate-400">
              {layer.inputs.map((line) => (
                <li key={line}>├── {line}</li>
              ))}
            </ul>
            <p className="mt-1 pl-2 text-slate-500">│</p>
            <p className="pl-2 text-slate-300">
              leads to: <span className="font-semibold text-cyan-200/95">{layer.leadsTo}</span>
            </p>
            <p className="mt-1.5 rounded border border-slate-700/80 bg-slate-950/50 px-2 py-1.5 text-[10px] leading-snug text-slate-500">
              In this app: {layer.inCodeSummary}
            </p>
          </TreeBranch>
        ))}

        <TreeBranch>
          <p className="pt-3 text-slate-100">
            <span className="text-cyan-400/90">7.</span> {INJURY_RISK_FINAL_ENGINE.title}
          </p>
          <ul className="mt-1 list-none space-y-0.5 pl-2 text-slate-400">
            {INJURY_RISK_FINAL_ENGINE.factors.map((f) => (
              <li key={f}>├── {f}</li>
            ))}
          </ul>
          <p className="mt-1 pl-2 text-slate-500">│</p>
          <p className="pl-2 text-slate-300">
            leads to: <span className="font-semibold text-cyan-200/95">{INJURY_RISK_FINAL_ENGINE.leadsTo}</span>
          </p>
        </TreeBranch>

        <TreeBranch>
          <p className="pt-3 text-slate-100">
            <span className="text-cyan-400/90">8.</span> {INJURY_RISK_OUTPUT.title}
          </p>
          <ul className="mt-1 list-none space-y-0.5 pl-2 text-slate-400">
            {INJURY_RISK_OUTPUT.bands.map((b) => (
              <li key={b}>├── {b}</li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{INJURY_RISK_OUTPUT.bandNote}</p>
        </TreeBranch>
      </div>
    </section>
  );
}
