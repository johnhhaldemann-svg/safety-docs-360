import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { getMe, getPreTaskChecklist, getSafetyBriefing } from "@/api/mobile";
import { AppCard, SelectionDropdown, StatusBanner } from "@/components/Enterprise";
import { Button, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { theme } from "@/theme";

const HAZARD_FAMILIES = [
  { id: "fall", label: "Fall" },
  { id: "struck_by", label: "Struck-by" },
  { id: "line_of_fire", label: "Line of Fire" },
  { id: "electrical", label: "Electrical" },
  { id: "excavation", label: "Excavation" },
  { id: "fire", label: "Fire" },
];

export default function SafetyIntelligenceScreen() {
  const { data } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const [taskTitle, setTaskTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tradeCode, setTradeCode] = useState("general_contractor");
  const [workAreaLabel, setWorkAreaLabel] = useState("");
  const [selectedJobsiteId, setSelectedJobsiteId] = useState("");
  const [hazardFamily, setHazardFamily] = useState("falls");
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState("");
  const [resultText, setResultText] = useState("");
  const selectedJobsite = data?.jobsites.find((jobsite) => jobsite.id === selectedJobsiteId) ?? data?.jobsites[0] ?? null;

  function buildInput() {
    return {
      companyId: data?.user.companyId ?? "mobile-company",
      jobsiteId: selectedJobsite?.id ?? null,
      sourceModule: "mobile",
      tradeCode,
      taskTitle,
      description,
      workAreaLabel,
      hazardFamilies: [hazardFamily],
      hazardCategories: [hazardFamily],
      requiredControls: [],
      permitTriggers: [],
      ppeRequirements: [],
      trainingRequirementCodes: [],
      equipmentUsed: [],
      workConditions: [],
      siteRestrictions: [],
      prohibitedEquipment: [],
      metadata: { client: "safety-mobile" },
    };
  }

  const briefingMutation = useMutation({
    mutationFn: () => getSafetyBriefing(buildInput()),
    onSuccess: (payload) => {
      setResultTitle("Daily Risk Briefing");
      setResultText(JSON.stringify(payload.briefing ?? payload, null, 2));
    },
    onError: (error) => Alert.alert("Briefing failed", error instanceof Error ? error.message : "Could not build briefing."),
  });

  const checklistMutation = useMutation({
    mutationFn: () => getPreTaskChecklist(buildInput()),
    onSuccess: (payload) => {
      setResultTitle("Pre-Task Checklist");
      setResultText(JSON.stringify(payload.checklist ?? payload, null, 2));
    },
    onError: (error) => Alert.alert("Checklist failed", error instanceof Error ? error.message : "Could not build checklist."),
  });

  const disabled = !taskTitle || !selectedJobsite || briefingMutation.isPending || checklistMutation.isPending;

  return (
    <Screen title="Safety Intelligence" subtitle="Generate a field briefing or pre-task checklist while online.">
      <StatusBanner title="Online AI Tool" detail="Briefings use current jobsite context and platform risk memory." tone="info" />
      <View style={styles.form}>
        <AppCard title="Work Context" eyebrow="Input">
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
          <Field label="Task Title" value={taskTitle} onChangeText={setTaskTitle} placeholder="Install guardrail at mezzanine" />
          <Field label="Description" value={description} onChangeText={setDescription} multiline />
          <Field label="Trade Code" value={tradeCode} onChangeText={setTradeCode} placeholder="general_contractor" />
          <Field label="Work Area" value={workAreaLabel} onChangeText={setWorkAreaLabel} placeholder="Level 2 east deck" />
          <SelectionDropdown
            label="Primary Hazard"
            value={labelFor(HAZARD_FAMILIES, hazardFamily)}
            open={openPicker === "hazard"}
            options={HAZARD_FAMILIES}
            onToggle={() => setOpenPicker((current) => (current === "hazard" ? null : "hazard"))}
            onSelect={(id) => {
              setHazardFamily(id);
              setOpenPicker(null);
            }}
          />
          <Button onPress={() => briefingMutation.mutate()} disabled={disabled}>
            {briefingMutation.isPending ? "Building..." : "Build Briefing"}
          </Button>
          <Button variant="secondary" onPress={() => checklistMutation.mutate()} disabled={disabled}>
            {checklistMutation.isPending ? "Building..." : "Build Checklist"}
          </Button>
        </AppCard>
        {resultText ? (
          <AppCard title={resultTitle} eyebrow="Output">
            <Text style={styles.resultText}>{resultText}</Text>
          </AppCard>
        ) : null}
      </View>
    </Screen>
  );
}

function labelFor(options: Array<{ id: string; label: string }>, id: string) {
  return options.find((option) => option.id === id)?.label ?? id;
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  resultText: { color: theme.text, fontSize: 12, lineHeight: 18, fontWeight: "700" },
});
