import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { Button, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { createJsa, createJsaActivity, getMe, signJsa, submitJsa, uploadJsaPhoto } from "@/api/mobile";
import { pickPhoto } from "@/utils/photos";
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
    try {
      const nextPhoto = await pickPhoto();
      setPhoto(nextPhoto);
    } catch (error) {
      Alert.alert("Photo failed", error instanceof Error ? error.message : "Could not add photo.");
    }
  }

  return (
    <Screen title="New JSA" subtitle="Matches the platform JSA header and work-step structure.">
      <View style={styles.form}>
        <Field label="JSA title / job name" value={title} onChangeText={setTitle} />
        <Text style={styles.jobsite}>Jobsite: {data?.jobsites[0]?.name ?? "No assigned jobsite"}</Text>
        <Field label="Work date" value={workDate} onChangeText={setWorkDate} placeholder="YYYY-MM-DD" />
        <Field label="Trade" value={trade} onChangeText={setTrade} placeholder="Electrical, Roofing, General" />
        <Field label="Work area" value={workArea} onChangeText={setWorkArea} placeholder="North core level 5" />
        <Field label="Work step / activity" value={activityName} onChangeText={setActivityName} multiline />
        <Field label="Crew size" value={crewSize} onChangeText={setCrewSize} placeholder="6" />
        <Field label="Hazard category" value={hazardCategory} onChangeText={setHazardCategory} placeholder="fall, electrical, struck_by" />
        <Field label="Hazard description" value={hazardDescription} onChangeText={setHazardDescription} multiline />
        <Field label="Controls / mitigation" value={mitigation} onChangeText={setMitigation} multiline />
        <Field label="Planned risk level" value={plannedRiskLevel} onChangeText={setPlannedRiskLevel} placeholder="low, medium, high, critical" />
        <Field label="Permit required" value={permitRequired} onChangeText={setPermitRequired} placeholder="yes or no" />
        <Field label="Permit type" value={permitType} onChangeText={setPermitType} placeholder="Hot Work, LOTO, Excavation" />
        <Field label="Required PPE" value={ppe} onChangeText={setPpe} placeholder="Hard hat, glasses, gloves" />
        <Button onPress={addPhoto} variant="secondary">{photo ? "Photo selected" : "Take photo"}</Button>
        <Field label="Signature" value={signature} onChangeText={setSignature} placeholder="Printed name" />
        <Button onPress={() => mutation.mutate()} disabled={mutation.isPending || !title || !activityName || !hazardDescription || !mitigation || !signature}>
          {mutation.isPending ? "Sending..." : "Send JSA for Review"}
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  jobsite: { color: theme.muted, fontWeight: "700" }
});
