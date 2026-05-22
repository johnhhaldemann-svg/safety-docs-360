"use client";

import { Activity, Brain, ClipboardCheck, Rocket } from "lucide-react";
import { GusBotFigure } from "@/components/gus/GusSmartBot";
import type { GusDecision } from "@/lib/gus/gusTypes";

type GusCompanionStageProps = {
  decision: GusDecision;
  onPlan: () => void;
  onDismiss: () => void;
  compact?: boolean;
};

function attentionLabel(decision: GusDecision) {
  if (decision.attentionLevel === "critical" || decision.attentionLevel === "high") return "Review needed";
  if (decision.kind === "planning_offer") return "Plan ready";
  return "Watching";
}

export function GusCompanionStage({ decision, onPlan, onDismiss, compact = false }: GusCompanionStageProps) {
  if (compact) {
    return (
      <section className="relative overflow-hidden rounded-xl border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="relative h-20 w-20 shrink-0">
            <div className="absolute inset-2 rounded-full border border-red-200/70 bg-red-100/20 blur-sm" />
            <GusBotFigure state={decision.botState} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="inline-flex rounded-full border border-red-200 bg-white px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-red-600 shadow-[0_8px_20px_rgba(239,68,68,0.12)]">
              {attentionLabel(decision)}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Gus is checking risk signals now and keeping draft-only review steps close.
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onPlan}
            className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
          >
            Plan work
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
          >
            Dismiss
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] px-4 py-5">
      <div className="absolute right-3 top-4 hidden w-40 space-y-5 sm:block">
        <div className="flex gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-100 text-red-600">
            <Activity className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-700">Attention state</p>
            <p className="mt-1 text-xs leading-4 text-slate-600">Gus uses pulse and motion when review needs attention.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-100 text-blue-600">
            <Brain className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-700">Active companion</p>
            <p className="mt-1 text-xs leading-4 text-slate-600">Risk, permits, observations, and planning are monitored.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange-100 text-orange-600">
            <ClipboardCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-700">Draft only</p>
            <p className="mt-1 text-xs leading-4 text-slate-600">Plans and notices always require human review.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-100 text-violet-600">
            <Rocket className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-700">Quick actions</p>
            <p className="mt-1 text-xs leading-4 text-slate-600">Plan, email, mute, dismiss, and review controls stay close.</p>
          </div>
        </div>
      </div>

      <div className="relative min-h-72 pr-0 sm:pr-44">
        <div className="absolute left-4 top-4 z-10 rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-black text-red-600 shadow-[0_14px_34px_rgba(239,68,68,0.18)]">
          {attentionLabel(decision)}
        </div>
        <div className="absolute left-10 top-14 h-44 w-44 rounded-full border border-red-200/70 bg-red-100/20 blur-sm" />
        <div className="relative flex justify-center pt-12">
          <GusBotFigure state={decision.botState} hero />
        </div>
      </div>

      <div className="relative mx-auto -mt-2 flex w-fit items-center overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white/92 shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
        <button
          type="button"
          onClick={onPlan}
          className="min-h-14 border-r border-slate-200 px-5 text-xs font-black text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
        >
          Plan work
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-14 px-5 text-xs font-black text-slate-700 transition hover:bg-slate-50"
        >
          Dismiss
        </button>
      </div>
      <p className="mt-3 text-center text-xs font-semibold text-slate-600">
        Gus AI Safety Coach <span className="text-emerald-600">Live</span>
      </p>
    </section>
  );
}
