"use client";

/**
 * GuidedTourModal.tsx
 *
 * Full-screen guided product tour overlay.
 * Renders a step card with icon, title, description, and CTA link.
 * Supports Back / Next / Finish navigation and a Skip button.
 *
 * Usage:
 *   <GuidedTourModal steps={steps} onFinish={fn} onDismiss={fn} />
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileText,
  GraduationCap,
  HardHat,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { TourStep } from "./tourConfig";

// ---------------------------------------------------------------------------
// Icon map (keep in sync with tourConfig.ts icon strings)
// ---------------------------------------------------------------------------
const ICON_MAP: Record<string, React.ElementType> = {
  ShieldCheck,
  Building2,
  Users,
  GraduationCap,
  ClipboardCheck,
  FileText,
  AlertTriangle,
  Sparkles,
  Rocket,
  HardHat,
  CheckCircle2,
};

const COLOR_MAP: Record<
  string,
  { bg: string; border: string; icon: string; badge: string; cta: string; ctaHover: string }
> = {
  blue:   { bg: "bg-blue-50",   border: "border-blue-200",   icon: "text-blue-700",   badge: "bg-blue-100 text-blue-700",   cta: "bg-blue-600 hover:bg-blue-500",   ctaHover: "" },
  indigo: { bg: "bg-indigo-50", border: "border-indigo-200", icon: "text-indigo-700", badge: "bg-indigo-100 text-indigo-700", cta: "bg-indigo-600 hover:bg-indigo-500", ctaHover: "" },
  violet: { bg: "bg-violet-50", border: "border-violet-200", icon: "text-violet-700", badge: "bg-violet-100 text-violet-700", cta: "bg-violet-600 hover:bg-violet-500", ctaHover: "" },
  emerald:{ bg: "bg-emerald-50",border: "border-emerald-200",icon: "text-emerald-700",badge: "bg-emerald-100 text-emerald-700",cta:"bg-emerald-600 hover:bg-emerald-500",ctaHover:""},
  amber:  { bg: "bg-amber-50",  border: "border-amber-200",  icon: "text-amber-700",  badge: "bg-amber-100 text-amber-700",  cta: "bg-amber-600 hover:bg-amber-500",  ctaHover: "" },
  orange: { bg: "bg-orange-50", border: "border-orange-200", icon: "text-orange-700", badge: "bg-orange-100 text-orange-700", cta: "bg-orange-600 hover:bg-orange-500", ctaHover: "" },
  red:    { bg: "bg-red-50",    border: "border-red-200",    icon: "text-red-700",    badge: "bg-red-100 text-red-700",    cta: "bg-red-600 hover:bg-red-500",    ctaHover: "" },
  cyan:   { bg: "bg-cyan-50",   border: "border-cyan-200",   icon: "text-cyan-700",   badge: "bg-cyan-100 text-cyan-700",   cta: "bg-cyan-600 hover:bg-cyan-500",   ctaHover: "" },
  green:  { bg: "bg-green-50",  border: "border-green-200",  icon: "text-green-700",  badge: "bg-green-100 text-green-700",  cta: "bg-green-600 hover:bg-green-500",  ctaHover: "" },
};

type Props = {
  steps: TourStep[];
  initialStep?: number;
  onFinish: () => void;
  onDismiss: () => void;
};

export function GuidedTourModal({ steps, initialStep = 0, onFinish, onDismiss }: Props) {
  const [index, setIndex] = useState(initialStep);
  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;
  const progress = Math.round(((index + 1) / steps.length) * 100);

  const colors = COLOR_MAP[step.color] ?? COLOR_MAP.blue;
  const Icon = ICON_MAP[step.icon] ?? ShieldCheck;

  const handleNext = useCallback(() => {
    if (isLast) {
      onFinish();
    } else {
      setIndex((i) => i + 1);
    }
  }, [isLast, onFinish]);

  const handleBack = useCallback(() => {
    if (!isFirst) setIndex((i) => i - 1);
  }, [isFirst]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") handleNext();
      if (e.key === "ArrowLeft") handleBack();
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleNext, handleBack, onDismiss]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      {/* Card */}
      <div className="relative flex w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">

        {/* Progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-t-2xl bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className={`flex items-center justify-between rounded-t-xl px-6 py-4 ${colors.bg} border-b ${colors.border}`}>
          <div className="flex items-center gap-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${colors.border} bg-white/70`}>
              <Icon className={`h-6 w-6 ${colors.icon}`} aria-hidden />
            </span>
            <div>
              <p id="tour-title" className="text-base font-black text-slate-900">
                {step.title}
              </p>
              <p className="text-xs font-semibold text-slate-500">{step.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Skip tour"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white/60 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          <p className="text-sm leading-relaxed text-slate-700">{step.body}</p>

          {/* Explore CTA */}
          <Link
            href={step.href}
            onClick={onDismiss}
            className={`mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-white transition ${colors.cta}`}
          >
            {step.ctaLabel}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          {/* Step counter */}
          <span className="text-xs font-semibold text-slate-400">
            Step {index + 1} of {steps.length}
          </span>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700"
            >
              {isLast ? "Finish Tour" : "Next"}
              {!isLast && <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
              {isLast && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
            </button>
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-1.5 pb-4">
          {steps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Go to step ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === index
                  ? "w-5 bg-blue-600"
                  : i < index
                  ? "w-1.5 bg-blue-300"
                  : "w-1.5 bg-slate-300"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
