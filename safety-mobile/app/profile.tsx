import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { AppCard, LoadingState, StatusBanner } from "@/components/Enterprise";
import { Screen } from "@/components/Screen";
import { getMe } from "@/api/mobile";
import { theme } from "@/theme";

export default function ProfileScreen() {
  const { data, isLoading } = useQuery({ queryKey: ["me"], queryFn: getMe });
  return (
    <Screen title="Profile" subtitle="Current mobile account and enabled field modules.">
      {isLoading ? <LoadingState title="Loading profile..." /> : null}
      {!isLoading && data ? (
        <>
          <StatusBanner title="Mobile Permissions" detail={`${data.features.length} enabled field module${data.features.length === 1 ? "" : "s"}.`} tone="success" />
          <AppCard title="Account" eyebrow="Signed in">
            <Row label="Email" value={data.user.email} />
            <Row label="Role" value={data.user.role} />
            <Row label="Team" value={data.user.team} />
            <Row label="Company" value={data.user.companyName || "Not linked"} />
            <Row label="Features" value={data.features.map((item) => item.replace("mobile_", "").replaceAll("_", " ")).join(", ")} />
          </AppCard>
        </>
      ) : null}
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
  row: { gap: 4, borderBottomWidth: 1, borderBottomColor: theme.border, paddingBottom: 10 },
  label: { color: theme.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  value: { color: theme.textStrong, fontSize: 15, fontWeight: "800" }
});
