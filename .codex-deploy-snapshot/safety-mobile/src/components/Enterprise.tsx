import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "@/theme";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export type SelectOption = { id: string; label: string; meta?: string };

export function AppCard({
  children,
  title,
  eyebrow,
  aside,
}: {
  children?: ReactNode;
  title?: string;
  eyebrow?: string;
  aside?: ReactNode;
}) {
  return (
    <View style={styles.card}>
      {title || eyebrow || aside ? (
        <View style={styles.cardHeader}>
          <View style={styles.headerText}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
          </View>
          {aside}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function SectionHeader({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
    </View>
  );
}

export function StatusBanner({
  title,
  detail,
  tone = "info",
  action,
}: {
  title: string;
  detail?: string;
  tone?: "info" | "success" | "warning" | "danger" | "neutral";
  action?: ReactNode;
}) {
  return (
    <View style={[styles.banner, bannerStyle(tone)]}>
      <View style={styles.headerText}>
        <Text style={[styles.bannerTitle, bannerTextStyle(tone)]}>{title}</Text>
        {detail ? <Text style={styles.bannerDetail}>{detail}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function LoadingState({ title = "Loading workspace..." }: { title?: string }) {
  return (
    <AppCard>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>Syncing with Safety360 Docs.</Text>
    </AppCard>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <AppCard>
      <Text style={styles.stateTitle}>{title}</Text>
      {detail ? <Text style={styles.stateText}>{detail}</Text> : null}
    </AppCard>
  );
}

export function ErrorState({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail?: string;
  onRetry?: () => void;
}) {
  return (
    <AppCard>
      <Text style={[styles.stateTitle, { color: theme.danger }]}>{title}</Text>
      {detail ? <Text style={styles.stateText}>{detail}</Text> : null}
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      ) : null}
    </AppCard>
  );
}

export function MetricTile({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "neutral" | "success" | "warning" | "danger" }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, metricTone(tone)]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function ModuleCard({
  title,
  detail,
  badge,
  onPress,
  tone = "primary",
  iconName = "apps-outline",
}: {
  title: string;
  detail: string;
  badge?: string;
  onPress: () => void;
  tone?: "primary" | "danger" | "success" | "neutral";
  iconName?: IoniconName;
}) {
  const iconColor = tone === "danger" ? theme.danger : tone === "success" ? theme.success : tone === "neutral" ? theme.textStrong : theme.primary;
  return (
    <Pressable onPress={onPress} style={styles.module}>
      <View style={[styles.moduleIcon, moduleTone(tone)]}>
        <Ionicons name={iconName} size={23} color={iconColor} />
      </View>
      <View style={styles.headerText}>
        <Text style={styles.moduleTitle}>{title}</Text>
        <Text style={styles.moduleDetail}>{detail}</Text>
      </View>
      {badge ? <Text style={styles.moduleBadge}>{badge}</Text> : null}
      <Ionicons name="chevron-forward" size={20} color={theme.primary} />
    </Pressable>
  );
}

export function SelectionDropdown({
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
  options: SelectOption[];
  onToggle: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.selectorGroup}>
      <Text style={styles.selectorLabel}>{label}</Text>
      <Pressable onPress={onToggle} style={styles.dropdownButton}>
        <View style={styles.headerText}>
          <Text style={styles.dropdownTitle}>{value}</Text>
          <Text style={styles.dropdownMeta}>{open ? "Tap to close" : "Tap to choose"}</Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={theme.primary} />
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

export function MultiSelect({
  label,
  selected,
  options,
  onToggle,
}: {
  label: string;
  selected: string[];
  options: Array<{ id: string; label: string }>;
  onToggle: (id: string) => void;
}) {
  return (
    <View style={styles.selectorGroup}>
      <Text style={styles.selectorLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const active = selected.includes(option.id);
          return (
            <Pressable key={option.id} onPress={() => onToggle(option.id)} style={[styles.choiceChip, active ? styles.choiceChipActive : null]}>
              <Text style={[styles.choiceChipText, active ? styles.choiceChipTextActive : null]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function PhotoEvidenceButton({
  count,
  selected,
  onPress,
}: {
  count?: number;
  selected?: boolean;
  onPress: () => void;
}) {
  const label = count && count > 0 ? `${count} attached` : selected ? "Photo selected" : "Take photo or choose from phone";
  return (
    <Pressable onPress={onPress} style={styles.evidenceButton}>
      <View style={styles.evidenceIcon}>
        <Ionicons name="camera-outline" size={22} color={theme.primary} />
      </View>
      <View>
        <Text style={styles.evidenceTitle}>Photo Evidence</Text>
        <Text style={styles.evidenceMeta}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.primary} />
    </Pressable>
  );
}

function bannerStyle(tone: "info" | "success" | "warning" | "danger" | "neutral") {
  if (tone === "success") return { backgroundColor: theme.successSoft, borderColor: "#94d3b1" };
  if (tone === "warning") return { backgroundColor: theme.warningSoft, borderColor: "#efc46f" };
  if (tone === "danger") return { backgroundColor: theme.dangerSoft, borderColor: "#f4a7a7" };
  if (tone === "neutral") return { backgroundColor: theme.panelSoft, borderColor: theme.borderStrong };
  return { backgroundColor: theme.infoSoft, borderColor: "#9bd2ef" };
}

function bannerTextStyle(tone: "info" | "success" | "warning" | "danger" | "neutral") {
  if (tone === "success") return { color: theme.success };
  if (tone === "warning") return { color: theme.warning };
  if (tone === "danger") return { color: theme.danger };
  if (tone === "neutral") return { color: theme.textStrong };
  return { color: theme.info };
}

function metricTone(tone: "neutral" | "success" | "warning" | "danger") {
  if (tone === "success") return { color: theme.success };
  if (tone === "warning") return { color: theme.warning };
  if (tone === "danger") return { color: theme.danger };
  return { color: theme.textStrong };
}

function moduleTone(tone: "primary" | "danger" | "success" | "neutral") {
  if (tone === "danger") return { backgroundColor: theme.dangerSoft };
  if (tone === "success") return { backgroundColor: theme.successSoft };
  if (tone === "neutral") return { backgroundColor: theme.panel };
  return { backgroundColor: theme.primarySoft };
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: theme.borderStrong,
    backgroundColor: theme.surface,
    borderRadius: 10,
    padding: 14,
    gap: 12,
    shadowColor: theme.shadowStrong,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: { color: theme.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
  cardTitle: { color: theme.textStrong, fontSize: 17, fontWeight: "900", marginTop: 2 },
  sectionHeader: { gap: 3, marginTop: 2 },
  sectionTitle: { color: theme.slate, fontSize: 12, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" },
  sectionDetail: { color: theme.muted, fontSize: 12, fontWeight: "700", lineHeight: 17 },
  banner: { borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  bannerTitle: { fontSize: 13, fontWeight: "900" },
  bannerDetail: { color: theme.text, fontSize: 12, lineHeight: 17, marginTop: 2, fontWeight: "700" },
  stateTitle: { color: theme.textStrong, fontSize: 16, fontWeight: "900" },
  stateText: { color: theme.text, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  retryButton: { marginTop: 2, borderWidth: 1, borderColor: theme.borderStrong, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  retryText: { color: theme.primary, fontWeight: "900", textTransform: "uppercase", fontSize: 12, letterSpacing: 0.5 },
  metric: { flexGrow: 1, flexBasis: "46%", borderWidth: 1, borderColor: theme.border, backgroundColor: theme.panelSoft, borderRadius: 9, padding: 12 },
  metricValue: { fontSize: 24, fontWeight: "900" },
  metricLabel: { color: theme.muted, fontSize: 10, fontWeight: "900", textTransform: "uppercase", marginTop: 4 },
  module: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  moduleIcon: { width: 42, height: 42, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  moduleTitle: { color: theme.textStrong, fontWeight: "900", fontSize: 15 },
  moduleDetail: { color: theme.muted, fontWeight: "700", fontSize: 12, lineHeight: 17, marginTop: 2 },
  moduleBadge: { color: theme.accent, backgroundColor: theme.accentSoft, borderRadius: 999, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  selectorGroup: { gap: 7 },
  selectorLabel: { color: theme.textStrong, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.4 },
  dropdownButton: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 10 },
  dropdownTitle: { color: theme.textStrong, fontSize: 14, fontWeight: "900" },
  dropdownMeta: { color: theme.muted, fontSize: 11, fontWeight: "700", marginTop: 2 },
  dropdownPanel: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.panelSoft, borderRadius: 10, padding: 8, gap: 6 },
  optionRow: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, gap: 2 },
  optionText: { color: theme.textStrong, fontWeight: "900", fontSize: 13 },
  optionMeta: { color: theme.muted, fontWeight: "700", fontSize: 11 },
  emptyText: { color: theme.muted, fontWeight: "700", padding: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceChip: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  choiceChipActive: { borderColor: theme.primary, backgroundColor: theme.primary },
  choiceChipText: { color: theme.text, fontSize: 12, fontWeight: "900" },
  choiceChipTextActive: { color: theme.white },
  evidenceButton: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.panelSoft, borderRadius: 9, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  evidenceIcon: { width: 38, height: 38, borderRadius: 8, backgroundColor: theme.primarySoft, alignItems: "center", justifyContent: "center" },
  evidenceTitle: { color: theme.textStrong, fontWeight: "900", fontSize: 13 },
  evidenceMeta: { color: theme.primary, fontWeight: "800", fontSize: 12, marginTop: 2 },
});
