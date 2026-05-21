import { useQuery } from "@tanstack/react-query";
import { listIncidentReports } from "@/api/mobile";
import { EmptyState, ErrorState, LoadingState, StatusBanner } from "@/components/Enterprise";
import { RegisterAction, RegisterRow } from "@/components/ListPrimitives";
import { Screen } from "@/components/Screen";

type IncidentReportRow = {
  id: string;
  title?: string | null;
  category?: string | null;
  severity?: string | null;
  review_status?: string | null;
  created_at?: string | null;
};

export default function IncidentsScreen() {
  const { data = [], isLoading, error, refetch } = useQuery<IncidentReportRow[]>({ queryKey: ["incidents"], queryFn: listIncidentReports });

  return (
    <Screen title="Incidents" subtitle="Incident and near-miss reports submitted for review.">
      <RegisterAction href="/incidents/new" label="New Incident Report" />
      <StatusBanner title="Manager Review" detail="Submitted reports stay in review until a manager or safety admin approves or rejects them." tone="warning" />
      {isLoading ? <LoadingState title="Loading incident reports..." /> : null}
      {error ? <ErrorState title="Incidents Not Loaded" detail={error instanceof Error ? error.message : "Try again."} onRetry={() => void refetch()} /> : null}
      {!isLoading && !error && data.length === 0 ? <EmptyState title="No Incident Reports" detail="New incident and near-miss reports will appear here." /> : null}
      {data.map((incident) => (
        <RegisterRow
          key={incident.id}
          title={incident.title || "Incident report"}
          meta={`${labelize(incident.category)} • ${labelize(incident.severity)}`}
          badge={incident.review_status ?? "pending"}
          detail={incident.created_at ? `Submitted ${new Date(incident.created_at).toLocaleString()}` : undefined}
        />
      ))}
    </Screen>
  );
}

function labelize(value?: string | null) {
  return String(value ?? "not set").replaceAll("_", " ");
}
