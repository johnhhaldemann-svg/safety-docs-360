import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { listFieldIssues } from "@/api/mobile";
import { theme } from "@/theme";

export default function FieldIssuesScreen() {
  const { data, isLoading } = useQuery({ queryKey: ["field-issues"], queryFn: listFieldIssues });
  return (
    <Screen title="Field Issues" subtitle="Hazards, observations, corrective actions, and closeout proof.">
      <Link style={styles.cta} href="/field-issues/new">New Field Issue</Link>
      {isLoading ? <Text style={styles.muted}>Loading...</Text> : null}
      <View style={styles.list}>
        {(data ?? []).map((item: { id: string; title?: string; status?: string; severity?: string }) => (
          <View key={item.id} style={styles.row}>
            <Text style={styles.title}>{item.title || "Untitled issue"}</Text>
            <Text style={styles.muted}>{item.status || "open"} | {item.severity || "medium"}</Text>
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
