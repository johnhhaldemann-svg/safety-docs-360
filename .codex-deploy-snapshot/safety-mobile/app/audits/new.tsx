import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useMemo, useState } from "react";
import { Button, Field } from "@/components/Form";
import { PhotoEvidenceButton, SelectionDropdown, StatusBanner } from "@/components/Enterprise";
import { Screen } from "@/components/Screen";
import { createAudit, getAuditTemplates, getMe, signAudit, uploadAuditPhoto } from "@/api/mobile";
import { pickPhotoFromCamera, pickPhotoFromLibrary } from "@/utils/photos";
import type { ImagePickerAsset } from "expo-image-picker";
import { theme } from "@/theme";
import type { MobileCompany } from "@/types/mobile";

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

function buildMobileCompanies(companies?: MobileCompany[]) {
  if (companies && companies.length > 0) return companies;
  return [];
}

function statusButtonActiveStyle(status: AuditStatus) {
  if (status === "pass") return styles.statusButtonPass;
  if (status === "fail") return styles.statusButtonFail;
  return styles.statusButtonNa;
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
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [selectedJobsiteId, setSelectedJobsiteId] = useState("");
  const [jobsitePickerOpen, setJobsitePickerOpen] = useState(false);
  const [selectedTrades, setSelectedTrades] = useState<string[]>(["general_contractor"]);
  const [tradePickerOpen, setTradePickerOpen] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<string, AuditStatus>>({});
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [correctiveActionsMap, setCorrectiveActionsMap] = useState<Record<string, string>>({});
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
  const mobileCompanies = useMemo(() => buildMobileCompanies(data?.mobileCompanies), [data]);
  const selectedCompany = mobileCompanies.find((company) => company.id === selectedCompanyId) ?? mobileCompanies[0] ?? null;
  const companyJobsites = selectedCompany?.jobsites ?? [];
  const selectedJobsite = companyJobsites.find((jobsite) => jobsite.id === selectedJobsiteId) ?? companyJobsites[0] ?? null;
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
  const completionPercent = itemCount > 0 ? Math.round((score.total / itemCount) * 100) : 0;
  const activeSectionScored = activeSection
    ? activeSection.items.filter((item) => statusMap[fieldItemKey(activeSection.id, item.id)]).length
    : 0;
  const activeSectionPercent = activeSection?.items.length
    ? Math.round((activeSectionScored / activeSection.items.length) * 100)
    : 0;
  const failedItems = useMemo(() => {
    const rows: Array<{ key: string; label: string; action?: string }> = [];
    for (const section of combinedSections) {
      for (const item of section.items) {
        const key = fieldItemKey(section.id, item.id);
        if (statusMap[key] === "fail") {
          rows.push({ key, label: item.label, action: correctiveActionsMap[key] });
        }
      }
    }
    return rows;
  }, [combinedSections, correctiveActionsMap, statusMap]);
  const totalPhotos = Object.values(photoCounts).reduce((total, count) => total + count, 0);

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

  async function addPhotoFromCamera(key: string) {
    try {
      const nextPhoto = await pickPhotoFromCamera();
      if (!nextPhoto) return;
      setPhoto(nextPhoto);
      setPhotoCounts((current) => ({ ...current, [key]: (current[key] ?? 0) + 1 }));
    } catch (error) {
      Alert.alert("Photo failed", error instanceof Error ? error.message : "Could not add photo.");
    }
  }

  async function addPhotoFromLibrary(key: string) {
    try {
      const nextPhoto = await pickPhotoFromLibrary();
      if (!nextPhoto) return;
      setPhoto(nextPhoto);
      setPhotoCounts((current) => ({ ...current, [key]: (current[key] ?? 0) + 1 }));
    } catch (error) {
      Alert.alert("Photo failed", error instanceof Error ? error.message : "Could not choose photo.");
    }
  }

  function addPhoto(key: string) {
    Alert.alert("Add Photo Evidence", "Attach a photo for this checklist item.", [
      { text: "Take Photo", onPress: () => void addPhotoFromCamera(key) },
      { text: "Choose From Phone", onPress: () => void addPhotoFromLibrary(key) },
      { text: "Cancel", style: "cancel" }
    ]);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompany || !selectedJobsite) {
        throw new Error("Select the audit customer and audit job/location before submitting.");
      }
      const missingCorrectiveActions = Object.entries(statusMap)
        .filter(([, status]) => status === "fail")
        .map(([key]) => key)
        .filter((key) => !correctiveActionsMap[key]?.trim());
      if (missingCorrectiveActions.length > 0) {
        throw new Error("Corrective action is required for every failed audit item.");
      }
      const created = await createAudit({
        auditCustomerId: selectedCompany?.id ?? null,
        auditCustomerLocationId: selectedJobsite?.id ?? null,
        auditedCompanyName: selectedCompany?.name ?? null,
        jobsiteId: null,
        auditDate,
        auditors,
        hoursBilled,
        selectedTrade: selectedTrades[0] ?? "general_contractor",
        selectedTrades,
        templateSource: "field",
        status: "pending_review",
        statusMap,
        notesMap,
        correctiveActionsMap,
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
      subtitle="Complete the field checklist and send it to admin review."
      footer={sectionNav}
    >
      <StatusBanner
        title="AI + Admin Review"
        detail="Submitted audits are reviewed by AI for summary/corrections, then approved by a company admin before customer delivery."
        tone="info"
      />
      <View style={styles.form}>
        <View style={styles.auditHeaderCard}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardKicker}>Audit Header</Text>
              <Text style={styles.cardTitle}>Customer Location & Billing</Text>
            </View>
            <Text style={styles.reviewBadge}>Review Required</Text>
          </View>
          <SelectionDropdown
            label="Company Being Audited"
            value={selectedCompany?.name ?? "No company available"}
            open={companyPickerOpen}
            onToggle={() => setCompanyPickerOpen((open) => !open)}
            options={mobileCompanies.map((company) => ({ id: company.id, label: company.name }))}
            onSelect={(id) => {
              setSelectedCompanyId(id);
              setSelectedJobsiteId("");
              setCompanyPickerOpen(false);
            }}
          />
          <SelectionDropdown
            label="Audit Job / Location"
            value={selectedJobsite?.name ?? "No audit location"}
            open={jobsitePickerOpen}
            onToggle={() => setJobsitePickerOpen((open) => !open)}
            options={companyJobsites.map((jobsite) => ({ id: jobsite.id, label: jobsite.name, meta: jobsite.status ?? undefined }))}
            onSelect={(id) => {
              setSelectedJobsiteId(id);
              setJobsitePickerOpen(false);
            }}
          />
          <Field label="Audit Date" value={auditDate} onChangeText={setAuditDate} placeholder="YYYY-MM-DD" />
          <Field label="Auditor(s)" value={auditors} onChangeText={setAuditors} placeholder="Names, comma-separated" />
          <Field label="Hours Billed" value={hoursBilled} onChangeText={setHoursBilled} placeholder="0.00" keyboardType="decimal-pad" />
        </View>

        <View style={styles.auditHeaderCard}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardKicker}>Scope</Text>
              <Text style={styles.cardTitle}>Trades Observed</Text>
            </View>
            <Text style={styles.scopeCount}>{selectedTrades.length} Selected</Text>
          </View>
          <Pressable onPress={() => setTradePickerOpen((open) => !open)} style={styles.dropdownButton}>
            <Text style={styles.dropdownTitle}>
              {selectedTemplates.length === 1 ? toTitleCase(selectedTemplates[0]?.title) : `${selectedTemplates.length} Trades Selected`}
            </Text>
            <Text style={styles.dropdownMeta}>{tradePickerOpen ? "Tap to close" : "Tap to choose trades"}</Text>
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
                  <Text style={styles.checkboxText}>{selected ? "X" : ""}</Text>
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
        </View>

        <View style={styles.scoreCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.scoreTitleWrap}>
              <Text style={styles.cardKicker}>Progress</Text>
              <Text style={styles.scoreTitle}>{selectedTemplates.map((item) => toTitleCase(item.title)).join(" + ") || "Field Audit"}</Text>
            </View>
            <Text style={styles.complianceBadge}>{score.compliance == null ? "--" : `${score.compliance}%`}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${completionPercent}%` }]} />
          </View>
          <View style={styles.scoreGrid}>
            <ScoreMetric label="Sections" value={sectionCount} />
            <ScoreMetric label="Items" value={itemCount} />
            <ScoreMetric label="Scored" value={score.total} />
            <ScoreMetric label="Findings" value={score.fail} danger />
          </View>
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
                <View style={styles.sectionProgressTrack}>
                  <View style={[styles.sectionProgressFill, { width: `${activeSectionPercent}%` }]} />
                </View>
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
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemText}>{toTitleCase(item.label)}</Text>
                    {item.critical ? <Text style={styles.criticalBadge}>Critical</Text> : null}
                  </View>
                  {item.oshaRef ? <Text style={styles.ref}>Reference: {item.oshaRef}</Text> : null}
                  <View style={styles.statusRow}>
                    {(["pass", "fail", "na"] as const).map((status) => (
                      <Pressable
                        key={status}
                        onPress={() => setRowStatus(key, status)}
                        style={[
                          styles.statusButton,
                          selected === status ? statusButtonActiveStyle(status) : null
                        ]}
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
                  {selected === "fail" ? (
                    <Field
                      label="Required Corrective Action"
                      value={correctiveActionsMap[key] ?? ""}
                      onChangeText={(value) => setCorrectiveActionsMap((current) => ({ ...current, [key]: value }))}
                      placeholder="What must be corrected, who owns it, and when it is due"
                      multiline
                    />
                  ) : null}
                  <PhotoEvidenceButton count={photoCounts[key] ?? 0} onPress={() => addPhoto(key)} />
                </View>
              );
            })}
          </View>
        ) : null}

        {isLastSectionPage ? (
          <View style={styles.finalPage}>
            <Text style={styles.finalTitle}>Final Review</Text>
            <Text style={styles.finalText}>
              Review the audit results, add the final signature, and send the report to company admin review.
            </Text>
            <View style={styles.finalSummary}>
              <ScoreMetric label="Pass" value={score.pass} />
              <ScoreMetric label="Fail" value={score.fail} danger />
              <ScoreMetric label="N/A" value={score.na} />
              <ScoreMetric label="Photos" value={totalPhotos} />
            </View>
            {failedItems.length > 0 ? (
              <View style={styles.failedSummary}>
                <Text style={styles.failedTitle}>Failed Items Requiring Admin Review</Text>
                {failedItems.slice(0, 5).map((item) => (
                  <Text key={item.key} style={styles.failedText}>
                    {toTitleCase(item.label)} - {item.action?.trim() || "Corrective action required"}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={styles.finalText}>No failed checklist items recorded.</Text>
            )}
            <Field label="Signature" value={signature} onChangeText={setSignature} placeholder="Printed name" />
            <Button onPress={() => mutation.mutate()} disabled={mutation.isPending || !auditors || !signature || score.total < 1}>
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

function ScoreMetric({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, danger ? styles.metricDanger : null]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  group: { gap: 8 },
  label: { color: theme.textStrong, fontSize: 13, fontWeight: "800" },
  selectorGroup: { gap: 7 },
  selectorLabel: { color: theme.textStrong, fontSize: 13, fontWeight: "900" },
  auditHeaderCard: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 8, padding: 14, gap: 12 },
  cardHeaderRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  cardKicker: { color: theme.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
  cardTitle: { color: theme.textStrong, fontSize: 17, fontWeight: "900", marginTop: 3 },
  reviewBadge: { color: theme.warning, backgroundColor: theme.warningSoft, borderRadius: 999, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  scopeCount: { color: theme.accent, backgroundColor: theme.accentSoft, borderRadius: 999, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  dropdownButton: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  dropdownTitle: { color: theme.textStrong, fontSize: 15, fontWeight: "900" },
  dropdownMeta: { color: theme.muted, fontSize: 12, fontWeight: "700", marginTop: 3 },
  dropdownPanel: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.panelSoft, borderRadius: 12, padding: 8, gap: 6 },
  optionRow: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 10, gap: 2 },
  optionText: { color: theme.textStrong, fontWeight: "900", fontSize: 13 },
  optionMeta: { color: theme.muted, fontWeight: "700", fontSize: 11 },
  emptyText: { color: theme.muted, fontWeight: "700", padding: 8 },
  tradeRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10 },
  tradeRowActive: { borderColor: theme.primary, backgroundColor: theme.primarySoft },
  tradeRowText: { flex: 1 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" },
  checkboxActive: { borderColor: theme.primary, backgroundColor: theme.primary },
  checkboxText: { color: theme.white, fontWeight: "900", fontSize: 14 },
  tradeText: { color: theme.text, fontWeight: "800", fontSize: 12 },
  tradeTextActive: { color: theme.textStrong, fontWeight: "900", fontSize: 12 },
  tradeMeta: { color: theme.muted, fontWeight: "700", fontSize: 10, marginTop: 2 },
  scoreCard: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 8, padding: 14, gap: 12 },
  scoreTitleWrap: { flex: 1 },
  scoreTitle: { color: theme.textStrong, fontWeight: "900", fontSize: 17, marginTop: 3 },
  scoreText: { color: theme.muted, fontWeight: "700" },
  complianceBadge: { minWidth: 54, textAlign: "center", color: theme.success, backgroundColor: theme.successSoft, borderRadius: 8, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 8, fontSize: 14, fontWeight: "900" },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: theme.panel, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 999, backgroundColor: theme.primary },
  scoreGrid: { flexDirection: "row", gap: 8 },
  metric: { flex: 1, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.panelSoft, borderRadius: 8, padding: 9, gap: 2 },
  metricValue: { color: theme.textStrong, fontSize: 18, fontWeight: "900" },
  metricDanger: { color: theme.danger },
  metricLabel: { color: theme.muted, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  section: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.panelSoft, borderRadius: 8, padding: 12, gap: 12 },
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
  sectionProgressTrack: { height: 6, borderRadius: 999, backgroundColor: theme.surface, overflow: "hidden", marginTop: 6 },
  sectionProgressFill: { height: 6, borderRadius: 999, backgroundColor: theme.accent },
  finalPage: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 8, padding: 14, gap: 12 },
  finalTitle: { color: theme.textStrong, fontSize: 18, fontWeight: "900" },
  finalText: { color: theme.muted, fontSize: 13, fontWeight: "700", lineHeight: 19 },
  finalSummary: { flexDirection: "row", gap: 8 },
  failedSummary: { borderWidth: 1, borderColor: theme.warning, backgroundColor: theme.warningSoft, borderRadius: 9, padding: 11, gap: 6 },
  failedTitle: { color: theme.warning, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  failedText: { color: theme.textStrong, fontSize: 12, fontWeight: "800", lineHeight: 18 },
  item: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 8, padding: 12, gap: 10 },
  itemHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  itemText: { color: theme.textStrong, fontSize: 15, fontWeight: "800", lineHeight: 21, flex: 1 },
  criticalBadge: { color: theme.danger, backgroundColor: theme.dangerSoft, borderRadius: 999, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  ref: { color: theme.primary, fontSize: 12, fontWeight: "800" },
  statusRow: { flexDirection: "row", gap: 8 },
  statusButton: { flex: 1, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 9, paddingVertical: 9, alignItems: "center" },
  statusButtonActive: { borderColor: theme.primary, backgroundColor: theme.primary },
  statusButtonPass: { borderColor: theme.success, backgroundColor: theme.success },
  statusButtonFail: { borderColor: theme.danger, backgroundColor: theme.danger },
  statusButtonNa: { borderColor: theme.primary, backgroundColor: theme.primary },
  statusText: { color: theme.text, fontWeight: "900", fontSize: 12 },
  statusTextActive: { color: theme.white, fontWeight: "900", fontSize: 12 },
  evidenceButton: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.panelSoft, borderRadius: 8, padding: 12, gap: 4 },
  evidenceTitle: { color: theme.textStrong, fontWeight: "900", fontSize: 13 },
  evidenceMeta: { color: theme.primary, fontWeight: "800", fontSize: 12 }
});
