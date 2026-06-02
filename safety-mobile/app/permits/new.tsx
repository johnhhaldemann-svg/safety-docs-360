import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useMemo, useState } from "react";
import { createPermitRequest, getMe, listJsaActivities } from "@/api/mobile";
import { AppCard, MultiSelect, SelectionDropdown, StatusBanner } from "@/components/Enterprise";
import { Button, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { theme } from "@/theme";
import type { MobileJsaActivity } from "@/types/mobile";

const PERMIT_TYPES = [
  { id: "hot_work", label: "Hot Work" },
  { id: "loto", label: "LOTO" },
  { id: "excavation", label: "Excavation" },
  { id: "confined_space", label: "Confined Space" },
  { id: "critical_lift", label: "Critical Lift" },
  { id: "electrical", label: "Electrical" },
  { id: "other", label: "Other" },
];

const SEVERITIES = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "critical", label: "Critical" },
];

type PendingPermitRequest = {
  key: string;
  title: string;
  permitType: string;
  jsaActivityId?: string;
  activityName?: string;
};

export default function NewPermitScreen() {
  const params = useLocalSearchParams();
  const initialJobsiteId = firstParam(params.jobsiteId);
  const initialActivityIds = splitParam(params.jsaActivityIds);
  const initialPermitTypes = splitParam(params.permitTypes).map(normalizePermitType).filter(Boolean) as string[];
  const { data } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPermitTypeIds, setSelectedPermitTypeIds] = useState<string[]>(initialPermitTypes.length > 0 ? initialPermitTypes : ["hot_work"]);
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>(initialActivityIds);
  const [severity, setSeverity] = useState("medium");
  const [sifFlag, setSifFlag] = useState("no");
  const [dueAt, setDueAt] = useState("");
  const [selectedJobsiteId, setSelectedJobsiteId] = useState(initialJobsiteId);
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const selectedJobsite = data?.jobsites.find((jobsite) => jobsite.id === selectedJobsiteId) ?? data?.jobsites[0] ?? null;
  const selectedJobsiteIdForQuery = selectedJobsite?.id ?? "";
  const {
    data: activities = [],
    isLoading: activitiesLoading,
    error: activitiesError,
  } = useQuery({
    queryKey: ["jsa-activities", selectedJobsiteIdForQuery],
    queryFn: () => listJsaActivities({ jobsiteId: selectedJobsiteIdForQuery }),
    enabled: Boolean(selectedJobsiteIdForQuery),
  });

  const permitActivities = useMemo(
    () =>
      activities.filter((activity) => {
        if (!activity.id) return false;
        return Boolean(activity.permit_required || activity.permit_type || inferPermitType(activity.activity_name));
      }),
    [activities]
  );

  const pendingRequests = useMemo(
    () => buildPendingRequests({ title, selectedPermitTypeIds, selectedActivityIds, activities }),
    [activities, selectedActivityIds, selectedPermitTypeIds, title]
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedJobsite) throw new Error("Choose a jobsite before submitting permit requests.");
      if (pendingRequests.length < 1) throw new Error("Select at least one permit type or JSA task.");
      for (const request of pendingRequests) {
        await createPermitRequest({
          title: request.title,
          description: buildDescription(description, request),
          permitType: request.permitType,
          severity,
          sifFlag: sifFlag === "yes",
          dueAt,
          jobsiteId: selectedJobsite.id,
          jsaActivityId: request.jsaActivityId ?? null,
        });
      }
      return pendingRequests.length;
    },
    onSuccess: (count) => {
      Alert.alert(
        "Permit requests sent",
        `${count} draft permit request${count === 1 ? "" : "s"} will appear under Open Permits until reviewed.`
      );
      router.replace("/permits");
    },
    onError: (error) => Alert.alert("Permit failed", error instanceof Error ? error.message : "Could not submit permit request."),
  });

  function togglePermitType(id: string) {
    setSelectedPermitTypeIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleActivity(activity: MobileJsaActivity) {
    setSelectedActivityIds((current) => (current.includes(activity.id) ? current.filter((id) => id !== activity.id) : [...current, activity.id]));
    const activityType = activityPermitType(activity);
    if (activityType) {
      setSelectedPermitTypeIds((current) => (current.includes(activityType) ? current : [...current, activityType]));
    }
  }

  return (
    <Screen title="New Permit Request" subtitle="Select one or more permit needs and link them to JSA tasks when applicable.">
      <StatusBanner title="Draft Until Reviewed" detail="Selected permits appear under Open Permits as draft requests until an authorized reviewer activates them." tone="warning" />
      <View style={styles.form}>
        <AppCard title="Permit Details" eyebrow="Request">
          <Field label="Title Prefix" value={title} onChangeText={setTitle} placeholder="Level 3 mechanical work" />
          <SelectionDropdown
            label="Jobsite"
            value={selectedJobsite?.name ?? "No assigned jobsite"}
            open={openPicker === "jobsite"}
            options={(data?.jobsites ?? []).map((jobsite) => ({ id: jobsite.id, label: jobsite.name, meta: jobsite.status ?? undefined }))}
            onToggle={() => setOpenPicker((current) => (current === "jobsite" ? null : "jobsite"))}
            onSelect={(id) => {
              setSelectedJobsiteId(id);
              setSelectedActivityIds([]);
              setOpenPicker(null);
            }}
          />
          <MultiSelect label="Permit Types" selected={selectedPermitTypeIds} options={PERMIT_TYPES} onToggle={togglePermitType} />
          <SelectionDropdown
            label="Severity"
            value={labelFor(SEVERITIES, severity)}
            open={openPicker === "severity"}
            options={SEVERITIES}
            onToggle={() => setOpenPicker((current) => (current === "severity" ? null : "severity"))}
            onSelect={(id) => {
              setSeverity(id);
              setOpenPicker(null);
            }}
          />
          <SelectionDropdown
            label="SIF Potential"
            value={sifFlag === "yes" ? "Yes" : "No"}
            open={openPicker === "sif"}
            options={[{ id: "no", label: "No" }, { id: "yes", label: "Yes" }]}
            onToggle={() => setOpenPicker((current) => (current === "sif" ? null : "sif"))}
            onSelect={(id) => {
              setSifFlag(id);
              setOpenPicker(null);
            }}
          />
          <Field label="Due / Needed By" value={dueAt} onChangeText={setDueAt} placeholder="YYYY-MM-DD" />
          <Field label="Work Description" value={description} onChangeText={setDescription} multiline />
        </AppCard>

        <AppCard title="Link JSA Tasks" eyebrow="Optional">
          {activitiesLoading ? <Text style={styles.helpText}>Loading JSA tasks for this jobsite...</Text> : null}
          {activitiesError ? <Text style={styles.errorText}>{activitiesError instanceof Error ? activitiesError.message : "Could not load JSA tasks."}</Text> : null}
          {!activitiesLoading && permitActivities.length === 0 ? (
            <Text style={styles.helpText}>No permit-related JSA tasks found for this jobsite yet.</Text>
          ) : null}
          <View style={styles.activityList}>
            {permitActivities.map((activity) => {
              const active = selectedActivityIds.includes(activity.id);
              const permitType = activityPermitType(activity);
              return (
                <Pressable key={activity.id} onPress={() => toggleActivity(activity)} style={[styles.activityRow, active ? styles.activityRowActive : null]}>
                  <View style={styles.activityHeader}>
                    <Text style={[styles.activityTitle, active ? styles.activityTitleActive : null]}>{activity.activity_name || "JSA task"}</Text>
                    <Text style={[styles.activityBadge, active ? styles.activityBadgeActive : null]}>{active ? "Selected" : "Link"}</Text>
                  </View>
                  <Text style={[styles.activityMeta, active ? styles.activityMetaActive : null]}>
                    {labelize(permitType ?? activity.permit_type ?? "permit")} | {labelize(activity.planned_risk_level ?? "risk not set")}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </AppCard>

        <AppCard title="Request Preview" eyebrow={`${pendingRequests.length} Open Draft${pendingRequests.length === 1 ? "" : "s"}`}>
          {pendingRequests.length > 0 ? (
            <View style={styles.previewList}>
              {pendingRequests.map((request) => (
                <View key={request.key} style={styles.previewRow}>
                  <Text style={styles.previewTitle}>{request.title}</Text>
                  <Text style={styles.previewMeta}>{labelFor(PERMIT_TYPES, request.permitType)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.helpText}>Select permit types or JSA tasks to build draft requests.</Text>
          )}
          <Button onPress={() => mutation.mutate()} disabled={mutation.isPending || !selectedJobsite || pendingRequests.length < 1}>
            {mutation.isPending ? "Sending..." : `Send ${pendingRequests.length || ""} Permit Request${pendingRequests.length === 1 ? "" : "s"}`}
          </Button>
        </AppCard>
      </View>
    </Screen>
  );
}

function buildPendingRequests({
  title,
  selectedPermitTypeIds,
  selectedActivityIds,
  activities,
}: {
  title: string;
  selectedPermitTypeIds: string[];
  selectedActivityIds: string[];
  activities: MobileJsaActivity[];
}): PendingPermitRequest[] {
  const cleanTitle = title.trim();
  const selectedActivities = activities.filter((activity) => selectedActivityIds.includes(activity.id));
  if (selectedActivities.length > 0) {
    return selectedActivities.map((activity) => {
      const permitType = activityPermitType(activity) ?? selectedPermitTypeIds[0] ?? "other";
      const activityName = activity.activity_name?.trim() || labelFor(PERMIT_TYPES, permitType);
      return {
        key: `activity:${activity.id}`,
        title: cleanTitle ? `${cleanTitle} - ${activityName}` : `${activityName} permit`,
        permitType,
        jsaActivityId: activity.id,
        activityName,
      };
    });
  }
  return selectedPermitTypeIds.map((permitType) => ({
    key: `type:${permitType}`,
    title: cleanTitle ? `${cleanTitle} - ${labelFor(PERMIT_TYPES, permitType)}` : `${labelFor(PERMIT_TYPES, permitType)} permit`,
    permitType,
  }));
}

function buildDescription(description: string, request: PendingPermitRequest) {
  return [
    description.trim(),
    request.activityName ? `Linked JSA task: ${request.activityName}` : "",
  ].filter(Boolean).join("\n");
}

function activityPermitType(activity: MobileJsaActivity) {
  return normalizePermitType(activity.permit_type) ?? inferPermitType(activity.activity_name);
}

function inferPermitType(value?: string | null) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("hot")) return "hot_work";
  if (normalized.includes("loto") || normalized.includes("lockout") || normalized.includes("energized")) return "loto";
  if (normalized.includes("excavat") || normalized.includes("trench")) return "excavation";
  if (normalized.includes("confined")) return "confined_space";
  if (normalized.includes("lift") || normalized.includes("rigging")) return "critical_lift";
  if (normalized.includes("electric")) return "electrical";
  return null;
}

function normalizePermitType(value?: string | null) {
  const normalized = String(value ?? "").trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (!normalized) return null;
  if (normalized.includes("hot_work") || normalized.includes("hot")) return "hot_work";
  if (normalized.includes("loto") || normalized.includes("lockout")) return "loto";
  if (normalized.includes("excavat") || normalized.includes("trench")) return "excavation";
  if (normalized.includes("confined")) return "confined_space";
  if (normalized.includes("critical_lift") || normalized.includes("lift")) return "critical_lift";
  if (normalized.includes("electric")) return "electrical";
  if (PERMIT_TYPES.some((option) => option.id === normalized)) return normalized;
  return "other";
}

function labelFor(options: Array<{ id: string; label: string }>, id: string) {
  return options.find((option) => option.id === id)?.label ?? labelize(id);
}

function labelize(value?: string | null) {
  return String(value ?? "not set").replaceAll("_", " ");
}

function firstParam(value: unknown) {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

function splitParam(value: unknown) {
  return firstParam(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  helpText: { color: theme.text, fontSize: 13, fontWeight: "700", lineHeight: 19 },
  errorText: { color: theme.danger, fontSize: 13, fontWeight: "800", lineHeight: 19 },
  activityList: { gap: 9 },
  activityRow: {
    borderWidth: 1,
    borderColor: theme.borderStrong,
    backgroundColor: theme.surface,
    borderRadius: theme.radiusMd,
    padding: 12,
    gap: 6,
  },
  activityRowActive: { borderColor: theme.primary, backgroundColor: theme.primaryTint },
  activityHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  activityTitle: { color: theme.textStrong, flex: 1, fontSize: 14, fontWeight: "900", lineHeight: 19 },
  activityTitleActive: { color: theme.primary },
  activityBadge: {
    color: theme.primary,
    backgroundColor: theme.primarySoft,
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  activityBadgeActive: { color: theme.white, backgroundColor: theme.primary },
  activityMeta: { color: theme.muted, fontSize: 12, fontWeight: "800", textTransform: "capitalize" },
  activityMetaActive: { color: theme.text },
  previewList: { gap: 8 },
  previewRow: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.panelSoft,
    borderRadius: theme.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 3,
  },
  previewTitle: { color: theme.textStrong, fontSize: 13, fontWeight: "900" },
  previewMeta: { color: theme.primary, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
});
