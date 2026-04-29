import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { Button, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { createFieldIssue, getMe, uploadFieldIssuePhoto } from "@/api/mobile";
import { pickPhoto } from "@/utils/photos";
import type { ImagePickerAsset } from "expo-image-picker";
import { theme } from "@/theme";

export default function NewFieldIssueScreen() {
  const { data } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [category, setCategory] = useState("hazard");
  const [observationType, setObservationType] = useState("negative");
  const [sifPotential, setSifPotential] = useState("no");
  const [sifCategory, setSifCategory] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [photo, setPhoto] = useState<ImagePickerAsset | null>(null);
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
        jobsiteId: data?.jobsites[0]?.id ?? null,
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
    try {
      const photo = await pickPhoto();
      setPhoto(photo);
    } catch (error) {
      Alert.alert("Photo failed", error instanceof Error ? error.message : "Could not add photo.");
    }
  }

  return (
    <Screen title="New Field Issue" subtitle="Matches the platform observation and corrective-action fields.">
      <View style={styles.form}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Issue Details</Text>
          <Field label="Title" value={title} onChangeText={setTitle} />
          <Field label="Jobsite" value={data?.jobsites[0]?.name ?? "No assigned jobsite"} onChangeText={() => undefined} editable={false} />
          <Field label="Description" value={description} onChangeText={setDescription} multiline />
          <Field label="Severity" value={severity} onChangeText={setSeverity} placeholder="low, medium, high, critical" />
          <Field label="Category" value={category} onChangeText={setCategory} placeholder="hazard, ppe, housekeeping" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Review & Assignment</Text>
          <Field label="Observation Type" value={observationType} onChangeText={setObservationType} placeholder="negative or positive" />
          <Field label="SIF Potential" value={sifPotential} onChangeText={setSifPotential} placeholder="yes or no" />
          <Field label="SIF Category" value={sifCategory} onChangeText={setSifCategory} placeholder="fall, electrical, struck_by" />
          <Field label="Assigned User ID" value={assignedTo} onChangeText={setAssignedTo} placeholder="Optional platform user id" />
          <Field label="Due Date" value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Evidence</Text>
          <Button onPress={addPhoto} variant="secondary">{photo ? "Photo Selected" : "Take Photo"}</Button>
          <Button onPress={() => mutation.mutate()} disabled={mutation.isPending || !title}>
            {mutation.isPending ? "Sending..." : "Send Issue For Review"}
          </Button>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  card: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 8, padding: 14, gap: 12 },
  cardTitle: { color: theme.textStrong, fontSize: 16, fontWeight: "900" }
});
