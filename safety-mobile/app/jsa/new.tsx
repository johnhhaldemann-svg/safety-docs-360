import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, StyleSheet, View } from "react-native";
import { useState } from "react";
import { Button, Field } from "@/components/Form";
import { AppCard, MultiSelect, PhotoEvidenceButton, SelectionDropdown, StatusBanner } from "@/components/Enterprise";
import { Screen } from "@/components/Screen";
import { createJsa, createJsaActivity, getMe, signJsa, submitJsa, uploadJsaPhoto } from "@/api/mobile";
import { pickPhotoFromCamera, pickPhotoFromLibrary } from "@/utils/photos";
import type { ImagePickerAsset } from "expo-image-picker";
import { theme } from "@/theme";

const TRADE_OPTIONS = [
  { id: "general_contractor", label: "General Contractor" },
  { id: "electrical", label: "Electrical" },
  { id: "mechanical", label: "Mechanical" },
  { id: "plumbing", label: "Plumbing" },
  { id: "concrete", label: "Concrete" },
  { id: "roofing", label: "Roofing" },
  { id: "steel_erection", label: "Steel Erection" },
  { id: "excavation", label: "Excavation" },
];

const HAZARD_OPTIONS = [
  { id: "struck_by", label: "Struck-by" },
  { id: "electrical", label: "Electrical" },
  { id: "fall", label: "Fall" },
  { id: "chemical", label: "Chemical" },
  { id: "fire", label: "Fire" },
  { id: "pinch", label: "Pinch" },
  { id: "noise", label: "Noise" },
  { id: "overhead", label: "Overhead" },
];

const TASK_OPTIONS = [
  { id: "site_access_setup", label: "Site access / setup" },
  { id: "material_handling", label: "Material handling" },
  { id: "equipment_operation", label: "Equipment operation" },
  { id: "working_at_heights", label: "Working at heights" },
  { id: "excavation_trenching", label: "Excavation / trenching" },
  { id: "hot_work", label: "Hot work" },
  { id: "energized_or_loto", label: "Electrical / LOTO" },
  { id: "confined_space", label: "Confined space" },
  { id: "rigging_lifting", label: "Rigging / lifting" },
  { id: "cleanup_closeout", label: "Cleanup / closeout" },
];

const PPE_OPTIONS = [
  { id: "hard_hat", label: "Hard Hat" },
  { id: "safety_glasses", label: "Safety Glasses" },
  { id: "gloves", label: "Gloves" },
  { id: "hi_vis", label: "Hi-vis" },
  { id: "harness", label: "Harness" },
  { id: "respirator", label: "Respirator" },
  { id: "hearing_protection", label: "Hearing Protection" },
  { id: "steel_toe_boots", label: "Steel-toe Boots" },
];

const RISK_OPTIONS = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "critical", label: "Critical" },
];

const STEP_STATUS_OPTIONS = [
  { id: "planned", label: "Planned" },
  { id: "not_started", label: "Not Started" },
  { id: "active", label: "Active" },
  { id: "monitored", label: "Monitored" },
  { id: "paused", label: "Paused" },
  { id: "completed", label: "Completed" },
];

const PERMIT_TYPE_OPTIONS = [
  { id: "", label: "No Permit Type" },
  { id: "hot_work", label: "Hot Work" },
  { id: "loto", label: "LOTO" },
  { id: "excavation", label: "Excavation" },
  { id: "confined_space", label: "Confined Space" },
  { id: "critical_lift", label: "Critical Lift" },
];

