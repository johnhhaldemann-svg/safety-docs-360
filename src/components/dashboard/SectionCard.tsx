import type { ComponentProps } from "react";
import { SectionCard as WorkspaceSectionCard } from "@/components/WorkspacePrimitives";

export type DashboardSectionCardProps = ComponentProps<typeof WorkspaceSectionCard>;

/**
 * Dashboard overview section shell — matches app {@link WorkspaceSectionCard} styling.
 */
export function SectionCard(props: DashboardSectionCardProps) {
  return <WorkspaceSectionCard {...props} />;
}
