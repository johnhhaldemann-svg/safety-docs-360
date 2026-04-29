import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { Button, Field } from "@/components/Form";
import { AppCard, StatusBanner } from "@/components/Enterprise";
import { Screen } from "@/components/Screen";
import { login } from "@/api/mobile";
import { saveSession } from "@/auth/session";
import { theme } from "@/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const session = await login(email, password);
      await saveSession(session.accessToken, session.refreshToken);
      router.replace("/dashboard");
    } catch (error) {
      Alert.alert("Login failed", error instanceof Error ? error.message : "Check your email and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen title="Secure Sign In" subtitle="Use your existing Safety360 Docs company account.">
      <StatusBanner title="Login Required" detail="This app is public-listed, but field workflows require an approved platform account." tone="info" />
      <AppCard title="Company Field Access" eyebrow="Safety360 Field">
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="name@company.com" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
        <Button onPress={submit} disabled={loading}>
          {loading ? "Signing In..." : "Sign In"}
        </Button>
      </AppCard>
      <Text style={styles.note}>Internet is required for version 1.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { color: theme.muted, fontSize: 13, textAlign: "center", fontWeight: "700" }
});
