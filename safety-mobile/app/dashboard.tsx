import { Link, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { getMe } from "@/api/mobile";
import { clearSession } from "@/auth/session";
import type { MobileFeature } from "@/types/mobile";
import { theme } from "@/theme";

function featureEnabled(features: MobileFeature[], feature: MobileFeature) {
  return features.includes(feature);
}

export default function DashboardScreen() {
  const { data, isLoading, error } = useQuery({ queryKey: ["me"], queryFn: getMe });

  async function logout() {
    await clearSession();
    router.replace("/login");
  }

  if (isLoading) {
    return <Screen title="Dashboard" subtitle="Loading field workspace..." />;
  }
  if (error || !data) {
    return <Screen title="Dashboard" subtitle="Could not load your mobile workspace. Check your connection." />;
  }

  return (
    <Screen title="Field dashboard" subtitle={data.user.companyName || data.user.team}>
      <View style={styles.stats}>
        <Stat label="Open issues" value={data.dashboard.openIssues} />
        <Stat label="Active JSAs" value={data.dashboard.activeJsas} />
        <Stat label="Recent audits" value={data.dashboard.recentAudits} />
        <Stat label="Jobsites" value={data.dashboard.assignedJobsites} />
      </View>
      <View style={styles.actions}>
        {featureEnabled(data.features, "mobile_jsa") ? <Tile href="/jsa/new" label="Start JSA" /> : null}
        {featureEnabled(data.features, "mobile_field_issues") ? <Tile href="/field-issues/new" label="Report Field Issue" /> : null}
        {featureEnabled(data.features, "mobile_field_audits") ? <Tile href="/audits/new" label="Start Audit" /> : null}
        <Tile href="/profile" label="Profile" />
      </View>
      <View style={styles.links}>
        {featureEnabled(data.features, "mobile_jsa") ? <Link style={styles.link} href="/jsa">View JSAs</Link> : null}
        {featureEnabled(data.features, "mobile_field_issues") ? <Link style={styles.link} href="/field-issues">View Field Issues</Link> : null}
        {featureEnabled(data.features, "mobile_field_audits") ? <Link style={styles.link} href="/audits">View Audits</Link> : null}
      </View>
      <Pressable onPress={logout} style={styles.logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Tile({ href, label }: { href: Parameters<typeof Link>[0]["href"]; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable style={styles.tile}>
        <Text style={styles.tileText}>{label}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { width: "48%", borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 12, padding: 14 },
  statValue: { color: theme.textStrong, fontSize: 28, fontWeight: "900" },
  statLabel: { color: theme.muted, fontWeight: "700", marginTop: 4 },
  actions: { gap: 10 },
  tile: { backgroundColor: theme.primary, borderRadius: 12, padding: 16 },
  tileText: { color: theme.white, fontWeight: "900", fontSize: 16 },
  links: { gap: 8 },
  link: { color: theme.primary, fontWeight: "800", paddingVertical: 6 },
  logout: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 10, padding: 14, alignItems: "center" },
  logoutText: { color: theme.textStrong, fontWeight: "800" }
});
