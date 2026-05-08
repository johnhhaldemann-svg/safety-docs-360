import { SafePredictShell } from "@/components/safe-predict/SafePredictShell";
import { SafePredictDataProvider } from "@/components/safe-predict/SafePredictDataProvider";

export default function SafePredictLayout({ children }: { children: React.ReactNode }) {
  return (
    <SafePredictDataProvider>
      <SafePredictShell>{children}</SafePredictShell>
    </SafePredictDataProvider>
  );
}
