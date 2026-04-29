import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { getMe } from "@/api/mobile";
import { theme } from "@/theme";

export default function ProfileScreen() {
  const { data, isLoading } = useQuery({ queryKey: ["me"], queryFn: getMe });
  return (
    <Screen title="Profile" subtitle="Current mobile account and enabled field modules.">
      {isLoading || !data ? null : (
        <View style={styles.card}>
          <Row label="Email" value={data.user.email} />
          <Row label="Role" value={data.user.role} />
          <Row label="Team" value={data.user.team} />
          <Row label="Company" value={data.user.companyName || "Not linked"} />
          <Row label="Features" value={data.features.join(", ")} />
        </View>
      )}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 14, padding: 16, gap: 14 },
  row: { gap: 4 },
  label: { color: theme.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  value: { color: theme.textStrong, fontSize: 15, fontWeight: "700" }
});
