import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { Button, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { createFieldIssue, getMe, uploadFieldIssuePhoto } from "@/api/mobile";
import { pickPhotoFromCamera, pickPhotoFromLibrary } from "@/utils/photos";
import type { ImagePickerAsset } from "expo-image-picker";
import { theme } from "@/theme";

const SEVERITY_OPTIONS = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "critical", label: "Critical" },
];

const CATEGORY_OPTIONS = [
  { id: "hazard", label: "Hazard" },
  { id: "near_miss", label: "Near Miss" },
  { id: "incident", label: "Incident" },
  { id: "good_catch", label: "Good Catch" },
  { id: "ppe_violation", label: "PPE Violation" },
  { id: "housekeeping", label: "Housekeeping" },
  { id: "equipment_issue", label: "Equipment Issue" },
  { id: "fall_hazard", label: "Fall Hazard" },
  { id: "electrical_hazard", label: "Electrical Hazard" },
  { id: "corrective_action", label: "Corrective Action" },
];

const OBSERVATION_TYPE_OPTIONS = [
  { id: "negative", label: "Negative Observation" },
  { id: "near_miss", label: "Near Miss" },
  { id: "positive", label: "Positive Observation" },
];

const SIF_CATEGORY_OPTIONS = [
  { id: "", label: "Not Applicable" },
  { id: "fall_from_height", label: "Fall From Height" },
  { id: "struck_by", label: "Struck By" },
  { id: "caught_between", label: "Caught Between" },
  { id: "electrical", label: "Electrical" },
  { id: "excavation_collapse", label: "Excavation Collapse" },
  { id: "confined_space", label: "Confined Space" },
  { id: "hazardous_energy", label: "Hazardous Energy" },
  { id: "crane_rigging", label: "Crane/Rigging" },
  { id: "line_of_fire", label: "Line Of Fire" },
];

export default function NewFieldIssueScreen() {
  const { data } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [category, setCategory] = useState("hazard");
  const [observationType, setObservationType] = useState("negative");
  const [sifPotential, setSifPotential] = useState("no");
  const [sifCategory, setSifCategory] = useState("");
  const [selectedJobsiteId, setSelectedJobsiteId] = useState("");
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [photo, setPhoto] = useState<ImagePickerAsset | null>(null);
  const selectedJobsite = data?.jobsites.find((jobsite) => jobsite.id === selectedJobsiteId) ?? data?.jobsites[0] ?? null;
  const mutation = useMutation({
    mutationFn: async () => {
      const created = await createFieldIssue({
        title,
        description,
        severity,
        category,
        observationType,
        sifPotential: sifPotential.trim().toLowerCase().startsWith("y"),
        sifCategory,
        assignedUserId: assignedTo,
        dueAt: dueDate,
        jobsiteId: selectedJobsite?.id ?? null,
        status: "open"
      });
      const id = created?.observation?.id ?? created?.action?.id ?? created?.actionId;
      if (id && photo) await uploadFieldIssuePhoto(id, photo);
      return id;
    },
    onSuccess: () => {
      Alert.alert("Sent for review", "Field issue sent to company admin review.");
      router.replace("/field-issues");
    },
    onError: (error) => Alert.alert("Issue failed", error instanceof Error ? error.message : "Could not submit issue.")
  });

  async function addPhoto() {
    Alert.alert("Add Photo", "Attach a field issue photo.", [
      { text: "Take Photo", onPress: () => void addPhotoFromCamera() },
      { text: "Choose From Phone", onPress: () => void addPhotoFromLibrary() },
      { text: "Cancel", style: "cancel" }
    ]);
  }

  async function addPhotoFromCamera() {
    try {
      setPhoto(await pickPhotoFromCamera());
    } catch (error) {
      Alert.alert("Photo failed", error instanceof Error ? error.message : "Could not add photo.");
    }
  }

  async function addPhotoFromLibrary() {
    try {
      setPhoto(await pickPhotoFromLibrary());
    } catch (error) {
      Alert.alert("Photo failed", error instanceof Error ? error.message : "Could not choose photo.");
    }
  }

  return (
    <Screen title="New Field Issue" subtitle="Report a field issue and send it to admin review.">
      <View style={styles.form}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Issue Details</Text>
          <Field label="Title" value={title} onChangeText={setTitle} />
          <SelectionDropdown
            label="Jobsite"
            value={selectedJobsite?.name ?? "No assigned jobsite"}
            open={openPicker === "jobsite"}
            options={(data?.jobsites ?? []).map((jobsite) => ({ id: jobsite.id, label: jobsite.name, meta: jobsite.status ?? undefined }))}
            onToggle={() => setOpenPicker((current) => current === "jobsite" ? null : "jobsite")}
            onSelect={(id) => {
              setSelectedJobsiteId(id);
              setOpenPicker(null);
            }}
          />
          <Field label="Description" value={description} onChangeText={setDescription} multiline />
          <SelectionDropdown
            label="Severity"
            value={labelFor(SEVERITY_OPTIONS, severity)}
            open={openPicker === "severity"}
            options={SEVERITY_OPTIONS}
            onToggle={() => setOpenPicker((current) => current === "severity" ? null : "severity")}
            onSelect={(id) => {
              setSeverity(id);
              setOpenPicker(null);
            }}
          />
          <SelectionDropdown
            label="Category"
            value={labelFor(CATEGORY_OPTIONS, category)}
            open={openPicker === "category"}
            options={CATEGORY_OPTIONS}
            onToggle={() => setOpenPicker((current) => current === "category" ? null : "category")}
            onSelect={(id) => {
              setCategory(id);
              setOpenPicker(null);
            }}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Review & Assignment</Text>
          <SelectionDropdown
            label="Observation Type"
            value={labelFor(OBSERVATION_TYPE_OPTIONS, observationType)}
            open={openPicker === "observationType"}
            options={OBSERVATION_TYPE_OPTIONS}
            onToggle={() => setOpenPicker((current) => current === "observationType" ? null : "observationType")}
            onSelect={(id) => {
              setObservationType(id);
              setOpenPicker(null);
            }}
          />
          <SelectionDropdown
            label="SIF Potential"
            value={sifPotential === "yes" ? "Yes" : "No"}
            open={openPicker === "sifPotential"}
            options={[{ id: "no", label: "No" }, { id: "yes", label: "Yes" }]}
            onToggle={() => setOpenPicker((current) => current === "sifPotential" ? null : "sifPotential")}
            onSelect={(id) => {
              setSifPotential(id);
              if (id === "no") setSifCategory("");
              setOpenPicker(null);
            }}
          />
          {sifPotential === "yes" ? (
            <SelectionDropdown
              label="SIF Category"
              value={labelFor(SIF_CATEGORY_OPTIONS, sifCategory)}
              open={openPicker === "sifCategory"}
              options={SIF_CATEGORY_OPTIONS}
              onToggle={() => setOpenPicker((current) => current === "sifCategory" ? null : "sifCategory")}
              onSelect={(id) => {
                setSifCategory(id);
                setOpenPicker(null);
              }}
            />
          ) : null}
          <Field label="Assigned User ID" value={assignedTo} onChangeText={setAssignedTo} placeholder="Optional platform user id" />
          <Field label="Due Date" value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Evidence</Text>
          <Button onPress={addPhoto} variant="secondary">{photo ? "Photo selected" : "Add photo"}</Button>
          <Button onPress={() => mutation.mutate()} disabled={mutation.isPending || !title}>
            {mutation.isPending ? "Sending..." : "Send Issue For Review"}
          </Button>
        </View>
      </View>
    </Screen>
  );
}

