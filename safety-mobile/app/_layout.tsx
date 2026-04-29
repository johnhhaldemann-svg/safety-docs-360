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
      />
    </QueryClientProvider>
  );
}
