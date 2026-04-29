import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { listAudits } from "@/api/mobile";
import { theme } from "@/theme";

export default function AuditsScreen() {
  const { data, isLoading } = useQuery({ queryKey: ["audits"], queryFn: listAudits });
  return (
    <Screen title="Audits" subtitle="Field audits only for version 1.">
      <Link style={styles.cta} href="/audits/new">New Audit</Link>
      {isLoading ? <Text style={styles.muted}>Loading...</Text> : null}
      <View style={styles.list}>
        {(data ?? []).map((item: { id: string; selected_trade?: string; status?: string; audit_date?: string }) => (
          <View key={item.id} style={styles.row}>
            <Text style={styles.title}>{item.selected_trade || "Field audit"}</Text>
            <Text style={styles.muted}>{item.status || "submitted"} | {item.audit_date || "No date"}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cta: { color: theme.white, backgroundColor: theme.primary, padding: 14, borderRadius: 10, fontWeight: "900", textAlign: "center", overflow: "hidden" },
  list: { gap: 10 },
  row: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 12, padding: 14 },
  title: { color: theme.textStrong, fontWeight: "800" },
  muted: { color: theme.muted, marginTop: 4 }
});
