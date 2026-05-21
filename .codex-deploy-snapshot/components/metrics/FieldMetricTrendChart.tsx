"use client";

import { useCallback, useId, useRef, useState, type KeyboardEvent } from "react";
import { METRIC_CHART_PANEL } from "./metricChartSurfaces";

type TrendPoint = {
  key: string;
  label: string;
  created: number;
  closed: number;
  openBacklog: number;
};

const WIDTH = 720;
const HEIGHT = 240;
const LEFT_PAD = 28;
const BOTTOM_PAD = 26;
const TOP_PAD = 12;
const RIGHT_PAD = 12;

export function FieldMetricTrendChart({ points }: { points: TrendPoint[] }) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const data = points.length > 0
    ? points
    : [{ key: "0", label: "No data", created: 0, closed: 0, openBacklog: 0 }];

  const maxValue = Math.max(1, ...data.flatMap((p) => [p.created, p.closed, p.openBacklog]));
  const step = (WIDTH - LEFT_PAD - RIGHT_PAD) / Math.max(1, data.length - 1);

  const makePath = (accessor: (point: (typeof data)[number]) => number) =>
    data
      .map((point, index) => {
        const x = LEFT_PAD + index * step;
        const y =
          HEIGHT - BOTTOM_PAD - (accessor(point) / maxValue) * (HEIGHT - TOP_PAD - BOTTOM_PAD);
        return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

  const lineDefs = [
    { id: `c-${uid}`, label: "Created", color: "#38bdf8", path: makePath((p) => p.created) },
    { id: `d-${uid}`, label: "Closed", color: "#34d399", path: makePath((p) => p.closed) },
    { id: `b-${uid}`, label: "Open Backlog", color: "#f59e0b", path: makePath((p) => p.openBacklog) },
  ];

  const activeIndex = hover !== null ? hover : focusIdx;
  const activePoint = data[activeIndex] ?? data[0];

  const setNearest = useCallback(
    (clientX: number) => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * WIDTH;
      const i = Math.round((x - LEFT_PAD) / step);
      const clamped = Math.max(0, Math.min(data.length - 1, i));
      setHover(clamped);
      setFocusIdx(clamped);
    },
    [data.length, step],
  );

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setFocusIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setFocusIdx((i) => Math.min(data.length - 1, i + 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setFocusIdx(data.length - 1);
    }
  };

  const hasReal = points.length > 0;
  const xFocus = LEFT_PAD + activeIndex * step;
  const leftPct = data.length <= 1 ? 50 : (activeIndex / (data.length - 1)) * 100;

  return (
    <div
      className={METRIC_CHART_PANEL}
      ref={wrapRef}
      onMouseMove={(e) => hasReal && setNearest(e.clientX)}
      onMouseLeave={() => setHover(null)}
    >
      <p id={`${uid}-trend-desc`} className="sr-only">
        Multi-series trend: created, closed, and open backlog. Use arrow keys to move along the time axis.
        {activePoint
          ? ` Focus: ${activePoint.label}. Created ${activePoint.created}, closed ${activePoint.closed}, open backlog ${activePoint.openBacklog}.`
          : ""}
      </p>
      <div className="flex flex-wrap gap-2" aria-hidden>
        {lineDefs.map((line) => (
          <div
            key={line.id}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/90 px-3 py-1 text-[11px] font-semibold text-slate-300"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: line.color }} />
            {line.label}
          </div>
        ))}
      </div>
      <div
        className="relative mt-4 outline-none"
        tabIndex={0}
        role="img"
        aria-label="Open vs closed trend chart"
        aria-describedby={`${uid}-trend-desc`}
        onKeyDown={onKey}
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-64 w-full" preserveAspectRatio="none">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = HEIGHT - BOTTOM_PAD - ratio * (HEIGHT - TOP_PAD - BOTTOM_PAD);
            return (
              <line
                key={ratio}
                x1={LEFT_PAD}
                x2={WIDTH - RIGHT_PAD}
                y1={y}
                y2={y}
                stroke="rgba(148, 163, 184, 0.18)"
                strokeWidth="1"
              />
            );
          })}
          {hasReal ? (
            <line
              x1={xFocus}
              x2={xFocus}
              y1={TOP_PAD}
              y2={HEIGHT - BOTTOM_PAD}
              stroke="rgba(34, 211, 238, 0.35)"
              strokeWidth="1.5"
            />
          ) : null}
          {lineDefs.map((line) => (
            <path
              key={line.id}
              d={line.path}
              fill="none"
              stroke={line.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {data.map((point, index) => {
            const x = LEFT_PAD + index * step;
            return (
              <text
                key={point.key}
                x={x}
                y={HEIGHT - 6}
                fill="rgb(148 163 184)"
                fontSize="11"
                textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"}
              >
                {point.label}
              </text>
            );
          })}
        </svg>
        {hasReal && activePoint ? (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-cyan-500/30 bg-slate-950/95 px-2.5 py-1.5 text-left text-[10px] text-cyan-100 shadow-md"
            style={{
              minWidth: "9rem",
              left: `${leftPct}%`,
            }}
          >
            <div className="font-semibold text-white">{activePoint.label}</div>
            <div className="mt-0.5 font-mono text-cyan-200">
              C {activePoint.created} · D {activePoint.closed} · B {activePoint.openBacklog}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
