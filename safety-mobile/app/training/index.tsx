import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { listTrainingReadiness } from "@/api/mobile";
import { AppCard, EmptyState, ErrorState, LoadingState, MetricTile, StatusBanner } from "@/components/Enterprise";
import { RegisterRow } from "@/components/ListPrimitives";
import { Screen } from "@/components/Screen";
import { theme } from "@/theme";

type ReadinessRow = {
  id?: string;
  userId?: string;
  employeeId?: string;
  name?: string;
  email?: string;
  contractorName?: string;
  readinessStatus?: string;
  status?: string;
  summary?: string;
};

type ReadinessResponse = {
  rows?: ReadinessRow[];
  summary?: Record<string, number>;
};

export default function TrainingScreen() {
  const { data, isLoading, error, refetch } = useQuery<ReadinessResponse>({ queryKey: ["training-readiness"], queryFn: () => listTrainingReadiness() });
  const rows = data?.rows ?? [];
  const summary = data?.summary ?? {};

  return (
    <Screen title="Training Readiness" subtitle="Crew readiness and training gaps for field planning.">
      <StatusBanner title="Readiness Check" detail="Use this before work starts to find missing or limited training readiness." tone="info" />
      <View style={styles.metrics}>
        <MetricTile label="Ready" value={summary.ready ?? 0} tone="success" />
        <MetricTile label="Needs Training" value={summary.needsTraining ?? summary.needs_training ?? 0} tone="warning" />
        <MetricTile label="Limited" value={summary.limited ?? 0} tone="warning" />
        <MetricTile label="Rows" value={rows.length} />
      </View>
      {isLoading ? <LoadingState title="Loading readiness..." /> : null}
      {error ? <ErrorState title="Readiness Not Loaded" detail={error instanceof Error ? error.message : "Try again."} onRetry={() => void refetch()} /> : null}
      {!isLoading && !error && rows.length === 0 ? <EmptyState title="No Readiness Rows" detail="Training readiness rows will appear once employees or contractors are tracked." /> : null}
      {rows.slice(0, 30).map((row, index) => (
        <RegisterRow
          key={row.id ?? row.userId ?? row.employeeId ?? String(index)}
          title={row.name || row.email || "Worker"}
          meta={row.contractorName || row.email || "Company worker"}
          badge={row.readinessStatus ?? row.status ?? "review"}
          detail={row.summary}
        />
      ))}
      {rows.length > 30 ? (
        <AppCard>
          <Text style={styles.moreText}>{rows.length - 30} more rows available in the web training matrix.</Text>
        </AppCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  moreText: { color: theme.muted, fontWeight: "800" },
});
