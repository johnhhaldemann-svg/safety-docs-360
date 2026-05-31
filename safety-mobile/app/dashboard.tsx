import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getApiErrorStatus, getFriendlyApiError } from "@/api/client";
import { getMe } from "@/api/mobile";
import { clearSession } from "@/auth/session";
import {
  AppCard,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricTile,
  ModuleCard,
  SectionHeader,
  StatusBanner,
} from "@/components/Enterprise";
import { Screen } from "@/components/Screen";
import type { MobileFeature } from "@/types/mobile";
import { theme } from "@/theme";

const MOBILE_RELEASE_LABEL = "Build 9 sync";

function featureEnabled(features: MobileFeature[], feature: MobileFeature) {
  return features.includes(feature);
}

function formatTime(value?: string) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function DashboardScreen() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch, isRefetching } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const status = getApiErrorStatus(error);

  useEffect(() => {
    if (status === 401) {
      clearSession().finally(() => router.replace("/login"));
    }
  }, [status]);

  async function logout() {
    await clearSession();
    router.replace("/login");
  }

  async function syncWorkspace() {
    await queryClient.invalidateQueries();
    await refetch();
  }

  if (isLoading) {
    return (
      <Screen title="Dashboard" subtitle="Loading your mobile field workspace.">
        <LoadingState />
      </Screen>
    );
  }

  if (error || !data) {
    async function signInAgain() {
      await clearSession();
      router.replace("/login");
    }

    return (
      <Screen
        title="Dashboard"
        subtitle="Could not load your mobile workspace."
        headerAside={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sync workspace"
            onPress={() => void refetch()}
            disabled={isRefetching}
            style={[styles.syncButton, isRefetching ? styles.syncButtonDisabled : null]}
          >
            <Ionicons name="refresh" size={13} color={theme.accent} />
            <Text style={styles.syncText}>{isRefetching ? "Syncing" : "Sync"}</Text>
          </Pressable>
        }
      >
        <ErrorState
          title={status === 401 ? "Session Expired" : "Workspace Not Loaded"}
          detail={
            status === 401
              ? "Please sign in again to continue."
              : getFriendlyApiError(error, "Check your connection and try again.")
          }
          onRetry={() => void refetch()}
        />
        <Pressable onPress={signInAgain} style={styles.logout}>
          <Text style={styles.logoutText}>Sign In Again</Text>
        </Pressable>
        <Text style={styles.releaseText}>{MOBILE_RELEASE_LABEL}</Text>
      </Screen>
    );
  }

  const activity = data.dashboard.recentActivity ?? [];

  return (
    <Screen
      title="Dashboard"
      subtitle={data.user.companyName || data.user.team || "Mobile field workspace"}
      headerAside={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sync workspace"
          onPress={syncWorkspace}
          disabled={isRefetching}
          style={[styles.syncButton, isRefetching ? styles.syncButtonDisabled : null]}
        >
          <Ionicons name="refresh" size={13} color={theme.accent} />
          <Text style={styles.syncText}>{isRefetching ? "Syncing" : "Sync"}</Text>
          <Text style={styles.syncTime}>{formatTime(data.dashboard.lastSyncAt)}</Text>
        </Pressable>
      }
    >
      <StatusBanner
        title="Ready For Field Work"
        detail={`Online sync is active. JSAs, field issues, and audits submit back to the platform for review. ${MOBILE_RELEASE_LABEL}.`}
        tone="success"
      />

      <View style={styles.metrics}>
        <MetricTile label="Open Issues" value={data.dashboard.openIssues} tone={data.dashboard.openIssues > 0 ? "warning" : "neutral"} />
        <MetricTile label="Active JSAs" value={data.dashboard.activeJsas} />
        <MetricTile label="Recent Audits" value={data.dashboard.recentAudits} />
        <MetricTile label="Pending Review" value={data.dashboard.pendingAuditReviews ?? 0} tone={(data.dashboard.pendingAuditReviews ?? 0) > 0 ? "warning" : "success"} />
        <MetricTile label="Permit Requests" value={data.dashboard.draftPermits ?? 0} tone={(data.dashboard.draftPermits ?? 0) > 0 ? "warning" : "neutral"} />
        <MetricTile label="Incident Reviews" value={data.dashboard.pendingIncidentReviews ?? 0} tone={(data.dashboard.pendingIncidentReviews ?? 0) > 0 ? "warning" : "neutral"} />
      </View>

      <SectionHeader title="Start Work" detail={`${data.dashboard.assignedJobsites} assigned jobsite${data.dashboard.assignedJobsites === 1 ? "" : "s"}`} />
      <View style={styles.stack}>
        {featureEnabled(data.features, "mobile_jsa") ? (
          <ModuleCard title="Start JSA" detail="Pre-task planning, hazards, PPE, photos, and signoff." iconName="document-text-outline" onPress={() => router.push("/jsa/new")} />
        ) : null}
        {featureEnabled(data.features, "mobile_field_issues") ? (
          <ModuleCard title="Report Field Issue" detail="Create a platform-safe observation or corrective action." tone="danger" iconName="alert-circle-outline" onPress={() => router.push("/field-issues/new")} />
        ) : null}
        {featureEnabled(data.features, "mobile_field_audits") ? (
          <ModuleCard title="Start Audit" detail="Trade checklist, evidence, hours billed, and admin review." tone="success" iconName="clipboard-outline" onPress={() => router.push("/audits/new")} />
        ) : null}
        {featureEnabled(data.features, "mobile_permits") ? (
          <ModuleCard title="Request Permit" detail="Submit hot work, LOTO, excavation, confined space, or lift permits for review." iconName="construct-outline" onPress={() => router.push("/permits/new")} />
        ) : null}
        {featureEnabled(data.features, "mobile_incidents") ? (
          <ModuleCard title="Report Incident" detail="Capture incident or near-miss details for manager review." tone="danger" iconName="medical-outline" onPress={() => router.push("/incidents/new")} />
        ) : null}
        {featureEnabled(data.features, "mobile_toolbox") ? (
          <ModuleCard title="Toolbox Talk" detail="Start a toolbox session and collect attendee signoff notes." tone="neutral" iconName="chatbubbles-outline" onPress={() => router.push("/toolbox/new")} />
        ) : null}
        {featureEnabled(data.features, "mobile_safety_intelligence") ? (
          <ModuleCard title="Safety Intelligence" detail="Generate a daily risk briefing or pre-task checklist." tone="neutral" iconName="bulb-outline" onPress={() => router.push("/safety-intelligence")} />
        ) : null}
      </View>

      <SectionHeader title="Review Records" />
      <View style={styles.stack}>
        {featureEnabled(data.features, "mobile_jsa") ? <ModuleCard title="JSA Register" detail="Review submitted and active JSAs." tone="neutral" iconName="list-outline" onPress={() => router.push("/jsa")} /> : null}
        {featureEnabled(data.features, "mobile_field_issues") ? <ModuleCard title="Field Issue Register" detail="View open field issues and corrective actions." tone="neutral" iconName="warning-outline" onPress={() => router.push("/field-issues")} /> : null}
        {featureEnabled(data.features, "mobile_field_audits") ? <ModuleCard title="Audit Register" detail="Review audit submissions and status." tone="neutral" iconName="reader-outline" onPress={() => router.push("/audits")} /> : null}
        {featureEnabled(data.features, "mobile_permits") ? <ModuleCard title="Permit Register" detail="Review draft, active, closed, and expired permits." tone="neutral" iconName="construct-outline" onPress={() => router.push("/permits")} /> : null}
        {featureEnabled(data.features, "mobile_incidents") ? <ModuleCard title="Incident Register" detail="Review submitted incidents and near misses." tone="neutral" iconName="medkit-outline" onPress={() => router.push("/incidents")} /> : null}
        {featureEnabled(data.features, "mobile_toolbox") ? <ModuleCard title="Toolbox Register" detail="Review jobsite toolbox sessions." tone="neutral" iconName="chatbox-ellipses-outline" onPress={() => router.push("/toolbox")} /> : null}
        {featureEnabled(data.features, "mobile_training") ? <ModuleCard title="Training Readiness" detail="Check crew readiness and training gaps." tone="neutral" iconName="school-outline" onPress={() => router.push("/training")} /> : null}
        {featureEnabled(data.features, "mobile_documents") ? <ModuleCard title="Documents" detail="Open approved field documents." tone="neutral" iconName="folder-open-outline" onPress={() => router.push("/documents")} /> : null}
        {featureEnabled(data.features, "mobile_reports") ? <ModuleCard title="Reports" detail="Open published field reports." tone="neutral" iconName="document-attach-outline" onPress={() => router.push("/reports")} /> : null}
        {featureEnabled(data.features, "mobile_jobsites") ? <ModuleCard title="Jobsites" detail="Review assigned jobsites and customer context." tone="neutral" iconName="location-outline" onPress={() => router.push("/jobsites")} /> : null}
        <ModuleCard title="Profile" detail="Account, role, and permissions." tone="neutral" iconName="person-circle-outline" onPress={() => router.push("/profile")} />
      </View>

      <SectionHeader title="Recent Activity" />
      {activity.length > 0 ? (
        <AppCard>
          {activity.map((item) => (
            <View key={item.id} style={styles.activityRow}>
              <View style={styles.activityText}>
                <Text style={styles.activityLabel}>{item.label}</Text>
                <Text style={styles.activityDetail}>{item.detail}</Text>
              </View>
              <Text style={[styles.activityTone, item.tone === "warning" ? styles.warningText : item.tone === "success" ? styles.successText : null]}>
                {formatTime(item.createdAt ?? undefined)}
              </Text>
            </View>
          ))}
        </AppCard>
      ) : (
        <EmptyState title="No Recent Activity" detail="New mobile submissions will appear here after sync." />
      )}

      <SectionHeader title="Assigned Jobsites" />
      <AppCard>
        {data.jobsites.slice(0, 5).map((jobsite) => (
          <View key={jobsite.id} style={styles.jobsiteRow}>
            <View style={styles.activityText}>
              <Text style={styles.jobsiteName}>{jobsite.name}</Text>
              {jobsite.customer_company_name ? <Text style={styles.activityDetail}>{jobsite.customer_company_name}</Text> : null}
            </View>
            <Text style={styles.jobsiteStatus}>{jobsite.status || "active"}</Text>
          </View>
        ))}
        {data.jobsites.length === 0 ? <Text style={styles.emptyText}>No jobsites assigned yet.</Text> : null}
      </AppCard>

      <Pressable onPress={logout} disabled={isRefetching} style={styles.logout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  syncButton: {
    backgroundColor: theme.accentSoft,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(15, 118, 110, 0.24)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 30,
  },
  syncButtonDisabled: { opacity: 0.65 },
  syncText: {
    color: theme.accent,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  syncTime: { color: theme.accent, fontSize: 10, fontWeight: "800" },
  releaseText: { color: theme.muted, fontSize: 11, fontWeight: "800", textAlign: "center" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stack: { gap: 10 },
  activityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    paddingBottom: 10,
  },
  activityText: { flex: 1, minWidth: 0 },
  activityLabel: { color: theme.textStrong, fontWeight: "900", fontSize: 13 },
  activityDetail: { color: theme.muted, fontWeight: "700", fontSize: 12, lineHeight: 17, marginTop: 2 },
  activityTone: { color: theme.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  warningText: { color: theme.warning },
  successText: { color: theme.success },
  jobsiteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    paddingBottom: 10,
  },
  jobsiteName: { color: theme.textStrong, fontWeight: "900", fontSize: 13 },
  jobsiteStatus: { color: theme.muted, fontWeight: "900", textTransform: "uppercase", fontSize: 11 },
  emptyText: { color: theme.muted, fontWeight: "700" },
  logout: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 10, padding: 14, alignItems: "center" },
  logoutText: { color: theme.textStrong, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
});
