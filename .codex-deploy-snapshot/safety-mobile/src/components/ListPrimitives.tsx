import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/theme";

export function RegisterAction({ href, label }: { href: Parameters<typeof Link>[0]["href"]; label: string }) {
  return (
    <Link style={styles.cta} href={href}>
      {label}
    </Link>
  );
}

export function RegisterRow({
  title,
  meta,
  badge,
  detail,
}: {
  title: string;
  meta: string;
  badge?: string;
  detail?: string;
}) {
  const tone = badgeTone(badge);
  return (
    <View style={styles.row}>
      <View style={[styles.rail, { backgroundColor: tone.color }]} />
      <View style={styles.rowHeader}>
        <Text style={styles.title}>{title}</Text>
        {badge ? (
          <Text style={[styles.badge, { color: tone.color, backgroundColor: tone.background }]}>
            {badge.replaceAll("_", " ")}
          </Text>
        ) : null}
      </View>
      <Text style={styles.meta}>{meta}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

function badgeTone(badge?: string) {
  const normalized = String(badge ?? "").toLowerCase();
  if (normalized.includes("pending")) return { color: theme.warning, background: theme.warningSoft };
  if (normalized.includes("open") || normalized.includes("active")) return { color: theme.info, background: theme.infoSoft };
  if (normalized.includes("submit") || normalized.includes("complete") || normalized.includes("closed")) {
    return { color: theme.success, background: theme.successSoft };
  }
  if (normalized.includes("fail") || normalized.includes("critical")) return { color: theme.danger, background: theme.dangerSoft };
  return { color: theme.primary, background: theme.primarySoft };
}

export const listStyles = StyleSheet.create({
  list: { gap: 10 },
  muted: { color: theme.muted, fontWeight: "700" },
});

const styles = StyleSheet.create({
  cta: {
    color: theme.white,
    backgroundColor: theme.primary,
    padding: 14,
    borderRadius: 10,
    fontWeight: "900",
    textAlign: "center",
    overflow: "hidden",
    textTransform: "uppercase",
  },
  row: {
    borderWidth: 1,
    borderColor: theme.borderStrong,
    backgroundColor: theme.surface,
    borderRadius: 10,
    padding: 14,
    gap: 8,
    overflow: "hidden",
  },
  rail: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  rowHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  title: { color: theme.textStrong, fontWeight: "900", fontSize: 15, flex: 1 },
  badge: {
    color: theme.primary,
    backgroundColor: theme.primarySoft,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  meta: { color: theme.muted, fontWeight: "700", fontSize: 12 },
  detail: {
    color: theme.text,
    backgroundColor: theme.panelSoft,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    overflow: "hidden",
    fontSize: 12,
    fontWeight: "700",
  },
});