export default function NewJsaScreen() {
  const { data } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const [title, setTitle] = useState("");
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedJobsiteId, setSelectedJobsiteId] = useState("");
  const [trade, setTrade] = useState("general_contractor");
  const [workArea, setWorkArea] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [customTasks, setCustomTasks] = useState("");
  const [crewSize, setCrewSize] = useState("");
  const [hazardTags, setHazardTags] = useState<string[]>([]);
  const [hazardDescription, setHazardDescription] = useState("");
  const [mitigation, setMitigation] = useState("");
  const [plannedRiskLevel, setPlannedRiskLevel] = useState("medium");
  const [permitRequired, setPermitRequired] = useState("no");
  const [permitType, setPermitType] = useState("");
  const [stepStatus, setStepStatus] = useState("planned");
  const [ppeTags, setPpeTags] = useState<string[]>([]);
  const [supervisor, setSupervisor] = useState("");
  const [shiftPhase, setShiftPhase] = useState("");
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const [signature, setSignature] = useState("");
  const [photo, setPhoto] = useState<ImagePickerAsset | null>(null);
  const selectedJobsite = data?.jobsites.find((jobsite) => jobsite.id === selectedJobsiteId) ?? data?.jobsites[0] ?? null;
  const hazardCategory = hazardTags.join(",");
  const ppe = ppeTags.map((tag) => labelFor(PPE_OPTIONS, tag)).join(", ");
  const selectedTaskLabels = selectedTaskIds.map((id) => labelFor(TASK_OPTIONS, id));
  const customTaskLabels = customTasks
    .split(/\n|,/)
    .map((task) => task.trim())
    .filter(Boolean);
  const workTasks = Array.from(new Set([...selectedTaskLabels, ...customTaskLabels]));
  const mutation = useMutation({
    mutationFn: async () => {
      if (workTasks.length < 1) {
        throw new Error("Select at least one JSA task or enter a custom task.");
      }
      const jobsiteId = selectedJobsite?.id ?? null;
      const created = await createJsa({
        title,
        description: [
          `Trade: ${labelFor(TRADE_OPTIONS, trade)}`,
          `Tasks: ${workTasks.join("; ")}`,
          `Work area: ${workArea}`,
          `Supervisor: ${supervisor}`,
          `Shift phase: ${shiftPhase}`,
          `PPE: ${ppe}`
        ].filter((line) => !line.endsWith(": ")).join("\n"),
        status: "active",
        severity: plannedRiskLevel,
        category: hazardCategory || "corrective_action",
        jobsiteId
      });
      const id = created?.jsa?.id;
      if (!id) throw new Error("JSA was not created.");
      const permitActivityIds: string[] = [];
      const permitTypes = new Set<string>();
      for (const activityName of workTasks) {
        const createdActivity = await createJsaActivity({
          jsaId: id,
          jobsiteId,
          workDate,
          trade,
          activityName,
          area: workArea,
          crewSize: Number.parseInt(crewSize, 10) || null,
          hazardCategory,
          hazardDescription,
          mitigation,
          permitRequired: permitRequired.trim().toLowerCase().startsWith("y"),
          permitType,
          plannedRiskLevel,
          status: stepStatus
        });
        const activityId = String(createdActivity?.activity?.id ?? "");
        if (permitRequired.trim().toLowerCase().startsWith("y") && activityId) {
          permitActivityIds.push(activityId);
          if (permitType) permitTypes.add(permitType);
        }
      }
      if (photo) await uploadJsaPhoto(id, photo);
      await signJsa(id, signature);
      await submitJsa(id);
      return { id, jobsiteId, permitActivityIds, permitTypes: Array.from(permitTypes) };
    },
    onSuccess: (result) => {
      const message = `JSA sent with ${workTasks.length} task${workTasks.length === 1 ? "" : "s"} for company admin review.`;
      if (result.permitActivityIds.length > 0) {
        Alert.alert("Sent for review", `${message} Create linked permit requests now?`, [
          {
            text: "Create Permits",
            onPress: () =>
              router.replace({
                pathname: "/permits/new",
                params: {
                  jobsiteId: result.jobsiteId ?? "",
                  jsaActivityIds: result.permitActivityIds.join(","),
                  permitTypes: result.permitTypes.join(",")
                }
              })
          },
          { text: "JSA Register", onPress: () => router.replace("/jsa"), style: "cancel" }
        ]);
        return;
      }
      Alert.alert("Sent for review", message);
      router.replace("/jsa");
    },
    onError: (error) => Alert.alert("JSA failed", error instanceof Error ? error.message : "Could not submit JSA.")
  });

  async function addPhoto() {
    Alert.alert("Add Photo", "Attach a JSA photo.", [
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
    <Screen title="New JSA" subtitle="Build a field JSA and send it to admin review.">
      <StatusBanner title="Admin Review Required" detail="Submitted JSAs sync to the platform for review and recordkeeping." tone="info" />
      <View style={styles.form}>
        <AppCard title="Job Details" eyebrow="Step 1">
          <Field label="JSA Title / Job Name" value={title} onChangeText={setTitle} />
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
          <Field label="Work Date" value={workDate} onChangeText={setWorkDate} placeholder="YYYY-MM-DD" />
          <SelectionDropdown
            label="Trade"
            value={labelFor(TRADE_OPTIONS, trade)}
            open={openPicker === "trade"}
            options={TRADE_OPTIONS}
            onToggle={() => setOpenPicker((current) => current === "trade" ? null : "trade")}
            onSelect={(id) => {
              setTrade(id);
              setOpenPicker(null);
            }}
          />
          <Field label="Work Area" value={workArea} onChangeText={setWorkArea} placeholder="North core level 5" />
          <Field label="Crew Size" value={crewSize} onChangeText={setCrewSize} placeholder="6" />
          <Field label="Supervisor" value={supervisor} onChangeText={setSupervisor} placeholder="Supervisor name" />
          <Field label="Shift / Phase" value={shiftPhase} onChangeText={setShiftPhase} placeholder="Day shift, pre-task, lift setup" />
        </AppCard>

        <AppCard title="Work Step & Controls" eyebrow="Step 2">
          <MultiSelect label="Task / Work Steps" selected={selectedTaskIds} options={TASK_OPTIONS} onToggle={(id) => toggleValue(setSelectedTaskIds, id)} />
          <Field label="Additional Task(s)" value={customTasks} onChangeText={setCustomTasks} placeholder="One per line or comma-separated" multiline />
          <MultiSelect label="Hazard Tags" selected={hazardTags} options={HAZARD_OPTIONS} onToggle={(id) => toggleValue(setHazardTags, id)} />
          <Field label="Hazard Description" value={hazardDescription} onChangeText={setHazardDescription} multiline />
          <Field label="Controls / Mitigation" value={mitigation} onChangeText={setMitigation} multiline />
          <SelectionDropdown
            label="Risk Level"
            value={labelFor(RISK_OPTIONS, plannedRiskLevel)}
            open={openPicker === "risk"}
            options={RISK_OPTIONS}
            onToggle={() => setOpenPicker((current) => current === "risk" ? null : "risk")}
            onSelect={(id) => {
              setPlannedRiskLevel(id);
              setOpenPicker(null);
            }}
          />
          <SelectionDropdown
            label="Step Status"
            value={labelFor(STEP_STATUS_OPTIONS, stepStatus)}
            open={openPicker === "status"}
            options={STEP_STATUS_OPTIONS}
            onToggle={() => setOpenPicker((current) => current === "status" ? null : "status")}
            onSelect={(id) => {
              setStepStatus(id);
              setOpenPicker(null);
            }}
          />
          <SelectionDropdown
            label="Permit Required"
            value={permitRequired === "yes" ? "Yes" : "No"}
            open={openPicker === "permitRequired"}
            options={[{ id: "no", label: "No" }, { id: "yes", label: "Yes" }]}
            onToggle={() => setOpenPicker((current) => current === "permitRequired" ? null : "permitRequired")}
            onSelect={(id) => {
              setPermitRequired(id);
              if (id === "no") setPermitType("");
              setOpenPicker(null);
            }}
          />
          {permitRequired === "yes" ? (
            <SelectionDropdown
              label="Permit Type"
              value={labelFor(PERMIT_TYPE_OPTIONS, permitType)}
              open={openPicker === "permitType"}
              options={PERMIT_TYPE_OPTIONS}
              onToggle={() => setOpenPicker((current) => current === "permitType" ? null : "permitType")}
              onSelect={(id) => {
                setPermitType(id);
                setOpenPicker(null);
              }}
            />
          ) : null}
          <MultiSelect label="Required PPE" selected={ppeTags} options={PPE_OPTIONS} onToggle={(id) => toggleValue(setPpeTags, id)} />
        </AppCard>

        <AppCard title="Evidence & Sign-Off" eyebrow="Final">
          <PhotoEvidenceButton selected={Boolean(photo)} onPress={addPhoto} />
          <Field label="Signature" value={signature} onChangeText={setSignature} placeholder="Printed name" />
          <Button onPress={() => mutation.mutate()} disabled={mutation.isPending || !title || workTasks.length < 1 || hazardTags.length < 1 || !hazardDescription || !mitigation || ppeTags.length < 1 || !signature}>
            {mutation.isPending ? "Sending..." : "Send JSA For Review"}
          </Button>
        </AppCard>
      </View>
    </Screen>
  );
}

function labelFor(options: Array<{ id: string; label: string }>, id: string) {
  return options.find((option) => option.id === id)?.label ?? id;
}

function toggleValue(setter: (update: (current: string[]) => string[]) => void, id: string) {
  setter((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
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
  emptyText: { color: theme.muted, fontWeight: "700", padding: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceChip: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  choiceChipActive: { borderColor: theme.primary, backgroundColor: theme.primary },
  choiceChipText: { color: theme.text, fontSize: 12, fontWeight: "900" },
  choiceChipTextActive: { color: theme.white }
});
