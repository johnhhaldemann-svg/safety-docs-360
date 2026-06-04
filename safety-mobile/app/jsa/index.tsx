import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { Screen } from "@/components/Screen";
import { listJsas } from "@/api/mobile";
import { listStyles, RegisterAction, RegisterRow } from "@/components/ListPrimitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/Enterprise";
import { getFriendlyApiError } from "@/api/client";

export default function JsaListScreen() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["jsa"], queryFn: listJsas });
  return (
    <Screen title="JSA" subtitle="Create, save, submit, and review job safety analyses.">
      <RegisterAction href="/jsa/new" label="New JSA" />
      {isLoading ? <LoadingState title="Loading JSAs..." /> : null}
      {error ? <ErrorState title="JSAs Not Loaded" detail={getFriendlyApiError(error)} onRetry={() => void refetch()} /> : null}
      {!isLoading && !error && (data ?? []).length === 0 ? <EmptyState title="No JSAs Yet" detail="Submitted mobile JSAs will appear here." /> : null}
      <View style={listStyles.list}>
        {(data ?? []).map((item: { id: string; title?: string; status?: string; description?: string | null; severity?: string }) => (
          <RegisterRow
            key={item.id}
            title={item.title || "Untitled JSA"}
            meta={item.severity ? `Risk: ${item.severity.replaceAll("_", " ")}` : "Job Safety Analysis"}
            badge={item.status || "draft"}
            detail={taskDetail(item.description)}
          />
        ))}
      </View>
    </Screen>
  );
}

function taskDetail(description?: string | null) {
  const taskLine = String(description ?? "")
    .split("\n")
    .find((line) => line.toLowerCase().startsWith("tasks:"));
  const tasks = taskLine?.replace(/^tasks:\s*/i, "").trim();
  return tasks || undefined;
}
