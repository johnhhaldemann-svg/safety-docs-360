import { Badge } from "@/components/ui/badge";

export function ObservationStatusBadge({ status }: { status: string }) {
  const v = status.trim();
  const variant =
    v === "Closed" ? "success" : v === "In Progress" ? "secondary" : "outline";
  return <Badge variant={variant}>{v}</Badge>;
}
