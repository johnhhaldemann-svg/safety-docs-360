import { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { theme } from "@/theme";

export function Screen({
  title,
  subtitle,
  children,
  footer
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, footer ? styles.contentWithFooter : null]}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Safety360 Field</Text>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.canvas },
  scroll: { flex: 1 },
  content: { padding: 18, gap: 16 },
  contentWithFooter: { paddingBottom: 112 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: theme.borderStrong,
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18
  },
  header: {
    gap: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "rgba(121,151,196,0.42)",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 18,
    padding: 18
  },
  kicker: { color: theme.primary, fontSize: 11, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase" },
  title: { color: theme.textStrong, fontSize: 28, fontWeight: "900" },
  subtitle: { color: theme.text, fontSize: 14, lineHeight: 20 }
});
