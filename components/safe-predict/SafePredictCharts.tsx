"use client";

import { useSyncExternalStore } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SafePredictForecastPoint } from "@/lib/safePredictMockData";

// recharts lives only in this module so pages that render charts pull it in,
// while the ~46 chart-less SafePredict pages never bundle it.

function useHasMounted() {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
}

export function MiniSparkline({ data, color = "#ef4444" }: { data: number[]; color?: string }) {
  const hasMounted = useHasMounted();
  const points = data.map((value, index) => ({ index, value }));
  if (!hasMounted) return <div className="h-[42px] w-full" aria-hidden />;

  return (
    <ResponsiveContainer width="100%" height={42} minWidth={0} minHeight={0}>
      <LineChart data={points} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ForecastTrendChart({ data, compact = false }: { data: SafePredictForecastPoint[]; compact?: boolean }) {
  const hasMounted = useHasMounted();

  return (
    <div className={compact ? "h-[285px]" : "h-[330px]"}>
      {hasMounted ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <AreaChart data={data} margin={{ top: 22, right: 18, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="highRiskBand" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#fee2e2" stopOpacity={0.92} />
              <stop offset="100%" stopColor="#fef3c7" stopOpacity={0.42} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e5e7eb" vertical={false} strokeDasharray="4 4" />
          <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: "#cbd5e1" }} tick={{ fill: "#475569", fontSize: 12 }} />
          <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} />
          <Tooltip
            formatter={(value, name) => [
              typeof value === "number" ? `${value} risk index` : value,
              name === "historicalRisk" ? "Historical risk index" : name === "predictedRisk" ? "Predicted risk index" : name,
            ]}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #dbe3ee",
              boxShadow: "0 12px 22px rgba(15,23,42,0.12)",
            }}
          />
          <Area type="monotone" dataKey="predictedRisk" stroke="none" fill="url(#highRiskBand)" fillOpacity={0.8} />
          <Line type="monotone" dataKey="historicalRisk" name="Historical risk index" stroke="#ef4444" strokeWidth={2.5} dot={false} connectNulls />
          <Line
            type="monotone"
            dataKey="predictedRisk"
            name="Predicted risk index"
            stroke="#f97316"
            strokeWidth={3}
            dot={false}
            strokeDasharray={compact ? undefined : "4 4"}
          />
        </AreaChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
