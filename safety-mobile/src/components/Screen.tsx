import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { theme } from "@/theme";

export function Screen({
  title,
  subtitle,
  children,
  eyebrow = "Safety360 Field",
  footer,
  headerAside
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  eyebrow?: string;
  footer?: ReactNode;
  headerAside?: ReactNode;
}) {
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, footer ? styles.contentWithFooter : null]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.kicker}>{eyebrow}</Text>
            {headerAside ?? <Text style={styles.envPill}>Online</Text>}
          </View>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.canvas },
  scroll: { flex: 1 },
  content: { padding: 14, gap: 14 },
  contentWithFooter: { paddingBottom: 116 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: theme.borderStrong,
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18
  },
  header: {
    gap: 8,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: theme.borderStrong,
    backgroundColor: theme.surface,
    borderRadius: 10,
    padding: 15,
    shadowColor: theme.shadowStrong,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  envPill: {
    color: theme.accent,
    backgroundColor: theme.accentSoft,
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  kicker: { color: theme.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, textTransform: "uppercase", flexShrink: 1 },
  title: { color: theme.textStrong, fontSize: 22, fontWeight: "900", flexShrink: 1 },
  subtitle: { color: theme.text, fontSize: 14, lineHeight: 20, fontWeight: "600", flexShrink: 1 }
});
