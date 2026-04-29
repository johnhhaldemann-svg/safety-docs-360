import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { listJsas } from "@/api/mobile";
import { listStyles, RegisterAction, RegisterRow } from "@/components/ListPrimitives";

export default function JsaListScreen() {
  const { data, isLoading } = useQuery({ queryKey: ["jsa"], queryFn: listJsas });
  return (
    <Screen title="JSA" subtitle="Create, save, submit, and review job safety analyses.">
      <RegisterAction href="/jsa/new" label="New JSA" />
      {isLoading ? <Text style={listStyles.muted}>Loading...</Text> : null}
      <View style={listStyles.list}>
        {(data ?? []).map((item: { id: string; title?: string; status?: string }) => (
          <RegisterRow key={item.id} title={item.title || "Untitled JSA"} meta="Job Safety Analysis" badge={item.status || "draft"} />
        ))}
      </View>
    </Screen>
  );
}
