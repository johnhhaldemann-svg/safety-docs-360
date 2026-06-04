import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { listPermits } from "@/api/mobile";
import { EmptyState, ErrorState, LoadingState, StatusBanner } from "@/components/Enterprise";
import { RegisterAction, RegisterRow } from "@/components/ListPrimitives";
import { Screen } from "@/components/Screen";
import { theme } from "@/theme";
import type { MobilePermit } from "@/types/mobile";

export default function PermitsScreen() {
  const { data = [], isLoading, error, refetch } = useQuery<MobilePermit[]>({ queryKey: ["permits"], queryFn: listPermits });
  const openPermits = data.filter((permit) => isOpenPermit(permit.status));
  const otherPermits = data.filter((permit) => !isOpenPermit(permit.status));

  return (
    <Screen title="Permits" subtitle="Open includes draft requests awaiting review and active permits.">
      <RegisterAction href="/permits/new" label="New Permit Request" />
      <StatusBanner title="Open Permits Stay Visible" detail="Mobile requests stay as draft until authorized review, but they remain listed here as open work." tone="warning" />
      {isLoading ? <LoadingState title="Loading permits..." /> : null}
      {error ? <ErrorState title="Permits Not Loaded" detail={error instanceof Error ? error.message : "Try again."} onRetry={() => void refetch()} /> : null}
      {!isLoading && !error && data.length === 0 ? <EmptyState title="No Permits Yet" detail="Draft requests and active permits will appear here." /> : null}
      {!isLoading && !error && openPermits.length > 0 ? (
        <PermitSection title="Open Permits" detail={`${openPermits.length} draft or active permit${openPermits.length === 1 ? "" : "s"}`}>
          {openPermits.map((permit) => (
            <PermitRegisterRow key={permit.id} permit={permit} />
          ))}
        </PermitSection>
      ) : null}
      {!isLoading && !error && data.length > 0 && openPermits.length === 0 ? (
        <EmptyState title="No Open Permits" detail="Draft requests and active permits will show here when selected or submitted." />
      ) : null}
      {!isLoading && !error && otherPermits.length > 0 ? (
        <PermitSection title="Closed / Expired" detail={`${otherPermits.length} archived permit${otherPermits.length === 1 ? "" : "s"}`}>
          {otherPermits.map((permit) => (
            <PermitRegisterRow key={permit.id} permit={permit} />
          ))}
        </PermitSection>
      ) : null}
    </Screen>
  );
}

function PermitSection({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionDetail}>{detail}</Text>
      </View>
      <View style={styles.rows}>{children}</View>
    </View>
  );
}

function PermitRegisterRow({ permit }: { permit: MobilePermit }) {
  return (
    <RegisterRow
      title={permit.title || "Permit request"}
      meta={`${labelize(permit.permit_type)} | ${labelize(permit.severity)}`}
      badge={statusBadge(permit.status)}
      detail={permit.updated_at ? `Updated ${new Date(permit.updated_at).toLocaleString()}` : undefined}
    />
  );
}

function isOpenPermit(status?: string | null) {
  const normalized = String(status ?? "draft").toLowerCase();
  return normalized === "draft" || normalized === "active" || normalized === "open";
}

function statusBadge(status?: string | null) {
  const normalized = String(status ?? "draft").toLowerCase();
  if (normalized === "draft") return "Draft request";
  if (normalized === "active" || normalized === "open") return "Active permit";
  return normalized || "draft";
}

function labelize(value?: string | null) {
  return String(value ?? "not set").replaceAll("_", " ");
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionHeader: { gap: 3, paddingHorizontal: 2 },
  sectionTitle: { color: theme.textStrong, fontSize: 16, fontWeight: "900" },
  sectionDetail: { color: theme.muted, fontSize: 12, fontWeight: "800" },
  rows: { gap: 10 },
});
