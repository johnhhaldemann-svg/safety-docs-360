"use client";

import { buildLeadingIndicatorTargets } from "@/lib/injuryWeather/leadingIndicatorTargets";
import type { InjuryWeatherDashboardData } from "@/lib/injuryWeather/types";

export function LeadingIndicatorsPanel({ data }: { data: InjuryWeatherDashboardData }) {
  const { headline, subline, items } = buildLeadingIndicatorTargets(data);

  return (
    <section className="rounded-2xl border border-emerald-900/45 bg-emerald-950/20 p-5 text-sm text-emerald-50/95 shadow-lg">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300/90">Prevention focus</p>
      <h3 className="mt-1 text-lg font-bold text-emerald-50">{headline}</h3>
      <p className="mt-2 text-xs leading-relaxed text-emerald-100/80">{subline}</p>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li
            key={item.label}
            className="rounded-xl border border-emerald-800/40 bg-black/25 px-4 py-3 text-left text-emerald-50/95"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-300/90">{item.label}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-emerald-100/90">{item.action}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
