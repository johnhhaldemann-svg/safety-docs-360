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
        {(data ?? []).map((item: { id: string; selected_trade?: string; status?: string; audit_date?: string }) => {
          const trades = formatTrades(item.selected_trade);
          return (
            <RegisterRow
              key={item.id}
              title={trades.title}
              meta={item.audit_date || "No date"}
              badge={item.status || "submitted"}
              detail={trades.detail}
            />
          );
        })}
      </View>
    </Screen>
  );
}

function formatTrades(value?: string) {
  const trades = String(value ?? "")
    .split(",")
    .map((trade) => trade.trim())
    .filter(Boolean)
    .map((trade) => trade.replaceAll("_", " "));
  if (trades.length < 1) return { title: "Field Audit", detail: undefined };
  if (trades.length === 1) return { title: toTitleCase(trades[0]), detail: undefined };
  return {
    title: `${trades.length} Trade Audit`,
    detail: trades.map(toTitleCase).join(", "),
  };
}

function toTitleCase(value: string) {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
