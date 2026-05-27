"use client";

import type { MouseEvent, PointerEvent } from "react";
import { ClipboardList, MessageCircle, VolumeX, X } from "lucide-react";
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
      .gus-smartbot-figure .gus-smartbot-head { animation: gus-head-look 7s ease-in-out infinite; transform-origin: 50% 90%; }
      .gus-smartbot-figure .gus-smartbot-eye { animation: gus-blink 4.8s ease-in-out infinite; }
      .gus-smartbot-figure .gus-smartbot-mouth { animation: gus-mouth 2.4s ease-in-out infinite; }
      .gus-smartbot-figure .gus-smartbot-sp-badge { animation: gus-glow 2.8s ease-in-out infinite; }
      .gus-smartbot-idle .gus-smartbot-arm-right { animation: gus-idle-wave 16s ease-in-out infinite; transform-origin: left center; }
      .gus-smartbot-idle .gus-smartbot-arm-left { animation: gus-idle-check 19s ease-in-out infinite; transform-origin: top center; }
      .gus-smartbot-wave .gus-smartbot-arm-right { animation: gus-wave 1.4s ease-in-out infinite; transform-origin: left center; }
      .gus-smartbot-pointing .gus-smartbot-arm-right { transform: rotate(-34deg) translate(6px, -4px); }
      .gus-smartbot-warning { animation: gus-warning 1s ease-in-out infinite; }
      .gus-smartbot-thinking .gus-smartbot-arm-left { animation: gus-think 1.8s ease-in-out infinite; }
      .gus-smartbot-planning .gus-smartbot-arm-left { transform: rotate(20deg); }
      @keyframes gus-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
      @keyframes gus-head-look { 0%, 100% { transform: rotate(0deg); } 35% { transform: rotate(-2deg); } 70% { transform: rotate(2deg); } }
      @keyframes gus-idle-wave { 0%, 58%, 100% { transform: rotate(0deg); } 62% { transform: rotate(-30deg); } 66% { transform: rotate(12deg); } 70% { transform: rotate(-24deg); } 74% { transform: rotate(0deg); } }
      @keyframes gus-idle-check { 0%, 28%, 100% { transform: rotate(0deg) translateY(0); } 31% { transform: rotate(14deg) translateY(-1px); } 34% { transform: rotate(-8deg) translateY(1px); } 37% { transform: rotate(0deg) translateY(0); } }
      @keyframes gus-wave { 0%, 100% { transform: rotate(0deg); } 45% { transform: rotate(-34deg); } 70% { transform: rotate(14deg); } }
      @keyframes gus-warning { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-3px) scale(1.035); } }
      @keyframes gus-think { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(18deg); } }
      @keyframes gus-blink { 0%, 44%, 50%, 100% { transform: scaleY(1); } 47% { transform: scaleY(0.12); } }
      @keyframes gus-mouth { 0%, 100% { transform: scaleX(0.86); opacity: 0.78; } 50% { transform: scaleX(1.12); opacity: 1; } }
      @keyframes gus-glow { 0%, 100% { box-shadow: 0 0 0 rgba(37,99,235,0); } 50% { box-shadow: 0 0 16px rgba(37,99,235,0.5); } }
      @media (prefers-reduced-motion: reduce) {
        .gus-smartbot-figure,
        .gus-smartbot-figure .gus-smartbot-head,
        .gus-smartbot-figure .gus-smartbot-eye,
        .gus-smartbot-figure .gus-smartbot-mouth,
        .gus-smartbot-figure .gus-smartbot-sp-badge,
        .gus-smartbot-idle .gus-smartbot-arm-right,
        .gus-smartbot-idle .gus-smartbot-arm-left,
        .gus-smartbot-wave .gus-smartbot-arm-right,
        .gus-smartbot-warning,
        .gus-smartbot-thinking .gus-smartbot-arm-left {
          animation: none !important;
        }
      }
    `}</style>
  );
}

export function GusBotFigure({ state, compact = false, hero = false }: { state: GusBotState; compact?: boolean; hero?: boolean }) {
  const size = hero ? "h-64 w-52" : compact ? "h-14 w-12" : "h-24 w-20";
  const helmetShell = hero ? "h-16 w-32 rounded-t-[3rem]" : compact ? "h-5 w-11 rounded-t-[1.6rem]" : "h-9 w-[4.7rem] rounded-t-[2.4rem]";
  const helmetBrim = hero ? "top-12 h-4 w-36" : compact ? "top-4 h-1.5 w-12" : "top-7 h-2.5 w-[5.1rem]";
  const badge = hero ? "top-4 h-8 w-10 text-sm" : compact ? "top-1.5 h-3.5 w-4 text-[7px]" : "top-2.5 h-5 w-6 text-[9px]";
  const head = hero ? "mt-12 h-24 w-[7.5rem] rounded-[2rem]" : compact ? "mt-5 h-7 w-9 rounded-[0.8rem]" : "mt-8 h-12 w-16 rounded-[1.15rem]";
  const face = hero ? "h-16 w-24 rounded-[1.6rem]" : compact ? "h-5 w-7 rounded-[0.55rem]" : "h-8 w-12 rounded-[0.85rem]";
  const eye = hero ? "h-8 w-5" : compact ? "h-2.5 w-1.5" : "h-4 w-2.5";
  const body = hero ? "h-[6.25rem] w-28 rounded-[1.8rem]" : compact ? "h-6 w-9 rounded-[0.8rem]" : "h-11 w-[3.75rem] rounded-[1.15rem]";
  const arm = hero ? "h-16 w-7" : compact ? "h-5 w-2" : "h-8 w-3.5";
  const leg = hero ? "h-11 w-6" : compact ? "h-4 w-2" : "h-7 w-3";
  const boot = hero ? "h-5 w-10" : compact ? "h-2 w-4" : "h-3.5 w-6";
  const faceOpacity = state === "muted" ? "opacity-60" : "";

  return (
    <span
      className={`gus-smartbot-figure gus-smartbot-${state} relative grid ${size} shrink-0 place-items-center`}
      aria-hidden="true"
    >
      <GusBotMotionStyles />
      <span className={`absolute inset-1 rounded-full bg-gradient-to-br ${botToneClasses(state)} opacity-15 blur-md`} />
      <span className="absolute bottom-0 h-2 w-3/4 rounded-full bg-slate-900/10 blur-sm" />
      <span className="relative grid place-items-center">
        <span className={`gus-smartbot-head relative grid place-items-center ${hero ? "pt-3" : "pt-0"}`}>
          <span className={`absolute ${helmetShell} top-0 border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f2f4f7_50%,#d7dce3_100%)] shadow-[inset_0_8px_16px_rgba(255,255,255,0.95),inset_0_-7px_12px_rgba(148,163,184,0.25),0_4px_10px_rgba(15,23,42,0.12)]`} />
          <span className={`absolute ${helmetBrim} rounded-full border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#e5e7eb_100%)] shadow-[0_4px_8px_rgba(15,23,42,0.14)]`} />
          <span className={`gus-smartbot-sp-badge absolute ${badge} z-20 grid place-items-center rounded bg-blue-600 font-black leading-none text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_2px_5px_rgba(37,99,235,0.35)]`}>
            SP
          </span>
          <span className={`absolute ${hero ? "top-1 h-12 w-px" : compact ? "top-0.5 h-4 w-px" : "top-1 h-7 w-px"} bg-slate-300/70`} />
          <span className={`absolute ${hero ? "left-12 top-2 h-11 w-px rotate-6" : compact ? "left-4 top-1 h-3.5 w-px rotate-6" : "left-6 top-1.5 h-6 w-px rotate-6"} bg-slate-300/55`} />
          <span className={`absolute ${hero ? "right-12 top-2 h-11 w-px -rotate-6" : compact ? "right-4 top-1 h-3.5 w-px -rotate-6" : "right-6 top-1.5 h-6 w-px -rotate-6"} bg-slate-300/55`} />

          <span className={`relative ${head} grid place-items-center border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#dfe4ea_100%)] shadow-[0_10px_22px_rgba(15,23,42,0.18)]`}>
            <span className={`${hero ? "-left-4 h-14 w-7" : compact ? "-left-1.5 h-4 w-2" : "-left-2.5 h-7 w-3.5"} absolute top-1/2 -translate-y-1/2 rounded-full border border-slate-400 bg-[linear-gradient(135deg,#4b5563,#111827)] shadow-sm`} />
            <span className={`${hero ? "-right-4 h-14 w-7" : compact ? "-right-1.5 h-4 w-2" : "-right-2.5 h-7 w-3.5"} absolute top-1/2 -translate-y-1/2 rounded-full border border-slate-400 bg-[linear-gradient(135deg,#4b5563,#111827)] shadow-sm`} />
            <span className={`relative ${face} ${faceOpacity} grid place-items-center overflow-hidden border border-slate-800 bg-[radial-gradient(circle_at_30%_25%,#273449_0%,#050912_62%,#020617_100%)] shadow-[inset_0_2px_8px_rgba(255,255,255,0.16),0_8px_16px_rgba(15,23,42,0.26)]`}>
              <span className="absolute inset-x-2 top-1 h-px bg-white/12" />
              <span className={`flex ${hero ? "gap-8" : compact ? "gap-2.5" : "gap-4"} items-center`}>
                <span className={`gus-smartbot-eye ${eye} rounded-full bg-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.98)]`} />
                <span className={`gus-smartbot-eye ${eye} rounded-full bg-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.98)]`} />
              </span>
              <span className={`${hero ? "bottom-3 h-1 w-10" : compact ? "bottom-0.5 h-0.5 w-4" : "bottom-1.5 h-0.5 w-7"} gus-smartbot-mouth absolute rounded-b-full border-b-2 border-blue-400`} />
              {state === "warning" ? (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.9)]" />
              ) : null}
            </span>
          </span>
        </span>

        <span className={`${hero ? "-mt-2" : compact ? "-mt-1" : "-mt-1.5"} relative grid place-items-center`}>
          <span className={`relative ${body} overflow-hidden border border-orange-300/70 bg-[linear-gradient(135deg,#ff8a1f_0%,#f97316_54%,#c2410c_100%)] shadow-[0_12px_24px_rgba(234,88,12,0.26)]`}>
            <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-900/25" />
            <span className={`${hero ? "left-6 w-3" : compact ? "left-2 w-1" : "left-3 w-1.5"} absolute inset-y-0 bg-slate-100/88 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.5)]`} />
            <span className={`${hero ? "right-6 w-3" : compact ? "right-2 w-1" : "right-3 w-1.5"} absolute inset-y-0 bg-slate-100/88 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.5)]`} />
            <span className={`${hero ? "top-14 h-3" : compact ? "top-3 h-1" : "top-6 h-1.5"} absolute inset-x-0 bg-slate-100/88`} />
          </span>

          <span className={`${hero ? "-left-10 top-2" : compact ? "-left-3 top-0.5" : "-left-5 top-1.5"} absolute gus-smartbot-arm-left`}>
            <span className={`block ${arm} origin-top rounded-full border border-slate-300 bg-[linear-gradient(135deg,#f8fafc,#cbd5e1)] shadow-sm`} />
            <span className={`${hero ? "h-5 w-7" : compact ? "h-1.5 w-2.5" : "h-3 w-4"} mx-auto mt-0.5 block rounded-full bg-slate-900`} />
          </span>
          <span className={`${hero ? "-right-10 top-2" : compact ? "-right-3 top-0.5" : "-right-5 top-1.5"} absolute gus-smartbot-arm-right`}>
            <span className={`block ${arm} origin-top rounded-full border border-slate-300 bg-[linear-gradient(135deg,#f8fafc,#cbd5e1)] shadow-sm`} />
            <span className={`${hero ? "h-5 w-7" : compact ? "h-1.5 w-2.5" : "h-3 w-4"} mx-auto mt-0.5 block rounded-full bg-slate-900`} />
          </span>

          <span className={`${hero ? "mt-0 gap-8" : compact ? "mt-0 gap-3" : "mt-0.5 gap-5"} flex`}>
            <span className={`${leg} rounded-b-lg bg-[linear-gradient(180deg,#374151,#111827)]`} />
            <span className={`${leg} rounded-b-lg bg-[linear-gradient(180deg,#374151,#111827)]`} />
          </span>
          <span className={`${hero ? "-mt-1 gap-4" : compact ? "-mt-0.5 gap-1.5" : "-mt-0.5 gap-2.5"} flex`}>
            <span className={`${boot} rounded-b-lg border border-slate-300 bg-[linear-gradient(180deg,#f8fafc,#cbd5e1)] shadow-sm`} />
            <span className={`${boot} rounded-b-lg border border-slate-300 bg-[linear-gradient(180deg,#f8fafc,#cbd5e1)] shadow-sm`} />
          </span>
        </span>
      </span>
    </span>
  );
}

