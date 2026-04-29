import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { Screen } from "@/components/Screen";
import { listFieldIssues } from "@/api/mobile";
import { listStyles, RegisterAction, RegisterRow } from "@/components/ListPrimitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/Enterprise";
import { getFriendlyApiError } from "@/api/client";

export default function FieldIssuesScreen() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["field-issues"], queryFn: listFieldIssues });
  return (
    <Screen title="Field Issues" subtitle="Hazards, observations, corrective actions, and closeout proof.">
      <RegisterAction href="/field-issues/new" label="New Field Issue" />
      {isLoading ? <LoadingState title="Loading field issues..." /> : null}
      {error ? <ErrorState title="Field Issues Not Loaded" detail={getFriendlyApiError(error)} onRetry={() => void refetch()} /> : null}
      {!isLoading && !error && (data ?? []).length === 0 ? <EmptyState title="No Field Issues Yet" detail="New field reports will appear here after sync." /> : null}
      <View style={listStyles.list}>
        {(data ?? []).map((item: { id: string; title?: string; status?: string; severity?: string }) => (
          <RegisterRow key={item.id} title={item.title || "Untitled Issue"} meta={`Severity: ${item.severity || "medium"}`} badge={item.status || "open"} />
        ))}
      </View>
    </Screen>
  );
}
