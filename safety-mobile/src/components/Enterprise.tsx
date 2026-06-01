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
      <View style={styles.cardAccent} />
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
      <View style={[styles.bannerIcon, bannerIconStyle(tone)]}>
        <Ionicons name={bannerIconName(tone)} size={18} color={bannerIconColor(tone)} />
      </View>
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
      <Text style={styles.stateText}>Syncing with SafePredict.</Text>
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
      <View style={[styles.metricSpark, metricSparkTone(tone)]} />
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
      <View style={[styles.moduleRail, moduleRailTone(tone)]} />
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

function bannerIconName(tone: "info" | "success" | "warning" | "danger" | "neutral"): IoniconName {
  if (tone === "success") return "checkmark-circle-outline";
  if (tone === "warning") return "alert-circle-outline";
  if (tone === "danger") return "close-circle-outline";
  if (tone === "neutral") return "shield-outline";
  return "information-circle-outline";
}

function bannerIconColor(tone: "info" | "success" | "warning" | "danger" | "neutral") {
  if (tone === "success") return theme.success;
  if (tone === "warning") return theme.warning;
  if (tone === "danger") return theme.danger;
  if (tone === "neutral") return theme.textStrong;
  return theme.info;
}

function bannerIconStyle(tone: "info" | "success" | "warning" | "danger" | "neutral") {
  if (tone === "success") return { backgroundColor: theme.successSoft };
  if (tone === "warning") return { backgroundColor: theme.warningSoft };
  if (tone === "danger") return { backgroundColor: theme.dangerSoft };
  if (tone === "neutral") return { backgroundColor: theme.panel };
  return { backgroundColor: theme.infoSoft };
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

function metricSparkTone(tone: "neutral" | "success" | "warning" | "danger") {
  if (tone === "success") return { backgroundColor: theme.success };
  if (tone === "warning") return { backgroundColor: theme.warning };
  if (tone === "danger") return { backgroundColor: theme.danger };
  return { backgroundColor: theme.primary };
}

function moduleTone(tone: "primary" | "danger" | "success" | "neutral") {
  if (tone === "danger") return { backgroundColor: theme.dangerSoft };
  if (tone === "success") return { backgroundColor: theme.successSoft };
  if (tone === "neutral") return { backgroundColor: theme.panel };
  return { backgroundColor: theme.primarySoft };
}

function moduleRailTone(tone: "primary" | "danger" | "success" | "neutral") {
  if (tone === "danger") return { backgroundColor: theme.danger };
  if (tone === "success") return { backgroundColor: theme.success };
  if (tone === "neutral") return { backgroundColor: theme.steel };
  return { backgroundColor: theme.primary };
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.borderStrong,
    backgroundColor: theme.surfaceRaised,
    borderRadius: theme.radiusLg,
    padding: 16,
    gap: 14,
    shadowColor: theme.shadowStrong,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 3,
  },
  cardAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: theme.primary,
    opacity: 0.82,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: { color: theme.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" },
  cardTitle: { color: theme.textStrong, fontSize: 18, fontWeight: "900", marginTop: 2, lineHeight: 23 },
  sectionHeader: { gap: 4, marginTop: 4, paddingHorizontal: 2 },
  sectionTitle: { color: theme.slate, fontSize: 12, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" },
  sectionDetail: { color: theme.muted, fontSize: 12, fontWeight: "700", lineHeight: 18 },
  banner: { borderWidth: 1, borderRadius: theme.radiusMd, padding: 13, flexDirection: "row", alignItems: "center", gap: 11 },
  bannerIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  bannerTitle: { fontSize: 13, fontWeight: "900", lineHeight: 18 },
  bannerDetail: { color: theme.text, fontSize: 12, lineHeight: 18, marginTop: 2, fontWeight: "700" },
  stateTitle: { color: theme.textStrong, fontSize: 16, fontWeight: "900" },
  stateText: { color: theme.text, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  retryButton: { marginTop: 2, borderWidth: 1, borderColor: theme.borderStrong, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  retryText: { color: theme.primary, fontWeight: "900", textTransform: "uppercase", fontSize: 12, letterSpacing: 0.5 },
  metric: { position: "relative", overflow: "hidden", flexGrow: 1, flexBasis: "46%", borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceRaised, borderRadius: theme.radiusMd, padding: 13, minHeight: 86 },
  metricSpark: { position: "absolute", right: 12, top: 12, width: 30, height: 5, borderRadius: 99, opacity: 0.9 },
  metricValue: { fontSize: 27, fontWeight: "900", lineHeight: 31 },
  metricLabel: { color: theme.muted, fontSize: 10, fontWeight: "900", textTransform: "uppercase", marginTop: 5, letterSpacing: 0.3 },
  module: { position: "relative", overflow: "hidden", minHeight: 72, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surfaceRaised, borderRadius: theme.radiusLg, padding: 13, flexDirection: "row", alignItems: "center", gap: 11, shadowColor: theme.shadow, shadowOpacity: 1, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 2 },
  moduleRail: { position: "absolute", left: 0, top: 12, bottom: 12, width: 4, borderTopRightRadius: 99, borderBottomRightRadius: 99 },
  moduleIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  moduleTitle: { color: theme.textStrong, fontWeight: "900", fontSize: 15, lineHeight: 20 },
  moduleDetail: { color: theme.muted, fontWeight: "700", fontSize: 12, lineHeight: 17, marginTop: 2 },
  moduleBadge: { color: theme.accent, backgroundColor: theme.accentSoft, borderRadius: 999, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  selectorGroup: { gap: 7 },
  selectorLabel: { color: theme.textStrong, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.4 },
  dropdownButton: { minHeight: theme.tap, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: theme.radiusMd, paddingHorizontal: 13, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  dropdownTitle: { color: theme.textStrong, fontSize: 14, fontWeight: "900" },
  dropdownMeta: { color: theme.muted, fontSize: 11, fontWeight: "700", marginTop: 2 },
  dropdownPanel: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.primaryTint, borderRadius: theme.radiusMd, padding: 8, gap: 7 },
  optionRow: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 11, gap: 2 },
  optionText: { color: theme.textStrong, fontWeight: "900", fontSize: 13 },
  optionMeta: { color: theme.muted, fontWeight: "700", fontSize: 11 },
  emptyText: { color: theme.muted, fontWeight: "700", padding: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceChip: { minHeight: 38, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  choiceChipActive: { borderColor: theme.primary, backgroundColor: theme.primary },
  choiceChipText: { color: theme.text, fontSize: 12, fontWeight: "900" },
  choiceChipTextActive: { color: theme.white },
  evidenceButton: { minHeight: 66, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.primaryTint, borderRadius: theme.radiusMd, padding: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  evidenceIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: theme.primarySoft, alignItems: "center", justifyContent: "center" },
  evidenceTitle: { color: theme.textStrong, fontWeight: "900", fontSize: 13 },
  evidenceMeta: { color: theme.primary, fontWeight: "800", fontSize: 12, marginTop: 2 },
});
