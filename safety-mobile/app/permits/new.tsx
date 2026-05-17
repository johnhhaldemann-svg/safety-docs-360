import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, StyleSheet, View } from "react-native";
import { useState } from "react";
import { createPermitRequest, getMe } from "@/api/mobile";
import { AppCard, SelectionDropdown, StatusBanner } from "@/components/Enterprise";
import { Button, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";

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

export default function NewPermitScreen() {
  const { data } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [permitType, setPermitType] = useState("hot_work");
  const [severity, setSeverity] = useState("medium");
  const [sifFlag, setSifFlag] = useState("no");
  const [dueAt, setDueAt] = useState("");
  const [selectedJobsiteId, setSelectedJobsiteId] = useState("");
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const selectedJobsite = data?.jobsites.find((jobsite) => jobsite.id === selectedJobsiteId) ?? data?.jobsites[0] ?? null;

  const mutation = useMutation({
    mutationFn: () =>
      createPermitRequest({
        title,
        description,
        permitType,
        severity,
        sifFlag: sifFlag === "yes",
        dueAt,
        jobsiteId: selectedJobsite?.id ?? null,
      }),
    onSuccess: () => {
      Alert.alert("Permit request sent", "A manager or safety admin must activate this permit.");
      router.replace("/permits");
    },
    onError: (error) => Alert.alert("Permit failed", error instanceof Error ? error.message : "Could not submit permit request."),
  });

  return (
    <Screen title="New Permit Request" subtitle="Submit a permit request for review before work begins.">
      <StatusBanner title="Draft Until Reviewed" detail="Field users submit permit requests. Managers or safety admins activate permits in the platform." tone="warning" />
      <View style={styles.form}>
        <AppCard title="Permit Details" eyebrow="Request">
          <Field label="Title" value={title} onChangeText={setTitle} placeholder="Hot work at level 3" />
          <SelectionDropdown
            label="Jobsite"
            value={selectedJobsite?.name ?? "No assigned jobsite"}
            open={openPicker === "jobsite"}
            options={(data?.jobsites ?? []).map((jobsite) => ({ id: jobsite.id, label: jobsite.name, meta: jobsite.status ?? undefined }))}
            onToggle={() => setOpenPicker((current) => (current === "jobsite" ? null : "jobsite"))}
            onSelect={(id) => {
              setSelectedJobsiteId(id);
              setOpenPicker(null);
            }}
          />
          <SelectionDropdown
            label="Permit Type"
            value={labelFor(PERMIT_TYPES, permitType)}
            open={openPicker === "permitType"}
            options={PERMIT_TYPES}
            onToggle={() => setOpenPicker((current) => (current === "permitType" ? null : "permitType"))}
            onSelect={(id) => {
              setPermitType(id);
              setOpenPicker(null);
            }}
          />
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
          <Button onPress={() => mutation.mutate()} disabled={mutation.isPending || !title || !selectedJobsite}>
            {mutation.isPending ? "Sending..." : "Send Permit Request"}
          </Button>
        </AppCard>
      </View>
    </Screen>
  );
}

function labelFor(options: Array<{ id: string; label: string }>, id: string) {
  return options.find((option) => option.id === id)?.label ?? id;
}

const styles = StyleSheet.create({
  form: { gap: 12 },
});
