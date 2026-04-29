import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { theme } from "@/theme";

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.textStrong,
          headerTitleStyle: { fontWeight: "800" },
          contentStyle: { backgroundColor: theme.canvas }
        }}
      >
        <Stack.Screen name="index" options={{ title: "Safety360" }} />
        <Stack.Screen name="login" options={{ title: "Sign In" }} />
        <Stack.Screen name="dashboard" options={{ title: "Dashboard" }} />
        <Stack.Screen name="profile" options={{ title: "Profile" }} />
        <Stack.Screen name="jsa/index" options={{ title: "JSA" }} />
        <Stack.Screen name="jsa/new" options={{ title: "New JSA" }} />
        <Stack.Screen name="field-issues/index" options={{ title: "Field Issues" }} />
        <Stack.Screen name="field-issues/new" options={{ title: "New Field Issue" }} />
        <Stack.Screen name="audits/index" options={{ title: "Audits" }} />
        <Stack.Screen name="audits/new" options={{ title: "New Audit" }} />
      </Stack>
    </QueryClientProvider>
  );
}
