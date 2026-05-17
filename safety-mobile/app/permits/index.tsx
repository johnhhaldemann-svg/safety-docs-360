import { useQuery } from "@tanstack/react-query";
import { listPermits } from "@/api/mobile";
import { EmptyState, ErrorState, LoadingState, StatusBanner } from "@/components/Enterprise";
import { RegisterAction, RegisterRow } from "@/components/ListPrimitives";
import { Screen } from "@/components/Screen";

type PermitRow = {
  id: string;
  title?: string | null;
  permit_type?: string | null;
  status?: string | null;
  severity?: string | null;
  updated_at?: string | null;
};

export default function PermitsScreen() {
  const { data = [], isLoading, error, refetch } = useQuery<PermitRow[]>({ queryKey: ["permits"], queryFn: listPermits });

  return (
    <Screen title="Permits" subtitle="Draft requests need manager or safety admin activation.">
      <RegisterAction href="/permits/new" label="New Permit Request" />
      <StatusBanner title="Review Required" detail="Mobile permit requests are saved as drafts until an authorized reviewer activates them." tone="warning" />
      {isLoading ? <LoadingState title="Loading permits..." /> : null}
      {error ? <ErrorState title="Permits Not Loaded" detail={error instanceof Error ? error.message : "Try again."} onRetry={() => void refetch()} /> : null}
      {!isLoading && !error && data.length === 0 ? <EmptyState title="No Permits Yet" detail="Permit requests and active permits will appear here." /> : null}
      {data.length > 0
        ? data.map((permit) => (
            <RegisterRow
              key={permit.id}
              title={permit.title || "Permit request"}
              meta={`${labelize(permit.permit_type)} • ${labelize(permit.severity)}`}
              badge={permit.status ?? "draft"}
              detail={permit.updated_at ? `Updated ${new Date(permit.updated_at).toLocaleString()}` : undefined}
            />
          ))
        : null}
    </Screen>
  );
}

function labelize(value?: string | null) {
  return String(value ?? "not set").replaceAll("_", " ");
}
