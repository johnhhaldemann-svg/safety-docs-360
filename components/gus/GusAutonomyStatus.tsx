"use client";

import { Activity, CheckCircle2, Mic, Volume2 } from "lucide-react";
import type { GusAutonomyStatus as GusAutonomyStatusType } from "@/lib/gus/gusTypes";

type GusAutonomyStatusProps = {
  status: GusAutonomyStatusType;
};

function stateClassName(state: GusAutonomyStatusType["state"]) {
  if (state === "blocked") return "border-red-200 bg-red-50 text-red-900";
  if (state === "waiting_on_review") return "border-amber-200 bg-amber-50 text-amber-950";
  if (state === "limited") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

export function GusAutonomyStatus({ status }: GusAutonomyStatusProps) {
  return (
    <section className={`rounded-xl border px-3 py-2 ${stateClassName(status.state)}`} aria-label="Gus coach status">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/80">
          {status.state === "monitoring" ? (
            <Activity className="h-4 w-4" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-current/70">
            Coach status
          </p>
          <p className="mt-0.5 text-sm font-black leading-5 text-current">{status.label}</p>
          <p className="mt-1 text-xs leading-5 text-current/75">{status.detail}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-current/70">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1">
              <Volume2 className="h-3 w-3" aria-hidden="true" />
              Voice {status.voiceAvailable ? "ready" : "off"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1">
              <Mic className="h-3 w-3" aria-hidden="true" />
              Mic {status.micAvailable ? "ready" : "limited"}
            </span>
            <span className="rounded-full bg-white/70 px-2 py-1">
              Context {status.contextAvailable ? "live" : "limited"}
            </span>
            <span className="rounded-full bg-white/70 px-2 py-1">
              Memory {status.memoryAvailable ? "local" : "off"}
            </span>
            <span className="rounded-full bg-white/70 px-2 py-1">
              AI Engine {status.aiEngineAvailable ? "linked" : "limited"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
