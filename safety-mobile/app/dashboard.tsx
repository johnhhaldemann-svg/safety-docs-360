import { Link, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
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

  const status = getErrorStatus(error);
  const errorMessage = getErrorMessage(error);

  useEffect(() => {
    if (status === 401) {
      clearSession().finally(() => router.replace("/login"));
    }
  }, [status]);

  async function logout() {
    await clearSession();
    router.replace("/login");
  }

  if (isLoading) {
    return <Screen title="Dashboard" subtitle="Loading field workspace..." />;
  }
  if (error || !data) {
    return (
      <Screen
        title="Dashboard"
        subtitle={
          status === 401
            ? "Your sign-in expired. Sending you back to login..."
            : `Could not load your mobile workspace.${errorMessage ? ` ${errorMessage}` : " Check your connection."}`
        }
      />
    );
  }

  return (
    <Screen title="Field Command Center" subtitle={data.user.companyName || data.user.team}>
      <View style={styles.summary}>
        <View style={styles.summaryBody}>
          <Text style={styles.summaryKicker}>Today</Text>
          <Text style={styles.summaryTitle}>Ready For Field Work</Text>
          <Text style={styles.summarySub}>Login required, online sync, admin review on submit</Text>
        </View>
        <Text style={styles.summaryMeta}>{data.dashboard.assignedJobsites} Jobsites</Text>
      </View>
      <View style={styles.stats}>
        <Stat label="Open issues" value={data.dashboard.openIssues} />
        <Stat label="Active JSAs" value={data.dashboard.activeJsas} />
        <Stat label="Recent audits" value={data.dashboard.recentAudits} />
        <Stat label="Jobsites" value={data.dashboard.assignedJobsites} />
      </View>
      <View style={styles.opsPanel}>
        <Text style={styles.opsTitle}>Mobile Access</Text>
        <View style={styles.chipRow}>
          {data.features.map((feature) => (
            <Text key={feature} style={styles.chip}>
              {feature.replace("mobile_", "").replaceAll("_", " ")}
            </Text>
          ))}
        </View>
      </View>
      <Text style={styles.sectionLabel}>Start Work</Text>
      <View style={styles.actions}>
        {featureEnabled(data.features, "mobile_jsa") ? <Tile href="/jsa/new" label="Start JSA" meta="Pre-task planning" icon="clipboard" /> : null}
        {featureEnabled(data.features, "mobile_field_issues") ? <Tile href="/field-issues/new" label="Report Field Issue" meta="Observation or corrective action" icon="issue" /> : null}
        {featureEnabled(data.features, "mobile_field_audits") ? <Tile href="/audits/new" label="Start Audit" meta="Checklist, photos, signature" icon="audit" /> : null}
        <Tile href="/profile" label="Profile" meta="Account and permissions" icon="profile" />
      </View>
      <Text style={styles.sectionLabel}>Review Records</Text>
      <View style={styles.links}>
        {featureEnabled(data.features, "mobile_jsa") ? <Link style={styles.link} href="/jsa">JSA Register</Link> : null}
        {featureEnabled(data.features, "mobile_field_issues") ? <Link style={styles.link} href="/field-issues">Field Issue Register</Link> : null}
        {featureEnabled(data.features, "mobile_field_audits") ? <Link style={styles.link} href="/audits">Audit Register</Link> : null}
      </View>
      <View style={styles.jobsitePanel}>
        <Text style={styles.opsTitle}>Assigned Jobsites</Text>
        {data.jobsites.slice(0, 4).map((jobsite) => (
          <View key={jobsite.id} style={styles.jobsiteRow}>
            <Text style={styles.jobsiteName}>{jobsite.name}</Text>
            <Text style={styles.jobsiteStatus}>{jobsite.status || "active"}</Text>
          </View>
        ))}
        {data.jobsites.length === 0 ? <Text style={styles.emptyText}>No jobsites assigned yet.</Text> : null}
      </View>
      <Pressable onPress={logout} style={styles.logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </Screen>
  );
}

function getErrorStatus(error: unknown) {
  if (typeof error === "object" && error && "status" in error && typeof error.status === "number") {
    return error.status;
  }
  return null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "";
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

type TileIconName = "clipboard" | "issue" | "audit" | "profile";

function Tile({ href, label, meta, icon }: { href: Parameters<typeof Link>[0]["href"]; label: string; meta: string; icon: TileIconName }) {
  return (
    <Link href={href} asChild>
      <Pressable style={styles.tile}>
        <View style={styles.tileAccent}>
          <TileIcon name={icon} />
        </View>
        <View style={styles.tileBody}>
          <Text style={styles.tileText}>{label}</Text>
          <Text style={styles.tileMeta}>{meta}</Text>
        </View>
        <Text style={styles.tileArrow}>{">"}</Text>
      </Pressable>
    </Link>
  );
}

function TileIcon({ name }: { name: TileIconName }) {
  if (name === "issue") {
    return (
      <View style={styles.issueIcon}>
        <View style={styles.issueLineTall} />
        <View style={styles.issueDot} />
      </View>
    );
  }

  if (name === "audit") {
    return (
      <View style={styles.auditIcon}>
        <View style={styles.auditRow}>
          <View style={styles.auditCheck} />
          <View style={styles.auditLine} />
        </View>
        <View style={styles.auditRow}>
          <View style={styles.auditCheck} />
          <View style={styles.auditLineShort} />
        </View>
      </View>
    );
  }

  if (name === "profile") {
    return (
      <View style={styles.profileIcon}>
        <View style={styles.profileHead} />
        <View style={styles.profileBody} />
      </View>
    );
  }

  return (
    <View style={styles.clipboardIcon}>
      <View style={styles.clipboardClip} />
      <View style={styles.clipboardLine} />
      <View style={styles.clipboardLineShort} />
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    width: "100%",
    borderWidth: 1,
    borderColor: theme.borderStrong,
    backgroundColor: theme.surface,
    borderRadius: 8,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10
  },
  summaryBody: { flex: 1, minWidth: 0 },
  summaryKicker: { color: theme.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1.4, textTransform: "uppercase" },
  summaryTitle: { color: theme.textStrong, fontSize: 17, fontWeight: "900", marginTop: 4, flexShrink: 1 },
  summarySub: { color: theme.muted, fontSize: 12, fontWeight: "700", marginTop: 4, flexShrink: 1, lineHeight: 17 },
  summaryMeta: { color: theme.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase", flexShrink: 0, textAlign: "right", maxWidth: 82 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { flexGrow: 1, flexBasis: "46%", minWidth: 0, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 8, padding: 14 },
  statValue: { color: theme.textStrong, fontSize: 27, fontWeight: "900" },
  statLabel: { color: theme.muted, fontWeight: "800", marginTop: 4, textTransform: "uppercase", fontSize: 11 },
  opsPanel: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 8, padding: 14, gap: 10 },
  opsTitle: { color: theme.textStrong, fontWeight: "900", fontSize: 14 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { color: theme.primary, backgroundColor: theme.primarySoft, borderRadius: 999, overflow: "hidden", paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  sectionLabel: { color: theme.slate, fontSize: 12, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase", marginTop: 2 },
  actions: { gap: 10 },
  tile: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderStrong, borderRadius: 8, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  tileAccent: { width: 44, height: 44, borderRadius: 8, backgroundColor: theme.primarySoft, alignItems: "center", justifyContent: "center" },
  tileBody: { flex: 1, minWidth: 0, gap: 3 },
  tileText: { color: theme.textStrong, fontWeight: "900", fontSize: 16, flexShrink: 1 },
  tileMeta: { color: theme.muted, fontWeight: "700", fontSize: 12, flexShrink: 1 },
  tileArrow: { color: theme.primary, fontSize: 28, fontWeight: "700", flexShrink: 0 },
  links: { gap: 8, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 8, padding: 10 },
  link: { color: theme.primary, fontWeight: "900", paddingVertical: 8 },
  jobsitePanel: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 8, padding: 14, gap: 10 },
  jobsiteRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10 },
  jobsiteName: { color: theme.textStrong, fontWeight: "900", flex: 1 },
  jobsiteStatus: { color: theme.muted, fontWeight: "900", textTransform: "uppercase", fontSize: 11 },
  emptyText: { color: theme.muted, fontWeight: "700" },
  clipboardIcon: { width: 22, height: 26, borderWidth: 2, borderColor: theme.primary, borderRadius: 4, paddingTop: 8, paddingHorizontal: 4, gap: 4 },
  clipboardClip: { position: "absolute", top: -5, alignSelf: "center", width: 12, height: 7, borderWidth: 2, borderColor: theme.primary, borderRadius: 3, backgroundColor: theme.primarySoft },
  clipboardLine: { height: 2, backgroundColor: theme.primary, borderRadius: 2 },
  clipboardLineShort: { width: 9, height: 2, backgroundColor: theme.primary, borderRadius: 2 },
  issueIcon: { width: 25, height: 25, borderWidth: 2, borderColor: theme.danger, borderRadius: 6, transform: [{ rotate: "45deg" }], alignItems: "center", justifyContent: "center" },
  issueLineTall: { width: 2, height: 11, backgroundColor: theme.danger, borderRadius: 2 },
  issueDot: { width: 3, height: 3, backgroundColor: theme.danger, borderRadius: 3, marginTop: 3 },
  auditIcon: { width: 26, gap: 6 },
  auditRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  auditCheck: { width: 8, height: 8, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: theme.accent, transform: [{ rotate: "-45deg" }] },
  auditLine: { flex: 1, height: 2, backgroundColor: theme.accent, borderRadius: 2 },
  auditLineShort: { width: 10, height: 2, backgroundColor: theme.accent, borderRadius: 2 },
  profileIcon: { alignItems: "center", gap: 3 },
  profileHead: { width: 12, height: 12, borderRadius: 12, borderWidth: 2, borderColor: theme.primary },
  profileBody: { width: 22, height: 11, borderTopLeftRadius: 11, borderTopRightRadius: 11, borderWidth: 2, borderBottomWidth: 0, borderColor: theme.primary },
  logout: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 8, padding: 14, alignItems: "center" },
  logoutText: { color: theme.textStrong, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 }
});
