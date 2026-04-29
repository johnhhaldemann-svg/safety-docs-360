import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useMemo, useState } from "react";
import { Button, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { createAudit, getAuditTemplates, getMe, signAudit, uploadAuditPhoto } from "@/api/mobile";
import { pickPhoto } from "@/utils/photos";
import type { ImagePickerAsset } from "expo-image-picker";
import { theme } from "@/theme";

type AuditStatus = "pass" | "fail" | "na";

type AuditTemplate = {
  id: string;
  title: string;
  fieldScope?: string;
  csepKind?: string;
  sections: Array<{
    id: string;
    title: string;
    subtitle?: string;
    items: Array<{ id: string; label: string; oshaRef?: string; critical?: boolean }>;
  }>;
};

function fieldItemKey(sectionId: string, itemId: string) {
  return `field-${sectionId}-${itemId}`;
}

function formatCsepKind(kind?: string) {
  if (!kind || kind === "other_common") return "";
  return toTitleCase(kind.replaceAll("_", " "));
}

function toTitleCase(value?: string | null) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => {
      if (!word) return word;
      if (/^[A-Z]{2,}$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export default function NewAuditScreen() {
  const { data } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const { data: templates = [] } = useQuery<AuditTemplate[]>({
    queryKey: ["audit-templates"],
    queryFn: getAuditTemplates
  });
  const [auditors, setAuditors] = useState("");
  const [auditDate, setAuditDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hoursBilled, setHoursBilled] = useState("");
  const [selectedTrades, setSelectedTrades] = useState<string[]>(["general_contractor"]);
  const [tradePickerOpen, setTradePickerOpen] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<string, AuditStatus>>({});
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [sectionPage, setSectionPage] = useState(0);
  const [photo, setPhoto] = useState<ImagePickerAsset | null>(null);
  const [signature, setSignature] = useState("");

  const selectedTemplates = useMemo(() => {
    const picked = templates.filter((item) => selectedTrades.includes(item.id));
    return picked.length > 0 ? picked : templates.slice(0, 1);
  }, [selectedTrades, templates]);
  const combinedSections = useMemo(() => {
    const sectionMap = new Map<string, AuditTemplate["sections"][number]>();
    for (const template of selectedTemplates) {
      for (const section of template.sections) {
        const existing = sectionMap.get(section.id);
        if (!existing) {
          sectionMap.set(section.id, { ...section, items: [...section.items] });
          continue;
        }
        const itemIds = new Set(existing.items.map((item) => item.id));
        existing.items.push(...section.items.filter((item) => !itemIds.has(item.id)));
      }
    }
    return [...sectionMap.values()];
  }, [selectedTemplates]);
  const sectionCount = combinedSections.length;
  const activePage = Math.min(sectionPage, Math.max(combinedSections.length - 1, 0));
  const activeSection = combinedSections[activePage];
  const isLastSectionPage = sectionCount === 0 || activePage >= sectionCount - 1;
  const itemCount = useMemo(
    () => combinedSections.reduce((total, section) => total + section.items.length, 0),
    [combinedSections]
  );
  const score = useMemo(() => {
    const values = Object.values(statusMap);
    const pass = values.filter((value) => value === "pass").length;
    const fail = values.filter((value) => value === "fail").length;
    const na = values.filter((value) => value === "na").length;
    const compliance = pass + fail > 0 ? Math.round((pass / (pass + fail)) * 100) : null;
    return { pass, fail, na, total: values.length, compliance };
  }, [statusMap]);

  function setRowStatus(key: string, status: AuditStatus) {
    setStatusMap((current) => ({ ...current, [key]: status }));
  }

  function toggleTrade(tradeId: string) {
    setSelectedTrades((current) => {
      if (current.includes(tradeId)) {
        const next = current.filter((id) => id !== tradeId);
        setSectionPage(0);
        return next.length > 0 ? next : current;
      }
      setSectionPage(0);
      return [...current, tradeId];
    });
  }

  function markSectionNotPresent(section: AuditTemplate["sections"][number]) {
    setStatusMap((current) => {
      const next = { ...current };
      for (const item of section.items) {
        next[fieldItemKey(section.id, item.id)] = "na";
      }
      return next;
    });
    setNotesMap((current) => {
      const next = { ...current };
      for (const item of section.items) {
        const key = fieldItemKey(section.id, item.id);
        if (!next[key]) next[key] = "Section marked not present.";
      }
      return next;
    });
    setCollapsedSections((current) => ({ ...current, [section.id]: true }));
  }

  function toggleSection(sectionId: string) {
    setCollapsedSections((current) => ({ ...current, [sectionId]: !current[sectionId] }));
  }

  async function addPhoto(key: string) {
    try {
      const nextPhoto = await pickPhoto();
      if (!nextPhoto) return;
      setPhoto(nextPhoto);
      setPhotoCounts((current) => ({ ...current, [key]: (current[key] ?? 0) + 1 }));
    } catch (error) {
      Alert.alert("Photo failed", error instanceof Error ? error.message : "Could not add photo.");
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const created = await createAudit({
        jobsiteId: data?.jobsites[0]?.id ?? null,
        auditDate,
        auditors,
        hoursBilled,
        selectedTrade: selectedTrades[0] ?? "general_contractor",
        selectedTrades,
        templateSource: "field",
        status: "pending_review",
        statusMap,
        notesMap,
        photoCounts
      });
      const id = created?.audit?.id;
      if (id && photo) await uploadAuditPhoto(id, photo);
      if (id && signature) await signAudit(id, signature);
      return id;
    },
    onSuccess: () => {
      Alert.alert("Sent for review", "Audit sent to company admin review.");
      router.replace("/audits");
    },
    onError: (error) => Alert.alert("Audit failed", error instanceof Error ? error.message : "Could not submit audit.")
  });

  const sectionNav = activeSection ? (
    <View style={styles.pageNav}>
      <Pressable
        onPress={() => setSectionPage((page) => Math.max(page - 1, 0))}
        disabled={activePage === 0}
        style={[styles.pageButton, activePage === 0 ? styles.pageButtonDisabled : null]}
      >
        <Text style={styles.pageButtonText}>Previous</Text>
      </Pressable>
      <Text style={styles.pageCount}>Section {activePage + 1} of {sectionCount}</Text>
      <Pressable
        onPress={() => setSectionPage((page) => Math.min(page + 1, sectionCount - 1))}
        disabled={activePage >= sectionCount - 1}
        style={[styles.pageButton, activePage >= sectionCount - 1 ? styles.pageButtonDisabled : null]}
      >
        <Text style={styles.pageButtonText}>Next</Text>
      </Pressable>
    </View>
  ) : null;

  return (
    <Screen
      title="New Audit"
      subtitle="Same field checklist structure used by the web platform."
      footer={sectionNav}
    >
      <View style={styles.form}>
        <Field label="Jobsite" value={data?.jobsites[0]?.name ?? "No assigned jobsite"} onChangeText={() => undefined} editable={false} />
        <Field label="Audit date" value={auditDate} onChangeText={setAuditDate} placeholder="YYYY-MM-DD" />
        <Field label="Auditor(s)" value={auditors} onChangeText={setAuditors} placeholder="Names, comma-separated" />
        <Field label="Hours billed" value={hoursBilled} onChangeText={setHoursBilled} placeholder="0.00" keyboardType="decimal-pad" />

        <View style={styles.group}>
          <Text style={styles.label}>Trades observed</Text>
          <Pressable onPress={() => setTradePickerOpen((open) => !open)} style={styles.dropdownButton}>
            <Text style={styles.dropdownTitle}>
              {selectedTemplates.length === 1 ? toTitleCase(selectedTemplates[0]?.title) : `${selectedTemplates.length} Trades Selected`}
            </Text>
            <Text style={styles.dropdownMeta}>{tradePickerOpen ? "Tap To Close" : "Tap To Choose Trades"}</Text>
          </Pressable>
          {tradePickerOpen ? (
            <View style={styles.dropdownPanel}>
              {templates.map((item) => {
                const selected = selectedTrades.includes(item.id);
                const csepKind = formatCsepKind(item.csepKind);
                return (
              <Pressable
                key={item.id}
                onPress={() => toggleTrade(item.id)}
                style={[styles.tradeRow, selected ? styles.tradeRowActive : null]}
              >
                <View style={[styles.checkbox, selected ? styles.checkboxActive : null]}>
                  <Text style={styles.checkboxText}>{selected ? "✓" : ""}</Text>
                </View>
                <View style={styles.tradeRowText}>
                  <Text style={selected ? styles.tradeTextActive : styles.tradeText}>{toTitleCase(item.title)}</Text>
                  {csepKind ? <Text style={styles.tradeMeta}>{csepKind}</Text> : null}
                </View>
              </Pressable>
                );
              })}
            </View>
          ) : null}
          <Field
            label="Selected trade slugs"
            value={selectedTrades.join(", ")}
            onChangeText={(value) => {
              setSectionPage(0);
              setSelectedTrades(
                value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              );
            }}
            placeholder="general_contractor, electrical, roofing"
          />
        </View>

        <View style={styles.scoreCard}>
          <Text style={styles.scoreTitle}>{selectedTemplates.map((item) => toTitleCase(item.title)).join(" + ") || "Field Audit"}</Text>
          <Text style={styles.scoreText}>{sectionCount} Sections | {itemCount} Checklist Items</Text>
          <Text style={styles.scoreText}>
            Scored {score.total}: {score.pass} Pass, {score.fail} Fail, {score.na} N/A
            {score.compliance == null ? "" : ` | ${score.compliance}%`}
          </Text>
        </View>

        {activeSection ? (
          <View key={activeSection.id} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>{toTitleCase(activeSection.title)}</Text>
                {activeSection.subtitle ? <Text style={styles.sectionSub}>{toTitleCase(activeSection.subtitle)}</Text> : null}
                <Text style={styles.sectionSub}>
                  {activeSection.items.length} Items | {activeSection.items.filter((item) => statusMap[fieldItemKey(activeSection.id, item.id)]).length} Scored
                </Text>
              </View>
              <View style={styles.sectionActions}>
                <Pressable onPress={() => markSectionNotPresent(activeSection)} style={styles.sectionActionButton}>
                  <Text style={styles.sectionActionText}>Not present</Text>
                </Pressable>
                <Pressable onPress={() => toggleSection(activeSection.id)} style={styles.sectionActionButton}>
                  <Text style={styles.sectionActionText}>{collapsedSections[activeSection.id] ? "Open" : "Hide"}</Text>
                </Pressable>
              </View>
            </View>
            {collapsedSections[activeSection.id] ? (
              <Text style={styles.sectionCollapsed}>Section Hidden. Items Are Marked N/A If You Tapped Not Present.</Text>
            ) : activeSection.items.map((item) => {
              const key = fieldItemKey(activeSection.id, item.id);
              const selected = statusMap[key];
              return (
                <View key={key} style={styles.item}>
                  <Text style={styles.itemText}>{toTitleCase(item.label)}</Text>
                  {item.oshaRef ? <Text style={styles.ref}>{item.oshaRef}</Text> : null}
                  <View style={styles.statusRow}>
                    {(["pass", "fail", "na"] as const).map((status) => (
                      <Pressable
                        key={status}
                        onPress={() => setRowStatus(key, status)}
                        style={[styles.statusButton, selected === status ? styles.statusButtonActive : null]}
                      >
                        <Text style={selected === status ? styles.statusTextActive : styles.statusText}>{status.toUpperCase()}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {selected ? (
                    <Field
                      label="Notes"
                      value={notesMap[key] ?? ""}
                      onChangeText={(value) => setNotesMap((current) => ({ ...current, [key]: value }))}
                      placeholder="Observation detail, immediate action, responsible party"
                      multiline
                    />
                  ) : null}
                  <Button onPress={() => void addPhoto(key)} variant="secondary">
                    {(photoCounts[key] ?? 0) > 0 ? `Photo count ${photoCounts[key]}` : "Add photo evidence"}
                  </Button>
                </View>
              );
            })}
          </View>
        ) : null}

        {isLastSectionPage ? (
          <View style={styles.finalPage}>
            <Text style={styles.finalTitle}>Final Review</Text>
            <Text style={styles.finalText}>
              Signature Is Only Collected On The Last Page Of The Audit Report.
            </Text>
            <Field label="Signature" value={signature} onChangeText={setSignature} placeholder="Printed name" />
            <Button onPress={() => mutation.mutate()} disabled={mutation.isPending || !auditors || score.total < 1}>
              {mutation.isPending ? "Sending..." : "Send Audit for Review"}
            </Button>
          </View>
        ) : (
          <Button
            onPress={() => setSectionPage((page) => Math.min(page + 1, sectionCount - 1))}
            variant="secondary"
          >
            Next Section
          </Button>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  group: { gap: 8 },
  label: { color: theme.textStrong, fontSize: 13, fontWeight: "800" },
  dropdownButton: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  dropdownTitle: { color: theme.textStrong, fontSize: 15, fontWeight: "900" },
  dropdownMeta: { color: theme.muted, fontSize: 12, fontWeight: "700", marginTop: 3 },
  dropdownPanel: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.panelSoft, borderRadius: 12, padding: 8, gap: 6 },
  tradeRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10 },
  tradeRowActive: { borderColor: theme.primary, backgroundColor: theme.primarySoft },
  tradeRowText: { flex: 1 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" },
  checkboxActive: { borderColor: theme.primary, backgroundColor: theme.primary },
  checkboxText: { color: theme.white, fontWeight: "900", fontSize: 14 },
  tradeText: { color: theme.text, fontWeight: "800", fontSize: 12 },
  tradeTextActive: { color: theme.textStrong, fontWeight: "900", fontSize: 12 },
  tradeMeta: { color: theme.muted, fontWeight: "700", fontSize: 10, marginTop: 2 },
  scoreCard: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 10, padding: 12, gap: 4 },
  scoreTitle: { color: theme.textStrong, fontWeight: "900", fontSize: 17 },
  scoreText: { color: theme.muted, fontWeight: "700" },
  section: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.panelSoft, borderRadius: 12, padding: 12, gap: 12 },
  pageNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pageButton: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 9 },
  pageButtonDisabled: { opacity: 0.45 },
  pageButtonText: { color: theme.primary, fontWeight: "900", fontSize: 12 },
  pageCount: { color: theme.textStrong, fontWeight: "900", fontSize: 12 },
  sectionHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start", justifyContent: "space-between" },
  sectionHeaderText: { flex: 1, gap: 3 },
  sectionActions: { gap: 6, minWidth: 96 },
  sectionActionButton: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 8, alignItems: "center" },
  sectionActionText: { color: theme.primary, fontSize: 12, fontWeight: "900" },
  sectionCollapsed: { color: theme.muted, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10, fontWeight: "700" },
  sectionTitle: { color: theme.textStrong, fontWeight: "900", fontSize: 18 },
  sectionSub: { color: theme.muted, fontWeight: "700" },
  finalPage: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 12, padding: 12, gap: 12 },
  finalTitle: { color: theme.textStrong, fontSize: 18, fontWeight: "900" },
  finalText: { color: theme.muted, fontSize: 13, fontWeight: "700", lineHeight: 19 },
  item: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 10, padding: 12, gap: 10 },
  itemText: { color: theme.textStrong, fontSize: 15, fontWeight: "800", lineHeight: 21 },
  ref: { color: theme.primary, fontSize: 12, fontWeight: "800" },
  statusRow: { flexDirection: "row", gap: 8 },
  statusButton: { flex: 1, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 9, paddingVertical: 9, alignItems: "center" },
  statusButtonActive: { borderColor: theme.primary, backgroundColor: theme.primary },
  statusText: { color: theme.text, fontWeight: "900", fontSize: 12 },
  statusTextActive: { color: theme.white, fontWeight: "900", fontSize: 12 }
});
