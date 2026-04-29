import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { Button, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { createJsa, createJsaActivity, getMe, signJsa, submitJsa, uploadJsaPhoto } from "@/api/mobile";
import { pickPhotoFromCamera, pickPhotoFromLibrary } from "@/utils/photos";
import type { ImagePickerAsset } from "expo-image-picker";
import { theme } from "@/theme";

export default function NewJsaScreen() {
  const { data } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const [title, setTitle] = useState("");
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [trade, setTrade] = useState("");
  const [workArea, setWorkArea] = useState("");
  const [activityName, setActivityName] = useState("");
  const [crewSize, setCrewSize] = useState("");
  const [hazardCategory, setHazardCategory] = useState("");
  const [hazardDescription, setHazardDescription] = useState("");
  const [mitigation, setMitigation] = useState("");
  const [plannedRiskLevel, setPlannedRiskLevel] = useState("medium");
  const [permitRequired, setPermitRequired] = useState("no");
  const [permitType, setPermitType] = useState("");
  const [ppe, setPpe] = useState("");
  const [signature, setSignature] = useState("");
  const [photo, setPhoto] = useState<ImagePickerAsset | null>(null);
  const mutation = useMutation({
    mutationFn: async () => {
      const jobsiteId = data?.jobsites[0]?.id ?? null;
      const created = await createJsa({
        title,
        description: [`Trade: ${trade}`, `Work area: ${workArea}`, `PPE: ${ppe}`].filter(Boolean).join("\n"),
        status: "active",
        severity: plannedRiskLevel,
        category: hazardCategory || "corrective_action",
        jobsiteId
      });
      const id = created?.jsa?.id;
      if (!id) throw new Error("JSA was not created.");
      await createJsaActivity({
        jsaId: id,
        jobsiteId,
        workDate,
        trade,
        activityName: activityName || title,
        area: workArea,
        crewSize: Number.parseInt(crewSize, 10) || null,
        hazardCategory,
        hazardDescription,
        mitigation,
        permitRequired: permitRequired.trim().toLowerCase().startsWith("y"),
        permitType,
        plannedRiskLevel,
        status: "planned"
      });
      if (photo) await uploadJsaPhoto(id, photo);
      await signJsa(id, signature);
      await submitJsa(id);
      return id;
    },
    onSuccess: () => {
      Alert.alert("Sent for review", "JSA sent to company admin review.");
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
      <View style={styles.form}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Job Details</Text>
          <Field label="JSA Title / Job Name" value={title} onChangeText={setTitle} />
          <Text style={styles.jobsite}>Jobsite: {data?.jobsites[0]?.name ?? "No assigned jobsite"}</Text>
          <Field label="Work Date" value={workDate} onChangeText={setWorkDate} placeholder="YYYY-MM-DD" />
          <Field label="Trade" value={trade} onChangeText={setTrade} placeholder="Electrical, Roofing, General" />
          <Field label="Work Area" value={workArea} onChangeText={setWorkArea} placeholder="North core level 5" />
          <Field label="Crew Size" value={crewSize} onChangeText={setCrewSize} placeholder="6" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Work Step & Controls</Text>
          <Field label="Work Step / Activity" value={activityName} onChangeText={setActivityName} multiline />
          <Field label="Hazard Category" value={hazardCategory} onChangeText={setHazardCategory} placeholder="fall, electrical, struck_by" />
          <Field label="Hazard Description" value={hazardDescription} onChangeText={setHazardDescription} multiline />
          <Field label="Controls / Mitigation" value={mitigation} onChangeText={setMitigation} multiline />
          <Field label="Planned Risk Level" value={plannedRiskLevel} onChangeText={setPlannedRiskLevel} placeholder="low, medium, high, critical" />
          <Field label="Permit Required" value={permitRequired} onChangeText={setPermitRequired} placeholder="yes or no" />
          <Field label="Permit Type" value={permitType} onChangeText={setPermitType} placeholder="Hot Work, LOTO, Excavation" />
          <Field label="Required PPE" value={ppe} onChangeText={setPpe} placeholder="Hard hat, glasses, gloves" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Evidence & Sign-Off</Text>
          <Button onPress={addPhoto} variant="secondary">{photo ? "Photo selected" : "Add photo"}</Button>
          <Field label="Signature" value={signature} onChangeText={setSignature} placeholder="Printed name" />
          <Button onPress={() => mutation.mutate()} disabled={mutation.isPending || !title || !activityName || !hazardDescription || !mitigation || !signature}>
            {mutation.isPending ? "Sending..." : "Send JSA For Review"}
          </Button>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  card: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 8, padding: 14, gap: 12 },
  cardTitle: { color: theme.textStrong, fontSize: 16, fontWeight: "900" },
  jobsite: { color: theme.muted, fontWeight: "800" }
});
