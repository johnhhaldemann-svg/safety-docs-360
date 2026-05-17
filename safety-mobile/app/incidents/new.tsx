import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, StyleSheet, View } from "react-native";
import { useState } from "react";
import { createIncidentReport, getMe } from "@/api/mobile";
import { AppCard, SelectionDropdown, StatusBanner } from "@/components/Enterprise";
import { Button, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";

const CATEGORIES = [
  { id: "incident", label: "Incident" },
  { id: "near_miss", label: "Near Miss" },
];

const SEVERITIES = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "critical", label: "Critical" },
];

export default function NewIncidentScreen() {
  const { data } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("incident");
  const [severity, setSeverity] = useState("medium");
  const [selectedJobsiteId, setSelectedJobsiteId] = useState("");
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const selectedJobsite = data?.jobsites.find((jobsite) => jobsite.id === selectedJobsiteId) ?? data?.jobsites[0] ?? null;

  const mutation = useMutation({
    mutationFn: () =>
      createIncidentReport({
        title,
        description,
        category,
        severity,
        jobsiteId: selectedJobsite?.id ?? null,
      }),
    onSuccess: () => {
      Alert.alert("Incident report sent", "The report is now waiting for manager review.");
      router.replace("/incidents");
    },
    onError: (error) => Alert.alert("Incident failed", error instanceof Error ? error.message : "Could not submit incident report."),
  });

  return (
    <Screen title="New Incident Report" subtitle="Capture incident or near-miss details for review.">
      <StatusBanner title="Review Required" detail="Mobile incident reports are submitted to the safety submission queue before becoming incident records." tone="warning" />
      <View style={styles.form}>
        <AppCard title="Report Details" eyebrow="Incident">
          <Field label="Title" value={title} onChangeText={setTitle} placeholder="Near miss at loading area" />
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
            label="Type"
            value={labelFor(CATEGORIES, category)}
            open={openPicker === "category"}
            options={CATEGORIES}
            onToggle={() => setOpenPicker((current) => (current === "category" ? null : "category"))}
            onSelect={(id) => {
              setCategory(id);
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
          <Field label="Description" value={description} onChangeText={setDescription} multiline />
          <Button onPress={() => mutation.mutate()} disabled={mutation.isPending || !title || !selectedJobsite}>
            {mutation.isPending ? "Sending..." : "Send Incident Report"}
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
