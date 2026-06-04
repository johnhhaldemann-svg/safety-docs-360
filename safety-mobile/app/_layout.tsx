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
          headerStyle: { backgroundColor: theme.surfaceRaised },
          headerTintColor: theme.textStrong,
          headerTitleStyle: { fontWeight: "900" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.canvas }
        }}
      >
        <Stack.Screen name="index" options={{ title: "Safety360", headerShown: false }} />
        <Stack.Screen name="login" options={{ title: "Sign In", headerShown: false }} />
        <Stack.Screen name="dashboard" options={{ title: "Dashboard", headerShown: false }} />
        <Stack.Screen name="profile" options={{ title: "Profile", headerShown: false }} />
        <Stack.Screen name="jsa/index" options={{ title: "JSA", headerShown: false }} />
        <Stack.Screen name="jsa/new" options={{ title: "New JSA" }} />
        <Stack.Screen name="field-issues/index" options={{ title: "Field Issues", headerShown: false }} />
        <Stack.Screen name="field-issues/new" options={{ title: "New Field Issue" }} />
        <Stack.Screen name="audits/index" options={{ title: "Audits", headerShown: false }} />
        <Stack.Screen name="audits/new" options={{ title: "New Audit" }} />
        <Stack.Screen name="permits/index" options={{ title: "Permits", headerShown: false }} />
        <Stack.Screen name="permits/new" options={{ title: "New Permit Request" }} />
        <Stack.Screen name="incidents/index" options={{ title: "Incidents", headerShown: false }} />
        <Stack.Screen name="incidents/new" options={{ title: "New Incident Report" }} />
        <Stack.Screen name="toolbox/index" options={{ title: "Toolbox Talks", headerShown: false }} />
        <Stack.Screen name="toolbox/new" options={{ title: "New Toolbox Talk" }} />
        <Stack.Screen name="training/index" options={{ title: "Training", headerShown: false }} />
        <Stack.Screen name="documents/index" options={{ title: "Documents", headerShown: false }} />
        <Stack.Screen name="reports/index" options={{ title: "Reports", headerShown: false }} />
        <Stack.Screen name="safety-intelligence/index" options={{ title: "Safety Intelligence", headerShown: false }} />
        <Stack.Screen name="jobsites/index" options={{ title: "Jobsites", headerShown: false }} />
      </Stack>
    </QueryClientProvider>
  );
}
