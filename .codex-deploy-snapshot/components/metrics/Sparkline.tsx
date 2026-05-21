"use client";

import {
  useCallback,
  useId,
  useMemo,
  useState,
  useRef,
  type KeyboardEvent,
} from "react";
import {
  type SparkPoint,
  buildAreaAndLinePath,
  formatShortAxisDate,
  resolveSparklineData,
  sparklineAriaDescription,
  tickIndices,
} from "@/lib/metrics/observationSparkline";

const W = 320;
const CHART_H = 88;
const X_AXIS = 20;
const H = CHART_H + X_AXIS;
const PAD_Y = 6;

type SparklineProps = {
  points: SparkPoint[];
  windowDays: number;
  loading?: boolean;
  /** "compact" = fewer on-chart labels; still shows range caption */
  variant?: "default" | "compact";
  className?: string;
  /** Extra line under the chart (e.g. selected window) */
  rangeCaption?: string;
};

export function Sparkline({
  points,
  windowDays,
  loading = false,
  variant = "default",
  className = "",
  rangeCaption,
}: SparklineProps) {
  const data = useMemo(() => resolveSparklineData(points), [points]);
  const hasRealData = points.length > 0;
  const { dPath, maxY, step } = useMemo(
    () => buildAreaAndLinePath(data, W, CHART_H, PAD_Y),
    [data],
  );
  const gradId = useId().replace(/:/g, "");
  const descId = useId().replace(/:/g, "");
  const tickIdx = useMemo(() => tickIndices(data.length), [data.length]);
  const [hover, setHover] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const activeIndex = hover !== null ? hover : focusIdx;
  const activePoint = data[activeIndex] ?? data[0];
  const tooltipLeftPct = data.length <= 1 ? 50 : (activeIndex / (data.length - 1)) * 100;

  const setNearestFromClientX = useCallback(
    (clientX: number) => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * W;
      const i = Math.round(x / step);
      const clamped = Math.max(0, Math.min(data.length - 1, i));
      setHover(clamped);
      setFocusIdx(clamped);
    },
    [data.length, step],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (data.length < 1) return;
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

  const ariaDesc = sparklineAriaDescription(points, windowDays, loading);
  const caption = loading
    ? `Loading series for the last ${windowDays} day view…`
    : rangeCaption ??
      (hasRealData
        ? `Daily counts in selected range (last ${windowDays} days).`
        : "No series values in the selected range.");

  return (
    <div
      className={["w-full", className].filter(Boolean).join(" ")}
      onMouseLeave={() => setHover(null)}
    >
      <p className="mb-1 px-1 text-[10px] text-slate-500">{caption}</p>
      <div
        ref={wrapRef}
        className="relative outline-none"
        role="img"
        tabIndex={0}
        aria-label="Observation count trend"
        aria-describedby={descId}
        onKeyDown={onKeyDown}
        onMouseMove={(ev) => setNearestFromClientX(ev.clientX)}
        onMouseEnter={(ev) => setNearestFromClientX(ev.clientX)}
      >
        <p id={descId} className="sr-only">
          {ariaDesc} Use left and right arrow keys to move focus between days.
        </p>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-28 w-full text-cyan-400"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(34 211 238)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="rgb(34 211 238)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${dPath} L ${W} ${CHART_H} L 0 ${CHART_H} Z`}
            fill={`url(#${gradId})`}
            className="text-cyan-500/20"
          />
          <path d={dPath} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          {hasRealData && activePoint ? (
            <>
              <line
                x1={(activeIndex * step).toFixed(1)}
                x2={(activeIndex * step).toFixed(1)}
                y1={0}
                y2={CHART_H}
                stroke="rgba(34,211,238,0.45)"
                strokeWidth="1.2"
                pointerEvents="none"
              />
              <circle
                cx={(activeIndex * step).toFixed(1)}
                cy={(CHART_H - PAD_Y - (activePoint.count / maxY) * (CHART_H - PAD_Y * 2 - 8) - 4).toFixed(1)}
                r="4"
                fill="rgb(34 211 238)"
                stroke="rgb(15 23 42)"
                strokeWidth="1"
                pointerEvents="none"
              />
            </>
          ) : null}
          {variant === "default" && hasRealData
            ? tickIdx.map((ti) => {
                const x = ti * step;
                return (
                  <text
                    key={ti}
                    x={x}
                    y={H - 4}
                    fill="rgb(148 163 184)"
                    fontSize="9"
                    textAnchor={
                      ti === 0 ? "start" : ti === data.length - 1 ? "end" : "middle"
                    }
                  >
                    {formatShortAxisDate(data[ti]!.date)}
                  </text>
                );
              })
            : null}
          {variant === "compact" && hasRealData && data.length > 1
            ? [0, data.length - 1].map((ti) => {
                const x = ti * step;
                return (
                  <text
                    key={`c-${ti}`}
                    x={x}
                    y={H - 4}
                    fill="rgb(148 163 184)"
                    fontSize="8"
                    textAnchor={ti === 0 ? "start" : "end"}
                  >
                    {formatShortAxisDate(data[ti]!.date)}
                  </text>
                );
              })
            : null}
        </svg>
        {hasRealData && activePoint ? (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-cyan-500/30 bg-slate-950/95 px-2 py-1 text-center text-[10px] text-cyan-100 shadow-md"
            style={{
              minWidth: "5.5rem",
              left: `${tooltipLeftPct}%`,
            }}
          >
            <div className="font-semibold text-white">{formatShortAxisDate(activePoint.date)}</div>
            <div className="font-black tabular-nums text-cyan-200">{activePoint.count} obs.</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
