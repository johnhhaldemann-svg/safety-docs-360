import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { listFieldIssues } from "@/api/mobile";
import { listStyles, RegisterAction, RegisterRow } from "@/components/ListPrimitives";

export default function FieldIssuesScreen() {
  const { data, isLoading } = useQuery({ queryKey: ["field-issues"], queryFn: listFieldIssues });
  return (
    <Screen title="Field Issues" subtitle="Hazards, observations, corrective actions, and closeout proof.">
      <RegisterAction href="/field-issues/new" label="New Field Issue" />
      {isLoading ? <Text style={listStyles.muted}>Loading...</Text> : null}
      <View style={listStyles.list}>
        {(data ?? []).map((item: { id: string; title?: string; status?: string; severity?: string }) => (
          <RegisterRow key={item.id} title={item.title || "Untitled Issue"} meta={`Severity: ${item.severity || "medium"}`} badge={item.status || "open"} />
        ))}
      </View>
    </Screen>
  );
}
