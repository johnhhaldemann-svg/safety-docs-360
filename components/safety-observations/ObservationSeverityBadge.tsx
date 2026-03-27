import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ObservationSeverityBadge({ severity }: { severity: string }) {
  const v = severity.trim();
  const variant =
    v === "Critical" || v === "High"
      ? "destructive"
      : v === "Medium"
        ? "warning"
        : "secondary";
  return (
    <Badge variant={variant} className={cn(v === "Medium" && "bg-amber-100 text-amber-900")}>
      {v}
    </Badge>
  );
}
