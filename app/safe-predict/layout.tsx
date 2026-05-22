import { SafePredictShell } from "@/components/safe-predict/SafePredictShell";
import { SafePredictDataProvider } from "@/components/safe-predict/SafePredictDataProvider";
import { GusAssistant } from "@/components/gus/GusAssistant";

export default function SafePredictLayout({ children }: { children: React.ReactNode }) {
  return (
    <SafePredictDataProvider>
      <SafePredictShell>{children}</SafePredictShell>
      <GusAssistant currentPage="SafePredict" />
    </SafePredictDataProvider>
  );
}
