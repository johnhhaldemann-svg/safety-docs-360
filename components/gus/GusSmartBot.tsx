"use client";

import { Bot, ClipboardList, MessageCircle, VolumeX, X } from "lucide-react";
import type { GusDecision, GusBotState } from "@/lib/gus/gusTypes";

type GusSmartBotProps = {
  decision: GusDecision;
  open: boolean;
  muted?: boolean;
  compact?: boolean;
  onOpen: () => void;
  onPlan: () => void;
  onDismiss: () => void;
};

function attentionClasses(level: GusDecision["attentionLevel"]) {
  if (level === "critical") return "border-red-300 bg-red-50 text-red-800 shadow-[0_18px_48px_rgba(239,68,68,0.24)]";
  if (level === "high") return "border-amber-300 bg-amber-50 text-amber-900 shadow-[0_18px_48px_rgba(245,158,11,0.22)]";
  if (level === "medium") return "border-blue-200 bg-blue-50 text-blue-900 shadow-[0_18px_44px_rgba(37,99,235,0.18)]";
  return "border-slate-200 bg-white text-slate-800 shadow-[0_18px_40px_rgba(15,23,42,0.14)]";
}

function botToneClasses(state: GusBotState) {
  if (state === "warning") return "from-red-500 via-amber-400 to-blue-600";
  if (state === "planning") return "from-blue-600 via-cyan-400 to-emerald-500";
  if (state === "pointing") return "from-amber-400 via-blue-500 to-cyan-500";
  if (state === "muted") return "from-slate-400 via-slate-500 to-slate-700";
  return "from-blue-600 via-cyan-400 to-sky-500";
}

function shortMessage(message: string) {
  const firstSentence = message.split(/(?<=[.!?])\s+/)[0] ?? message;
  return firstSentence.length > 96 ? `${firstSentence.slice(0, 93).trim()}...` : firstSentence;
}

function GusBotMotionStyles() {
  return (
    <style>{`
      .gus-smartbot-figure { transform-origin: 50% 100%; animation: gus-float 4s ease-in-out infinite; }
      .gus-smartbot-figure .gus-smartbot-eye { animation: gus-blink 4.8s ease-in-out infinite; }
      .gus-smartbot-figure .gus-smartbot-mouth { animation: gus-mouth 2.4s ease-in-out infinite; }
      .gus-smartbot-figure .gus-smartbot-antenna { animation: gus-glow 2s ease-in-out infinite; }
      .gus-smartbot-wave .gus-smartbot-arm-right { animation: gus-wave 1.4s ease-in-out infinite; transform-origin: left center; }
      .gus-smartbot-pointing .gus-smartbot-arm-right { transform: rotate(-22deg) translateX(2px); }
      .gus-smartbot-warning { animation: gus-warning 1s ease-in-out infinite; }
      .gus-smartbot-thinking .gus-smartbot-arm-left { animation: gus-think 1.8s ease-in-out infinite; }
      .gus-smartbot-planning .gus-smartbot-arm-left { transform: rotate(20deg); }
      @keyframes gus-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
      @keyframes gus-wave { 0%, 100% { transform: rotate(0deg); } 45% { transform: rotate(-34deg); } 70% { transform: rotate(14deg); } }
      @keyframes gus-warning { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-3px) scale(1.035); } }
      @keyframes gus-think { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(18deg); } }
      @keyframes gus-blink { 0%, 44%, 50%, 100% { transform: scaleY(1); } 47% { transform: scaleY(0.12); } }
      @keyframes gus-mouth { 0%, 100% { width: 0.75rem; opacity: 0.75; } 50% { width: 1.15rem; opacity: 1; } }
      @keyframes gus-glow { 0%, 100% { box-shadow: 0 0 0 rgba(251,191,36,0); } 50% { box-shadow: 0 0 16px rgba(251,191,36,0.85); } }
      @media (prefers-reduced-motion: reduce) {
        .gus-smartbot-figure,
        .gus-smartbot-figure .gus-smartbot-eye,
        .gus-smartbot-figure .gus-smartbot-mouth,
        .gus-smartbot-figure .gus-smartbot-antenna,
        .gus-smartbot-wave .gus-smartbot-arm-right,
        .gus-smartbot-warning,
        .gus-smartbot-thinking .gus-smartbot-arm-left {
          animation: none !important;
        }
      }
    `}</style>
  );
}

