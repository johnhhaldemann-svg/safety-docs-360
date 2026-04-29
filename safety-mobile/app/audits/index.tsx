import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { listAudits } from "@/api/mobile";
import { listStyles, RegisterAction, RegisterRow } from "@/components/ListPrimitives";

export default function AuditsScreen() {
  const { data, isLoading } = useQuery({ queryKey: ["audits"], queryFn: listAudits });
  return (
    <Screen title="Audits" subtitle="Field audits only for version 1.">
      <RegisterAction href="/audits/new" label="New Audit" />
      {isLoading ? <Text style={listStyles.muted}>Loading...</Text> : null}
      <View style={listStyles.list}>
        {(data ?? []).map((item: { id: string; selected_trade?: string; status?: string; audit_date?: string }) => (
          <RegisterRow key={item.id} title={(item.selected_trade || "Field Audit").replaceAll("_", " ")} meta={item.audit_date || "No date"} badge={item.status || "submitted"} />
        ))}
      </View>
    </Screen>
  );
}
