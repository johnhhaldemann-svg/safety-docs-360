import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Button, Field } from "@/components/Form";
import { AppCard, StatusBanner } from "@/components/Enterprise";
import { Screen } from "@/components/Screen";
import { login } from "@/api/mobile";
import { getFriendlyApiError } from "@/api/client";
import { saveSession } from "@/auth/session";
import { theme } from "@/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function submit() {
    setLoading(true);
    setErrorMessage("");
    try {
      const session = await login(email, password);
      await saveSession(session.accessToken, session.refreshToken);
      router.replace("/dashboard");
    } catch (error) {
      const message = getFriendlyApiError(error, "Check your email and password.");
      setErrorMessage(message);
      Alert.alert("Login failed", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      title="Sign In"
      subtitle="Use your existing Safety360 company account."
      footer={
        <View style={styles.footerActions}>
          <Button onPress={submit} disabled={loading}>
            {loading ? "Signing In..." : "Sign In"}
          </Button>
        </View>
      }
    >
      <View style={styles.brandPanel}>
        <View style={styles.brandIcon}>
          <Ionicons name="shield-checkmark" size={32} color={theme.white} />
        </View>
        <View style={styles.brandText}>
          <Text style={styles.brandKicker}>Safety360 Field</Text>
          <Text style={styles.brandTitle}>Field safety, synced to the platform.</Text>
        </View>
      </View>
      <AppCard title="Company Field Access" eyebrow="Safety360 Field">
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="name@company.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          returnKeyType="next"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          returnKeyType="done"
        />
      </AppCard>
      {errorMessage ? <StatusBanner title="Login Failed" detail={errorMessage} tone="danger" /> : null}
      <StatusBanner title="Login Required" detail="Field workflows require an approved platform account." tone="info" />
      <Text style={styles.note}>Internet is required for version 1.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footerActions: { gap: 10 },
  brandPanel: {
    borderWidth: 1,
    borderColor: theme.borderStrong,
    backgroundColor: theme.ink,
    borderRadius: theme.radiusXl,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: theme.shadowDeep,
    shadowOpacity: 1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  brandIcon: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: { flex: 1, minWidth: 0 },
  brandKicker: { color: "#9ec5ff", fontSize: 10, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
  brandTitle: { color: theme.white, fontSize: 21, lineHeight: 26, fontWeight: "900", marginTop: 4 },
  note: { color: theme.muted, fontSize: 13, textAlign: "center", fontWeight: "700" }
});
