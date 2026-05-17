import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, StyleSheet, View } from "react-native";
import { useState } from "react";
import { addToolboxAttendee, createToolboxSession, getMe, getToolboxTemplates } from "@/api/mobile";
import { AppCard, SelectionDropdown, StatusBanner } from "@/components/Enterprise";
import { Button, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";

type ToolboxTemplate = { id: string; name?: string | null; topics?: string[] | null };

export default function NewToolboxScreen() {
  const { data } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const { data: templates = [] } = useQuery<ToolboxTemplate[]>({ queryKey: ["toolbox-templates"], queryFn: getToolboxTemplates });
  const [selectedJobsiteId, setSelectedJobsiteId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [notes, setNotes] = useState("");
  const [guestName, setGuestName] = useState("");
  const [signatureNote, setSignatureNote] = useState("");
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const selectedJobsite = data?.jobsites.find((jobsite) => jobsite.id === selectedJobsiteId) ?? data?.jobsites[0] ?? null;
  const selectedTemplate = templates.find((template) => template.id === templateId) ?? templates[0] ?? null;

  const mutation = useMutation({
    mutationFn: async () => {
      const created = await createToolboxSession({
        jobsiteId: selectedJobsite?.id ?? null,
        templateId: selectedTemplate?.id ?? null,
        notes,
      });
      const sessionId = created?.session?.id;
      if (sessionId && guestName.trim()) {
        await addToolboxAttendee(sessionId, {
          guestName,
          signed: Boolean(signatureNote.trim()),
          signatureNote,
        });
      }
      return sessionId;
    },
    onSuccess: () => {
      Alert.alert("Toolbox talk created", "The session is available in the platform toolbox log.");
      router.replace("/toolbox");
    },
    onError: (error) => Alert.alert("Toolbox failed", error instanceof Error ? error.message : "Could not create toolbox session."),
  });

  return (
    <Screen title="New Toolbox Talk" subtitle="Create a jobsite toolbox session and optional attendee signoff.">
      <StatusBanner title="Field Session" detail="Session notes and attendee signoff sync online to the jobsite toolbox log." tone="info" />
      <View style={styles.form}>
        <AppCard title="Session Details" eyebrow="Toolbox">
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
            label="Template"
            value={selectedTemplate?.name ?? "No template"}
            open={openPicker === "template"}
            options={templates.map((template) => ({ id: template.id, label: template.name ?? "Toolbox template", meta: template.topics?.join(", ") }))}
            onToggle={() => setOpenPicker((current) => (current === "template" ? null : "template"))}
            onSelect={(id) => {
              setTemplateId(id);
              setOpenPicker(null);
            }}
          />
          <Field label="Session Notes" value={notes} onChangeText={setNotes} multiline />
          <Field label="Attendee / Guest Name" value={guestName} onChangeText={setGuestName} placeholder="Optional printed name" />
          <Field label="Signature Note" value={signatureNote} onChangeText={setSignatureNote} placeholder="Optional signoff note" />
          <Button onPress={() => mutation.mutate()} disabled={mutation.isPending || !selectedJobsite}>
            {mutation.isPending ? "Saving..." : "Create Toolbox Talk"}
          </Button>
        </AppCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
});