function labelFor(options: Array<{ id: string; label: string }>, id: string) {
  return options.find((option) => option.id === id)?.label ?? id;
}

function SelectionDropdown({
  label,
  value,
  open,
  options,
  onToggle,
  onSelect,
}: {
  label: string;
  value: string;
  open: boolean;
  options: Array<{ id: string; label: string; meta?: string }>;
  onToggle: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.selectorGroup}>
      <Text style={styles.selectorLabel}>{label}</Text>
      <Pressable onPress={onToggle} style={styles.dropdownButton}>
        <Text style={styles.dropdownTitle}>{value}</Text>
        <Text style={styles.dropdownMeta}>{open ? "Tap to close" : "Tap to choose"}</Text>
      </Pressable>
      {open ? (
        <View style={styles.dropdownPanel}>
          {options.map((option) => (
            <Pressable key={option.id} onPress={() => onSelect(option.id)} style={styles.optionRow}>
              <Text style={styles.optionText}>{option.label}</Text>
              {option.meta ? <Text style={styles.optionMeta}>{option.meta}</Text> : null}
            </Pressable>
          ))}
          {options.length === 0 ? <Text style={styles.emptyText}>No options available.</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  card: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 8, padding: 14, gap: 12 },
  cardTitle: { color: theme.textStrong, fontSize: 16, fontWeight: "900" },
  selectorGroup: { gap: 7 },
  selectorLabel: { color: theme.textStrong, fontSize: 13, fontWeight: "900" },
  dropdownButton: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11 },
  dropdownTitle: { color: theme.textStrong, fontSize: 14, fontWeight: "900" },
  dropdownMeta: { color: theme.muted, fontSize: 12, fontWeight: "700", marginTop: 3 },
  dropdownPanel: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.panelSoft, borderRadius: 10, padding: 8, gap: 6 },
  optionRow: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, gap: 2 },
  optionText: { color: theme.textStrong, fontWeight: "900", fontSize: 13 },
  optionMeta: { color: theme.muted, fontWeight: "700", fontSize: 11 },
  emptyText: { color: theme.muted, fontWeight: "700", padding: 8 }
});
