import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { Screen } from "@/components/Screen";
import { listAudits } from "@/api/mobile";
import { listStyles, RegisterAction, RegisterRow } from "@/components/ListPrimitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/Enterprise";
import { getFriendlyApiError } from "@/api/client";

export default function AuditsScreen() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["audits"], queryFn: listAudits });
  return (
    <Screen title="Audits" subtitle="Field audits only for version 1.">
      <RegisterAction href="/audits/new" label="New Audit" />
      {isLoading ? <LoadingState title="Loading audits..." /> : null}
      {error ? <ErrorState title="Audits Not Loaded" detail={getFriendlyApiError(error)} onRetry={() => void refetch()} /> : null}
      {!isLoading && !error && (data ?? []).length === 0 ? <EmptyState title="No Audits Yet" detail="Submitted mobile audits will appear here." /> : null}
      <View style={listStyles.list}>
        {(data ?? []).map((item: { id: string; selected_trade?: string; status?: string; audit_date?: string }) => (
          <RegisterRow key={item.id} title={(item.selected_trade || "Field Audit").replaceAll("_", " ")} meta={item.audit_date || "No date"} badge={item.status || "submitted"} />
        ))}
      </View>
    </Screen>
  );
}