export function GusBotFigure({ state, compact = false }: { state: GusBotState; compact?: boolean }) {
  const size = compact ? "h-11 w-11" : "h-24 w-24";
  const headSize = compact ? "h-8 w-9" : "h-14 w-16";
  const bodySize = compact ? "h-6 w-8" : "h-12 w-16";
  const eyeSize = compact ? "h-1.5 w-1.5" : "h-2.5 w-2.5";
  const armSize = compact ? "h-1.5 w-4" : "h-2.5 w-8";

  return (
    <span
      className={`gus-smartbot-figure gus-smartbot-${state} relative grid ${size} shrink-0 place-items-center`}
      aria-hidden="true"
    >
      <GusBotMotionStyles />
      <span className={`absolute inset-1 rounded-full bg-gradient-to-br ${botToneClasses(state)} opacity-15 blur-md`} />
      <span className="absolute bottom-0 h-2 w-3/4 rounded-full bg-slate-900/10 blur-sm" />
      <span className="relative grid place-items-center">
        <span className="gus-smartbot-antenna absolute -top-1 h-2 w-7 rounded-full bg-amber-400 shadow-sm" />
        <span className={`relative grid ${headSize} place-items-center rounded-[1rem] border border-white/70 bg-gradient-to-br from-white to-blue-50 shadow-[0_10px_24px_rgba(15,23,42,0.16)]`}>
          <span className="absolute -left-1 top-1/2 h-3 w-1.5 -translate-y-1/2 rounded-full bg-blue-500" />
          <span className="absolute -right-1 top-1/2 h-3 w-1.5 -translate-y-1/2 rounded-full bg-blue-500" />
          <span className="grid place-items-center rounded-full bg-slate-950 px-2 py-1">
            <span className="flex items-center gap-2">
              <span className={`gus-smartbot-eye ${eyeSize} rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)]`} />
              <span className={`gus-smartbot-eye ${eyeSize} rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)]`} />
            </span>
            <span className="gus-smartbot-mouth mt-1 h-0.5 rounded-full bg-cyan-200" />
          </span>
        </span>
        <span className={`relative -mt-1 grid ${bodySize} place-items-center rounded-[1rem] border border-white/70 bg-gradient-to-br ${botToneClasses(state)} shadow-[0_12px_26px_rgba(37,99,235,0.22)]`}>
          <Bot className={compact ? "h-3.5 w-3.5 text-white" : "h-5 w-5 text-white"} strokeWidth={2.5} />
          <span className="absolute -left-3 top-2 gus-smartbot-arm-left">
            <span className={`block ${armSize} origin-right rounded-full bg-blue-500 shadow-sm`} />
          </span>
          <span className="absolute -right-3 top-2 gus-smartbot-arm-right">
            <span className={`block ${armSize} origin-left rounded-full bg-blue-500 shadow-sm`} />
          </span>
        </span>
      </span>
    </span>
  );
}

export function GusSmartBot({ decision, open, muted, compact, onOpen, onPlan, onDismiss }: GusSmartBotProps) {
  const attention = attentionClasses(decision.attentionLevel);
  const shouldPulse = decision.attentionLevel === "high" || decision.attentionLevel === "critical";

  return (
    <div className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] items-end gap-3 sm:bottom-5 sm:right-5">
      <div className="hidden min-w-0 max-w-[18rem] sm:block">
        <div className={`rounded-2xl border px-4 py-3 ${attention}`}>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-current/70">Gus Smart Safety Bot</p>
          <p className="mt-1 text-sm font-black leading-5">{shortMessage(decision.message.message)}</p>
          {decision.signals.length > 0 ? (
            <p className="mt-1 text-xs font-semibold leading-4 text-current/70">
              Watching {decision.signals.slice(0, 2).map((item) => item.label).join(", ")}
            </p>
          ) : null}
        </div>
      </div>
      <div className="relative">
        {shouldPulse ? (
          <span className="absolute inset-0 rounded-full border-2 border-amber-300 opacity-75 motion-safe:animate-ping" aria-hidden="true" />
        ) : null}
        <button
          type="button"
          onClick={onOpen}
          className="relative grid rounded-[1.4rem] border border-white/70 bg-white p-2 text-left shadow-[0_18px_44px_rgba(15,23,42,0.2)] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
          aria-label={open ? "Gus AI Safety Coach is open" : "Open Gus AI Safety Coach"}
          title="Open Gus AI Safety Coach"
        >
          <GusBotFigure state={muted ? "muted" : decision.botState} compact={compact} />
        </button>
        <div className="absolute -left-2 -top-3 flex -translate-x-full gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-[0_10px_24px_rgba(15,23,42,0.14)] max-sm:hidden">
          <button
            type="button"
            onClick={onOpen}
            className="grid h-8 w-8 place-items-center rounded-full text-blue-700 hover:bg-blue-50"
            aria-label="Open Gus"
            title="Open Gus"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onPlan}
            className="grid h-8 w-8 place-items-center rounded-full text-slate-700 hover:bg-slate-100"
            aria-label="Plan work with Gus"
            title="Plan work with Gus"
          >
            <ClipboardList className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label={muted ? "Gus is muted" : "Dismiss Gus"}
            title={muted ? "Gus is muted" : "Dismiss"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
