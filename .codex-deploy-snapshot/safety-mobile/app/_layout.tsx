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
        <Stack.Screen name="permits/index" options={{ title: "Permits" }} />
        <Stack.Screen name="permits/new" options={{ title: "New Permit Request" }} />
        <Stack.Screen name="incidents/index" options={{ title: "Incidents" }} />
        <Stack.Screen name="incidents/new" options={{ title: "New Incident Report" }} />
        <Stack.Screen name="toolbox/index" options={{ title: "Toolbox Talks" }} />
        <Stack.Screen name="toolbox/new" options={{ title: "New Toolbox Talk" }} />
        <Stack.Screen name="training/index" options={{ title: "Training" }} />
        <Stack.Screen name="documents/index" options={{ title: "Documents" }} />
        <Stack.Screen name="reports/index" options={{ title: "Reports" }} />
        <Stack.Screen name="safety-intelligence/index" options={{ title: "Safety Intelligence" }} />
        <Stack.Screen name="jobsites/index" options={{ title: "Jobsites" }} />
      </Stack>
    </QueryClientProvider>
  );
}