export function GusSmartBot({ decision, open, muted, compact, onOpen, onPlan, onDismiss }: GusSmartBotProps) {
  const attention = attentionClasses(decision.attentionLevel);
  const shouldPulse = decision.attentionLevel === "high" || decision.attentionLevel === "critical";
  const handleOpenPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    onOpen();
  };
  const handleOpenClick = (_event: MouseEvent<HTMLElement>) => {
    onOpen();
  };
  const stopClusterOpen = (event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] cursor-pointer items-end gap-3 sm:bottom-5 sm:right-5"
      onClick={handleOpenClick}
      onPointerUp={handleOpenPointerUp}
    >
      <div className="hidden min-w-0 max-w-[18rem] sm:block">
        <button
          type="button"
          onClick={handleOpenClick}
          onPointerUp={handleOpenPointerUp}
          className={`block w-full rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${attention}`}
          aria-label="Open Gus AI Safety Coach from message"
          title="Open Gus AI Safety Coach"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-current">Gus Smart Safety Bot</p>
          <p className="mt-1 text-sm font-black leading-5">{shortMessage(decision.message.message)}</p>
          {decision.signals.length > 0 ? (
            <p className="mt-1 text-xs font-semibold leading-4 text-current">
              Watching {decision.signals.slice(0, 2).map((item) => item.label).join(", ")}
            </p>
          ) : null}
        </button>
      </div>
      <div className="relative">
        {shouldPulse ? (
          <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-amber-300 opacity-75 motion-safe:animate-ping" aria-hidden="true" />
        ) : null}
        <button
          type="button"
          onClick={handleOpenClick}
          onPointerUp={handleOpenPointerUp}
          className="relative z-10 grid rounded-[1.4rem] border border-white/70 bg-white p-2 text-left shadow-[0_18px_44px_rgba(15,23,42,0.2)] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
          aria-label={open ? "Gus AI Safety Coach is open" : "Open Gus AI Safety Coach"}
          title="Open Gus AI Safety Coach"
        >
          <GusBotFigure state={muted ? "muted" : decision.botState} compact={compact} />
        </button>
        <div className="absolute -left-2 -top-3 z-20 flex -translate-x-full gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-[0_10px_24px_rgba(15,23,42,0.14)] max-sm:hidden">
          <button
            type="button"
            onClick={handleOpenClick}
            onPointerUp={handleOpenPointerUp}
            className="grid h-8 w-8 place-items-center rounded-full text-blue-700 hover:bg-blue-50"
            aria-label="Open Gus"
            title="Open Gus"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              stopClusterOpen(event);
              onPlan();
            }}
            onPointerUp={stopClusterOpen}
            className="grid h-8 w-8 place-items-center rounded-full text-slate-700 hover:bg-slate-100"
            aria-label="Plan work with Gus"
            title="Plan work with Gus"
          >
            <ClipboardList className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              stopClusterOpen(event);
              onDismiss();
            }}
            onPointerUp={stopClusterOpen}
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
