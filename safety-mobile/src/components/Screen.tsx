import { ReactNode } from "react";
import { router, usePathname } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  const pathname = usePathname();
  const showDock = pathname !== "/login" && pathname !== "/" && !footer;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
    >
      <View style={styles.backdropOne} />
      <View style={styles.backdropTwo} />
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            footer ? styles.contentWithFooter : null,
            showDock ? styles.contentWithDock : null,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={styles.header}>
            <View style={styles.headerGlow} />
            <View style={styles.headerTop}>
              <View style={styles.brandRow}>
                <View style={styles.brandMark}>
                  <Ionicons name="shield-checkmark" size={18} color={theme.white} />
                </View>
                <Text style={styles.kicker}>{eyebrow}</Text>
              </View>
              {headerAside ?? <Text style={styles.envPill}>Online</Text>}
            </View>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {children}
        </ScrollView>
        {showDock ? <BottomDock pathname={pathname} /> : null}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function BottomDock({ pathname }: { pathname: string }) {
  const items = [
    { href: "/dashboard", label: "Home", icon: "home-outline" },
    { href: "/jsa", label: "JSA", icon: "document-text-outline" },
    { href: "/field-issues", label: "Issues", icon: "warning-outline" },
    { href: "/audits", label: "Audits", icon: "reader-outline" },
    { href: "/safety-intelligence", label: "AI", icon: "bulb-outline" },
  ] as const;

  return (
    <View style={styles.dockWrap} pointerEvents="box-none">
      <View style={styles.dock}>
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Pressable
              key={item.href}
              onPress={() => router.push(item.href)}
              style={[styles.dockItem, active ? styles.dockItemActive : null]}
            >
              <View style={styles.dockItemInner}>
                <Ionicons name={item.icon} size={18} color={active ? theme.white : theme.primary} />
                <Text style={[styles.dockText, active ? styles.dockTextActive : null]}>{item.label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.canvas },
  safeArea: { flex: 1 },
  backdropOne: {
    position: "absolute",
    left: -80,
    top: -90,
    width: 230,
    height: 230,
    borderRadius: 230,
    backgroundColor: "#d9e9ff",
    opacity: 0.88,
  },
  backdropTwo: {
    position: "absolute",
    right: -90,
    top: 120,
    width: 200,
    height: 200,
    borderRadius: 200,
    backgroundColor: "#dff5ed",
    opacity: 0.76,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 18, gap: 14 },
  contentWithFooter: { paddingBottom: 116 },
  contentWithDock: { paddingBottom: 104 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    shadowColor: theme.shadowDeep,
    shadowOpacity: 1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -8 },
    elevation: 10,
  },
  header: {
    position: "relative",
    overflow: "hidden",
    gap: 10,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: theme.borderStrong,
    backgroundColor: theme.surfaceRaised,
    borderRadius: theme.radiusXl,
    padding: 18,
    shadowColor: theme.shadowStrong,
    shadowOpacity: 1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  headerGlow: {
    position: "absolute",
    right: -34,
    top: -40,
    width: 150,
    height: 150,
    borderRadius: 150,
    backgroundColor: theme.primarySoft,
  },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.shadowStrong,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
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
  kicker: { color: theme.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.3, textTransform: "uppercase", flexShrink: 1 },
  title: { color: theme.textStrong, fontSize: 28, fontWeight: "900", lineHeight: 33, flexShrink: 1 },
  subtitle: { color: theme.text, fontSize: 14, lineHeight: 21, fontWeight: "700", flexShrink: 1 },
  dockWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 18 : 12,
  },
  dock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: theme.borderStrong,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 24,
    padding: 7,
    shadowColor: theme.shadowDeep,
    shadowOpacity: 1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  dockItem: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  dockItemActive: {
    backgroundColor: theme.primary,
  },
  dockItemInner: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dockText: { color: theme.primary, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  dockTextActive: { color: theme.white },
});
