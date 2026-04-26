import { StatusBadge as WorkspaceStatusBadge } from "@/components/WorkspacePrimitives";
import type { TrafficLightStatus } from "@/src/lib/dashboard/types";

type WorkspaceTone = "neutral" | "success" | "warning" | "error" | "info";

function trafficLightToTone(status: TrafficLightStatus): WorkspaceTone {
  if (status === "green") return "success";
  if (status === "yellow") return "warning";
  return "error";
}

type TrafficProps = { label: string; trafficLight: TrafficLightStatus };
type ToneProps = { label: string; tone: WorkspaceTone };

export type DashboardStatusBadgeProps = TrafficProps | ToneProps;

function isTrafficProps(p: DashboardStatusBadgeProps): p is TrafficProps {
  return "trafficLight" in p;
}

/**
 * Status pill for dashboard KPIs and engine health — supports traffic-light semantics
 * or the standard workspace tone palette.
 */
export function StatusBadge(props: DashboardStatusBadgeProps) {
  const tone = isTrafficProps(props) ? trafficLightToTone(props.trafficLight) : props.tone;
  return <WorkspaceStatusBadge label={props.label} tone={tone} />;
}
