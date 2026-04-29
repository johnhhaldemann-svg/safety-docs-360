import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Button, Field } from "@/components/Form";
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
    <Screen title="Log in" subtitle="Use your existing Safety360Docs account. No public signup in this first version.">
      <View style={styles.card}>
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="name@company.com" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
        <Button onPress={submit} disabled={loading}>
          {loading ? "Logging in..." : "Log in"}
        </Button>
      </View>
      <Text style={styles.note}>Internet is required for version 1.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 14, padding: 16 },
  note: { color: theme.muted, fontSize: 13, textAlign: "center" }
});
